# RUNBOOK — Google Maps Platform (operação)

> Complemento operacional de `docs/GOOGLE_MAPS.md`. Cada incidente tem sintoma, diagnóstico
> e ação. Sempre registre o que foi feito em `audit_log` ou no PR correspondente.
> O `geo-gateway` é único e agnóstico de provedor: trocar de provedor é configuração, não deploy.

## 1. Chave vazada (`GOOGLE_MAPS_SERVER_KEY` exposta)

**Sintoma:** erro 403 `PERMISSION_DENIED` / `API key not valid` em massa, ou consumo anômalo
em `geo_usage_month` e no painel "Faturamento" do Google Cloud; alerta `INTEGRATION_FAILURE`.

**Ação (ordem, sem pular):**
1. Google Cloud Console → **APIs e serviços → Credenciais** → desabilitar a chave imediatamente
   (não esperar a rotação; "Desabilitar" tem efeito em segundos, "Excluir" em minutos).
2. Criar a chave substituta **restrita** à API (Geocoding + Places + Routes + Static), sem
   restrição de IP se o runtime for edge (o IP de saída do Supabase não é fixo).
3. `supabase secrets set GOOGLE_MAPS_SERVER_KEY=<nova> --project-ref iecgydonctmabiijadsf`.
4. `supabase functions deploy geo-gateway --project-ref iecgydonctmabiijadsf --yes`
   — **o secret novo só é lido após redeploy**; a edge em execução mantém o valor antigo.
5. Confirmar: `provider-status` do gateway → `google.configured=true`; e um `geocode` real
   devolvendo `precision` não nulo.
6. Revisar `geo_usage_month` do mês contra o painel (etapa 95) para medir o dano.

**Nunca:** reaproveitar a chave revogada "só para testar". A chave de navegador
(`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`) é separada e **não** deve ser usada no servidor.

## 2. Orçamento estourado (Google bloqueado por cota)

**Sintoma:** HTTP 429 nos logs do gateway; `provider-status` mostra `budget.blocked=true` para
`google`; mapa continua servindo pelo Mapbox. O aviso proativo é o alerta `GEO_BUDGET_WARNING`
(disparado quando o gasto do mês cruza `alert_at_pct`, `geo-gateway/index.ts:177`).

**Ação:**
1. `/settings/maps` → conferir os cards de `geo_budget`. O bloqueio é por provedor, não global.
2. Funções no Google caem para o `fallback_provider` (Mapbox) automaticamente quando
   `geo_settings.<fn>.fallback_provider = 'mapbox'`. Se não houver fallback, a função fica `off`
   e o gateway responde 503 (`Provedor indisponível para <fn>`, `resolver.ts:107`).
3. Se o estouro veio de ETA (`matrix`), reduzir a cadência para 120 s ou trocar `matrix` para
   Mapbox — é o item que mais pesa (D9 do plano).
4. Só depois disso avaliar aumento do orçamento `geo_budget` e da cota no Google Cloud.
5. **Não** desligar `autocomplete`/`geocode`: são as funções que quebram a criação de pedido.

## 3. Google fora do ar (5xx / timeout)

**Sintoma:** gateway devolvendo `GEO_UPSTREAM_ERROR`; autocomplete vazio; rota/ETA parados.

**Ação:**
1. `/settings/maps` → mudar `autocomplete`, `geocode`, `reverse`, `route`, `matrix`, `static`
   para `mapbox` (ou `auto`). **Efeito em ≤ 60 s**, sem deploy — o resolver tem TTL de 60 s.
