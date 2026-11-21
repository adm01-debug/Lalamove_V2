# Achado: o `lalamove-gateway` aponta para um proxy que não existe

**Impacto:** todas as telas que consomem `useLalamove` (Configurações Lalamove, status,
carteira, veículos, áreas de serviço, token UAPI) estão **mortas em produção**.
O fluxo de pedido **não** é afetado — `NewOrderDialog` chama `lalamove-api` direto.

## Evidência

`supabase/functions/lalamove-gateway/index.ts:31-34`:

```ts
const TARGETS: Record<Target, { urlEnv: string; keyEnv: string }> = {
  unified: { urlEnv: 'LALAMOVE_UNIFIED_PROXY_URL', keyEnv: 'LALAMOVE_UNIFIED_PROXY_KEY' },
  uapi:    { urlEnv: 'LALAMOVE_UAPI_PROXY_URL',    keyEnv: 'LALAMOVE_UAPI_PROXY_KEY' },
};
```

Os secrets do projeto `iecgydonctmabiijadsf` (Management API, 21/11/2026) são 13 e
**nenhum** deles é `LALAMOVE_UNIFIED_PROXY_URL`, `LALAMOVE_UNIFIED_PROXY_KEY`,
`LALAMOVE_UAPI_PROXY_URL` ou `LALAMOVE_UAPI_PROXY_KEY`:

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEYS,
SUPABASE_SECRET_KEYS, SUPABASE_DB_URL, SUPABASE_JWKS, MAPBOX_ACCESS_TOKEN,
LALAMOVE_API_KEY, LALAMOVE_API_SECRET, LALAMOVE_MARKET, LALAMOVE_BASE_URL, LALAMOVE_UAPI_URL
```

Com a variável ausente, a edge devolve (linha ~257):
`500 {"error":"Configuração ausente para o destino \"unified\""}` — antes de qualquer
chamada à Lalamove.

Confirmado também que `lalamove.vehicles()`/`serviceAreas()` do front
(`src/lib/lalamove-api.ts:145-146`) vão para esse gateway, e que `LalamoveSettingsPage.tsx:53`
consome `useVehicles()`.

## Decisão pendente do dono (não executado)

O gateway foi escrito para um proxy externo (estilo `?key=…&action=…`) que não está
configurado — provavelmente desativado. Dois caminhos:

1. **Configurar os 4 secrets** se o proxy externo ainda existir (ninguém da sessão tem a URL).
2. **Aposentar o proxy**: traduzir as ações do gateway para as edges que já funcionam
   (`lalamove-api` para v3 — `cities/quote/order_*` — e `lalamove-uapi` para
   `user/wallet/vehicles/service_areas/refresh_token`). É uma camada de tradução de
   vocabulário (os nomes de ação divergem) — trabalho de uma sessão, com teste por ação.

Enquanto não for decidido, as telas de configuração continuam retornando 500.
