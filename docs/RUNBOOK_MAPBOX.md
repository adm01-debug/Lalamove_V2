# RUNBOOK — Mapbox (operação)

> Complemento operacional de `docs/MAPBOX.md`. Cada incidente tem sintoma, diagnóstico
> e ação. Sempre registre o que foi feito em `audit_log` ou no PR correspondente.

## 1. Token vazado (`sk.` ou `pk.` commitado / exposto)

**Sintoma:** uso anômalo em `geo_usage_month`, 401 em massa, alerta `INTEGRATION_FAILURE`.

**Ação (ordem, sem pular):**
1. `mapbox.com/account/access-tokens` → revogar o token imediatamente (não esperar rotação).
2. Criar substituto com os mesmos scopes mínimos (nunca `*:write` no `sk.` de runtime).
3. `supabase secrets set MAPBOX_SERVER_TOKEN=<novo> --project-ref iecgydonctmabiijadsf`.
4. Para `pk.`: `supabase secrets set MAPBOX_ACCESS_TOKEN=<novo>` (lido por `get-mapbox-token`).
5. Confirmar: `provider-status` do gateway → `mapbox.configured=true`; um pedido real
   autocompleta e o mapa carrega.
6. Revisar `geo_usage_month` do mês e comparar com a fatura (etapa 74).

**Nunca:** reaproveitar o token revogado "só para testar".

## 2. `429` persistente

**Sintoma:** respostas 429 em `/map-tools` ou ETA congelado; log do gateway com
`GEO_RATE_LIMITED` e `retryAfter`.

**Ação:**
1. Identificar a API no log (Directions 300/min, Matrix `driving-traffic` 30/min,
   Geocoding 1.000/min, Static 1.250/min, Map Matching 300/min, Search Box 10/s).
2. Se for Matrix com trânsito: reduzir a cadência do ETA para 120 s **ou** trocar a função
   `matrix` para perfil `driving` em `geo_settings` (60/min).
3. Se for autocomplete: `geo_settings.autocomplete` → `google` (ou `auto`) na tela
   `/settings/maps`; efeito em ≤ 60 s.
4. Só depois disso avaliar aumento de cota com a Mapbox.

## 3. Mapbox fora do ar (5xx/timeout)

**Sintoma:** gateway devolvendo `GEO_UPSTREAM_ERROR`; mapa/ETA parados.

**Ação:**
1. `/settings/maps` → `tiles`, `autocomplete`, `geocode`, `reverse`, `route`, `matrix` para
   `google` (ou `auto`) e salvar. Cache do `resolver` expira em 60 s — **sem deploy**.
2. Se o Google também estiver fora: `off` nas funções não essenciais e seguir com
   coordenadas da cotação Lalamove (fonte da verdade) para não travar pedidos.
3. Ao voltar: reverter para `mapbox` e conferir `geo_usage_month` (sem cobrança dupla).

## 4. Search Box sem cobertura no Brasil

**Sintoma:** autocomplete sem resultado para endereços BR válidos; `accuracy` baixa na
execução de `scripts/geo/searchbox-coverage.ts`.

**Ação:**
1. `geo_settings.autocomplete.config.mapbox_mode = 'geocoding'` → o gateway passa a usar
   Geocoding v6 `autocomplete=true` (100k grátis, cobra por tecla: debounce 300 ms e mínimo
   5 caracteres já estão no front).
2. Registrar o resultado da cobertura em `docs/MAPBOX.md` (etapa 36).

## 5. Fatura inesperada

**Sintoma:** cobrança acima de US$ 0 com volume dentro do previsto.

**Ação:**
1. `/settings/maps` → painel de uso, exportar CSV e comparar SKU por SKU com a fatura.
2. Suspeitos conhecidos: Search Box cobrado por **sessão** (sem `session_token` fecha a cada
   suggest), Matrix cobrado por **elemento** (sources × destinations), Static por imagem.
3. Divergência > 5 %: ajustar `geo_price_list` (etapa 74) e abrir PR com a tabela comparativa.
4. Ligar `geo_budget.mapbox.hard_stop=true` se o gasto passar de 70 % da cota grátis dois
   meses seguidos (etapa 73).

## 6. `geo-gateway` responde `GEO_NOT_CONFIGURED`

**Sintoma:** toda ação do gateway falha com "provedor não configurado".

**Ação:**
1. `provider-status` → checar `configured` por provedor.
2. Mapbox: secret `MAPBOX_SERVER_TOKEN` presente? (fallback `MAPBOX_ACCESS_TOKEN`).
3. Google: além do secret, o provedor precisa estar implementado — hoje o gateway só tem
   Mapbox (`implemented:false` para Google). A UI bloqueia a seleção nesse caso.
