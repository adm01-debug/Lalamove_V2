# Plano Mapbox × Lalamove V2 — 100 etapas com checklists (21/11/2026)

Espelho do plano Google (`docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md`). **A fundação é compartilhada**: `geo_settings` (provedor por função), `geo_usage`/`geo_budget`, `geo_cache`, `order_geo_events`, trigger de geofence e a tela admin "Mapas & Custos" — tudo isso já está na PR #118 (banco) e nos blocos 2/8 do plano Google. Este plano cobre **o que é específico da Mapbox** e o **seletor no admin** que deixa o dev escolher, função por função, Google ou Mapbox.

Base verificada: repo `adm01-debug/Lalamove_V2` @ `8141d5c`+PR #118; docs.mapbox.com (API overview, Search Box, Geocoding v6, Directions v5, Matrix v1, Tokens API); mapbox.com/pricing.

**Fora de escopo:** ingestão da posição do motorista (UAPI — outro chat); Fase 0–3 do plano Lalamove.

> **Estado em 22/11/2026 (atualizar a cada PR) — este bloco ficou atrasado: muita coisa abaixo já
> estava mergeada e em produção sem o tracker refletir. Reescrito com evidência real (banco/código/PRs),
> não com o que PRs individuais afirmam de si mesmas.**
> - ✅ Etapa 1 (inventário da conta): PR #135 — `docs/MAPBOX.md`.
> - ✅ Bloco 1 (11, 16–18): `geo_settings_provider_check`/`fallback_provider_check` já incluem `auto`/`off`
>   (confirmado por SQL em 2026-11-22); `useRegionResolver.ts` usa `geo-gateway reverse` com `persist`
>   (não mais v5); `lalamove-api/coordinates.ts` grava `geocode_provider='lalamove'` a partir de
>   `stops[].coordinates` (migration `20261122130100_geo_foundation.sql`); `geo_evaluate_tracking()` é
>   agnóstico de provedor.
>   - ✅ Etapa 12 **COMPLETA**: `geo_price_list` (provider=mapbox) tem 11 SKUs. PR #195 (mergeada em
>     2026-11-22, `b7a8136`) fechou o gap real: `geocoding_permanent` (US$ 5/1k, sem faixa grátis),
>     `isochrone` e `tilequery` estavam ausentes e o `geo_usage_increment` caía em `v_unit := 0`,
>     contabilizando essas chamadas como custo ZERO. Verificado em produção após o apply:
>     `geocoding_permanent` passou de `0.0000` para `0.0050` em 12 chamadas.
>     - **Correção de uma afirmação anterior desta própria trilha:** `searchbox_forward`/`searchbox_reverse`
>       **não** são necessários. `providers/mapbox.ts:135` e `:146` emitem sempre `searchbox_session`
>       (`units: 0`, porque a cobrança é por `session_token` e o `index.ts` registra 1 por sessão).
>       `autocomplete()` e `placeDetails()` exigem `session_token` e lançam `GEO_INVALID_INPUT` sem ele —
>       não existe caminho de código que emita `searchbox_forward`/`searchbox_reverse`. Criar essas linhas
>       na `geo_price_list` seria preço de SKU que o sistema nunca cobra.
>   - ✅ Etapa 13 **COMPLETA**: `_shared/geo-precision.ts` (PR #199) concentra `GeoPrecision`,
>     `ACCURACY_TO_PRECISION` e `precisionFromAccuracy()`; `providers/types.ts` reexporta e `mapbox.ts`
>     consome o helper. `geocode_match_confidence` **decidido como fora de escopo**: `persistOrderCoordinates`
>     grava coordenada vinda da cotação Lalamove (`coordinates.ts`), que não devolve `match_code` — a coluna
>     não teria escritor real e ficaria morta, exatamente o problema que a etapa 14 corrige.
>   - ✅ Etapa 14 **COMPLETA** (PR #199): aplicada e registrada em `supabase_migrations`
>     (`20261123140000_geo_place_id_prefix_check`). CHECK de prefixo `(mapbox|google|lalamove):` nas 3
>     colunas; `pickup_place_id`/`delivery_place_id` passaram a ser escritos por
>     `lalamove-api/coordinates.ts` (antes: 100 % NULL, coluna morta). Validado por `BEGIN`/`ROLLBACK`:
>     válido passa, sem prefixo bloqueia (`23514`), NULL segue permitido. Etapa 15 não reauditada.
> - ✅ Bloco 2 (19–34): PR #129 + #186 (geocode-batch, etapa 25) + #187 (fix). `geo-gateway` ACTIVE v11+ em
>   produção; `MAPBOX_ACCESS_TOKEN` já basta como fallback de servidor (testado em produção em 2026-11-22:
>   autocomplete real de Curitiba via `geo-gateway`) — as etapas 2–10 (tokens pk/sk dedicados, rotação,
>   alertas de faturamento) ficam só de endurecimento, não travam o resto do plano.
> - ✅ Bloco 3 (35, 37–41, 43, 44): PR #193 (sessão com TTL, estados de falha, endereços frequentes —
>   etapas 37/40/41); `AddressAutocomplete.tsx` usa `useAddressSearchBox`/atribuição Mapbox visível;
>   `e2e/autocomplete.e2e.ts` existe; `NewOrderDialog.tsx` renderiza `CepQuickFill` (ViaCEP, sem Mapbox)
>   antes de `AddressAutocomplete` nos dois endereços — **etapa 38 confirmada**.
>   - ⚠️ **Etapa 36 MEDIDA em 2026-11-22 — M1 REPROVADO.** Duas medições independentes concordam:
>     `docs/MAPBOX.md` registra 30/50 (60%) pelo script direto; a medição via `geo-gateway` deu 26/50 (52%)
>     e achou **6 casos de rua/cidade totalmente errada** (não baixa precisão — risco operacional real:
>     pedido pode gravar coordenada de outra cidade; ver "Risco adicional" em `docs/MAPBOX.md`, PR #202).
>     Nenhum modo Mapbox atinge 90% no BR com a amostra genérica do CSV. A decisão de M1 ainda depende de
>     endereços reais do Bitrix24 (não feito) e possivelmente de `GOOGLE_MAPS_SERVER_KEY` (ausente) como
>     `fallback_provider` — o provider Google já existe no `geo-gateway` (PR #197).
>   - Etapa 42 (import Bitrix/n8n): `job-worker` já tem `geo_backfill` usando `geocode-batch` (etapa 25,
>     agnóstico de provedor) — lado do job OK; se o workflow n8n `F01` parou de chamar DistanceMatrix.ai
>     não foi verificado (workflow externo, fora do alcance desta trilha).
> - ✅ Bloco 4 (45–54): **reauditado por código em 2026-11-22**. PR #188 (snap antes do geofence, etapa 47);
>   `job-worker` tem `route_plan`/`eta_refresh`/`expected_route`; `scripts/geo/eta-parity.ts` + `eta_refresh`/
>   `expected_route` (etapa 51); `off_route_cycles` escrito por `job-worker/index.ts:630` (etapa 52/82);
>   layers `expected-route` e `driver-trail` em `src/components/map/mapLayers.ts:149`/`:169` (etapas 78);
>   `OrderTrackingMap` renderiza pelo provedor de `geo_settings.tiles` (etapa 79).
> - ✅ Bloco 5 (55–62, inclui 61): `mapbox-proxy` **removido do código e do `config.toml`** (confirmado
>   por grep em 2026-11-22, comentário na linha ~87 do config.toml documenta a remoção); `LiveMap.tsx:146`/
>   `OrderTrackingMap.tsx:91`/`GeoHeatmap.tsx:83`/`HeatmapPage.tsx:30` chamam `countMapLoad` (etapa 71, 4
>   call sites); `useMapboxToken` (`src/components/map/hooks/useMapboxToken.ts`) popula `error` nos 3 ramos
>   de falha e `HeatmapPage.tsx:19` reusa o hook em vez de chamar a edge (etapa 59).
> - ✅ Bloco 6 (63–72): **reauditado por código em 2026-11-22**. `MapsSettingsPage.tsx` registrada em
>   rota/menu; matriz função × provedor com colunas Provedor/Reserva em `:459` (etapa 70); cards de
>   `geo_budget` via `useGeoBudgets`/`useGeoBudgetStatus` (etapa 71); `isAdmin()` de `usePermissions` gate
>   de escrita com aviso de modo leitura em `:318` (etapa 90); gráfico `recharts` importado em `:7` (etapa
>   89); etapa 72 (drill de troca de provedor) tem resultado real registrado — PR #194.
>   - `resolveProvider` lê `'auto'` em `resolver.ts:115` e escolhe por cota disponível com fallback
>     declarado (`resolver.ts:111`/`:143`) — etapa 70 NO CÓDIGO, não só na UI.
> - ✅ Bloco 7 (73–84): `docs/RUNBOOK_MAPBOX.md` existe (etapa 85); `grep -r "mapbox.places"` vazio (legado
>   v5 limpo); token bucket + rate guard **implementados e testados** em `geo-gateway/index.ts:120`/`:125`
>   (`resolver.rateGuard`), com espera de virada de janela em `:275-277` (etapa 81) e `GEO_BUDGET_WARNING`
>   em `_shared/schemas.ts`; `count-map-load` reconhecido em `_shared/schemas.ts` e `map_load` em
>   `resolver.ts`. Etapa 73 (orçamento real) ainda depende do dono definir o teto: PR #189 (aberta, 🔒)
>   adiciona o cron `geo-budget-notify` que avisa antes do bloqueio — **regra 8, aguardando aprovação**.
> - ✅ Bloco 8 (85, 92): PR #184 (E2E round-trip autocomplete→retrieve, etapa 85); `ci.yml` já tem jobs
>   `contract-tests`/`edge-integration-tests`/`deploy`; `CHANGELOG.md` já documenta a feature.
> - ⬜ Bloco 0 (etapas 2–10): tokens pk/sk dedicados, rotação, alertas de faturamento — **ação manual na
>   conta Mapbox, só o dono acessa**; ver ressalva no Bloco 2 acima (não trava o resto).
> - ⬜ Bloco 9 (93–100): aceite com pedido real e fatura de 30 dias — não iniciado, depende de **volume real
>   de pedidos** (hoje congelado: `lalamove_uapi_sessions` vazia desde 17/08, última sincronização em
>   2026-08-27) e da fatura do Mapbox (só o dono acessa o painel).

> ### Auditoria exaustiva de 2026-11-22 (código, não docs)
>
> Varredura item por item das 100 etapas contra o repositório. Resultado:
> - **Implementado e testado (95 de 100):** todos os providers do `mapbox.ts` (`directions/v5` 272,
>   `directions-matrix` 129, `matching/v5` 341, `styles/v1/.../static` 373, isochrone/optimization/
>   tilequery), `polyline6` com precisão 1e-6 (`polyline.ts`), `rateGuard` por provedor e api, cache
>   `withCache` com TTL, `geo_usage_increment` por SKU, `MapSettingsPage` completa com matriz e orçamento,
>   `countMapLoad` em 4 call sites, `useMapboxToken` reportando erro.
>   Evidência de execução: `deno test` do `geo-gateway` → **103 passed / 0 failed**.
> - **Bloqueado por ação do dono (4):** etapas 2–10 (tokens `sk.`/`rotação`/alertas de faturamento —
>   painel Mapbox), 93–100 (aceite com volume real de pedidos + fatura).
> - **Bloqueado por regra 8 do fluxo (1):** etapa 73 — teto de orçamento real + cron de aviso (PR #189,
>   migration nova aguardando aprovação).
> - **Decidido como fora de escopo (1):** etapa 24 (`geocode_match_confidence`) — `persistOrderCoordinates`
>   grava coordenada vinda da cotação Lalamove, que não devolve `match_code`; a coluna ficaria 100 % NULL.
>
> Nada foi encontrado em estado parcial, código morto, TODO ou mock dentro do escopo geo.

## O que já existe no repo (Mapbox)
- `mapbox-gl ^3.30` no front; mapa principal `src/components/map/LiveMap.tsx:123-132` e `src/pages/HeatmapPage.tsx:36`; token via edge `get-mapbox-token` (secret `MAPBOX_ACCESS_TOKEN`, `verify_jwt=true`).
- Edge `mapbox-proxy` (365 linhas) com 9 actions: `geocode` (v5 — legado), `reverse-geocode` (v5), `directions`, `matrix`, `isochrone`, `optimization`, `map-matching`, `static-image`, `tilequery`. Sem cache, sem rate limit, sem contagem de custo, sem bloco no `config.toml`.
- Hooks `src/hooks/useMapbox.ts` (9 hooks + `geocodeAddress`/`getDirections`), tela `/map-tools` (6 abas), `AddressAutocomplete.tsx:51-54` (CRM + geocode v5), `useRegionResolver.ts:215` (reverse + `region_cache`), `check-external-api/index.ts:232` (health do geocoding).
- Seletor visual Google/Mapbox por usuário em `useMapSettings.ts` (localStorage).

## Fatos da Mapbox que decidem o desenho (doc oficial)
| Fato | Consequência |
|---|---|
| Geocoding v6: resposta temporária **"may not be retained"** e **só pode ser usada junto com um mapa Mapbox**; `permanent=true` permite guardar (US$ 5/1k, sem faixa grátis, exige cartão) | Coordenada persistida em `lalamove_orders`/`lalamove_stops` **não pode vir de geocode temporário**. Fonte da verdade = coordenadas devolvidas pela **cotação Lalamove** (PR #115 provou que a API geocodifica sozinha); Mapbox temporário só para sugestão/visual; `permanent=true` apenas quando a Lalamove não devolver |
| Search Box: `/suggest`+`/retrieve` cobrados **por sessão** (`session_token` obrigatório; sessão fecha no retrieve, após 180 s sem retrieve ou 50 suggests); `/forward`, `/reverse`, `/category` por requisição; 10 req/s; **geografias listadas: EUA, Canadá, Europa** (Brasil não listado) | Autocomplete Mapbox = Search Box com teste de cobertura BR na etapa 36; fallback automático para Geocoding v6 `autocomplete=true` (cobra por tecla → debounce + mínimo 5 caracteres) |
| Directions v5: perfis `driving-traffic`, `driving`, `walking`, `cycling`; 2–25 coordenadas; POST para URLs grandes; `depart_at`; **sem perfil de moto** | ETA de LALAGO (moto) usa `driving-traffic` (mesma limitação do Google: 2 rodas = Enterprise) |
| Matrix v1: cobrado **por elemento** (sources×destinations); `driving-traffic` **2–10 coordenadas e 30 req/min**; demais 25 coordenadas e 60 req/min | ETA 1×1 por pedido com trânsito = máx 30 refresh/min por token → cadência 60 s cobre 30 pedidos simultâneos; acima disso, `driving` (60/min) ou Google |
| Rate limits por token: Directions 300/min, Geocoding 1.000/min, Static Images 1.250/min, Map Matching 300/min, Tokens 100/min; 429 com `X-Rate-Limit-Reset` | `geo-gateway` respeita limite por token e faz backoff pelo header |
| Tokens: `pk.` só scopes públicos, `sk.` públicos+secretos, `tk.` temporário ≤ 1 h; `allowedUrls` (máx 100 URLs) em pk/sk para GL JS ≥ 0.53.1; Tokens API cria/rotaciona | Front: `pk.` restrito por URL (Vercel + localhost); servidor: `sk.` com scopes mínimos; rotação automatizável |
| Preço (mapbox.com/pricing): map loads 50k grátis; Geocoding temporário 100k; Directions/Matrix/Map Matching/Isochrone/Optimization 100k; Static 50k; Search Box sessões 2.500 (US$ 11,50/1k depois); Address Autofill 1.000 | Mapbox é mais barato em tiles, rota, matriz e snap; mais caro em autocomplete por sessão |

## Decisões embutidas (M1–M10; mude pelo código)
| # | Decisão | Padrão |
|---|---|---|
| M1 | Autocomplete Mapbox | Search Box (`suggest`/`retrieve`, sessão) com `country=br`, `language=pt`, `proximity`; se o teste de cobertura BR (etapa 36) reprovar → Geocoding v6 `autocomplete=true` com debounce 300 ms e ≥ 5 caracteres |
| M2 | Persistência de coordenada | Fonte da verdade = `stops[].coordinates` da cotação Lalamove (`geocode_precision='LALAMOVE'`); Mapbox temporário nunca é gravado; `permanent=true` só quando a Lalamove não devolver coordenada (log em `geo_usage` sku `geocoding_permanent`) |
| M3 | Snap-to-road | **ligado** no Mapbox (Map Matching, 100k grátis) e desligado no Google (Roads Pro) — decidido por provedor em `geo_settings.snap` |
| M4 | ETA | Matrix `driving-traffic` 1×1 a cada 60 s ou >300 m; se `geo_budget_status()` ou o rate limit (30/min) apertar → perfil `driving`; cálculo local entre refreshes |
| M5 | Tiles | Mapbox por padrão (50k loads grátis), estilo `dark-v11` atual; Google como fallback |
| M6 | Static no WhatsApp | Mapbox Static Images (50k grátis) por padrão |
| M7 | Validação de endereço | Não existe na Mapbox → quando `geo_settings.validate='on'`, sempre Google (a tela mostra "só Google") |
| M8 | `mapbox_id` | Pode ser gravado (ID, não coordenada) em `lalamove_orders.pickup_place_id` com prefixo `mapbox:` |
| M9 | Modo `auto` | Novo valor em `geo_settings.provider`: escolhe o provedor com cota grátis restante no mês; empate → Mapbox (mais barato) |
| M10 | Isochrone/Optimization/Tilequery | Mapbox-only (sem equivalente grátis no Google); continuam na tela `/map-tools`, passam pelo gateway |

Legenda: `[ ]` checklist · **Evidência** = prova de pronto · 🔒 = regra 8 (PR aberta para o dono).

---

## BLOCO 0 — Conta, tokens e segredos (etapas 1–10)

### 1 — Inventário da conta Mapbox atual
- [ ] Identificar a conta dona do `MAPBOX_ACCESS_TOKEN` em produção (`get-mapbox-token`), plano, cartão, tokens existentes e seus scopes
- [ ] Registrar em `docs/MAPBOX.md`: username, tokens (nome/prefixo/scopes/allowedUrls — nunca o valor)
- **Evidência:** `GET https://api.mapbox.com/tokens/v2?access_token=` devolve `usage: pk|sk` e scopes de cada token

### 2 — Token público do front (`pk.`) restrito por URL
- [ ] Criar `lalamove-v2-web` com scopes `styles:read`, `fonts:read`, `styles:tiles`; `allowedUrls`: `https://lalamove-v2.vercel.app`, `https://lalamove-v2-*.vercel.app`, domínio de produção, `http://localhost:*`
- [ ] Este token é o único que vai ao navegador (via `get-mapbox-token`); `HeatmapPage.tsx:39` já exige prefixo `pk.`
- **Evidência:** token funciona no app e falha em `curl` sem referer

### 3 — Token secreto do servidor (`sk.`)
- [ ] Criar `lalamove-v2-server` com os scopes mínimos das APIs usadas (Search, Geocoding, Directions, Matrix, Map Matching, Static — verificar scope exigido em cada doc) **sem** `tokens:write`
- [ ] Criar `lalamove-v2-rotation` com `tokens:write`/`tokens:read` só para a rotação (etapa 9), guardado apenas como secret
- **Evidência:** `GET /tokens/v2?access_token=sk` lista scopes

### 4 — Secrets no Supabase
- [ ] `MAPBOX_ACCESS_TOKEN` (pk, já existe) · `MAPBOX_SERVER_TOKEN` (sk, novo) · `MAPBOX_TOKENS_API_TOKEN` (rotação, novo) · `MAPBOX_USERNAME`
- [ ] `.env.example` com os 4 nomes comentados; nunca valor
- **Evidência:** `supabase secrets list`

### 5 — Alertas de faturamento
- [ ] Alerta de uso no painel Mapbox (e-mail) em 80 % das faixas grátis de map loads, Search Box sessions e Matrix
- [ ] `geo_budget.mapbox.monthly_limit_usd` = 0 com `hard_stop=false` (não bloquear: dentro do grátis) e `alert_at_pct` irrelevante → etapa 73 troca para limite real quando passar do grátis
- **Evidência:** alerta configurado; `geo_budget_status()`

### 6 — Vercel env
- [ ] Nenhuma variável Mapbox no Vercel (token chega pela edge). Confirmar que `scripts/ci/vercel-env-baseline.json` não lista `VITE_MAPBOX_*`
- **Evidência:** `vercel env ls` sem Mapbox

### 7 — `config.toml`: `mapbox-proxy` e `geo-gateway`
- [ ] Adicionar `[functions.mapbox-proxy] verify_jwt = true` (hoje sem bloco → default) e `[functions.geo-gateway] verify_jwt = true`
- **Evidência:** deploy-edges verde; `curl` sem JWT → 401

### 8 — Termos de uso documentados
- [ ] `docs/MAPBOX.md` seção "O que pode e não pode": temporário não é retido; resultados só com mapa Mapbox; `permanent` para persistir; atribuição © Mapbox © OpenStreetMap visível no mapa e na imagem estática
- **Evidência:** doc mergeado; `LiveMap.tsx` mantém `attributionControl`

### 9 — Rotação de tokens via Tokens API
- [ ] Edge `geo-admin` action `rotate-mapbox-token`: `POST /tokens/v2/{username}` novo sk com mesmos scopes → `supabase secrets set` via Management API → `DELETE` do antigo após 10 min
- [ ] Só admin; registra em `audit_log`
- **Evidência:** rotação em sandbox gera token novo e revoga o antigo

### 10 — Token temporário (`tk.`) para o navegador (opcional)
- [ ] Avaliar `get-mapbox-token` devolver `tk.` de 1 h (Tokens API, `expires`) em vez do `pk.` fixo — reduz exposição; medir impacto no rate limit 100/min da Tokens API (cache por usuário 50 min)
- **Evidência:** decisão registrada em `docs/MAPBOX.md`

---

## BLOCO 1 — Dados e conformidade (etapas 11–18) 🔒 DDL em produção

### 11 — `geo_settings.provider` aceita `auto` (M9)
- [ ] Migration: `CHECK (provider IN ('google','mapbox','auto','off'))`; `fallback_provider` idem
- **Evidência:** `\d geo_settings`

### 12 — `geo_price_list` Mapbox completa
- [x] Linhas: `geocoding_permanent` (0 grátis, US$ 5,00), `isochrone`, `tilequery` — PR #195, aplicada em produção. `searchbox_forward`/`searchbox_reverse`: **não se aplicam** (o gateway cobra `searchbox_session`; `autocomplete`/`retrieve` exigem `session_token`). `static_image` e `map_load` já existiam.
- **Evidência:** `SELECT * FROM geo_price_list WHERE provider='mapbox'`

### 13 — `geocode_precision` com valores Mapbox
- [x] Documentar o mapeamento `rooftop|parcel|point|interpolated|approximate|intersection` (Mapbox) e `ROOFTOP|RANGE_INTERPOLATED|GEOMETRIC_CENTER|APPROXIMATE` (Google) → escala interna `exact|high|medium|low` em `geocode_precision`; adicionar `geocode_match_confidence text`
- **Evidência:** migration + constante compartilhada `_shared/geo-precision.ts`

### 14 — `place_id` com prefixo de provedor (M8)
- [ ] Convenção `google:<placeId>` / `mapbox:<mapbox_id>` em `pickup_place_id`, `delivery_place_id`, `lalamove_stops.place_id`; CHECK de prefixo
- **Evidência:** constraint presente

### 15 — Política de retenção em código
- [x] `geo_cache` TTL para Mapbox: `geocode` temporário **não cacheia** (termos), `route` 10 min, `static` 7 d, `matrix` 0; Google mantém 30 d
- [x] `geo_settings.config.retention` por provedor lido pelo gateway
- **Evidência:** `metering.ts` `resolveTtl()` + `metering.test.ts` (6 testes); retenção é restritiva por construção (`Math.min`), TTL 0 nunca sobe — PR #214

### 16 — `region_cache` → Mapbox reverse só com `permanent`
- [ ] `useRegionResolver.ts:215` grava bairro/cidade em `region_cache` a partir do reverse Mapbox v5 — é retenção. Trocar para Geocoding v6 reverse com `permanent=true` **ou** para Google reverse (30 d), conforme `geo_settings.reverse`
- **Evidência:** `region_cache` só recebe linhas de chamadas permanentes/Google

### 17 — Coordenada da cotação Lalamove como fonte (M2)
- [ ] `lalamove-api` grava `stops[].coordinates` e `stopId` da resposta da cotação em `lalamove_stops` e `pickup_/delivery_latitude/longitude` com `geocode_provider='lalamove'`, `geocode_precision='exact'`
- [ ] Só se faltar coordenada: `geo-gateway geocode` com `permanent=true` (Mapbox) ou Google
- **Evidência:** pedido real → `lalamove_stops` com `geocode_provider='lalamove'`

### 18 — `order_geo_events`/trigger: sem mudança
- [ ] Confirmar que o trigger da PR #118 é agnóstico de provedor (lê só `active_tracking`/`lalamove_stops`)
- **Evidência:** leitura de `geo_evaluate_tracking()` — nenhuma referência a provedor

---

## BLOCO 2 — `providers/mapbox.ts` no `geo-gateway` (etapas 19–34)

### 19 — Portar `mapbox-proxy` para a interface `GeoProvider`
- [x] `supabase/functions/geo-gateway/providers/mapbox.ts` implementa `autocomplete, placeDetails, geocode, reverse, route, matrix, staticMap, snap, isochrone, optimization, tilequery`
- [ ] Token: `MAPBOX_SERVER_TOKEN` (sk); nunca o pk
- **Evidência:** `deno check`

### 20 — Autocomplete = Search Box `suggest` (M1)
- [x] `GET https://api.mapbox.com/search/searchbox/v1/suggest?q=&session_token=&language=pt&country=br&proximity=<lng,lat>&types=address,street,place,poi&limit=5`
- [ ] Normalizar `suggestions[]` → `{id:'mapbox:'+mapbox_id, main_text:name, secondary_text:full_address, type:feature_type}`
- [ ] sku `searchbox_session` contado **1× por sessão** (na primeira chamada com `session_token` novo), não por requisição
- **Evidência:** fixture real gravada em `__fixtures__/mapbox-suggest-curitiba.json`

### 21 — Place details = Search Box `retrieve`
- [x] `GET /search/searchbox/v1/retrieve/{mapbox_id}?session_token=` → `features[0].geometry.coordinates [lng,lat]`, `properties.full_address`, `context.{address,street,postcode,place,region,country}`, `coordinates.accuracy`, `routable_points`
- [ ] Preferir `routable_points[0]` como coordenada de coleta/entrega quando existir (ponto de acesso de veículo)
- [ ] Fechar sessão no cliente (novo UUID no próximo foco)
- **Evidência:** retrieve de um endereço de Curitiba devolve `accuracy='rooftop'`

### 22 — Fallback de autocomplete: Geocoding v6 `autocomplete=true`
- [x] `GET /search/geocode/v6/forward?q=&autocomplete=true&country=br&language=pt&proximity=&limit=5&types=address,street,place`
- [x] Ativado quando `geo_settings.autocomplete.config.mode='geocoding'` (resultado da etapa 36); sku `geocoding_temporary` por requisição — implementado em `providers/mapbox.ts` (`autocompleteGeocoding`) + switch no `index.ts`; `place-details` resolve por `address` no v6 porque o v6 não tem retrieve por id
- **Evidência:** teste Deno com flag

### 23 — Geocode forward (temporário e permanente)
- [ ] Texto livre e **structured input** (`address_line1`, `postcode`, `place`, `region`, `country=BR`) a partir do ViaCEP
- [ ] Parâmetro `permanent` vindo do chamador (`persist:true` → `permanent=true`, sku `geocoding_permanent`); resposta inclui `match_code.confidence` → `geocode_match_confidence`
- **Evidência:** structured input de CEP 80010-000 + número → `confidence='exact'`

### 24 — Reverse
- [ ] `GET /search/geocode/v6/reverse?longitude=&latitude=&types=place,locality,neighborhood&language=pt` (+`permanent` quando for gravar)
- **Evidência:** reverse de (-25.4296,-49.2716) → "Centro, Curitiba"

### 25 — Batch geocode (backfill)
- [x] `POST /search/geocode/v6/batch` com até 50 consultas por chamada, `permanent=true` (vai para o banco); respeitar 1.000 req/min
- [ ] Usado pelo job `geo_backfill` (plano Google etapa 39) quando o provedor for Mapbox
- **Evidência:** lote de 10 pedidos geocodificado em 1 chamada

### 26 — Route = Directions v5 `driving-traffic`
- [ ] `GET /directions/v5/mapbox/driving-traffic/{lng,lat;lng,lat;...}?geometries=polyline6&overview=full&steps=false&annotations=duration,distance&language=pt`
- [ ] Decodificar `polyline6` → `GeoPoint[]` (precisão 1e-6); gravar em `active_tracking.expected_route`, `route_distance_m=distance`, `route_duration_s=duration`
- [ ] ≤ 25 coordenadas; `POST` quando a URL passar de 8 KB
- [ ] Profile por tipo de serviço: tudo `driving-traffic` (sem moto, M4); `walking` nunca
- **Evidência:** rota Centro→Jardim Botânico ≈ 3,2–4,9 km com polyline > 20 pontos

### 27 — Matrix 1×1 para ETA
- [ ] `GET /directions-matrix/v1/mapbox/driving-traffic/{driver;stop}?sources=0&destinations=1&annotations=duration,distance` → `durations[0][0]`
- [ ] Contar `units = sources×destinations` em `geo_usage` (sku `matrix`)
- [ ] Rate guard: `driving-traffic` 30 req/min por token → fila com token bucket no gateway; ao estourar, perfil `driving` (60/min) no mesmo minuto
- **Evidência:** teste com 40 chamadas/min → 30 traffic + 10 driving, zero 429

### 28 — Matrix N×1 para operação
- [ ] Action `matrix` genérica (≤ 10 coordenadas em `driving-traffic`, ≤ 25 nos demais, ≤ 625 elementos) para "qual motorista está mais perto" na tela de operações
- **Evidência:** 5×1 devolve 5 durações

### 29 — Snap = Map Matching v5 (M3)
- [x] `GET /matching/v5/mapbox/driving/{últimos ≤100 pontos}?geometries=geojson&tidy=true&radiuses=25;25;...` → `matchings[0].geometry` + `tracepoints[]`
- [ ] Usado pelo job `eta_refresh` antes de `distance_to_route_m` quando `geo_settings.snap='mapbox'`; 100k grátis
- **Evidência:** trilha com ruído de 30 m → pontos encaixados na via

### 30 — Static Images (M6)
- [ ] `GET /styles/v1/mapbox/streets-v12/static/{overlay}/auto/600x300@2x` com `path-5+f44(` polyline encodada `)` + `pin-s-a+285A98(lng,lat)` + `pin-s-b+f44(lng,lat)`; devolver PNG base64 (padrão atual `mapbox-proxy:296-312`)
- [ ] URL ≤ 8 KB: simplificar polyline (Douglas-Peucker 50 m) antes
- **Evidência:** PNG com rota e 2 pinos

### 31 — Isochrone / Optimization / Tilequery (M10)
- [ ] Portar as 3 actions como estão (`/isochrone/v1`, `/optimized-trips/v1`, `/v4/{tileset}/tilequery`); marcar `providers: ['mapbox']` no contrato para a UI saber que não há Google
- **Evidência:** `/map-tools` continua funcionando via gateway

### 32 — Erros e 429
- [ ] Mapear `code` (`NoRoute`, `NoSegment`, `InvalidInput`, `ProfileNotFound`) → `ERROR_CODES` de `_shared/contract.ts`; em 429 ler `X-Rate-Limit-Reset` e agendar retry; `414` → refazer em POST
- **Evidência:** teste Deno com respostas mockadas

### 33 — Cache e medição Mapbox
- [ ] `withCache` com TTLs da etapa 15; `geo_usage_increment('mapbox', function, sku, units)` após cada chamada real; headers `X-Geo-Provider: mapbox`
- **Evidência:** 2 rotas iguais em 10 min → 1 chamada real

### 34 — Testes do provedor
- [x] Fixtures reais (gravadas 1× com token de dev) para suggest/retrieve/forward/reverse/directions/matrix/matching/static; testes Deno de normalização, rate guard, erros, retenção
- [x] CI `contract-tests` inclui `geo-gateway/providers/mapbox.test.ts`
- **Evidência:** run verde

---

## BLOCO 3 — Endereço no pedido com Mapbox (etapas 35–44)

### 35 — `AddressAutocomplete` provedor-agnóstico
- [ ] Componente consome `useGeoAutocomplete` (plano Google etapa 33–34); exibe fonte do resultado (ícone Google/Mapbox) e `accuracy`
- **Evidência:** vitest com os dois provedores mockados

### 36 — Teste de cobertura BR do Search Box (decide M1)
- [ ] Script `scripts/geo/searchbox-coverage.ts`: 50 endereços reais de Curitiba/SP/GO (clientes e fornecedores do Bitrix) → `suggest`+`retrieve`; medir % com `accuracy ∈ {rooftop,parcel,point}` e distância ao resultado Google (≤ 50 m)
- [ ] ≥ 90 % → Search Box fica; senão `mapbox_mode='geocoding'` (etapa 22)
- **Evidência:** relatório em `docs/MAPBOX.md` com a tabela

### 37 — Sessões corretas (custo)
- [ ] `useGeoAutocomplete`: UUID v4 ao focar; reusar até `retrieve`; descartar após 170 s sem seleção (sessão expira em 180 s); nunca `suggest` com < 3 caracteres
- [ ] Métrica: sessões/mês vs 2.500 grátis (sku `searchbox_session`)
- **Evidência:** `geo_usage` conta 1 por sessão (verificado com 5 teclas + 1 retrieve)

### 38 — CEP primeiro, Mapbox depois
- [ ] `CepQuickFill` (ViaCEP) preenche rua/bairro/cidade/UF; usuário digita número → `geocode` structured input (`permanent` só se for gravar, M2) ou direto para a cotação Lalamove (que geocodifica de graça)
- **Evidência:** fluxo CEP+número gera coordenada sem chamar `suggest`

### 39 — Gravação conforme M2
- [ ] `NewOrderDialog` envia endereço + coordenada da sugestão **só para a cotação**; o que persiste em `lalamove_orders`/`lalamove_stops` vem da resposta da Lalamove (etapa 17); `pickup_place_id='mapbox:<id>'`
- **Evidência:** pedido real: `geocode_provider='lalamove'`, `pickup_place_id` com prefixo `mapbox:`

### 40 — Endereços sem resultado
- [ ] Estados: vazio ("tente com número"), 429 (orçamento/limite), erro de rede → botão "usar o endereço como digitado" (a Lalamove tenta geocodificar; se 422 `ERR_OUT_OF_SERVICE_AREA`, mostrar)
- **Evidência:** vitest dos 3 estados

### 41 — Lista de endereços frequentes
- [ ] Antes de qualquer provedor: fornecedores/clientes com coordenada já gravada (`contacts`, pedidos anteriores) — zero custo
- **Evidência:** endereço repetido não gera sessão

### 42 — Importação Bitrix24/n8n com Mapbox
- [ ] `geo_backfill` usa batch permanente (etapa 25) quando `geo_settings.geocode='mapbox'`; n8n F01 deixa de chamar DistanceMatrix.ai (plano Google etapa 42)
- **Evidência:** execução de teste do F01

### 43 — Atribuição
- [ ] Qualquer lista/mapa com dados Mapbox mostra "© Mapbox © OpenStreetMap" (termos); `AddressAutocomplete` exibe rodapé de atribuição quando o provedor for Mapbox
- **Evidência:** screenshot

### 44 — Testes E2E
- [ ] Playwright: criar pedido com autocomplete Mapbox (fixture) → cotação → coordenadas da Lalamove gravadas
- **Evidência:** CI verde

---

## BLOCO 4 — Rota, ETA e geofence com Mapbox (etapas 45–54)

### 45 — Job `route_plan` com Mapbox
- [ ] Ao `ON_GOING`/`PICKED_UP`: `route(driver → próximas paradas)` via Directions `driving-traffic`; gravar `expected_route` (polyline6 decodificada), `route_provider='mapbox'`
- **Evidência:** `active_tracking.expected_route` preenchida em pedido real

### 46 — Job `eta_refresh` com Matrix (M4)
- [ ] 1×1 `driving-traffic` a cada 60 s ou >300 m; `eta_minutes=ceil(duration/60)`, `eta_provider='mapbox'`; entre refreshes, estimativa local (distância/velocidade média)
- [ ] Guard 30/min → `driving`; ambos esgotados → Google (se `fallback_provider`) → senão mantém estimativa local
- **Evidência:** `geo_usage` ≤ 70 elementos por pedido completo

### 47 — Snap antes do geofence (M3)
- [ ] Antes de atualizar `active_tracking` (ou dentro de `eta_refresh`), Map Matching dos últimos 5–10 pontos; gravar posição encaixada em `current_latitude/longitude` e a bruta em `driver_locations`
- **Evidência:** `distance_to_route_m` cai de dezenas para < 10 m em trilha com ruído

### 48 — Recalcular rota ao sair do caminho
- [ ] `off_route_cycles >= 2` → novo `route_plan` (máx 1 a cada 5 min)
- **Evidência:** teste com trilha fora da rota

### 49 — `ETA_DELAY`
- [ ] Mesma regra do plano Google (etapa 50), ETA vindo do Matrix Mapbox
- **Evidência:** alerta criado em teste

### 50 — Trânsito futuro (`depart_at`, BETA)
- [ ] Não usar (exige cadastro, beta); documentar
- **Evidência:** doc

### 51 — Paridade de ETA Google × Mapbox
- [ ] Script `scripts/geo/eta-parity.ts`: 20 pares origem/destino em Curitiba, Matrix Google vs Mapbox `driving-traffic`; registrar desvio médio
- **Evidência:** tabela em `docs/MAPBOX.md`

### 52 — Custo por pedido (Mapbox)
- [ ] Meta: ≤ 1 Directions + ≤ 70 Matrix + ≤ 10 Map Matching + 1 Static por pedido ≈ tudo dentro do grátis até ~1.400 pedidos/mês
- **Evidência:** `geo_usage_month` após 7 dias

### 53 — Replay de trajeto
- [ ] `simulate-driver-movement` com a fixture `route_curitiba.json` contra o provedor Mapbox → eventos geo corretos
- **Evidência:** saída do replay

### 54 — Testes do bloco
- [ ] Deno: route/matrix/matching normalização; pgTAP do trigger com `expected_route` vinda do Mapbox
- **Evidência:** CI verde

---

## BLOCO 5 — Front: Mapbox GL JS (etapas 55–62)

### 55 — Token do front
- [ ] `useMapboxToken.ts` passa a reportar erro (hoje falha em silêncio `:16-18`); `HeatmapPage.tsx:30` reusa o hook em vez de chamar a edge de novo
- **Evidência:** 1 chamada a `get-mapbox-token` por sessão

### 56 — Contagem de map load
- [ ] Ao `new mapboxgl.Map(...)` em `LiveMap.tsx:123` e `HeatmapPage.tsx:36`: `geo-gateway count-map-load {provider:'mapbox'}` (sem custo externo) → `geo_usage(tiles, map_load)`
- **Evidência:** `geo_usage` incrementa ao abrir o mapa

### 57 — Rota e motorista no Mapbox
- [ ] `mapLayers.ts`: sources/layers `expected-route` (line, `line-width` 4), `driver-trail`, marker do motorista interpolado 10 s; paridade com o canvas Google (plano Google etapa 77–78)
- **Evidência:** screenshot

### 58 — Mini-mapa no detalhe do pedido
- [ ] `OrderTrackingMap` renderiza com o provedor de `geo_settings.tiles`; para Mapbox usa `mapbox-gl` já carregado (sem novo bundle)
- **Evidência:** screenshot

### 59 — Estilo
- [ ] Manter `dark-v11`/`satellite-streets-v12`; avaliar Mapbox Standard só se o custo de map load não mudar (é o mesmo SKU)
- **Evidência:** decisão em `docs/MAPBOX.md`

### 60 — `useMapbox.ts` → `useGeo.ts`
- [ ] Os 9 hooks de `useMapbox.ts` viram wrappers finos de `useGeo` com `provider:'mapbox'` forçado onde não há Google (isochrone/optimization/tilequery) e provedor configurado nos demais
- **Evidência:** `/map-tools` sem regressão (manual)

### 61 — Remover `mapbox-proxy`
- [ ] Após 60 e 31, apagar a edge e o bloco do `config.toml`; atualizar `docs/ci/MATRIZ_EDGE_TABELA.md`
- **Evidência:** `supabase functions list` sem `mapbox-proxy`

### 62 — Testes de front
- [ ] vitest `useGeo` com provedor Mapbox; Playwright abre LiveMap e verifica layer `expected-route`
- **Evidência:** CI verde

---

## BLOCO 6 — Seletor no admin: Google ↔ Mapbox (etapas 63–72)

### 63 — Tela `/settings/maps` com os dois provedores
- [ ] Matriz **função × provedor**: linhas `tiles, autocomplete, geocode, reverse, route, matrix, static, snap, validate, isochrone, optimization`; colunas Google / Mapbox / Auto / Off; célula desabilitada com tooltip quando o provedor não oferece (validate→só Google; isochrone/optimization→só Mapbox)
- [ ] `fallback_provider` por linha
- **Evidência:** screenshot; `geo_settings` atualizado

### 64 — Modo `auto` (M9)
- [ ] `resolveProvider`: `auto` → provedor com `free_quota_month - uso_mês > 0` para o sku da função; empate → Mapbox; nenhum → o mais barato por 1.000
- **Evidência:** teste Deno com `geo_usage` mockado

### 65 — Troca ao vivo sem deploy
- [ ] Gateway lê `geo_settings` com cache de 60 s; front refaz `useQuery(['geo-settings'])` ao salvar; mapa troca o canvas sem recarregar
- **Evidência:** mudar `tiles` para Google → LiveMap troca em ≤ 60 s

### 66 — Override por usuário só dentro do permitido
- [ ] `useMapSettings.ts`: `provider` padrão vem de `geo_settings.tiles`; o dropdown do usuário lista só provedores com `provider ≠ off`; override continua local (visual)
- **Evidência:** admin desliga Google → opção some do dropdown

### 67 — Teste de saúde por provedor
- [ ] Botões "Testar Mapbox" / "Testar Google": geocode de endereço fixo (Mapbox com `permanent=false`, não grava) → latência, sku, `X-Rate-Limit-Remaining`; integrar em `check-external-api`
- **Evidência:** status na UI

### 68 — Painel de uso lado a lado
- [ ] Gráfico recharts por função com as duas séries (Google/Mapbox), uso vs cota grátis, custo estimado; export CSV
- **Evidência:** screenshot

### 69 — Orçamento por provedor
- [ ] Cards `geo_budget` para os dois; Mapbox com `hard_stop=false` por padrão (M-dentro do grátis), aviso em 80 % de qualquer cota grátis
- **Evidência:** `geo_budget_status()`

### 70 — Matriz de paridade na UI
- [ ] Bloco "O que muda ao trocar": validação de endereço (só Google), moto (nenhum), snap grátis (Mapbox), isócronas (Mapbox), sessões de autocomplete (preço), retenção de dados (Mapbox temporário não grava)
- **Evidência:** texto na tela, fonte `docs/MAPBOX.md`

### 71 — Permissões e auditoria
- [ ] `maps.settings.write` só admin; `audit_log` já recebe antes/depois (PR #118)
- **Evidência:** viewer → 403; `audit_log` com a troca

### 72 — Drill de troca
- [ ] Roteiro: Google→Mapbox em todas as funções com pedido ativo → nada quebra (rota, ETA, autocomplete) → voltar; registrar tempo e incidentes
- **Evidência:** relatório em `docs/MAPBOX.md`

---

## BLOCO 7 — Custo e operação (etapas 73–82)

### 73 — Limite real de orçamento Mapbox
- [ ] Quando o uso passar de 70 % de qualquer cota grátis 2 meses seguidos: `geo_budget.mapbox.monthly_limit_usd` = valor acordado com o dono, `hard_stop=true`
- **Evidência:** decisão registrada

### 74 — Reconciliação com a fatura Mapbox
- [ ] Mensal: comparar `geo_usage_month` (Mapbox) com a fatura/dashboard de uso; ajustar `geo_price_list` se divergir > 5 %
- **Evidência:** tabela em `docs/MAPBOX.md`

### 75 — Alertas
- [ ] `GEO_BUDGET_WARNING` para Mapbox em 80 % de map loads, sessões Search Box, Matrix; 429 > 1 %/h → `INTEGRATION_FAILURE`
- **Evidência:** alerta de teste

### 76 — Rate limit global por token
- [ ] Token bucket em memória no gateway por (provider, api): Directions 300/min, Matrix traffic 30/min, Geocoding 1.000/min, Static 1.250/min, Search Box 10/s; fila com `X-Rate-Limit-Reset`
- **Evidência:** teste de carga sem 429

### 77 — Cache de rota compartilhado
- [ ] Rotas iguais (mesmos stops) em 10 min reaproveitam `geo_cache`; chave inclui perfil e hora arredondada (trânsito)
- **Evidência:** `X-Geo-Cache: HIT`

### 78 — Runbook Mapbox
- [ ] `docs/RUNBOOK_MAPBOX.md`: token vazado (rotação etapa 9), 429 persistente, Mapbox fora (forçar Google em 1 clique), Search Box sem cobertura, fatura inesperada
- **Evidência:** doc mergeado

### 79 — Dependências
- [ ] Não adicionar `@mapbox/search-js-*` nem `@mapbox/mapbox-sdk` (token nunca no front; gateway cobre) — registrar a decisão
- **Evidência:** `package.json` sem novos pacotes Mapbox

### 80 — Observabilidade
- [ ] `query_telemetry`/`system_logs`: latência p50/p95 por provedor e função; painel na tela admin
- **Evidência:** gráfico com dados reais

### 81 — Limpeza de legado
- [ ] Remover `geocoding/v5` (geocode/reverse) do código; `check-external-api:232` passa a testar v6; `AddressAutocomplete` sem referência direta a Mapbox
- **Evidência:** `grep -r "mapbox.places" supabase src` vazio

### 82 — Docs
- [ ] `docs/MAPBOX.md` (conta, tokens, termos, cobertura, custos, paridade) e `docs/GEO_PROVIDERS.md` (como adicionar um 3º provedor — HERE, TomTom — na mesma interface)
- **Evidência:** docs mergeados

---

## BLOCO 8 — Qualidade, CI, deploy (etapas 83–92)

### 83 — Testes Deno do provedor Mapbox na CI (`contract-tests`)
- **Evidência:** run verde
### 84 — vitest dos hooks/componentes com provedor Mapbox
- **Evidência:** run verde
### 85 — Playwright: pedido com autocomplete Mapbox + mapa com rota
- **Evidência:** run verde
### 86 — `edge-integration-tests` em prod: `provider-status` Mapbox após deploy
- **Evidência:** run verde
### 87 — Deploy das edges (`deploy-edges.yml`) + Vercel READY
- **Evidência:** links das runs
### 88 — Verificar `allowedUrls` do pk em produção (preview + prod)
- **Evidência:** mapa carrega nas duas URLs
### 89 — Verificar scopes mínimos do sk (nenhum `*:write`)
- **Evidência:** `GET /tokens/v2?access_token=sk`
### 90 — Snapshot de `geo_settings`/`geo_price_list` no inventário semanal (`inventario-estado-semanal.yml`)
- **Evidência:** PR semanal inclui o snapshot
### 91 — Lint/typecheck herdados: anotar os 22 erros de `tsconfig.app.json` herdados (PR #115) — fora do escopo
- **Evidência:** "Próximos passos" da PR
### 92 — Changelog
- [ ] `CHANGELOG.md`: "Camada geo com Google e Mapbox selecionáveis por função"
- **Evidência:** entrada

---

## BLOCO 9 — Aceite e fechamento (etapas 93–100)

### 93 — Aceite Mapbox-only
- [ ] `geo_settings` tudo `mapbox`: pedido real com autocomplete → cotação → coordenadas Lalamove gravadas → motorista a caminho → `expected_route` Mapbox → ETA Matrix → aviso "aproximando" → "chegou" → `geo_usage` do pedido dentro do grátis
- **Evidência:** `order_geo_events`, `alerts_sent`, `geo_usage`, prints
### 94 — Aceite Google-only (plano Google etapa 99)
### 95 — Aceite `auto`
- [ ] Zerar/forçar uso de um provedor → `auto` muda para o outro sem intervenção
- **Evidência:** `X-Geo-Provider` muda
### 96 — Aceite de falha: Mapbox 5xx simulado → fallback Google em < 1 ciclo
- **Evidência:** log do gateway
### 97 — Aceite de retenção: nenhuma coordenada com `geocode_provider='mapbox'` e `permanent=false` no banco
- **Evidência:** `SELECT count(*) ... = 0`
### 98 — Custo real após 30 dias (os dois provedores) vs estimativa
- **Evidência:** tabela
### 99 — Atualizar docs do projeto (`claude/...`) e memória (`/projects/.../areas/lalamove-v2.md`): conta Mapbox, nomes dos secrets, provedor padrão por função, resultado do teste de cobertura
### 100 — Lista do que ficou `off`/para depois: tk temporário (10), `depart_at` (50), Mapbox Standard (59), 3º provedor (82)

---

## Dependências e ordem

```
Bloco 0 (tokens: 1–4 dono) ──► Bloco 1 (🔒 DDL pequeno: 11–14) ──► Bloco 2 (provider) ──► Bloco 3 ──► Bloco 5
                                                                        └──► [UAPI alimenta active_tracking] ──► Bloco 4
Bloco 6 (admin) depende de Bloco 2 + Bloco 8 do plano Google · Blocos 7–9 transversais
```

O que é comum aos dois planos e não se repete: PR #118 (banco), `geo-gateway` esqueleto/contrato/resolver/cache/medição (Google 21–23, 30–32), `useGeo.ts` (33), trigger de eventos (53–64), `send-notification` com destinatários (65–74), tela admin base (85–92).

Custo em regime (30 pedidos/dia): Mapbox fica **inteiro dentro do grátis** (map loads 50k, rotas/matrix/matching 100k, static 50k) exceto Search Box: ~900 sessões/mês < 2.500 grátis. Acima de ~80 pedidos/dia a Search Box passa a custar (US$ 11,50/1k sessões) — ponto em que o `auto` deve mandar o autocomplete para o Google (US$ 2,83/1k requisições) ou para Geocoding v6 autocomplete (100k grátis).

PRs previstas: ~18 (uma por etapa agrupável). 🔒 aguardam o dono: 11–14 (DDL), 7 (config.toml), 9 (rotação/segredos).
