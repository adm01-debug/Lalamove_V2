# Google Maps Platform × Mapbox × Lalamove V2 — análise (21/11/2026)

Base: doc oficial GMP (developers.google.com/maps, mapsplatform.google.com, tabela de preços atualizada 2026-11-12), doc Mapbox (docs.mapbox.com — API overview, Search Box, Geocoding v6, Directions v5, Matrix v1, Tokens), doc Lalamove v3 (developers.lalamove.com), repo `adm01-debug/Lalamove_V2` @ `18c9d83`→`8141d5c` (21/11/2026). Estado de produção na data = "NÃO VERIFICADO" por MCP nesta análise; vem dos docs de execução de 21/11.

> **Atualizações posteriores à análise (21/11):** itens 2 e 9 de "Quebrado / ausente" foram tratados por outras sessões (UAPI como fonte de posição; `deploy-edges.yml`); itens 1 (coordenadas 0,0) por PR #115; os itens 3, 6 e parte de 4 pela PR #118 (banco) e #129 (`geo-gateway`). Ver status nos planos.

## 1. O que o Google Maps Platform oferece que serve ao Lalamove V2

| Produto GMP | Para quê no nosso caso | SKU / cota grátis mês / preço 0–100k (USD por 1.000) |
|---|---|---|
| **Places Autocomplete (New)** `POST places.googleapis.com/v1/places:autocomplete` | Digitar endereço de coleta/entrega com sugestões; `includedRegionCodes:["br"]`, `locationBias` circle em Curitiba | Essentials · 10.000 · $2,83 por requisição; por sessão (sessionToken + Place Details) = sessão grátis + Place Details |
| **Place Details (New)** `GET /v1/places/{id}` FieldMask `location,formattedAddress,addressComponents` | Converter sugestão em lat/lng + endereço normalizado + `place_id` | Essentials · 10.000 · $5,00 (IDs-only: grátis ilimitado) |
| **Geocoding v4** `GET geocode.googleapis.com/v4/geocode/address/...` e `/v4/geocode/location` | Endereço digitado/ViaCEP → lat/lng (forward); lat/lng do motorista → bairro/rua (reverse) | Essentials · 10.000 · $5,00 |
| **Address Validation** (Brasil suportado, com metadado residential/commercial) | Validar/normalizar endereço antes de pagar pedido Lalamove; reduz ERR_OUT_OF_SERVICE_AREA | Pro · 5.000 · $17,00 |
| **Routes API — Compute Routes** `POST routes.googleapis.com/directions/v2:computeRoutes` | Rota esperada coleta→entrega (polyline), ETA com trânsito (`departureTime: now` = Pro), 2 rodas (`TWO_WHEELER` = Enterprise) | Essentials $5,00 / Pro $10,00 / Enterprise $15,00 · 25 waypoints máx · 3.000 QPM |
| **Routes API — Compute Route Matrix** | ETA motorista→coleta (1 origem × 1 destino) a cada poll; ou N pedidos de uma vez (até 625 elementos; 100 com TRAFFIC_AWARE_OPTIMAL) | Essentials $5,00 / Pro $10,00 por elemento |
| **Maps JavaScript API — Dynamic Maps** + biblioteca `routes` (classes `Route`, `RouteMatrix` substituem DirectionsService) | Mapa no detalhe do pedido e LiveMap; já carregado hoje via chave do conector Lovable | Essentials · 10.000 map loads · $7,00 |
| **Static Maps** | Miniatura do trajeto no WhatsApp/e-mail de notificação | Essentials · 10.000 · $2,00 |
| **Roads API — Nearest Road / Route Traveled** | Encaixar GPS do motorista na via (reduz falso "fora de rota") | Pro · 5.000 · $10,00 |
| **Route Optimization (Single Vehicle)** | Ordem ótima de paradas em pedido multi-stop (Lalamove já faz `isRouteOptimized:true` grátis — usar Google só para comparar) | Pro · 5.000 · $10,00 |
| **Isochrones** (preview) | Área atendível em X min — não necessário agora | — |
| **Navigation SDK / Fleet Engine / Last Mile** | **Não se aplica**: motorista é da Lalamove, não instalamos app nele (P-02 adiado para V3) | Enterprise $25,00 |

