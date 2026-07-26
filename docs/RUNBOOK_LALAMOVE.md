# Runbook — Integração Lalamove (v3 REST + UAPI)

> Etapa 29 do roteiro mestre. Procedimentos de plantão para as falhas mais
> prováveis da integração. Cada seção segue: **sintoma → diagnóstico → ação**.

## 0. Sinais que você deve olhar primeiro

| Sinal | Onde |
|---|---|
| Latência e erros por endpoint | `query_telemetry` (`operation = 'lalamove'`, `rpc_name` = ação) |
| Quota / rate limit | `lalamove_rate_limits` e a página **Quota Lalamove** |
| Alertas abertos | tabela `alerts`, `metadata->>'subtype'` |
| Correlação ponta a ponta | header `x-request-id` (gateway → proxy → log) |

Consulta rápida dos endpoints com pior saúde nas últimas 24 h:

```sql
select rpc_name as endpoint,
       count(*) as calls,
       count(*) filter (where severity = 'error') as errors,
       round(avg(duration_ms)) as avg_ms,
       max(duration_ms) as max_ms
from public.query_telemetry
where operation = 'lalamove'
  and created_at > now() - interval '24 hours'
group by 1
order by errors desc, avg_ms desc;
```

---

## 1. Sessão UAPI expirada (`ret = 10007`)

**Sintoma.** Painéis de histórico/financeiro/cupons mostram “Sessão UAPI
expirada”; alerta `CRITICAL` com `subtype = LALAMOVE_AUTH_FAILURE`.

**Diagnóstico.**

```sql
select user_fid, is_active, token_obtained_at,
       round(extract(epoch from (now() - token_obtained_at)) / 3600, 1) as idade_h
from public.lalamove_uapi_sessions
where is_active = true;
```

O refresh automático dispara com `idade_h > 20`. Idade acima de 24 h significa
que a janela de refresh foi perdida.

**Ação.**
1. Rodar a ação `refresh-token` da função `lalamove-uapi`.
2. Se retornar `10007` novamente, o refresh token morreu: é necessário um novo
   login manual na conta corporativa e regravar a sessão.
3. Confirmar recuperação chamando `user-info` e reconciliar os alertas abertos.

---

## 2. Janela de refresh perdida (token > 24 h)

**Causa comum.** `pg_cron` parado ou a Edge Function falhando em silêncio.

**Diagnóstico.** `select * from public.get_cron_jobs_health(20);` — procure
`failure_rate > 0` ou `last_run_started` antigo.

**Ação.** Reativar o job, executar o refresh manual (seção 1) e só então
liberar novas criações de pedido — pedidos criados sem sessão válida ficam
órfãos entre o nosso banco e a Lalamove.

---

## 3. WAF Argus bloqueando o proxy

**Sintoma.** Gateway devolve `502 Proxy error` com corpo HTML ou vazio; a
telemetria mostra `severity = 'error'` concentrada em **todas** as ações, não em
uma só.

**Diagnóstico.** Chamada direta ao proxy unificado com `x-request-id` novo. Se o
corpo não for JSON, é bloqueio de borda (Argus), não erro de negócio.

**Ação.**
1. Não repetir em loop — o WAF endurece o bloqueio com o volume.
2. Alternar para o proxy secundário (`LALAMOVE_UAPI_PROXY_URL`) enquanto durar.
3. Abrir chamado com o `request_id` e o horário exato do primeiro 502.

---

## 4. Cotação expirada (`ERR_QUOTATION_EXPIRED`)

A cotação vive **5 minutos**. Se o operador demora entre cotar e confirmar, a
criação falha.

**Ação.** Recotar automaticamente e reapresentar o preço antes de confirmar —
nunca reenviar o `quotationId` antigo.

---

## 5. Webhook com assinatura inválida / replay

**Sintoma.** Alerta `WEBHOOK_SIGNATURE_INVALID` (CRITICAL) ou
`WEBHOOK_REPLAY_REJECTED` (WARNING).

**Ação.**
- Assinatura inválida: `LALAMOVE_API_SECRET` está dessincronizado do provedor —
  não desabilite a validação HMAC como paliativo.
- Replay rejeitado: geralmente clock skew. Verifique o relógio do emissor antes
  de alargar a janela.

---

## 6. Pico de `ERR_*` em um único endpoint

**Diagnóstico.** A consulta da seção 0 isola `rpc_name`. Um pico restrito a
`quotation` costuma ser payload inválido (serviço/special request fora do
catálogo BR), não indisponibilidade.

**Ação.** Validar contra `src/lib/lalamoveCatalog.ts`; se a Lalamove mudou o
catálogo, atualizar o catálogo canônico **e** o teste de contrato.

---

## 7. Escalonamento

1. 0–15 min: plantão de operações (alerta multi-canal já dispara).
2. 15–60 min: engenharia de integração (este runbook).
3. > 60 min ou perda financeira: suporte corporativo Lalamove com a lista de
   `x-request-id` afetados.