2. Verificar no painel [status.cloud.google.com](https://status.cloud.google.com/) se é regional.
3. `snap`, `isochrone`, `optimization` e `tilequery` **não têm equivalente no Google** e já
   respondem `GEO_NOT_SUPPORTED` (HTTP 501) — não são afetadas.
4. Ao normalizar, voltar as funções para `auto` (não para `google` fixo), para preservar o
   balanceamento por cota.

## 3b. Mapbox fora do ar (5xx / timeout)

**Sintoma:** todas as funções ainda em `mapbox` devolvem `GEO_UPSTREAM_ERROR`; `snap`,
`isochrone`, `optimization` e `tilequery` (sem equivalente Google) falham por completo.

**Ação:**
1. `/settings/maps` → mudar `autocomplete`, `geocode`, `reverse`, `route`, `matrix` e
   `static` para `google`. **Efeito em ≤ 60 s**, sem deploy.
2. Conferir [status.mapbox.com](https://status.mapbox.com/).
3. As 4 funções sem equivalente no Google **não têm contorno** — avisar o time que snapping
   e isócronas ficam indisponíveis até o Mapbox voltar.
4. O gateway já faz failover em runtime (`failoverFor`): se o primário está usável mas a
   chamada falha, ele tenta o `fallback_provider` declarado e depois o outro provedor do par.
   Com `auto` em produção a maioria dos incidentes se resolve sem intervenção manual.
5. Ao normalizar, voltar tudo para `auto`.

## 4. `computeRoutes` rejeitando `departureTime`

**Sintoma:** `400 INVALID_ARGUMENT — "Timestamp must be set to a future time"`; toda rota falha.

**Causa histórica (corrigida na PR #205):** o gateway enviava `new Date().toISOString()`, e a
hora chegava ao servidor do Google já no passado — a API rejeita `departureTime` retroativo.

**Ação:** não reintroduzir `departureTime` no `computeRoutes`. Omitido, a API usa "agora" com
`TRAFFIC_AWARE`. Trânsito futuro (`depart_at`) está fora de escopo até a etapa 50 do plano Mapbox.

## 5. `429` / `RESOURCE_EXHAUSTED` do Google

**Sintoma:** `GEO_RATE_LIMITED` com `retryAfter`; latência dispara; ETA congelado.

**Ação:**
1. Identificar a API no log. Limites locais por minuto em `GOOGLE_RATE_LIMITS`
   (`geo-gateway/index.ts:48`): `places_autocomplete` 600, `place_details` 600, `geocoding` 300,
   `routes_compute_routes` 300, `routes_matrix` 60, `static_maps` 600.
2. O `rateGuard` local (`geo-gateway/index.ts:125`) já espera a virada de janela antes de estourar;
   se ainda assim houver 429, a cota real do Google Cloud é menor que a constante configurada —
   ajustar `GOOGLE_RATE_LIMITS` e redeployar.
3. Se for `matrix`: reduzir a cadência do ETA (D9) antes de pedir aumento de cota.
4. Se for `autocomplete`: trocar a função para `mapbox` em `/settings/maps`.

## 6. `geo-gateway` responde `GEO_NOT_CONFIGURED`

**Sintoma:** todas as chamadas Google falham com 503 `GEO_NOT_CONFIGURED`, mas o Mapbox funciona.

**Ação:**
1. `supabase secrets list --project-ref iecgydonctmabiijadsf` → confirmar que
   `GOOGLE_MAPS_SERVER_KEY` existe (o nome é **exato**; `GOOGLE_MAPS_API_KEY` não é lido).
2. Se o secret foi criado agora, **redeployar** o `geo-gateway` (ver item 1, passo 4).
3. Confirmar que a chave está habilitada no projeto certo do Google Cloud e com as APIs
   necessárias ativas (Geocoding, Places, Routes, Static).

## 7. `geo_cache` servindo resposta antiga (campo novo ausente)

**Sintoma:** um campo recém-adicionado ao mapper aparece `null`/`undefined` só em endereços
antigos, enquanto endereços inéditos devolvem o valor correto.

**Causa:** coluna `response` guarda o JSON inteiro e o TTL do Google `geocode`/`reverse` é de
**30 dias** (`metering.ts`, `CACHE_TTL_S`). Campo novo no mapper não aparece em resposta cacheada.

**Ação:**
```sql
DELETE FROM geo_cache
WHERE provider = 'google' AND function = 'geocode'
  AND (response->0->>'<campo_novo>') IS NULL;
```
Repetir com `function = 'reverse'` se o mapper afetado for o de reverse. O `DELETE` é seguro:
o cache é descartável e a próxima chamada repopula.

**Atenção:** a coluna chama-se `function` — usar `fn` dá `42703`.

## 8. Fatura inesperada

1. `geo_usage_month` por (provider, function) × preço de `geo_price_list` → comparar com o
   painel de faturamento do Google Cloud (etapa 95, tolerância de 5 %).
2. Divergência > 5 %: revisar `geo_price_list` **e** conferir se alguma chamada está fora do
   cache (chave de cache mudando a cada request, ex.: parâmetro volátil no payload).
3. Conferir `geo_cache` hit rate: latência p50/p95 por provedor está na tela `/settings/maps`
   (etapa 80) — p95 alto com volume alto costuma ser cache miss.
4. Funções mais caras: Address Validation (US$ 17/1k — **desligada por D7**), Routes com
   trânsito, Static. Auditar `geo_budget` por provedor.