Regras que mudam o custo (routes/usage-and-billing): >10 waypoints intermediários, `optimizeWaypointOrder`, `departureTime=now` (trânsito em tempo real) e `routingPreference TRAFFIC_AWARE*` → **Pro**; duas rodas / veículo grande → **Enterprise**. `X-Goog-FieldMask` é obrigatório e enxuto = mais barato.

**Fato-chave de arquitetura:** Google não tem "geofence como serviço" para terceiros. A proximidade do motorista é calculada por nós (haversine em SQL) a partir da posição que a **Lalamove** fornece.

## 2. O que a Mapbox oferece (e o que muda em relação ao Google)

| Fato (doc oficial) | Consequência |
|---|---|
| Geocoding v6: resposta temporária **"may not be retained"** e só pode ser usada junto com um mapa Mapbox; `permanent=true` permite guardar (US$ 5/1k, sem faixa grátis, exige cartão) | Coordenada persistida no pedido **não pode vir de geocode temporário** → fonte da verdade = coordenadas devolvidas pela cotação Lalamove; Mapbox temporário só sugere/desenha |
| Search Box: `/suggest`+`/retrieve` cobrados **por sessão** (`session_token` obrigatório; fecha no retrieve, 180 s sem retrieve ou 50 suggests); `/forward`/`/reverse`/`/category` por requisição; 10 req/s; geografias listadas: EUA, Canadá, Europa | Autocomplete Mapbox exige teste de cobertura BR (etapa 36) com fallback para Geocoding v6 `autocomplete=true` (cobra por tecla) |
| Directions v5: `driving-traffic`, `driving`, `walking`, `cycling`; 2–25 coordenadas; POST para URL > 8 KB; **sem moto** | ETA de LALAGO com `driving-traffic` |
| Matrix v1: por elemento; `driving-traffic` **2–10 coordenadas, 30 req/min**; demais 25 coords, 60/min | ETA 1×1 com trânsito a cada 60 s cobre 30 pedidos simultâneos; acima → `driving` ou Google |
| Rate limits por token: Directions 300/min, Geocoding 1.000/min, Static 1.250/min, Map Matching 300/min; 429 + `X-Rate-Limit-Reset` | Rate guard no `geo-gateway` |
| Tokens: `pk.` só scopes públicos, `sk.` públicos+secretos, `tk.` ≤ 1 h; `allowedUrls` (≤ 100) em pk/sk; Tokens API rotaciona | pk restrito por URL no front; sk só no gateway |
| Preço: map loads 50k grátis; Geocoding temporário 100k; Directions/Matrix/Map Matching/Isochrone/Optimization 100k; Static 50k; Search Box 2.500 sessões (US$ 11,50/1k depois) | Mapbox mais barato em tiles/rota/matriz/snap; mais caro em autocomplete por sessão |

## 3. O que a Lalamove fornece (developers.lalamove.com)

