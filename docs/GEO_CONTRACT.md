# Contrato de dados do motor geo

O motor geo (`geo_evaluate_tracking` → `geo_emit_event` → `alerts` + `job_queue`) **não
detecta motorista sozinho**. Ele reage a um `UPDATE` em `public.active_tracking`. Este
documento fixa o que o motor lê, o que ele grava e o que o produtor de posição precisa
garantir — sem isso o rastreamento fica mudo sem nenhum erro aparecer.

Etapa 41 do `PLANO_GOOGLE_MAPS_100_ETAPAS.md`.

---

## 1. O que o motor lê

### `public.active_tracking` (1 linha por pedido)

| Coluna | Tipo | Papel no motor |
| --- | --- | --- |
| `order_id` | `uuid NOT NULL UNIQUE` | Chave do rastreio. `UNIQUE` é o que garante **um** rastreio por pedido — o UPSERT do produtor depende disso. |
| `driver_id` | `uuid NOT NULL` | Usado nos alertas e nas métricas de rota. |
| `current_latitude` / `current_longitude` | `numeric` | **A posição que dispara tudo.** O trigger só roda quando uma destas duas muda. |
| `heading`, `speed` | `numeric` | `speed` alimenta o `is_stopped`; `heading` vai para o mapa. |
| `is_on_route`, `is_stopped`, `stopped_since` | `boolean` / `timestamptz` | Colunas de saída do motor (seção 2). |
| `eta_minutes` | `integer` | ETA vigente, sobrescrita pelo `eta_refresh`. |
| `last_updated` | `timestamptz NOT NULL DEFAULT now()` | **Guarda de idempotência**: o trigger ignora `NEW.last_updated <= OLD.last_updated`. |
| `tracking_status` | `text DEFAULT 'ACTIVE'` | Ver seção 4 (maiúsculo). |
| `eta_updated_at`, `eta_provider`, `route_provider`, `route_distance_m`, `route_duration_s`, `route_computed_at`, `distance_to_route_m`, `distance_to_next_stop_m`, `next_stop_index`, `near_stop_cycles`, `off_route_cycles` | vários | Métricas escritas pelo motor e pelo `job-worker` (migração `20261122130100`). |

### `public.lalamove_orders`

| Coluna | Papel |
| --- | --- |
| `lalamove_status` | Decide quando o rastreio nasce e quando morre (seção 3). |
| `driver_lalamove_id` | ID do motorista **na Lalamove** (numérico v3 ou `driver_fid` UAPI) — nunca o UUID de `drivers`. |
| `scheduled_at` | Base do cálculo de atraso (`ETA_DELAY`). |

---

## 2. O que o motor escreve

O trigger é **`BEFORE INSERT OR UPDATE OF current_latitude, current_longitude, eta_minutes,
next_stop_index`** (`20261122130100:530-533`) — roda antes de gravar, para as métricas
saírem na própria linha. A cada disparo com `last_updated` maior que o anterior:

1. `active_tracking` — `distance_to_route_m`, `distance_to_next_stop_m`, `is_on_route`,
   `near_stop_cycles`, `off_route_cycles`, `next_stop_index`.
2. `order_geo_events` — uma linha por `(order_id, event_type, stop_index)`. O
   `ON CONFLICT DO NOTHING` é a idempotência: o mesmo evento nunca dispara duas vezes.
3. `alerts` + `job_queue` — via `add_job('notification', …)` com `dedup_key`
   `geo:<order>:<event>:<stop>`.

**Consequência para o produtor:** reenviar a mesma posição é seguro (idempotente), mas
**não reenviar nada deixa o rastreamento mudo** — não existe varredura periódica que
invente posição.

---

## 3. Ciclo de vida do rastreio

