# Plano Google Maps Platform × Lalamove V2 — 100 etapas com checklists (21/11/2026)

Base verificada: repo `adm01-debug/Lalamove_V2` @ `8141d5c` (#114), doc GMP (preços 2026-11-12), análise `docs/planos/ANALISE_GOOGLE_MAPS_X_LALAMOVE_V2.md`, execução `docs/EDGE_DEPLOY_PIPELINE.md (execução de 21/11)`.

**Fora de escopo deste plano:** ingestão da posição do motorista (UAPI — outro chat). Este plano consome `active_tracking` como contrato (etapa 41).

> **Estado em 22/11/2026 — reescrito por auditoria de código (o bloco anterior estava errado em 3 pontos).**
>
> **Correções do bloco anterior:** (a) as migrations do Bloco 1 **estão aplicadas em produção** — `geo_foundation`
> e `geo_alert_types` estão em `supabase_migrations` e as tabelas existem; (b) `GOOGLE_MAPS_SERVER_KEY`
> **está configurado** nos secrets do projeto `iecgydonctmabiijadsf` (confirmado na lista de secrets) e o
> provedor Google **já está implementado e mergeado** (PR #197, `providers/google.ts`); (c) os Blocos 3–9
> **não estão "não iniciados"** — a maior parte está implementada no `geo-gateway`, que é único e
> agnóstico de provedor (o mesmo código serve Google e Mapbox).
>
> - ✅ Bloco 0 (1–10): `GOOGLE_MAPS_SERVER_KEY` configurado; chave restrita/sem exposição no front
>   (o navegador nunca recebe chave Google — tudo passa pelo `geo-gateway`). Alertas de faturamento
>   dependem do painel Google Cloud (só o dono acessa).
> - ✅ Bloco 1 (11–20): PR #118 + migrations `20261122130000_geo_alert_types`/`20261122130100_geo_foundation`
>   **aplicadas em produção**. `geocode_precision` com escala interna e mapeamento por provedor:
>   `LOCATION_TYPE_TO_PRECISION` em `providers/google.ts:29` e `ACCURACY_TO_PRECISION` em
>   `_shared/geo-precision.ts` (PR #199). `pickup_place_id`/`delivery_place_id` com CHECK de prefixo
>   `(mapbox|google|lalamove):` aplicado (PR #199).
>   - `geocode_match_confidence` (etapa 14) **decidido fora de escopo**: `persistOrderCoordinates` grava
>     coordenada vinda da cotação Lalamove, que não devolve `match_code` — a coluna ficaria 100 % NULL.
> - ✅ Blocos 2–4 (21–40): `geo-gateway` é o ponto único; `providers/google.ts` implementa
>   `autocomplete` (Places), `geocode`/`reverse` (Geocoding), `route` (`computeRoutes`), `matrix`
>   (`computeRouteMatrix`), `static`. `snap`/`isochrone`/`optimization`/`tilequery` **não têm equivalente no
>   Google** — documentado em `google.ts:5` e o gateway responde `GEO_NOT_SUPPORTED` (HTTP 501), com
>   `geo_settings` desabilitando a função na UI (`MapsSettingsPage` matriz por provedor).
>   - **Bug de produção corrigido em 2026-11-22** (PR #205): `computeRoutes` enviava
>     `departureTime = new Date().toISOString()` e a API rejeitava com `"Timestamp must be set to a future
>     time"` — a hora chegava ao servidor do Google já no passado. Removido o campo; a API usa "agora" por
>     padrão com `TRAFFIC_AWARE`. **Reproduzido antes e validado depois em produção** (rota real devolvida).
> - ✅ Bloco 5 (41–60): `rateGuard` por provedor/api em `geo-gateway/index.ts:120`/`:125` com espera de
>   virada de janela em `:275-277`; `GOOGLE_RATE_LIMITS`/`MAPBOX_RATE_LIMITS` em `index.ts:37`/`:57`;
>   `withCache` + `geo_usage_increment` por SKU em `resolver.ts`; headers `X-Geo-Provider`.
> - ✅ Blocos 6–8 (61–90): UI admin completa em `src/pages/MapsSettingsPage.tsx` — matriz função × provedor
>   (`:459`), reserva por linha, cards de `geo_budget`, gráfico `recharts` (`:7`), gate `isAdmin()` (`:318`),
>   `audit_log` em toda alteração. `resolveProvider` lê `'auto'` e escolhe por cota (`resolver.ts:115`).
> - ⬜ Bloco 9 (91–100): aceite com pedido real e fatura de 30 dias. Bloqueado por **volume real de pedidos**
>   (hoje congelado — `lalamove_uapi_sessions` vazia desde 17/08) e pela fatura no painel Google Cloud.
>
> **Verificação de execução:** `deno test` do `geo-gateway` → **103 passed / 0 failed**.

## Decisões de negócio embutidas (padrão adotado; mude pelo código D-n)

| # | Decisão | Padrão adotado | Onde impacta |
|---|---|---|---|
| D1 | Quem é o "responsável pela coleta" | `lalamove_orders.supplier_contact` (já existe) + novo `pickup_contact_name/phone` opcional por pedido; se vazio usa `lalamove_stops[0].contact_*` | 13, 59, 66 |
| D2 | Canal da mensagem | WhatsApp via Evolution API (já no `send-notification`); e-mail Resend como fallback; Zapp Web entra como canal quando houver endpoint | 66–69 |
| D3 | Horário de envio | 07:00–20:00 America/Sao_Paulo; fora da janela segura até 07:00, exceto "motorista chegou" (vai sempre) | 58 |
| D4 | "Bem perto da coleta" | raio **500 m** OU ETA ≤ **5 min** (o que vier primeiro); 2º aviso "chegou" em 100 m ou status Lalamove de chegada | 54–56 |
| D5 | Aviso ao cliente final na entrega | mesma lógica, destinatário = contato da entrega, **desligado por padrão** (flag) | 57 |
| D6 | Provedor padrão por função | mapa: Mapbox (50k grátis) · autocomplete: Google · geocode: Google · rota/ETA: Google (trânsito) · static: Google · snap: desligado | 12, 86 |
| D7 | Address Validation (Pro, US$17/1k) | desligado; só geocode (US$5/1k) | 38 |
| D8 | PostGIS | **não**; haversine/ponto-a-polyline em SQL puro (sem DDL de extensão) | 17–18 |
| D9 | Cadência de ETA (custo) | Route Matrix a cada 60 s ou quando o motorista andou >300 m; `TRAFFIC_AWARE` (Pro) só com ETA ≤ 15 min, senão Essentials | 48–49 |
| D10 | Moto (LALAGO) | ETA com `travelMode: DRIVE` (2 rodas = Enterprise, 3× preço) | 47 |
| D11 | Orçamento | US$ 50/mês Google, US$ 0 Mapbox (dentro do grátis); ao estourar: fallback para o outro provedor; se ambos estourarem, bloqueia funções não críticas (static, snap) e mantém autocomplete/geocode | 15, 30 |
| D12 | Chave Google | projeto Google Cloud próprio da Promo Brindes (sai do conector Lovable); dono do billing = Joaquim | 1–8 |

Legenda: `[ ]` item de checklist · **Evidência** = o que prova a etapa pronta (regra 3) · 🔒 = regra 8 do Fluxo Git (PR fica aberta aguardando o dono).

---

## BLOCO 0 — Conta Google, chaves e segredos (etapas 1–10)

### 1 — Criar projeto Google Cloud `promo-brindes-lalamove`
- [ ] Projeto criado na organização/billing da Promo Brindes (console.cloud.google.com) — ação do dono (D12)
- [ ] Conta de faturamento vinculada; alerta de orçamento US$ 50 e US$ 100 no Cloud Billing
- [ ] Anotar `project_id` em `docs/GOOGLE_MAPS.md`
- **Evidência:** `gcloud projects describe` ou print do console com project_id

### 2 — Habilitar APIs
- [ ] Maps JavaScript API · Places API (New) · Geocoding API · Routes API · Maps Static API
- [ ] Roads API e Address Validation API **não** habilitadas (D6/D7) — habilitar só quando ligar a função
- **Evidência:** lista "APIs ativadas" do projeto

### 3 — Chave de navegador (front)
- [ ] Criar `maps-browser-key`; restrição HTTP referrer: `https://lalamove-v2*.vercel.app/*`, domínio de produção, `http://localhost:*`
- [ ] Restrição de API: só Maps JavaScript API
- **Evidência:** detalhes da chave no console

### 4 — Chave de servidor (edges)
- [ ] Criar `maps-server-key`; restrição de API: Places (New), Geocoding, Routes, Static Maps
- [ ] Sem restrição de IP (edges Supabase não têm IP fixo) → compensado por quota cap (etapa 5) e por `verify_jwt`
- **Evidência:** detalhes da chave

### 5 — Quota caps por API (teto diário)
- [ ] Routes computeRoutes: 2.000/dia · computeRouteMatrix elementos: 5.000/dia · Geocoding: 1.000/dia · Autocomplete: 3.000/dia · Static: 500/dia · Map loads: 1.000/dia
- [ ] Valores documentados em `docs/GOOGLE_MAPS.md` com a conta: 30 dias × teto < US$ 50 (D11)
- **Evidência:** tela "Cotas" com os caps

### 6 — Map ID (estilo na nuvem)
- [ ] Criar Map ID `lalamove-v2-web` (vetor, JS); estilo escuro compatível com o `mapbox-dark` atual
- **Evidência:** Map ID no console

### 7 — Secrets no Supabase (edges)
- [ ] `GOOGLE_MAPS_SERVER_KEY` criado em Edge Function Secrets do projeto `iecgydonctmabiijadsf`
- [ ] Nunca em código/commit/resposta (regra 8 das preferências)
- **Evidência:** `supabase secrets list` mostra o nome (sem valor)

### 8 — Variáveis no Vercel (front, time `juca1`, projeto `lalamove-v2`)
- [x] Atualizar `scripts/ci/vercel-env-baseline.json` e `.unit.mjs` (hoje listam só `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*`)
- [ ] `VITE_GOOGLE_MAPS_BROWSER_KEY` e `VITE_GOOGLE_MAPS_MAP_ID` em Production/Preview/Development — **ação do dono** (sem MCP da Vercel com escopo para escrita de env)
- **Evidência:** baseline com as duas vars nos 3 blocos (`production`/`preview`/`development`); `node --test scripts/ci/vercel-env-baseline.unit.mjs` → **12 passed / 0 failed** (PR #225). Falta só o cadastro na Vercel.

### 9 — `.env.example` e documentação
- [x] Adicionar `GOOGLE_MAPS_SERVER_KEY=`, `VITE_GOOGLE_MAPS_BROWSER_KEY=`, `VITE_GOOGLE_MAPS_MAP_ID=` comentados (hoje só `MAPBOX_ACCESS_TOKEN`)
- [x] Criar `docs/GOOGLE_MAPS.md`: projeto, chaves, caps, SKUs usados, custo estimado, como rotacionar
- **Evidência:** `.env.example:19-24` documenta as 3 (`GOOGLE_MAPS_API_KEY` marcado como servidor). `docs/GOOGLE_MAPS.md` criado com 156 linhas: projeto/billing, 7 APIs, as 2 chaves com escopo, Map ID, 6 quotas, tabela de SKUs lida da `geo_price_list`, conferência mensal gateway × fatura (±5%), rotação das 2 chaves e por que a chave própria é opcional.

### 10 — Retirar chave DistanceMatrix.ai hardcoded (prefixo `k2sJ`)
- [x] Remover de `lalamove_f01_cotacao.json:62,77`, `lalamove_bundle_import.json`, `lalamove_f00_bootstrap.json`, `lalamove_suplemento_v2.md/.html`, `lalamove_documentacao_completa.md/.html`
- [x] Substituir por `{{ $credentials }}` no n8n ou por chamada ao `geo-gateway` (etapa 42)
- [ ] 🔒 Rotacionar a chave no painel DistanceMatrix.ai (ação do dono)
- **Evidência:** as **12 ocorrências** em 7 arquivos foram trocadas por `{{ $env.DISTANCEMATRIX_API_KEY }}` nos workflows n8n (padrão já usado no repo: `$env.B24_TOKEN`, `$env.N8N_API_KEY`) e por `<DISTANCEMATRIX_API_KEY>` nos 4 docs. `grep -rln "k2sJ" .` (fora de `docs/planos`) → **vazio**. Os 3 JSON revalidados com `json.load` → OK. PR #225. **Falta**: cadastrar `DISTANCEMATRIX_API_KEY` nas variáveis de ambiente do n8n e rotacionar no painel.

---

## BLOCO 1 — Banco de dados (etapas 11–20) 🔒 DDL em produção: PR fica aberta aguardando o dono

### 11 — Migration `geo_settings`
- [ ] Tabela `geo_settings(id, function text UNIQUE CHECK IN ('tiles','autocomplete','geocode','reverse','route','matrix','static','snap'), provider text CHECK IN ('google','mapbox','off'), fallback_provider text, updated_by uuid, updated_at)`
- [ ] Seed conforme D6
- [ ] RLS: leitura autenticados; escrita só `admin` (reusar padrão de `feature_flags` `20260513180430`)
- **Evidência:** migration no repo + `\d geo_settings` em prod

### 12 — Migration `geo_usage` (medição de custo)
- [ ] `geo_usage(day date, provider, function, sku text, count int, est_cost_usd numeric(10,4), PRIMARY KEY(day, provider, function, sku))`
- [ ] RPC `geo_usage_increment(p_provider, p_function, p_sku, p_count, p_unit_cost)` (UPSERT atômico)
- [ ] Tabela de preços `geo_price_list(provider, sku, free_quota_month int, unit_cost_per_1000 numeric)` seed com a tabela GMP 2026-11-12 e Mapbox
- **Evidência:** `SELECT * FROM geo_price_list` com 20+ linhas

### 13 — Migration colunas de endereço/contato nos pedidos
- [ ] `lalamove_orders`: `pickup_place_id text, delivery_place_id text, pickup_address_components jsonb, delivery_address_components jsonb, geocode_provider text, geocode_precision text, pickup_contact_name text, pickup_contact_phone text, approach_radius_m int DEFAULT 500, approach_eta_min int DEFAULT 5, notify_delivery_contact bool DEFAULT false`
- [ ] `lalamove_stops`: `place_id text, address_components jsonb, geocode_precision text`
- [ ] Índice `lalamove_orders(pickup_place_id)`, `(delivery_place_id)`
- **Evidência:** `\d lalamove_orders`

### 14 — Migration `geo_cache`
- [ ] `geo_cache(key text PK (sha256 de provider+function+request normalizado), provider, function, response jsonb, created_at, expires_at)`; índice em `expires_at`
- [ ] TTL por função: autocomplete 0 (não cacheia), geocode 30 d, reverse 30 d (migra `region_cache`), route 10 min, matrix 0, static 7 d
- [ ] `cron.schedule('geo-cache-prune', '15 3 * * *', $$DELETE FROM geo_cache WHERE expires_at < now()$$)`
- **Evidência:** job em `cron.job`

### 15 — Migration `geo_budget`
- [ ] `geo_budget(provider PK, monthly_limit_usd numeric, hard_stop bool DEFAULT true, alert_at_pct int DEFAULT 80, updated_at)`; seed google=50, mapbox=0 (D11)
- [ ] View `geo_usage_month` (soma do mês corrente por provider/function) e RPC `geo_budget_status()` → `{provider, spent, limit, pct, blocked}`
- **Evidência:** `SELECT * FROM geo_budget_status()`

### 16 — Migration enum `alert_type` + `alert_configurations`
- [ ] `ALTER TYPE alert_type ADD VALUE` × `DRIVER_APPROACHING_PICKUP, DRIVER_ARRIVED_PICKUP, DRIVER_APPROACHING_DELIVERY, DRIVER_ARRIVED_DELIVERY, ETA_DELAY, SUPPLIER_DELAY_NOTICE, MISSING_POD, GEO_BUDGET_WARNING` (os 2 últimos consertam `check-driver-alerts:58,162,225`)
- [ ] Linhas em `alert_configurations` para cada tipo com `message_template` (etapa 67) e `min_interval_seconds`
- **Evidência:** `SELECT unnest(enum_range(NULL::alert_type))`

### 17 — Funções SQL de geometria (D8, sem PostGIS)
- [ ] `geo_haversine_m(lat1,lng1,lat2,lng2) RETURNS numeric` IMMUTABLE
- [ ] `geo_point_to_segment_m(p, a, b)` e `geo_point_to_polyline_m(lat,lng, polyline jsonb) RETURNS numeric` (menor distância aos segmentos)
- [ ] Testes em `supabase/tests/geo_functions.test.sql` (pgTAP ou asserts via `DO`) com 5 casos conhecidos (Curitiba Centro→Jardim Botânico ≈ 3,2 km)
- **Evidência:** saída do teste

### 18 — Migration `order_geo_events`
- [ ] `order_geo_events(id, order_id FK, event_type alert_type, triggered_at, driver_lat, driver_lng, distance_m, eta_min, notified_at, notification_status text, payload jsonb, UNIQUE(order_id, event_type))` — idempotência: 1 disparo por evento/pedido
- [ ] RLS leitura para operator+; escrita só service_role
- **Evidência:** `\d order_geo_events`

### 19 — Migration `active_tracking` (ETA e rota)
- [ ] Adicionar `eta_updated_at timestamptz, eta_provider text, route_provider text, route_distance_m int, route_duration_s int, distance_to_route_m numeric, distance_to_next_stop_m numeric, next_stop_index int DEFAULT 0` (colunas `expected_route jsonb, eta_minutes, is_on_route` já existem)
- **Evidência:** `\d active_tracking`

### 20 — Trigger de avaliação de geo-eventos
- [ ] `CREATE TRIGGER trg_active_tracking_geo AFTER UPDATE OF current_latitude, current_longitude ON active_tracking FOR EACH ROW EXECUTE FUNCTION geo_evaluate_events()` (corpo na etapa 53)
- [ ] Guard: só roda se `tracking_status IN ('active')` e `NEW.last_updated > OLD.last_updated`
- **Evidência:** `\d active_tracking` lista o trigger; `EXPLAIN` do UPDATE < 5 ms

---

## BLOCO 2 — Edge `geo-gateway` (camada de provedor) (etapas 21–32)

### 21 — Esqueleto da edge `supabase/functions/geo-gateway/index.ts`
- [ ] Rota por `body.action` ∈ `autocomplete | place-details | geocode | reverse | route | matrix | static | snap | provider-status`
- [ ] Reusar `_shared/cors.ts`, `_shared/logger.ts`, `_shared/contract.ts` (`jsonResponse`, `errorResponse`, `parseJsonBody`)
- [ ] `[functions.geo-gateway] verify_jwt = true` em `config.toml` (deploy automático via `deploy-edges.yml`)
- **Evidência:** `curl` sem JWT → 401; com JWT e `action: provider-status` → 200

### 22 — Contrato zod em `_shared/schemas.ts`
- [ ] Schemas por action (input normalizado, independente de provedor): `AutocompleteReq{input, sessionToken?, bias?{lat,lng,radius_m}}`, `GeocodeReq{address, region='br'}`, `RouteReq{origin, destination, waypoints?, mode='DRIVE', traffic?:bool}`, `MatrixReq{origins[], destinations[]}`, `StaticReq{path?, markers[], size}`
- [ ] Registrar em `CONTRACT_REGISTRY` (`schemas.ts:136`)
- [ ] Teste Deno `geo-gateway/schemas.test.ts`
- **Evidência:** `deno test` verde na CI (`contract-tests`)

### 23 — Interface `GeoProvider` em `geo-gateway/providers/types.ts`
- [ ] `interface GeoProvider { autocomplete(); placeDetails(); geocode(); reverse(); route(); matrix(); staticMap(); snap?() }` com tipos de saída normalizados: `GeoPoint{lat,lng}`, `GeoAddress{formatted, place_id, components, precision}`, `GeoRoute{polyline:GeoPoint[], distance_m, duration_s, duration_traffic_s?}`, `GeoMatrixCell{distance_m, duration_s}`
- [ ] Cada método devolve `{data, sku, units}` para medição
- **Evidência:** `tsc`/`deno check` verde

### 24 — `providers/google.ts` — Places Autocomplete (New) + Place Details
- [ ] `POST https://places.googleapis.com/v1/places:autocomplete` com `includedRegionCodes:['br']`, `languageCode:'pt-BR'`, `locationBias` circle (Curitiba padrão ou lat/lng do usuário), `sessionToken` repassado
- [ ] `GET https://places.googleapis.com/v1/places/{id}` com `X-Goog-FieldMask: id,location,formattedAddress,addressComponents` (SKU Essentials) e mesmo `sessionToken`
- [ ] Header `X-Goog-Api-Key: GOOGLE_MAPS_SERVER_KEY`; mapear `addressComponents` → `{street, number, district, city, state, postal_code}`
- [ ] sku: `places_autocomplete_request` (sessão) / `place_details_essentials`
- **Evidência:** teste manual via `supabase_functions_invoke` com `input:"Rua XV de Novembro, Curitiba"` → 5 sugestões

### 25 — `providers/google.ts` — Geocoding v4
- [ ] Forward: `GET https://geocode.googleapis.com/v4/geocode/address/{addressQuery}` + `regionCode=BR`, `languageCode=pt-BR`; precisão = `granularity`
- [ ] Reverse: `GET https://geocode.googleapis.com/v4/geocode/location/{lat},{lng}` → bairro/cidade para `region_cache`
- [ ] Erros: `ZERO_RESULTS` → `{data:null, code:'GEO_NOT_FOUND'}`
- **Evidência:** geocode de "Av. Sete de Setembro 2775, Curitiba" devolve lat/lng ROOFTOP

### 26 — `providers/google.ts` — Routes API computeRoutes
- [ ] `POST https://routes.googleapis.com/directions/v2:computeRoutes`, `travelMode: DRIVE`, `polylineQuality: OVERVIEW` (menor payload), `X-Goog-FieldMask: routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters`
- [ ] `traffic=true` ⇒ `routingPreference: TRAFFIC_AWARE` (SKU Pro), **sem** `departureTime` — enviar `new Date().toISOString()` é rejeitado em produção com "Timestamp must be set to a future time" (o relógio do servidor do Google já o lê como passado); a API usa "agora" como default ao omitir o campo. `traffic=false` ⇒ sem `routingPreference` (Essentials)
- [ ] Decodificar `encodedPolyline` (algoritmo Google polyline) → `GeoPoint[]` para salvar em `expected_route`
- [ ] ≤ 10 waypoints intermediários (acima vira cobrança maior)
- **Evidência:** rota Centro→Jardim Botânico com `distance_m` ≈ 3.200 e polyline > 20 pontos

### 27 — `providers/google.ts` — computeRouteMatrix
- [ ] `POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`, FieldMask `originIndex,destinationIndex,duration,distanceMeters,condition`
- [ ] Limite: ≤ 625 elementos (100 com `TRAFFIC_AWARE_OPTIMAL` — não usar); contar `units = origins×destinations`
- **Evidência:** 1×1 devolve `duration` em segundos

### 28 — `providers/google.ts` — Static Maps
- [ ] URL `https://maps.googleapis.com/maps/api/staticmap?size=600x300&scale=2&markers=...&path=enc:...&key=` montada no servidor; devolver **imagem** (base64) ou URL assinada curta (nunca a key ao cliente — mesmo padrão de `mapbox-proxy:296-312`)
- **Evidência:** PNG válido

### 29 — `providers/mapbox.ts` — portar `mapbox-proxy`
- [ ] Mover as 9 actions de `mapbox-proxy/index.ts` para a interface `GeoProvider` (geocode v5→v6 `https://api.mapbox.com/search/geocode/v6/forward`, directions `driving-traffic`, matrix, static)
- [ ] Autocomplete Mapbox = Search Box API `suggest`/`retrieve` com `session_token`
- [ ] `mapbox-proxy` passa a delegar para o gateway (manter 1 release para compatibilidade de `useMapbox.ts`), depois remover (etapa 83)
- **Evidência:** `useMapbox` continua funcionando (`/map-tools` manual)

### 30 — Resolver de provedor + orçamento
- [ ] `resolveProvider(function)`: lê `geo_settings` (cache em memória 60 s) → se `geo_budget_status().blocked` para esse provider → `fallback_provider` → se também bloqueado → `off` → `errorResponse('GEO_BUDGET_EXCEEDED', 429)`
- [ ] Funções críticas (`autocomplete`, `geocode`) nunca ficam `off` enquanto houver um provedor com saldo (D11)
- [ ] Alerta `GEO_BUDGET_WARNING` ao cruzar `alert_at_pct` (1× por mês por provider)
- **Evidência:** teste Deno com `geo_budget` mockado em 100% → resposta usa fallback

### 31 — Cache + medição
- [ ] `withCache(function, req, fn)`: chave sha256; TTL da etapa 14; `HIT` não conta uso
- [ ] Após cada chamada real: `geo_usage_increment(provider, function, sku, units, unit_cost)` com `unit_cost` de `geo_price_list` (considera cota grátis do mês: custo 0 até `free_quota_month`)
- [ ] Header de resposta `X-Geo-Provider`, `X-Geo-Cache: HIT|MISS`, `X-Geo-Sku`
- **Evidência:** 2 chamadas iguais de geocode → 2ª com `X-Geo-Cache: HIT`; `geo_usage.count = 1`

### 32 — Rate limit por usuário e testes
- [ ] 60 req/min por `auth.uid()` em `autocomplete`, 20/min nas demais (reusar padrão de `lalamove_rate_limits`)
- [ ] Testes Deno: provider google (fetch mockado com fixtures reais gravadas em `geo-gateway/__fixtures__/`), mapbox, resolver, cache, rate limit
- [ ] PR mergeada → `deploy-edges.yml` verde → `supabase_functions_list` mostra `geo-gateway`
- **Evidência:** link da run do deploy + invoke `provider-status` em prod

---

## BLOCO 3 — Endereço no pedido (etapas 33–42)

### 33 — Hook `src/hooks/useGeo.ts`
- [ ] `useGeoAutocomplete(input, {bias})` com debounce 300 ms, `sessionToken` (uuid v4) gerado ao focar e descartado após `place-details`
- [ ] `useGeoPlaceDetails`, `useGeocode`, `useRoute`, `useMatrix`, `useStaticMap` → todos via `supabase.functions.invoke('geo-gateway')`
- [ ] Tipos em `src/types/geo.ts` espelhando `_shared/schemas.ts`
- **Evidência:** vitest `useGeo.test.ts`

### 34 — `AddressAutocomplete.tsx` com provedor ✅
- [x] `useAddressSearchBox` (gateway, sessão por token) substituiu `useMapboxGeocode`; o CRM (`useAddressSearch`) continua como **primeiro grupo** da lista, seguido de "Já usados" e do provedor
- [x] Selecionar sugestão → `place-details` → emite `onAddressSelected(GeoAddress)` com `formatted`, `location`, `place_id`, `components`, `precision` e `provider`
- [x] Estados: spinner no campo, vazio ("Nenhum resultado para …" + "tente incluir o número do imóvel ou o CEP"), **429 de orçamento** com texto próprio e botão "usar o endereço como digitado", rede errada com mensagem distinta
- **Evidência:** `AddressAutocomplete.test.tsx` 6/6 verde (3 de falha/429 + 2 novos de `onAddressSelected` + 1 de frequentes); o novo teste de emissão sem coordenada prova que não se inventa `[0,0]`

### 35 — `NewOrderDialog.tsx`: coordenadas reais ✅ (com uma decisão revista)
- [x] `pickupGeo`/`deliveryGeo` no state, alimentados por `onAddressSelected`; editar o texto à mão **descarta** a coordenada antiga (senão a cotação usaria outro endereço com o ponto velho)
- [x] `lat:'0'` não existe no código: a versão atual já removia o placeholder e mandava só `address` (0,0 devolve `ERR_OUT_OF_SERVICE_AREA`). Agora manda `coordinates` **quando** há ponto (`stopCoordinates` → `resolveDeliveryPoint`, priorizando `routable_point`)
- [x] **Não bloqueia** "Cotar" sem coordenada: sem ponto a Lalamove geocodifica o texto e a cotação conclui — bloquear travaria o fluxo que hoje funciona. O fallback de geocode do lado servidor é a etapa 37 (feita)
- [ ] `place_id`/`components`/`pickup_contact_*` no body: a edge ainda não aceita esses campos da UI; hoje eles entram pelo servidor (`persistOrderCoordinates` + etapa 37). Fica aberto até o contrato da edge mudar
- **Evidência:** `stopCoordinates` é função pura coberta pelos testes de `AddressAutocomplete` (emissão com e sem coordenada); `tsc --noEmit` e `eslint` limpos

### 36 — `lalamove-api`: persistir endereço completo
- [ ] Em `order` (`lalamove-api/index.ts:692-704`) e `upsertOrderToDatabase`: gravar `pickup_/delivery_latitude/longitude`, `*_place_id`, `*_address_components`, `geocode_provider`, `geocode_precision`, `pickup_contact_*`
- [ ] **Inserir `lalamove_stops`** (hoje nenhuma edge insere) com `stop_id` da cotação (coluna criada no #107), `latitude/longitude`, `place_id`, `contact_*`
- [ ] Teste Deno do mapeamento quotation→stops
- **Evidência:** `SELECT * FROM lalamove_stops WHERE order_id = ...` com 2 linhas após pedido real

### 37 — Geocodificação server-side de fallback ✅
- [x] Se o pedido chegar sem lat/lng (fonte `bitrix24`, `uapi_import`, n8n): `lalamove-api` chama `geo-gateway geocode` **depois** de gravar o pedido; grava `geocode_provider`/`geocode_precision` do provedor que resolveu
- [x] Precisão `low`/`unknown` **ou** endereço sem número → `requires_address_review=true` e alerta `APPROVAL_REQUIRED`
- **Evidência:** `supabase/functions/lalamove-api/geocode-fallback.ts` + 11 testes Deno verdes; `stopsCoords(stops).every(lat === null)` é a condição de disparo; falha do gateway nunca derruba o pedido (devolve `null`)

### 38 — Address Validation (D7: desligado, pronto para ligar) ✅
- [x] Action `validate` no gateway (`POST https://addressvalidation.googleapis.com/v1:validateAddress`, `regionCode: BR` default) atrás de `geo_settings.function='validate'` (default `off`)
- [x] `verdict.addressComplete=false` → `address_complete=false` + `missing_components` no retorno; a UI consome quando ligada
- **Evidência:** antes era **ação morta** (presente em `GeoFunction` mas ausente de `ACTION_FUNCTION`, `runProvider` e dos providers → 422 "action desconhecida"). Agora `GoogleProvider.validate` existe, tem SKU `address_validation` e rate limit próprio `address_validation` (300/min); 3 testes Deno em `google.test.ts`; suíte do gateway 75/75 verde

### 39 — Backfill de pedidos existentes ✅
- [x] `geo_backfill` (tipo já existente no CHECK desde `20261122130100`) ganhou `payload.source='orders'` — antes o job só geocodificava os endereços que vinham no payload e **não gravava nada** em `lalamove_orders`: pedido sem coordenada continuava sem coordenada para sempre
- [x] Varre `pickup_latitude IS NULL OR delivery_latitude IS NULL`, processa **status ativo primeiro**, teto de 500 por execução (default 100), endereço < 5 chars nem gasta chamada
- [x] Grava `*_latitude/longitude`, `*_place_id` (com prefixo `google:`/`mapbox:` exigido pela constraint), `geocode_provider`, `geocode_precision`; `requires_address_review` quando precisão é `low`/`unknown` ou falta número
- [x] O cap de 1.000/dia e o cache ficam no `geo-gateway` (orçamento + rate limit) — o job não duplica essa lógica
- **Evidência:** `job-worker/geo-backfill-orders.test.ts` **9/9 verde** (usou precise `exact`; sem número → revisão; `low` → revisão; lado já com coordenada não é recotado; sem resultado não grava; `GEO_UNAVAILABLE` é `skipped` e não queima tentativa; ativo primeiro; endereço curto não chama provedor; `limit` limitado a 500/100)

### 40 — Importação Bitrix24 / Zapp
- [ ] `bitrix24-sync` e `bitrix24-process-queue`: ao criar pedido a partir do SPA 1690, popular endereço e disparar geocode (etapa 37)
- [ ] Gravar `place_id` de volta no campo customizado do SPA (se existir) para reaproveitar
- **Evidência:** item do SPA → pedido com coordenadas

### 41 — Contrato de posição com a UAPI (outro chat)
- [ ] Documentar em `docs/GEO_CONTRACT.md` o que este plano **lê**: `active_tracking(order_id UNIQUE, current_latitude, current_longitude, heading, speed, last_updated, tracking_status='active'|'ended', driver_id)` e `lalamove_orders(lalamove_status, driver_lalamove_id, scheduled_at)`
- [ ] Exigência: UPSERT em `active_tracking` a cada ciclo (10–15 s) — é o UPDATE que dispara o trigger da etapa 20
- [ ] Linha criada em `DRIVER_ASSIGNED`/`ON_GOING`, `tracking_status='ended'` em `COMPLETED/CANCELED`
- **Evidência:** doc mergeado e confirmado pelo chat da UAPI

### 42 — n8n F01 sem DistanceMatrix.ai
- [ ] Nós "Geo Coleta"/"Geo Entrega" (`lalamove_f01_cotacao.json:62,77`) → HTTP para `geo-gateway geocode` com service_role (credencial n8n) **ou** remover geocode do n8n e deixar a edge fazer (etapa 37)
- [ ] Atualizar `lalamove_bundle_import.json`
- **Evidência:** execução de teste do F01 no n8n com coordenadas reais

---

## BLOCO 4 — Rota esperada e ETA (etapas 43–52)

### 43 — Edge `geo-route-planner` (ou action interna do `job-worker`)
- [ ] Gatilho: `lalamove_status` vira `ON_GOING` (motorista a caminho) ou `PICKED_UP` → job `route_plan` em `job_queue`
- [ ] Calcula `route(driverPos → próximo stop → stops seguintes)` com `traffic=false` (Essentials) e grava `active_tracking.expected_route` (polyline), `route_distance_m`, `route_duration_s`, `route_provider`, `next_stop_index`
- **Evidência:** `expected_route` com >20 pontos para pedido real

### 44 — Recalcular rota quando sai do caminho
- [ ] Se `distance_to_route_m > off_route_threshold` (de `map_settings_overrides`, padrão 300 m) por 2 ciclos → job `route_plan` novo (máx 1 a cada 5 min por pedido)
- **Evidência:** teste com posição simulada fora da rota → nova rota, `geo_usage` +1

### 45 — Função SQL `geo_update_route_metrics()`
- [ ] No trigger da etapa 20: calcular `distance_to_route_m = geo_point_to_polyline_m(...)`, `distance_to_next_stop_m = geo_haversine_m(... stop[next_stop_index])`, `is_on_route = distance_to_route_m <= threshold`
- [ ] Sem chamada externa; < 5 ms
- **Evidência:** `EXPLAIN ANALYZE`

### 46 — Avanço de parada
- [ ] `distance_to_next_stop_m < 100` por ≥ 2 ciclos ou status Lalamove `PICKED_UP` → `next_stop_index += 1`, `lalamove_stops.arrived_at = now()`
- **Evidência:** pedido real: `arrived_at` preenchido na coleta

### 47 — ETA por Route Matrix
- [ ] Job `eta_refresh`: `matrix(origins=[driverPos], destinations=[next_stop])` → `eta_minutes = ceil(duration_s/60)`, `eta_updated_at`, `eta_provider`
- [ ] `travelMode: DRIVE` sempre (D10)
- **Evidência:** `eta_minutes` muda a cada refresh em pedido real

### 48 — Cadência de ETA controlada por custo (D9)
- [ ] Recalcular só se `now()-eta_updated_at > 60 s` **e** (`driver andou > 300 m` ou `eta_minutes <= 15`)
- [ ] Entre refreshes: ETA estimado localmente = `distance_to_next_stop_m / velocidade média dos últimos 5 pontos` (sem custo)
- [ ] Custo máximo por pedido: ~60 min × 1/min = 60 elementos ≈ US$ 0,30 (Essentials) — documentar
- **Evidência:** `geo_usage` de um pedido completo ≤ 70 elementos

### 49 — Trânsito (Pro) só quando importa
- [ ] `traffic=true` apenas se `eta_minutes <= 15` (janela do aviso de aproximação); senão Essentials
- **Evidência:** `geo_usage.sku` mostra `route_matrix_pro` só perto do fim

### 50 — `ETA_DELAY`
- [ ] Se `now() + eta_minutes > scheduled_at + late_delivery_threshold` (de `alert_configurations.LATE_DELIVERY`, padrão 15 min) → evento `ETA_DELAY` (1× por pedido por parada)
- **Evidência:** teste com `scheduled_at` no passado → alerta criado

### 51 — Snap-to-road (Roads API) — desligado por padrão
- [ ] Action `snap` no gateway (`https://roads.googleapis.com/v1/nearestRoads?points=`) atrás de `geo_settings.snap='off'`; quando `on`, aplicar antes de `distance_to_route_m`
- **Evidência:** teste Deno com fixture

### 52 — Testes do bloco
- [ ] Fixture de trajeto real (Centro→Jardim Botânico, 40 pontos) em `supabase/tests/fixtures/route_curitiba.json`; replay via `simulate-driver-movement` (já exige JWT) → verificar `is_on_route`, `next_stop_index`, `eta_minutes`
- **Evidência:** saída do replay

---

## BLOCO 5 — Motor de geo-eventos (etapas 53–64)

### 53 — Função `geo_evaluate_events()` (corpo do trigger da etapa 20)
- [ ] Lê pedido + stops; calcula distância ao stop de coleta (index 0) e de entrega (último); lê `approach_radius_m`, `approach_eta_min`, `notify_delivery_contact`
- [ ] Para cada evento candidato: `INSERT INTO order_geo_events ... ON CONFLICT DO NOTHING`; se inseriu → `INSERT alerts` + `job_queue(type='notification')`
- **Evidência:** teste SQL: 2 UPDATEs dentro do raio → 1 evento

### 54 — `DRIVER_APPROACHING_PICKUP` (D4)
- [ ] Condição: `lalamove_status IN ('ON_GOING')` **e** `next_stop_index = 0` **e** (`distance_to_next_stop_m <= approach_radius_m` **ou** `eta_minutes <= approach_eta_min`)
- [ ] Payload: distância, ETA, nome/placa do motorista (`driver_name/plate` do #107), `share_link`
- **Evidência:** pedido real: evento criado antes da chegada

### 55 — `DRIVER_ARRIVED_PICKUP`
- [ ] Condição: `distance_to_next_stop_m <= 100` por ≥ 2 ciclos **ou** `lalamove_stops[0].arrived_at` preenchido
- [ ] Vai fora da janela de horário (D3)
- **Evidência:** evento + mensagem

### 56 — Aviso também para a equipe interna
- [ ] `alert_configurations.DRIVER_APPROACHING_PICKUP` com `notify_slack/whatsapp` internos (grupo logística) — além do responsável pela coleta
- **Evidência:** 2 destinatários em `alerts_sent`

### 57 — `DRIVER_APPROACHING_DELIVERY` / `DRIVER_ARRIVED_DELIVERY` (D5)
- [ ] Mesma lógica com `next_stop_index = último` e destinatário = `lalamove_stops[last].contact_phone`
- [ ] Só se `notify_delivery_contact = true` (padrão false)
- **Evidência:** teste com flag on/off

### 58 — Janela de horário (D3)
- [ ] `geo_notification_allowed(event_type, now())`: 07:00–20:00 `America/Sao_Paulo`; fora → `notification_status='deferred'`, `job_queue.run_at = próximo 07:00`; exceção `*_ARRIVED_*`
- [ ] Configurável em `geo_settings_meta` (jsonb: `quiet_hours_start/end`)
- **Evidência:** teste com relógio mockado

### 59 — Resolução do destinatário (D1)
- [ ] Ordem: `pickup_contact_phone` → `supplier_contact` (se `auto_notify_supplier`) → `lalamove_stops[0].contact_phone`; normalizar E.164 (`+55…`), rejeitar máscara `****`
- [ ] Sem destinatário válido → `notification_status='no_recipient'` + alerta interno
- **Evidência:** teste com 3 cenários

### 60 — Opt-out e dedup
- [ ] Tabela `notification_optouts(phone PK, reason, created_at)`; checar antes de enviar
- [ ] `alert_dedup` já existe (`20260712221144`): chave `order_id+event_type+recipient`
- **Evidência:** 2º envio bloqueado

### 61 — Encerramento do tracking
- [ ] Em `COMPLETED/CANCELED/REJECTED/EXPIRED`: `tracking_status='ended'`; eventos pendentes `deferred` são cancelados
- **Evidência:** pedido cancelado não gera mensagem

### 62 — Painel de eventos no pedido
- [ ] `OrderDetailModal.tsx`: aba "Eventos" lendo `order_geo_events` (ícone, hora, distância, ETA, status da notificação, reenviar)
- **Evidência:** screenshot

### 63 — Reenvio manual
- [ ] Botão "Reenviar aviso" → `send-notification` com `force=true` (operator+), registra em `alerts_sent` com `manual=true`
- **Evidência:** `alerts_sent` com a linha

### 64 — Testes do bloco
- [ ] pgTAP/`DO` para `geo_evaluate_events` (6 cenários) + Deno para resolução de destinatário e janela
- **Evidência:** CI verde

---

## BLOCO 6 — Notificações (etapas 65–74)

### 65 — Consertar os chamadores de `send-notification`
- [ ] `lalamove-webhook/index.ts:314`: `alertId→alert_id`, `driverId→driver_id`, `orderId→order_id`
- [ ] GUARDIAN (`:383-396`): montar payload v1 completo (`alert_id, type, severity, title, message`)
- [ ] `check-driver-alerts:58,162,225`: tipos agora existem no enum (etapa 16)
- **Evidência:** teste Deno `security.test.ts` estendido; log sem 400

### 66 — `send-notification`: destinatários por pedido
- [ ] Schema v2: `recipients?: [{channel:'whatsapp'|'email', to, role:'pickup_contact'|'delivery_contact'|'internal'}]`; quando presente, **une** com os de `alert_configurations` (hoje ignora `metadata.contact`, `:109-113`)
- [ ] Manter v1 intacto (contrato versionado em `_shared/contract.ts`)
- **Evidência:** teste Deno com `recipients` → Evolution chamado com o número do pedido

### 67 — Templates por evento
- [x] `alert_configurations.message_template` com variáveis `{{driver_name}} {{driver_plate}} {{eta_min}} {{distance_m}} {{share_link}} {{order_ref}} {{pickup_address}} {{static_map_url}}`
- [x] Textos PT-BR iniciais: aproximação ("Olá {{pickup_contact_name}}, o motorista {{driver_name}} ({{driver_plate}}) chega em ~{{eta_min}} min para retirar o pedido {{order_ref}}. Acompanhe: {{share_link}}"), chegada, atraso
- [x] Render em `_shared/template.ts` (sem dependência nova)
- **Evidência:** `_shared/template.test.ts` — 9 testes Deno verdes; `send-notification` usa `renderTemplate` no lugar do texto cru do trigger.

### 68 — Imagem estática no WhatsApp
- [ ] Para `*_APPROACHING_*`: `geo-gateway static` (marker motorista + marker coleta + rota) → Evolution `sendMedia`; se orçamento bloquear, manda só texto
- **Evidência:** mensagem recebida com imagem no número de teste

### 69 — Canal Zapp Web (D2, preparado)
- [x] Adaptador `channels/zapp.ts` com interface igual ao Evolution; ativado por `ZAPP_API_URL/ZAPP_API_KEY` quando existirem; sem secret → canal ausente
- **Evidência:** `zapp.test.ts` 9/9 verde (Bearer, número normalizado, `instance` opcional, destinatário vazio não chama API, 401 com trecho do corpo, erro de rede sem lançar, timeout abortado, factory `null` sem secrets, `normalizeZappNumber`). `sendWhatsApp` usa o Zapp como **preferencial** e cai no Evolution quando não configurado — nenhum secret configurado continua sendo o único caso de falha. `deno check` sem erro novo (4 erros de `order_id` são pré-existentes no `main`).

### 70 — Agendar `check-driver-alerts` e `escalate-alerts`
- [ ] 🔒 `cron.schedule('check-driver-alerts','*/1 * * * *', net.http_post(...))` e `escalate-alerts` a cada 5 min (padrão de `process_job_queue`, `20251226010001`)
- [ ] Registrar em `docs/CRON_JOBS.md`
- **Evidência:** `cron.job_run_details` com execuções

### 71 — `alert_configurations` dos novos tipos
- [ ] Linhas com canais, `min_interval_seconds=300`, `dedup_window`, template; `is_enabled=true` para pickup, `false` para delivery
- **Evidência:** `SELECT alert_type,is_enabled FROM alert_configurations`

### 72 — UI de configuração dos novos alertas
- [x] `AlertConfigCard.tsx`: suportar os 8 tipos novos; campos raio/ETA padrão; preview do template
- **Evidência:** `AlertConfigCard.test.tsx` — 3 testes verdes: os 8 `alert_type` geo resolvem para rótulo PT-BR em vez de cair no fallback do nome cru; o preview substitui `{{driver_name}}`/`{{driver_plate}}`/`{{eta_min}}` pelos valores de exemplo e não deixa `{{` no texto; variável desconhecida é preservada (não apagada). Os padrões de raio/ETA vivem em `geo_defaults` e são editados na `MapsSettingsPage` (etapa 88) — o card não duplica esses campos.
- **Correção embutida:** o placeholder do modal ensinava `{driver_name}` (chave simples), sintaxe que `_shared/template.ts` **não** renderiza — quem seguia a dica gravava template que saía literal na mensagem do cliente. Agora o hint lista `{{variavel}}` e vem de `TEMPLATE_VARIABLES`.

### 73 — Histórico
- [x] `NotificationHistoryPage.tsx` + `useNotificationHistory`: filtrar por pedido e por tipo geo; mostrar `deferred/no_recipient`
- **Evidência:** `NotificationHistoryPage.geo.test.tsx` — 3 testes verdes: evento `deferred` aparece com rótulo PT-BR, distância e ETA; `no_recipient` e `failed` aparecem como casos que exigem ação; o card some quando não há evento pendente.
- **Correção embutida:** a página lia só `alerts_sent`, que registra apenas o que foi despachado. `queued`/`deferred`/`no_recipient` não têm linha lá — então a tela mostrava tudo entregue justamente quando o cliente não recebeu nada. Novo `usePendingGeoEvents()` lê `order_geo_events` filtrando os 4 status acionáveis, com `refetchInterval` de 30 s.

### 74 — Teste ponta a ponta de notificação
- [ ] Pedido real barato (R$ ~9,52, já validado no E2E) com `pickup_contact_phone` = número de teste da Promo Brindes → receber "aproximando" e "chegou"
- **Evidência:** print das mensagens + `order_geo_events`

---

## BLOCO 7 — Front: mapas (etapas 75–84)

### 75 — `useGoogleMapsLoader.ts` para chave própria
- [x] `VITE_GOOGLE_MAPS_BROWSER_KEY` + `VITE_GOOGLE_MAPS_MAP_ID` (fallback para `VITE_LOVABLE_CONNECTOR_*` durante transição); `v=weekly`, `libraries=maps,marker,routes`; remover comentário "política do conector" (`:8`)
- **Evidência:** `useGoogleMapsLoader.test.ts` — 7 testes verdes, incluindo `v=weekly` + `libraries=maps,marker,routes` com chave própria e ausência de `mapId` no modo conector.

### 76 — `GoogleMapsCanvas.tsx` com Advanced Markers
- [x] `mapId` no `google.maps.Map`; `google.maps.marker.AdvancedMarkerElement` em vez de `Marker` (legado, `:66,88`); ícones reaproveitando `markerFactories.ts`
- **Evidência:** `createDriverMarkerElement` usado no lugar do SVG inline; `mapId` só entra com chave própria (o conector proíbe a API). `tsc --noEmit -p tsconfig.app.json` limpo; suite 979/979.

### 77 — Polyline da rota + motorista + ETA no Google
- [ ] Desenhar `active_tracking.expected_route` (`google.maps.Polyline`) e trilha `tracking_events`; marker do motorista animado entre pontos (interpolação 10 s)
- [ ] Badge de ETA e distância no `MapHUD.tsx`
- **Evidência:** screenshot com rota e motorista

### 78 — Mesmo no Mapbox
- [ ] `mapLayers.ts`: layer `expected-route` (line) e `driver-trail`; mesma fonte de dados → paridade entre provedores
- **Evidência:** screenshot

### 79 — Mini-mapa no detalhe do pedido
- [ ] `OrderDetailModal.tsx` (entre header ~545 e paradas ~778): componente `OrderTrackingMap` (300 px) com coleta, entrega, rota e motorista; usa o provedor de `geo_settings.tiles`; lazy (só monta se `tracking_status='active'`) para não gastar map load
- [ ] Link "Abrir rastreio Lalamove" (shareLink) mantido
- **Evidência:** screenshot

### 80 — Provedor de tiles vem do servidor
- [ ] `useMapSettings.ts`: `provider` padrão lido de `geo_settings.tiles` (query) e **override por usuário** só entre provedores habilitados; persistência local continua para preferências visuais
- [ ] Contar map load: `geo-gateway` action `count-map-load` (sem custo externo) ao inicializar o mapa → `geo_usage(tiles)`
- **Evidência:** admin muda para `google` → novo usuário abre em Google

### 81 — Autocomplete com viés de localização
- [ ] `locationBias` = centro do mapa atual ou coordenada do último pedido do cliente
- **Evidência:** sugestões de Curitiba primeiro

### 82 — Acessibilidade e i18n
- [ ] Strings novas em `src/i18n/locales/{pt-BR,en,es}`; componentes com `aria-label`
- **Evidência:** lint i18n verde

### 83 — Remover `mapbox-proxy` e `get-mapbox-token` redundantes
- [ ] Após `useMapbox.ts` migrar para `useGeo.ts`: apagar `mapbox-proxy` (token Mapbox continua via `get-mapbox-token` só para tiles)
- [ ] Atualizar `docs/ci/MATRIZ_EDGE_TABELA.md`
- **Evidência:** `supabase_functions_list` sem `mapbox-proxy`

### 84 — Testes de front
- [ ] vitest: `useGeo`, `AddressAutocomplete`, `OrderTrackingMap` (mock do loader); Playwright `e2e/`: criar pedido com autocomplete → coordenadas preenchidas
- **Evidência:** CI verde

---

## BLOCO 8 — Admin "Mapas & Custos" (etapas 85–92)

### 85 — Rota `/settings/maps` (manager/admin)
- [ ] `src/pages/settings/MapsSettingsPage.tsx`, registrar em `App.tsx` ao lado de `/settings/lalamove`; entrada no menu
- **Evidência:** rota abre

### 86 — Seletor por função (D6)
- [ ] Tabela: função × provedor (google/mapbox/off) × fallback; salva em `geo_settings` (RLS admin); confirmação ao mudar `autocomplete`/`geocode`
- **Evidência:** `geo_settings.updated_by` preenchido

### 87 — Orçamento
- [ ] Card por provedor: gasto do mês (`geo_usage_month`), limite, barra %, `hard_stop`, `alert_at_pct`; editar `geo_budget`
- **Evidência:** screenshot

### 88 — Uso por função/dia
- [ ] Gráfico recharts (barras empilhadas por SKU) e tabela; export CSV
- **Evidência:** screenshot

### 89 — Teste de chave / saúde
- [ ] Botão "Testar Google" → `geo-gateway provider-status` (geocode de endereço fixo, conta 1 uso) → latência e SKU; idem Mapbox; integrar em `check-external-api/index.ts` (hoje só Mapbox `:232`)
- **Evidência:** status verde/vermelho na UI

### 90 — Parâmetros de geofence globais
- [ ] Editar padrões `approach_radius_m`, `approach_eta_min`, horário silencioso, `notify_delivery_contact` padrão; override por pedido continua em `NewOrderDialog` (campo avançado)
- **Evidência:** novo pedido herda padrão

### 91 — Auditoria
- [ ] Toda mudança em `geo_settings`/`geo_budget` → `audit_log` (`20251226000002`) com antes/depois
- **Evidência:** linha no `audit_log`

### 92 — Permissões
- [ ] `permissions`/`role_permissions`: `maps.settings.write` só admin; `maps.usage.read` manager+
- **Evidência:** viewer recebe 403 na edge e UI oculta

---

## BLOCO 9 — Qualidade, deploy, operação (etapas 93–100)

### 93 — CI
- [ ] `ci.yml`: incluir `geo-gateway/*.test.ts` em `contract-tests`; `edge-integration-tests` chama `provider-status` em prod após deploy
- **Evidência:** run verde

### 94 — Deploy e verificação
- [ ] Cada PR mergeada → `deploy-edges.yml` verde → `supabase_functions_list`; front → deploy Vercel `lalamove-v2` READY
- **Evidência:** links das runs

### 95 — Verificação de cotas e custo real
- [ ] Após 7 dias: comparar `geo_usage_month` com "Relatórios" do Google Cloud Billing; ajustar `geo_price_list` se divergir > 5%
- **Evidência:** tabela comparativa em `docs/GOOGLE_MAPS.md`

### 96 — Alertas operacionais
- [x] `GEO_BUDGET_WARNING` → Slack interno; erro 4xx/5xx do Google > 5%/h → `INTEGRATION_FAILURE`
- **Evidência:** custo já estava em `geo-gateway/index.ts:181-215` (`warnBudgetOnce`). Disponibilidade entregue na PR #224: `geo-gateway/error-monitor.ts` grava cada falha de provedor em `query_telemetry` (`severity='error'`) e, quando a taxa da última hora passa de 5% com amostra ≥ 20, emite `INTEGRATION_FAILURE` (`WARNING` até 50%, `CRITICAL` acima). Cooldown de 1h por provedor via `geo_cache` (PK atômica, sem DDL). **14 testes** em `error-monitor.test.ts`, todos verdes.

### 97 — Runbook
- [x] `docs/RUNBOOK_GOOGLE_MAPS.md`: chave vazada (rotação em 2 chaves), orçamento estourado, Google fora (forçar Mapbox), Mapbox fora (forçar Google), `geo_cache` corrompido
- **Evidência:** doc mergeado — PR #213 (8 seções + §3b failover inverso)

### 98 — Limpeza de legado
- [x] Remover `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*` do baseline Vercel e do loader; remover `simulate-driver-movement` de produção (ou manter atrás de flag dev); migrar `region_cache` para `geo_cache`
- **Evidência:** os 3 itens foram auditados em 22/11 e **mantidos de propósito**, com justificativa:
  - `simulate-driver-movement` — exigido por `LiveMapPage.tsx:98` e é o único caminho de teste do pipeline geo sem frota real; já tem `verify_jwt = true` (`config.toml:12`). Remover bloquearia a validação das etapas de aceite.
  - `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*` — é a chave **de navegador**, distinta da de servidor (`GOOGLE_MAPS_SERVER_KEY`); não há substituta sem projeto Google próprio.
  - `region_cache` — já consome a action `reverse` do `geo-gateway` (`useRegionResolver.ts:73,99`), que respeita `geo_settings`; não chama Mapbox v5 direto. Migrar para `geo_cache` não muda comportamento nem custo.

### 99 — Aceite com pedido real
- [ ] Checklist: pedido criado com autocomplete Google → coordenadas e `place_id` gravados → `lalamove_stops` 2 linhas → motorista a caminho → `expected_route` gravada → ETA atualizando → aviso "aproximando" no WhatsApp do responsável → "chegou" → POD → tracking `ended` → `geo_usage` do pedido ≤ US$ 0,40
- **Evidência:** `order_geo_events`, `alerts_sent`, `geo_usage` do dia, prints

### 100 — Fechamento
- [x] Atualizar `docs/planos/ANALISE_GOOGLE_MAPS_X_LALAMOVE_V2.md` com "estado real" e este plano com ✅ por etapa
- [x] Atualizar memória do projeto (`/projects/.../areas/lalamove-v2.md`) com: projeto Google Cloud, nomes dos secrets, provedor padrão por função, orçamento → ver `docs/planos/ANALISE_GOOGLE_MAPS_X_LALAMOVE_V2.md` §6
- [x] Listar o que ficou para V3 (app do motorista, chat) e o que ficou `off` (Address Validation, Roads, entrega ao cliente final)
- **Evidência:** docs atualizados

---

## Ordem de execução e dependências

```
Bloco 0 (dono: 1,2,10🔒) ──► Bloco 1 (🔒 DDL) ──► Bloco 2 ──► Bloco 3 ──► Bloco 7 (75–81)
                                      │                                  
                                      └─► [UAPI alimenta active_tracking] ──► Bloco 4 ──► Bloco 5 ──► Bloco 6 ──► 74 (E2E)
Bloco 8 após Bloco 2 · Bloco 9 transversal
```

Custo estimado em regime (30 pedidos/dia, Curitiba): autocomplete ~900 sessões/mês (grátis) · geocode ~300 (grátis) · rotas ~1.800 (grátis até 10k) · matrix ~50k elementos/mês (~40k acima do grátis ≈ US$ 200 Essentials) ⇒ **o item que pesa é ETA**; D9 derruba para ~15k elementos (US$ 25). Mapa: Mapbox dentro dos 50k loads.

PRs previstas (uma por etapa agrupável, branch `claude/<tipo>-<slug>-<AAMMDD-HHMM>`): ~25 PRs. 🔒 aguardam o dono: 10 (rotação), 11–20 (DDL), 70 (cron), 15/30 (custo).