- Posição do motorista pela API v3: **somente polling** `GET /v3/orders/{orderId}/drivers/{driverId}` → `coordinates {lat,lng,updatedAt}`, atualiza a cada **10 s**, disponível a partir de 1 h antes do `scheduleAt` ou da chegada à coleta; 403 fora da janela; até COMPLETED. **Não existe webhook de localização**. Rate limit prod: Driver Details 300/min, Order Details 300/min, Quotation 100/min.
- UAPI (portal web logado, `br-uapi.lalamove.com`): `order_status` ("status tempo real"), `order_time_status` ("status com ETA", `driver_fid`), `order_tracking` (`share_id`,`sign`) — schema de resposta com lat/lon do motorista não capturado no repo; adotada como fonte de posição por outra sessão (Session Worker UAPI).
- `GET /v3/orders/{id}` traz `shareLink`, `stops[].coordinates`, `distance`, `driverId`. A **cotação v3 geocodifica sozinha** e devolve coordenadas + `stopId` (PR #115) — coordenada grátis e sem restrição de retenção.

## 4. Estado real do Lalamove V2 na data da análise (repo @ 18c9d83, arquivo:linha)

### Já existia
- Seletor visual Google/Mapbox: `src/hooks/useMapSettings.ts:7-14` (`MapProvider` = mapbox-dark|mapbox-sat|osm|esri-sat|google-roadmap|google-hybrid|google-3d), persistido **no localStorage por usuário** (`:126`), UI `src/components/map/MapProviderSelector.tsx`.
- Google Maps JS carregado em `src/components/map/hooks/useGoogleMapsLoader.ts:27-30,68` com `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` (chave de navegador do conector Lovable, `v=beta`, `libraries=maps3d,marker`, sem mapId). Canvas: `GoogleMapsCanvas.tsx` (Marker legado), `Google3DCanvas.tsx`.
- Mapbox: `mapbox-gl ^3.30`, token via edge `get-mapbox-token` (secret `MAPBOX_ACCESS_TOKEN`), edge `mapbox-proxy` com 9 actions (geocode v5, reverse-geocode v5, directions, matrix, isochrone, optimization, map-matching, static-image, tilequery) — sem cache, sem rate limit, sem contagem de custo, sem bloco no config.toml.
- Tabelas de posição: `active_tracking` (current_lat/lng, heading, speed, is_on_route, eta_minutes, expected_route JSONB, origin/destination lat/lng), `driver_locations`, `tracking_events` (particionada por mês). `region_cache` para reverse geocode.
- `feature_flags` (name, is_enabled, rules JSONB) com RLS admin — hook `useFeatureFlags.ts` não usado, sem UI.
- `map_settings_overrides` (geofence_radius, off_route_threshold, stopped_threshold por user/context) — sem coluna de provedor.
- Notificação: edge `send-notification` com canais reais WhatsApp (Evolution API), e-mail Resend, Slack, tarefa Bitrix24, webhook n8n; destinatários **só** de `alert_configurations` por `alert_type` (`:109-113`). SMS = colunas sem envio. Push = só `new Notification()` local.
- `lalamove_orders` já tinha `supplier_contact`, `auto_notify_supplier`, `stalled_threshold_minutes` (15), `route_deviation_threshold_minutes` (10) (`20260517125817`).

### Quebrado / ausente (bloqueava "motorista perto da coleta → avisar responsável")
1. **Pedido sem coordenadas**: `NewOrderDialog.tsx:247-248` enviava `coordinates {lat:'0',lng:'0'}` (→ 422 `ERR_OUT_OF_SERVICE_AREA`); `lalamove-api/index.ts:692-704` gravava só endereço texto; nenhuma edge inseria `lalamove_stops`; não existia `place_id`. *(PR #115 removeu o 0,0; gravação de stops/place_id = Bloco 3 dos planos.)*
2. **Posição do motorista descartada**: `lalamove-api/index.ts:470-480` ignorava `coordinates`; webhook tratava `DRIVER_LOCATION_UPDATED` (evento inexistente) e só fazia UPDATE em `active_tracking`; ninguém fazia INSERT; sem polling. *(UAPI Session Worker — outra sessão.)*
3. **Sem geometria**: sem PostGIS, sem haversine, sem geofence; `is_on_route`/`eta_minutes` só pelo simulador; `expected_route` nunca gravado. *(PR #118.)*
4. **Aviso ao fornecedor nunca saía**: webhook chamava `send-notification` em camelCase `{alertId…}` (`lalamove-webhook/index.ts:314`) contra schema `alert_id` (`_shared/schemas.ts:53`) → 400; GUARDIAN (`:383-396`) sem alert_id/severity/title; tipos `SUPPLIER_ALERT`, `SUPPLIER_DELAY_NOTICE`, `MISSING_POD` fora do enum `alert_type`; `send-notification` ignora `metadata.contact/recipient`. *(Enum: PR #118. Chamadores e destinatários: Google etapas 65–66, pendentes.)*
5. **`check-driver-alerts` e `escalate-alerts` sem cron**. *(Google etapa 70, pendente.)*
6. **Toggle de provedor** só visual e por usuário; sem controle global, uso/custo, orçamento. *(PR #118 `geo_settings`/`geo_usage`/`geo_budget` + PR #129 resolver; UI admin = Bloco 8/6 dos planos.)*
7. **Chave DistanceMatrix.ai hardcoded** (prefixo `k2sJ`) em `lalamove_f01_cotacao.json:62,77`, `lalamove_bundle_import.json`, `lalamove_f00_bootstrap.json`, docs .md/.html → rotacionar. *(Google etapa 10, pendente.)*
8. `.env.example` sem variáveis Google; sem secret Google de servidor. *(Google etapas 7–9, pendentes.)*
9. Deploy de edge manual. *(`deploy-edges.yml` — PR #108.)*

### Mapbox vs Google — equivalência para a camada de provedor

| Função | Google | Mapbox | Grátis/mês G / M |
|---|---|---|---|
| Tiles/mapa web | Maps JS Dynamic Maps | mapbox-gl map load | 10k / 50k |
| Autocomplete | Places Autocomplete (New) | Search Box sessions | 10k req / 2.500 sessões |
| Geocode fwd/rev | Geocoding v4 | Geocoding v6 (temporary; permanent p/ gravar) | 10k / 100k (perm.: 0) |
| Rota + polyline + ETA | Routes computeRoutes | Directions `driving-traffic` | 10k / 100k |
| Matriz ETA | Route Matrix (por elemento) | Matrix (por elemento) | 10k / 100k |
| Snap GPS à via | Roads Nearest Road (Pro) | Map Matching | 5k / 100k |
| Static map | Static Maps | Static Images | 10k / 50k |
| Validação de endereço | Address Validation (BR) | — | 5k / — |
| Isócronas / otimização multi-parada | Isochrones (preview) / Route Optimization (Pro) | Isochrone / Optimization | — / 100k |

## 5. Arquitetura adotada (detalhada nos planos)
- **Camada `geo`** no servidor: edge `geo-gateway` (PR #129) — actions `autocomplete`, `place-details`, `geocode`, `reverse`, `route`, `matrix`, `static`, `snap`, `isochrone`, `optimization`, `tilequery`, `count-map-load`, `provider-status`; lê `geo_settings.<função>` ∈ {google, mapbox, auto, off} + `fallback_provider`; cache `geo_cache` (TTL por função; Mapbox temporário não cacheia); medição `geo_usage` via `geo_usage_increment` (desconta cota grátis); orçamento `geo_budget`/`geo_budget_status()`; rate guard por (provider, api).
- **Posição do motorista**: contrato = `active_tracking` alimentada pela UAPI (outra sessão); o trigger `trg_active_tracking_geo` (PR #118) calcula distância à próxima parada e à `expected_route`, `is_on_route`, e emite eventos idempotentes em `order_geo_events` → `alerts` + `add_job('notification')`.
- **Eventos**: `DRIVER_APPROACHING_PICKUP` (raio 500 m OU ETA ≤ 5 min), `DRIVER_ARRIVED_PICKUP` (2 ciclos ≤ 100 m), `DRIVER_APPROACHING_DELIVERY`/`DRIVER_ARRIVED_DELIVERY` (registra; notifica só com `notify_delivery_contact`), `ETA_DELAY`, `GEO_BUDGET_WARNING`.
- **Notificação ao responsável pela coleta** via `send-notification` com `metadata.recipients` por pedido (pendente, Google etapa 66), templates em `alert_configurations`.
- **Admin "Mapas & Custos"**: matriz função × provedor, orçamento, uso, teste de chave (pendente, Google Bloco 8 / Mapbox Bloco 6).
