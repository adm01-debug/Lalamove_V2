# MAPBOX — Inventário e Referência (21/11/2026)

> Fonte canônica sobre a integração Mapbox no Lalamove V2.
> Plano detalhado: `claude/mapbox-x-lalamove-v2-plano-100-etapas-2026-11-21.md`

## Conta

- **Username:** `promobrindes`
- **Plano / cartão / limite:** NÃO VERIFICADO — acessar mapbox.com/account
- **Tokens existentes:** NÃO VERIFICADO — acessar mapbox.com/account/access-tokens
  (valores nunca neste arquivo; registrar apenas nome, prefixo, scopes e allowedUrls)

## Tokens a criar (etapas 2–3 do plano)

| Nome | Tipo | Scopes mínimos | Uso |
|---|---|---|---|
| `lalamove-v2-web` | `pk.` | `styles:read`, `fonts:read`, `styles:tiles` | Front-end via edge `get-mapbox-token` |
| `lalamove-v2-server` | `sk.` | Geocoding, Search Box, Directions, Matrix, Map Matching, Static Images, Isochrone | Edge `geo-gateway` (`MAPBOX_SERVER_TOKEN`) |
| `lalamove-v2-rotation` | `sk.` | `tokens:write`, `tokens:read` | Rotação automática (edge `geo-admin`, etapa 9) |

**`allowedUrls` do `pk.`:** `https://lalamove-v2.vercel.app`, `https://lalamove-v2-*.vercel.app`, domínio de produção, `http://localhost:*`.

## Secrets (etapa 4)

```
MAPBOX_ACCESS_TOKEN       # pk. — front-end via get-mapbox-token  (já existe)
MAPBOX_SERVER_TOKEN       # sk. — geo-gateway server-side          (a criar)
MAPBOX_TOKENS_API_TOKEN   # sk. com tokens:write — rotação         (a criar)
MAPBOX_USERNAME           # promobrindes                           (a criar)
```

Setar via: `supabase secrets set MAPBOX_SERVER_TOKEN=<valor> --project-ref iecgydonctmabiijadsf`

## O que pode e não pode (Termos de Uso — etapa 8)

- **Geocoding temporário** (`permanent=false`): **não pode ser retido**; só pode ser exibido junto com um mapa Mapbox na mesma sessão. Nunca salvar em `lalamove_orders` ou `lalamove_stops`.
- **Geocoding permanente** (`permanent=true`): pode ser persistido (US$ 5/1k, sem faixa grátis). Usar **somente** quando a Lalamove não retornar coordenadas na cotação.
- **Fonte da verdade de coordenadas:** `stops[].coordinates` da resposta da cotação Lalamove (`geocode_provider='lalamove'`). Mapbox temporário é só para sugestão visual.
- **Atribuição obrigatória:** "© Mapbox © OpenStreetMap" visível no mapa e em qualquer imagem estática exportada.
- **Search Box:** resultados válidos apenas dentro da sessão (`session_token`); proibido fora de um mapa Mapbox.

## Estado do código (21/11/2026)

| Componente | Arquivo | Estado |
|---|---|---|
| Token front | `supabase/functions/get-mapbox-token/index.ts` | ✅ `verify_jwt=true` declarado no `config.toml` |
| Proxy legado | `supabase/functions/mapbox-proxy/index.ts` | ⚠️ usa `pk.` como server token; a migrar para `geo-gateway` (etapa 61) |
| Gateway novo | `supabase/functions/geo-gateway/` | ✅ implementado em `main` (`index.ts`, `resolver.ts`, `polyline.ts`, `metering.ts`, `providers/mapbox.ts`, testes) |
| Hook front | `src/hooks/useMapbox.ts` | ⚠️ chama `mapbox-proxy` diretamente; migrar para `useGeo` (etapa 60) |
| Health check | `supabase/functions/check-external-api/index.ts:221` | ❌ bug: usa `MAPBOX_API_KEY` em vez de `MAPBOX_ACCESS_TOKEN` → sempre retorna `unknown` |
| Seletor visual | `src/hooks/useMapSettings.ts` | ⚠️ localStorage puro; não lê `geo_settings` do banco (etapa 66) |

## Cobertura BR do Search Box (etapa 36)

NÃO VERIFICADO — executar `scripts/geo/searchbox-coverage.ts` após criar `MAPBOX_SERVER_TOKEN`.

Critério de aceite: ≥ 90 % dos endereços com `accuracy ∈ {rooftop, parcel, point}` e distância ≤ 50 m do resultado Google.
Se reprovar: `geo_settings.autocomplete.config.mapbox_mode = 'geocoding'` → Geocoding v6 `autocomplete=true`.

## Custo estimado em regime (30 pedidos/dia ≈ 900/mês)

| SKU | Est./mês | Grátis | Custo |
|---|---|---|---|
| Map loads | ≤ 1.800 | 50.000 | US$ 0 |
| Directions | ≤ 900 | 100.000 | US$ 0 |
| Matrix elements | ≤ 63.000 | 100.000 | US$ 0 |
| Map Matching | ≤ 9.000 | 100.000 | US$ 0 |
| Static Images | ≤ 900 | 50.000 | US$ 0 |
| Search Box sessions | ≤ 900 | 2.500 | US$ 0 |
| **Total** | | | **US$ 0** |

Break-even: ~80 pedidos/dia → Search Box ultrapassa 2.500 sessões/mês (US$ 11,50/1k adicional).
Acima desse volume o modo `auto` deve desviar autocomplete para Google (US$ 2,83/1k) ou Geocoding v6 (100k grátis).

## Paridade ETA Google × Mapbox (etapa 51)

NÃO VERIFICADO — executar `scripts/geo/eta-parity.ts` após criar `MAPBOX_SERVER_TOKEN`.

## Decisões de arquitetura (M1–M10)

Ver `claude/mapbox-x-lalamove-v2-plano-100-etapas-2026-11-21.md` seção "Decisões embutidas".

## Rotação de token (Runbook — etapa 9)

1. Edge `geo-admin` action `rotate-mapbox-token` cria novo `sk.` com mesmos scopes via `POST /tokens/v2/promobrindes`
2. `supabase secrets set MAPBOX_SERVER_TOKEN=<novo>` via Management API
3. `DELETE /tokens/v2/promobrindes/<id-antigo>` após 10 minutos
4. Registrar em `audit_log`

Em emergência (token vazado): acessar mapbox.com/account/access-tokens → revogar imediatamente → executar rotação manual → atualizar secret no Supabase.
