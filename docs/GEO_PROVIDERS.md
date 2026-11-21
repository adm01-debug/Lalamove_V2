# Como adicionar um provedor de mapa (HERE, TomTom, …)

> Contrato do `geo-gateway` e passos para plugar um terceiro provedor sem tocar no front.
> Referências: `supabase/functions/geo-gateway/providers/types.ts` (interface),
> `providers/mapbox.ts` (implementação de referência), `resolver.ts` (seleção/medição).

## O contrato

Todo provedor implementa `GeoProvider` (`providers/types.ts`):

| Campo | Papel |
|---|---|
| `name` | `'mapbox' \| 'google' \| …` — vai no header `X-Geo-Provider` e em `geo_usage.provider` |
| `geocode / reverse` | `GeocodeReq → GeoAddress[]`; sem resultado deve lançar `GEO_NOT_FOUND` (404) |
| `route` | `RouteReq → GeoRoute` (`polyline: GeoPoint[]`, `distance_m`, `duration_s`, `legs`) |
| `matrix` | `MatrixReq → GeoMatrix` (`durations_s`, `distances_m` NxN) |
| `static` | `StaticReq → GeoStaticImage` (`image`: URL ou data URL) |
| `snap` | `SnapReq → GeoSnapResult` (`points`, `confidence` **nunca null**, `geometry?`) |
| `isochrone / optimization / tilequery` | opcionais; ausente = função indisponível naquele provedor |

Regras válidas para qualquer provedor:
1. **Nunca** lançar erro cru: use as classes de `_shared` (`GEO_NOT_FOUND`, `GEO_RATE_LIMITED`
   com `retryAfter`, `GEO_UPSTREAM_ERROR`, `GEO_NOT_CONFIGURED`, `422` de validação).
2. **Nunca** devolver coordenada que será persistida sem o direito de retenção do provedor
   (ver M2 em `docs/MAPBOX.md`): a fonte da verdade é a cotação Lalamove.
3. `confidence`/campos numéricos devem ser sempre numéricos (`?? 0`) — a UI faz `* 100` e
   um `null` vira `NaN%`.
4. O provedor **não** decide preço nem cota: isso é `geo_price_list`/`geo_usage_month`.

## Passo a passo

1. **Criar o arquivo** `providers/<nome>.ts` exportando `new <Nome>Provider({ token, fetch, rateGuard })`.
   Copie a estrutura de `providers/mapbox.ts`: um único `fetch` injetável (testável), um
   `request()` central que traduz status HTTP → erro do contrato.
2. **Registrar em `geo-gateway/index.ts`**: adicionar ao mapa de `getProvider()` e incluir o
   nome em `PROVIDERS` para que `provider-status` reporte `configured`/`implemented`.
3. **Medição**: nada a fazer — `resolver.ts` grava `geo_usage_month` por `(provider, api)` e
   o preço vem de `geo_price_list`. Insira as linhas de preço do novo provedor nessa tabela.
4. **Política**: `geo_settings.provider` aceita o novo valor. O front **não muda**: a tela
   `/settings/maps` lê as funções do banco e o `useGeo` consome o gateway.
5. **Testes Deno** (`providers/<nome>.test.ts`): copie `mapbox.test.ts` — sucesso, 404, 429
   com `X-Rate-Limit-Reset`, 5xx, e um caso de payload parcial. Rode de dentro de
   `supabase/functions/geo-gateway/`: `deno test --allow-all`.
6. **Docs**: linha nova em `docs/MAPBOX.md` § paridade e no `docs/ci/MATRIZ_EDGE_TABELA.md`
   (regenerado por `node scripts/ci/gerar-matriz-edge-tabela.mjs`).

## Checklist de aceite de um provedor novo

- [ ] `provider-status` → `configured=true`, `implemented=true`
- [ ] geocode/reverse/route/matrix/static funcionando em `/map-tools`
- [ ] `geo_usage_month` com linhas do novo provedor após uma chamada de cada API
- [ ] `X-Geo-Cache: HIT` na segunda chamada idêntica
- [ ] 404 do provedor vira lista vazia no front (não erro na tela)
- [ ] `deno test --allow-all` verde e `vitest run src/hooks/__tests__` verde
- [ ] `docs/MAPBOX.md` e este arquivo atualizados