| Evento em `lalamove_orders.lalamove_status` | Efeito esperado |
| --- | --- |
| `DRIVER_ASSIGNED` / `ON_GOING` | Linha de `active_tracking` criada (ou reaproveitada) com `tracking_status='ACTIVE'`; `job_queue` recebe `route_plan`. |
| `PICKED_UP` | Mesmo caminho; `next_stop_index` passa a apontar para a entrega. |
| `COMPLETED` / `CANCELED` | `tracking_status` sai de `ACTIVE` — o trigger para de avaliar e o mapa fecha. |

**Gap conhecido (verificado em 22/11/2026):** nenhuma edge cria a linha de
`active_tracking`. O `lalamove-webhook` em `DRIVER_LOCATION_UPDATED` faz
`select(...).maybeSingle()` e **só faz `update` quando a linha já existe**
(`lalamove-webhook/index.ts:571-588`) — se não existir, a posição é descartada em
silêncio, sem erro e sem log. `simulate-driver-movement` também só lê e atualiza.
Ou seja: hoje a linha depende de criação manual ou de outro produtor fora do repo, e é
por isso que `lalamove_uapi_sessions` e `active_tracking` podem ficar vazias enquanto o
webhook segue respondendo 200.

A correção é o produtor fazer UPSERT com `onConflict: 'order_id'` no primeiro
`DRIVER_LOCATION_UPDATED` de cada pedido. Fica registrado aqui porque não estava em
nenhuma etapa do plano — sem isso o motor geo é inalcançável na prática.

**Exigência para quem produz posição:** UPSERT (nunca `INSERT` puro) a cada ciclo de
10–15 s. `INSERT` esbarra no `UNIQUE(order_id)`; `UPDATE` que não toque em
`current_latitude`, `current_longitude`, `eta_minutes` nem `next_stop_index` não dispara
o trigger, porque a lista `OF` do `BEFORE UPDATE` é fechada nesses quatro campos.

Atenção: `BEFORE INSERT` também dispara. Um `INSERT` de rastreio novo já avalia eventos —
útil quando o pedido nasce dentro do raio da parada, mas significa que o primeiro INSERT
não pode vir com posição `null`.

---

## 4. Divergências conhecidas entre o plano e o código

Registradas aqui para o próximo agente não "corrigir" o que está certo nem confiar no
plano onde ele está errado.

| Plano diz | Código faz | Quem manda |
| --- | --- | --- |
| `tracking_status='active'\|'ended'` (minúsculo) | `'ACTIVE'` (default da coluna desde `20251224181640:33`, índice parcial em `:104`, trigger em `20261122130100:408`, `job-worker:531,679`) | **O código.** Usar `'ACTIVE'`; comparação é exata e case-sensitive. |
| `order_geo_events UNIQUE(order_id, event_type)` | `UNIQUE(order_id, event_type, stop_index)` | **O código.** Coleta e entrega do mesmo evento precisam coexistir no mesmo pedido. |
| Guard "só roda se `tracking_status IN ('active')`" | `IF NEW.tracking_status IS DISTINCT FROM 'ACTIVE' THEN RETURN NEW` (`:408`) | **O código.** Um valor nulo ou qualquer outro encerra o rastreio — fail-closed de propósito. |
| Trigger `AFTER UPDATE` | `BEFORE INSERT OR UPDATE OF current_latitude, current_longitude, eta_minutes, next_stop_index` (`:530-533`) | **O código.** `BEFORE` para gravar métricas na própria linha; a lista `OF` inclui ETA e parada, não só posição. |

---

## 5. Como conferir que está vivo

```sql
-- rastreios ativos e a última posição recebida
SELECT order_id, tracking_status, last_updated,
       now() - last_updated AS idade
FROM public.active_tracking
WHERE tracking_status = 'ACTIVE'
ORDER BY last_updated DESC;

-- eventos disparados nas últimas 24 h, com o status de entrega do aviso
SELECT order_id, event_type, stop_index, triggered_at, notification_status
FROM public.order_geo_events
WHERE triggered_at > now() - interval '24 hours'
ORDER BY triggered_at DESC;
```

`last_updated` parado há mais de 2 min num pedido `ON_GOING` significa que **o produtor
de posição parou**, não o motor geo.
