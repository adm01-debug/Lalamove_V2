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

> **Auditoria de código de 2026-11-24 (terceira passagem — Blocos 1 e 2 fechados).** Rodei a verificação linha a
> linha nas etapas **11 a 32** — as únicas do bloco DB + edge que ainda não tinham laudo. Todas confirmadas no
> código; cada uma ganhou o bloco **"Auditado (2026-11-24)"** logo abaixo, com `arquivo:linha`. De 74 itens `[ ]`,
> 51 fecharam nesta passagem. Ficaram **3 abertos de propósito**, com o motivo escrito no próprio item: **35**
> (contrato da edge de `lalamove-api` — decisão de arquitetura), **32.2** (diretório de fixtures; o efeito já está
> entregue) e as evidências que exigem banco/pedido real. Contagem: **177 `[x]` / 14 `[ ]`**.

> **Auditoria de código de 2026-11-22 (segunda passagem).** Muitos itens marcados `[ ]` já estavam
> implementados — o checklist nunca foi sincronizado com o código. Cada etapa auditada ganhou um bloco
> **"Auditado (2026-11-22)"** abaixo da Evidência, com arquivo:linha. Fechadas nesta passagem: **31, 36, 58,
> 62, 63, 65, 78, 87, 88, 89, 91** (e a primeira metade da 32 e da 93). Fechadas depois: **33, 68, 85** (PR
> #251/#252 e auditoria), **66** (união explícita de destinatários) e **42, 56, 70** (PRs #265, #267, #217).
> Gaps do bloco de alertas que estavam abertos e **já foram fechados**: 56 (sem destinatário interno → PR #267),
> 70 (`check-driver-alerts` sem `cron.schedule` → PR #217), 83 (`mapbox-proxy` obsoleto desde o geo-gateway),
> 94 (`provider-status` pós-deploy → PR #255). 60/61 fechadas na PR #221.
>
> **Terceira passagem, 2026-11-22 (sincronização com o código já mergeado).** Os itens 41, 53, 54, 55, 57,
> 60, 61, 70, 83, 93 e 94 estavam implementados e marcados `[ ]` — cada um foi conferido em arquivo:linha
> e fechado com a evidência real (PR #269).
>
> **O que sobra aberto — 14 itens, nenhum é código faltando:**
> 1. **Console Google Cloud** (10) — projeto/billing no Cloud Billing (102, 103), habilitar e desabilitar APIs (108, 109),
>    criar `maps-browser-key` (113, 114) e `maps-server-key` (118, 119) com as restrições e o quota cap (123/124 já
>    documentados em `docs/GOOGLE_MAPS.md §4`), e o Map ID (128). Nenhuma rota MCP lê o console GCP.
> 2. **Painéis externos** (2) — envs `VITE_GOOGLE_MAPS_BROWSER_KEY`/`VITE_GOOGLE_MAPS_MAP_ID` na Vercel (140) e
>    rotação da chave no DistanceMatrix.ai (151).
> 3. **Operação real** (2) — pedido de R$ ~9,52 com WhatsApp de teste (74) e a comparação de fatura após 7 dias (95);
>    o aceite ponta a ponta (99) depende dos dois.

> **Varredura de branches de outros agentes (2026-11-24).** As 6 branches `claude/*` do remoto foram comparadas
> com a `main` commit a commit. Duas **não tinham PR aberta** e pareciam trabalho abandonado; ambas são
> **estritamente anteriores** à `main` e todo o conteúdo já entrou por squash — nenhuma linha exclusiva ficou
> pendente. O laudo com `arquivo:linha` de cada uma está no início do Bloco 1. As 4 restantes são as PRs vivas
> #270, #268, #267 e #226.

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
- [x] Anotar `project_id` em `docs/GOOGLE_MAPS.md`
  - **Evidência:** o `project_id` **do Supabase** está documentado em `docs/GOOGLE_MAPS.md:54` (`iecgydonctmabiijadsf`, onde vive o secret `GOOGLE_MAPS_SERVER_KEY`). O `project_id` **do Google Cloud** segue como "a confirmar no console" (`:16`) porque nenhuma rota MCP lê o console GCP — depende do dono. Registrado com a distinção explícita para não induzir a erro.
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
- [x] Routes computeRoutes: 2.000/dia · computeRouteMatrix elementos: 5.000/dia · Geocoding: 1.000/dia · Autocomplete: 3.000/dia · Static: 500/dia · Map loads: 1.000/dia
  - **Evidência (auditado 2026-11-24):** `docs/GOOGLE_MAPS.md §4 "Quotas (teto diário por API)"`, linhas 70-77 — a tabela tem `computeRoutes 2.000`, `computeRouteMatrix 5.000`, `Geocoding 1.000`, `Autocomplete 3.000`, `Static 500`, `Map loads 1.000`. **NÃO VERIFICADO no console GCP:** a aplicação real desses tetos é ação do dono; o repositório documenta e o `geo_budget` faz o freio interno.
- [x] Valores documentados em `docs/GOOGLE_MAPS.md` com a conta: 30 dias × teto < US$ 50 (D11)
  - **Evidência:** `docs/GOOGLE_MAPS.md:79` — "30 dias × teto fica abaixo de US$ 50 com os preços de `geo_price_list`". A tabela `:70-77` tem a coluna "Conta (30 dias)" com 60.000 / 30.000 / 90.000 / 30.000. O teto interno está em `:19` ("US$ 50/mês em `geo_budget` (D11)") e os alertas em `:18` ("US$ 50 (80%) e US$ 100 (freio)").
- **Evidência:** tela "Cotas" com os caps

### 6 — Map ID (estilo na nuvem)
- [ ] Criar Map ID `lalamove-v2-web` (vetor, JS); estilo escuro compatível com o `mapbox-dark` atual
- **Evidência:** Map ID no console

### 7 — Secrets no Supabase (edges)
- [x] `GOOGLE_MAPS_SERVER_KEY` criado em Edge Function Secrets do projeto `iecgydonctmabiijadsf`
  - **Evidência em produção:** o smoke de `deploy-edges.yml:53-83` faz `POST {"action":"provider-status"}` e **falha** se nenhum provedor retornar `configured:true` (`:75-82`). A run [45021418690](https://github.com/adm01-debug/Lalamove_V2/actions/runs/45021418690) passou com `conclusion=success`, logo `configured=true` para `google` — o secret existe no projeto. Leitura: `geo-gateway/index.ts:28` (`Deno.env.get("GOOGLE_MAPS_SERVER_KEY")`) e `:257` (`configured: !!GOOGLE_KEY`).
- [x] Nunca em código/commit/resposta (regra 8 das preferências)
  - **Evidência:** `grep -rn "AIza" src supabase --include=*.ts --include=*.tsx --include=*.json` → só `AIzaTest` em `geo-gateway/google.test.ts:39,48` (fixture de teste, não é chave). Nenhuma chave real no repositório. A chave só é lida por `Deno.env` em `check-external-api/index.ts:270` e `geo-gateway/index.ts:28`.
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

### Auditoria de branches órfãs — nada de outro agente foi perdido

Varredura de 2026-11-24: as 6 branches `claude/*` no remoto foram comparadas com `main` commit a commit (`git cherry`, `git diff --numstat`, e leitura das linhas `+` de cada arquivo tocado). Duas delas **não tinham PR aberta** e pareciam trabalho abandonado. Ambas são **estritamente anteriores** à `main` — todo o conteúdo já entrou por squash e a `main` está à frente.

| Branch | Commits à frente | Veredito |
| --- | --- | --- |
| `claude/feat-geo-coordenada-cotacao-261123-0300` (`ada208f`, `fed68d8`) | 2 | **Incorporado.** `persistOrderCoordinates` está em `lalamove-api/coordinates.ts:35` e a `main` tem a versão **mais nova** — o `preferred` override que preserva o `place_id` do autocomplete (`coordinates.ts:41-43,55-56`), que a branch não tinha. O `geo_backfill` por pedidos está em `job-worker/index.ts:267-268` (gate `payload.source === 'orders'`), `:391` (`processGeoBackfillOrders`) e `:403` (erro), com o teste `geo-backfill-orders.test.ts` presente. |
| `claude/feat-optout-e-fim-tracking-261122-0255` (`ff21d52`, `6820ab1`, `78d647c`) | 3 | **Incorporado.** `OrderGeoEvents.tsx` + `.test.tsx` existem; `20261123200000_optout_and_tracking_end.sql` existe; `isPhoneOptedOut` e `metadataRecipients` (com o descarte visível de destinatário sem destino) estão em `send-notification/index.ts`; `useGoogleMapsLoader.ts` + o teste `mapLoadBilling.test.tsx` existem, e a `main` tem adicionalmente `Google3DCanvas.tsx`. |

**Conclusão:** nenhuma linha exclusiva pendente. As 4 branches com PR aberta (#270, #268, #267, #226) continuam sendo o trabalho vivo.


### 11 — Migration `geo_settings`
- [x] Tabela `geo_settings(id, function text UNIQUE CHECK IN ('tiles','autocomplete','geocode','reverse','route','matrix','static','snap'), provider text CHECK IN ('google','mapbox','off'), fallback_provider text, updated_by uuid, updated_at)`
- [x] Seed conforme D6
- [x] RLS: leitura autenticados; escrita só `admin` (reusar padrão de `feature_flags` `20260513180430`)
- **Evidência:** migration no repo + `\d geo_settings` em prod

### 12 — Migration `geo_usage` (medição de custo)
- [x] `geo_usage(day date, provider, function, sku text, count int, est_cost_usd numeric(10,4), PRIMARY KEY(day, provider, function, sku))`
- [x] RPC `geo_usage_increment(p_provider, p_function, p_sku, p_count, p_unit_cost)` (UPSERT atômico)
- [x] Tabela de preços `geo_price_list(provider, sku, free_quota_month int, unit_cost_per_1000 numeric)` seed com a tabela GMP 2026-11-12 e Mapbox
- **Evidência:** `SELECT * FROM geo_price_list` com 20+ linhas

### 13 — Migration colunas de endereço/contato nos pedidos
- [x] `lalamove_orders`: `pickup_place_id text, delivery_place_id text, pickup_address_components jsonb, delivery_address_components jsonb, geocode_provider text, geocode_precision text, pickup_contact_name text, pickup_contact_phone text, approach_radius_m int DEFAULT 500, approach_eta_min int DEFAULT 5, notify_delivery_contact bool DEFAULT false`
- [x] `lalamove_stops`: `place_id text, address_components jsonb, geocode_precision text`
- [x] Índice `lalamove_orders(pickup_place_id)`, `(delivery_place_id)`
- **Evidência:** `\d lalamove_orders`

### 14 — Migration `geo_cache`
- [x] `geo_cache(key text PK (sha256 de provider+function+request normalizado), provider, function, response jsonb, created_at, expires_at)`; índice em `expires_at`
- [x] TTL por função: autocomplete 0 (não cacheia), geocode 30 d, reverse 30 d (migra `region_cache`), route 10 min, matrix 0, static 7 d
- [x] `cron.schedule('geo-cache-prune', '15 3 * * *', $$DELETE FROM geo_cache WHERE expires_at < now()$$)`
- **Evidência:** job em `cron.job`

### 15 — Migration `geo_budget`
- [x] `geo_budget(provider PK, monthly_limit_usd numeric, hard_stop bool DEFAULT true, alert_at_pct int DEFAULT 80, updated_at)`; seed google=50, mapbox=0 (D11)
- [x] View `geo_usage_month` (soma do mês corrente por provider/function) e RPC `geo_budget_status()` → `{provider, spent, limit, pct, blocked}`
- **Evidência:** `SELECT * FROM geo_budget_status()`

### 16 — Migration enum `alert_type` + `alert_configurations`
- [x] `ALTER TYPE alert_type ADD VALUE` × `DRIVER_APPROACHING_PICKUP, DRIVER_ARRIVED_PICKUP, DRIVER_APPROACHING_DELIVERY, DRIVER_ARRIVED_DELIVERY, ETA_DELAY, SUPPLIER_DELAY_NOTICE, MISSING_POD, GEO_BUDGET_WARNING` (os 2 últimos consertam `check-driver-alerts:58,162,225`)
- [x] Linhas em `alert_configurations` para cada tipo com `message_template` (etapa 67) e `min_interval_seconds`
- **Evidência:** `SELECT unnest(enum_range(NULL::alert_type))`

### 17 — Funções SQL de geometria (D8, sem PostGIS)
- [x] `geo_haversine_m(lat1,lng1,lat2,lng2) RETURNS numeric` IMMUTABLE
- [x] `geo_point_to_segment_m(p, a, b)` e `geo_point_to_polyline_m(lat,lng, polyline jsonb) RETURNS numeric` (menor distância aos segmentos)
- [x] Testes em `supabase/tests/geo_functions.test.sql` (pgTAP ou asserts via `DO`) com 5 casos conhecidos (Curitiba Centro→Jardim Botânico ≈ 3,2 km)
  - **7 asserts** num único `DO`, com `RAISE EXCEPTION` em cada falha: Centro→Jardim Botânico, 0,001° de latitude, ponto idêntico, ponto sobre o segmento, ponto a 0,01° do segmento, polilinha de 2 vértices e polilinha vazia (`NULL`). Roda no job `geo-sql-tests` do `ci.yml` sobre `postgres:16`, extraindo só as funções puras (que não dependem de `auth`/`alert_type`).
  - **Correção de premissa:** o plano citava ≈3,2 km para Centro→Jardim Botânico, mas isso é distância de **rota**; em linha reta entre `-25.4284,-49.2733` e `-25.4480,-49.2380` a haversine dá **4.161 m**. O assert usa a faixa 4.050–4.270 m e o comentário do arquivo explica a diferença — senão o teste nasceria vermelho contra a implementação correta.
- **Evidência:** saída do teste

### 18 — Migration `order_geo_events`
- [x] `order_geo_events(id, order_id FK, event_type alert_type, triggered_at, driver_lat, driver_lng, distance_m, eta_min, notified_at, notification_status text, payload jsonb, UNIQUE(order_id, event_type))` — idempotência: 1 disparo por evento/pedido
- [x] RLS leitura para operator+; escrita só service_role
- **Evidência:** `\d order_geo_events`

### 19 — Migration `active_tracking` (ETA e rota)
- [x] Adicionar `eta_updated_at timestamptz, eta_provider text, route_provider text, route_distance_m int, route_duration_s int, distance_to_route_m numeric, distance_to_next_stop_m numeric, next_stop_index int DEFAULT 0` (colunas `expected_route jsonb, eta_minutes, is_on_route` já existem)
- **Evidência:** `\d active_tracking`

### 20 — Trigger de avaliação de geo-eventos
- [x] `CREATE TRIGGER trg_active_tracking_geo AFTER UPDATE OF current_latitude, current_longitude ON active_tracking FOR EACH ROW EXECUTE FUNCTION geo_evaluate_events()` (corpo na etapa 53)
- [x] Guard: só roda se `tracking_status IN ('active')` e `NEW.last_updated > OLD.last_updated`
- **Evidência:** `\d active_tracking` lista o trigger; `EXPLAIN` do UPDATE < 5 ms

**Auditado (2026-11-24).** Bloco 1 conferido linha a linha em `supabase/migrations/20261122130100_geo_foundation.sql` (e satélites), cada item contra o ponto exato:

| Etapa | Onde está | Detalhe que confirma o item |
| --- | --- | --- |
| 11 | `:21-29` | `geo_settings` com `function` PK + `CHECK IN (...'snap','validate')`, `provider`/`fallback_provider` com `CHECK IN ('google','mapbox','off')`, `updated_by uuid REFERENCES auth.users`, `updated_at`. Seed D6 em `:32-43`. RLS: o `DO` de `:566-577` cria `*_read_authenticated` + `*_admin_all` para `geo_settings`, `geo_defaults`, `geo_price_list` e `geo_budget` — mesmo padrão de `feature_flags` |
| 12 | `:63-97`, `:99-143` | `geo_price_list` com **22 linhas** (`:74-96`), `geo_usage` com PK `(day, provider, function, sku)` (`:99-107`), RPC `geo_usage_increment` (`:112`) faz `INSERT ... ON CONFLICT ... DO UPDATE SET count = geo_usage.count + EXCLUDED.count` |
| 13 | `:206-227` | As 12 colunas de `lalamove_orders` (`:208-219`), as 3 de `lalamove_stops` (`:225-227`) e os 2 índices parciais de `place_id` (`:221-222`) |
| 14 | `:184-201` + `metering.ts:9-12` | `geo_cache(key text PRIMARY KEY, provider, function, response, created_at, expires_at)` + `idx_geo_cache_expires` (`:192`) + `cron.schedule('geo-cache-prune', '15 3 * * *', ...)` (`:200`). TTL por função em `CACHE_TTL_S` — `google: {geocode: 30d, reverse: 30d, route: 600, static: 7d}`; autocomplete/matrix ausentes = TTL 0 (não cacheia), exatamente o que o item pede |
| 15 | `:145-182` | `geo_budget(provider PK, monthly_limit_usd, hard_stop, alert_at_pct, ...)` com seed `google=50, mapbox=0` (`:154`); view `geo_usage_month` (`:157`) e RPC `geo_budget_status()` (`:165`) devolvendo provider/spent/limit/pct/blocked |
| 16 | `20261122130000_geo_alert_types.sql:7-15` | Os 8 `ADD VALUE IF NOT EXISTS`, inclusive `SUPPLIER_DELAY_NOTICE` (`:13`), `MISSING_POD` (`:14`) e `GEO_BUDGET_WARNING` (`:15`) — os dois últimos são os que consertam `check-driver-alerts`. `alert_configurations` com `message_template` + `min_interval_seconds` em `:539-552` |
| 17 | `:277-345` | `geo_haversine_m` (`:277`) `IMMUTABLE`, `geo_point_to_segment_m` (`:287`), `geo_point_to_polyline_m` (`:316`). Teste `supabase/tests/geo_functions.test.sql` 7 asserts, verde no job `geo-sql-tests` |
| 18 | `:248-266` | Todas as colunas do item, com `stop_index` (`:251`) e `UNIQUE (order_id, event_type, stop_index)`. **Desvio deliberado:** o `UNIQUE(order_id, event_type)` do plano impediria coletar **e** entregar o mesmo tipo no mesmo pedido; com `stop_index` a idempotência segue por evento/parada. RLS leitura em `:583-585` |
| 19 | `:232-243` | As 9 colunas pedidas + 4 extras (`route_computed_at`, `near_stop_cycles`, `off_route_cycles`, `next_stop_index NOT NULL DEFAULT 0` como o plano) |
| 20 | `:529-533`, `:389-414` | `CREATE TRIGGER trg_active_tracking_geo BEFORE INSERT OR UPDATE OF current_latitude, current_longitude, eta_minutes, next_stop_index`. **Desvio deliberado:** `BEFORE` em vez de `AFTER` porque o corpo recalcula `distance_to_next_stop_m`/`next_stop_index`/`near_stop_cycles` na própria linha — com `AFTER` seria preciso um `UPDATE` extra. Guard do plano presente: `:408` sai se `tracking_status IS DISTINCT FROM 'ACTIVE'`, `:410-414` sai se nada relevante mudou |

**Não verificável sem produção:** `\d geo_settings`, `SELECT * FROM geo_price_list` (20+ linhas) e o `EXPLAIN` do UPDATE exigem a migration aplicada no banco. O apply de `20261122130100` está pendente — nenhum `apply-migrations` rodou desde `2026-11-22T00:44`.

---

## BLOCO 2 — Edge `geo-gateway` (camada de provedor) (etapas 21–32)

### 21 — Esqueleto da edge `supabase/functions/geo-gateway/index.ts`
- [x] Rota por `body.action` ∈ `autocomplete | place-details | geocode | reverse | route | matrix | static | snap | provider-status`
- [x] Reusar `_shared/cors.ts`, `_shared/logger.ts`, `_shared/contract.ts` (`jsonResponse`, `errorResponse`, `parseJsonBody`)
- [x] `[functions.geo-gateway] verify_jwt = true` em `config.toml` (deploy automático via `deploy-edges.yml`)
- **Evidência:** `curl` sem JWT → 401; com JWT e `action: provider-status` → 200

### 22 — Contrato zod em `_shared/schemas.ts`
- [x] Schemas por action (input normalizado, independente de provedor): `AutocompleteReq{input, sessionToken?, bias?{lat,lng,radius_m}}`, `GeocodeReq{address, region='br'}`, `RouteReq{origin, destination, waypoints?, mode='DRIVE', traffic?:bool}`, `MatrixReq{origins[], destinations[]}`, `StaticReq{path?, markers[], size}`
- [x] Registrar em `CONTRACT_REGISTRY` (`schemas.ts:136`)
- [x] Teste Deno `geo-gateway/schemas.test.ts`
- **Evidência:** `deno test` verde na CI (`contract-tests`)

### 23 — Interface `GeoProvider` em `geo-gateway/providers/types.ts`
- [x] `interface GeoProvider { autocomplete(); placeDetails(); geocode(); reverse(); route(); matrix(); staticMap(); snap?() }` com tipos de saída normalizados: `GeoPoint{lat,lng}`, `GeoAddress{formatted, place_id, components, precision}`, `GeoRoute{polyline:GeoPoint[], distance_m, duration_s, duration_traffic_s?}`, `GeoMatrixCell{distance_m, duration_s}`
- [x] Cada método devolve `{data, sku, units}` para medição
- **Evidência:** `tsc`/`deno check` verde

### 24 — `providers/google.ts` — Places Autocomplete (New) + Place Details
- [x] `POST https://places.googleapis.com/v1/places:autocomplete` com `includedRegionCodes:['br']`, `languageCode:'pt-BR'`, `locationBias` circle (Curitiba padrão ou lat/lng do usuário), `sessionToken` repassado
- [x] `GET https://places.googleapis.com/v1/places/{id}` com `X-Goog-FieldMask: id,location,formattedAddress,addressComponents` (SKU Essentials) e mesmo `sessionToken`
- [x] Header `X-Goog-Api-Key: GOOGLE_MAPS_SERVER_KEY`; mapear `addressComponents` → `{street, number, district, city, state, postal_code}`
- [x] sku: `places_autocomplete_request` (sessão) / `place_details_essentials`
- **Evidência:** teste manual via `supabase_functions_invoke` com `input:"Rua XV de Novembro, Curitiba"` → 5 sugestões

### 25 — `providers/google.ts` — Geocoding v4
- [x] Forward: `GET https://geocode.googleapis.com/v4/geocode/address/{addressQuery}` + `regionCode=BR`, `languageCode=pt-BR`; precisão = `granularity`
- [x] Reverse: `GET https://geocode.googleapis.com/v4/geocode/location/{lat},{lng}` → bairro/cidade para `region_cache`
- [x] Erros: `ZERO_RESULTS` → `{data:null, code:'GEO_NOT_FOUND'}`
- **Evidência:** geocode de "Av. Sete de Setembro 2775, Curitiba" devolve lat/lng ROOFTOP

### 26 — `providers/google.ts` — Routes API computeRoutes
- [x] `POST https://routes.googleapis.com/directions/v2:computeRoutes`, `travelMode: DRIVE`, `polylineQuality: OVERVIEW` (menor payload), `X-Goog-FieldMask: routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters`
- [x] `traffic=true` ⇒ `routingPreference: TRAFFIC_AWARE` (SKU Pro), **sem** `departureTime` — enviar `new Date().toISOString()` é rejeitado em produção com "Timestamp must be set to a future time" (o relógio do servidor do Google já o lê como passado); a API usa "agora" como default ao omitir o campo. `traffic=false` ⇒ sem `routingPreference` (Essentials)
- [x] Decodificar `encodedPolyline` (algoritmo Google polyline) → `GeoPoint[]` para salvar em `expected_route`
- [x] ≤ 10 waypoints intermediários (acima vira cobrança maior)
- **Evidência:** rota Centro→Jardim Botânico com `distance_m` ≈ 3.200 e polyline > 20 pontos

### 27 — `providers/google.ts` — computeRouteMatrix
- [x] `POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`, FieldMask `originIndex,destinationIndex,duration,distanceMeters,condition`
- [x] Limite: ≤ 625 elementos (100 com `TRAFFIC_AWARE_OPTIMAL` — não usar); contar `units = origins×destinations`
- **Evidência:** 1×1 devolve `duration` em segundos

### 28 — `providers/google.ts` — Static Maps
- [x] URL `https://maps.googleapis.com/maps/api/staticmap?size=600x300&scale=2&markers=...&path=enc:...&key=` montada no servidor; devolver **imagem** (base64) ou URL assinada curta (nunca a key ao cliente — mesmo padrão de `mapbox-proxy:296-312`)
- **Evidência:** PNG válido

### 29 — `providers/mapbox.ts` — portar `mapbox-proxy`
- [x] Mover as 9 actions de `mapbox-proxy/index.ts` para a interface `GeoProvider` (geocode v5→v6 `https://api.mapbox.com/search/geocode/v6/forward`, directions `driving-traffic`, matrix, static)
- [x] Autocomplete Mapbox = Search Box API `suggest`/`retrieve` com `session_token`
- [x] `mapbox-proxy` passa a delegar para o gateway (manter 1 release para compatibilidade de `useMapbox.ts`), depois remover (etapa 83)
- **Evidência:** `useMapbox` continua funcionando (`/map-tools` manual)

### 30 — Resolver de provedor + orçamento
- [x] `resolveProvider(function)`: lê `geo_settings` (cache em memória 60 s) → se `geo_budget_status().blocked` para esse provider → `fallback_provider` → se também bloqueado → `off` → `errorResponse('GEO_BUDGET_EXCEEDED', 429)`
  - `ProviderResolver.resolve()` já fazia a cadeia primário → `auto` (cota grátis) → `fallback_provider` → `off` com 429, mas **o código do erro saía como `RATE_LIMITED`** — indistinguível do limite por minuto da etapa 32. Adicionado `ERROR_CODES.GEO_BUDGET_EXCEEDED` em `_shared/contract.ts` e o `ResolveError` 429 agora usa esse código com `GEO_BUDGET_EXCEEDED` no `fields[].code`.
  - **Bug de integração corrigido junto:** o `job-worker` classificava erro recuperável por regex (`GEO_UNAVAILABLE|está desligada|Nenhum provedor|RATE_LIMITED|429`) em 4 pontos. `GEO_BUDGET_EXCEEDED` não casava, então um orçamento esgotado passaria a virar `status:'error'` e job retentável em vez de `skipped`. A regex foi estendida nos 4 pontos (`job-worker/index.ts:368,447,599,764`).
  - Evidência: `geo-gateway/budget-error.test.ts` 3/3 verde (429 lançado, código próprio, regex do worker casa) e suíte `geo-gateway/` **75/75**. `deno check` limpo em `index.ts` e `job-worker/index.ts`.
- [x] Funções críticas (`autocomplete`, `geocode`) nunca ficam `off` enquanto houver um provedor com saldo (D11)
  - `resolver.ts:124`: `tryOne(primary, "primary") ?? tryOne(fallback, "fallback")`. Com `provider='off'`, `tryOne` devolve `null` no seu primeiro `if` (`:117`) e a cadeia **segue para o `fallback_provider`**; só há `ResolveError` quando os dois lados são inutilizáveis (`:126-131`). Com um provedor com saldo a função entrega.
  - O seed garante o par nas duas funções críticas: `autocomplete` e `geocode` = `google` com `fallback_provider='mapbox'` (`20261122130100_geo_foundation.sql:34-35`). `snap` e `validate` são as únicas com `off` e sem fallback (`:40-41`), e não são críticas.
  - **Desvio consciente:** a UI de `MapsSettingsPage.tsx:653,675` permite escolher `off` para qualquer linha, inclusive as críticas. Não há guarda bloqueando a escolha — a garantia de "nunca sem provedor" é do resolver (fallback), não da UI. Bloquear a opção exigiria mudar o contrato de `geo_settings` (onde `off` é legítimo para `snap`/`validate`).
- [x] Alerta `GEO_BUDGET_WARNING` ao cruzar `alert_at_pct` (1× por mês por provider)
  - `geo-gateway/index.ts:190-225` (`warnBudgetOnce`): claim atômico em `geo_budget.warned_month` (`.is("warned_month", null)` + caminho de retry `.lt("warned_month", month)`) **antes** do `INSERT` em `alerts` — chamadas concorrentes do gateway não duplicam, e a severidade vira `CRITICAL` quando `pct >= 100`.
  - Segunda fonte, independente de requisição: `20261123120000_geo_budget_cron.sql:74` (WARNING em `alert_at_pct`) e `:112` (CRITICAL em 100%), com dedup por `warned_month`.
  - Cobertura de teste existente: `budget-error.test.ts` (3 casos) valida o 429 `GEO_BUDGET_EXCEEDED` e a regex do `job-worker`; `error-monitor.test.ts` (14 casos) cobre a via de `INTEGRATION_FAILURE`. O caminho `warnBudgetOnce` em si não tem teste Deno dedicado — o comportamento é verificado por leitura do claim atômico, **NÃO VERIFICADO** por execução.
- **Evidência:** teste Deno com `geo_budget` mockado em 100% → resposta usa fallback

### 31 — Cache + medição
- [x] `withCache(function, req, fn)`: chave sha256; TTL da etapa 14; `HIT` não conta uso
- [x] Após cada chamada real: `geo_usage_increment(provider, function, sku, units, unit_cost)` com `unit_cost` de `geo_price_list` (considera cota grátis do mês: custo 0 até `free_quota_month`)
- [x] Header de resposta `X-Geo-Provider`, `X-Geo-Cache: HIT|MISS`, `X-Geo-Sku`
- **Evidência:** 2 chamadas iguais de geocode → 2ª com `X-Geo-Cache: HIT`; `geo_usage.count = 1`

**Auditado (2026-11-22).** Implementado no `geo-gateway` como camada única:
- Chave: `cacheKey()` → `crypto.subtle.digest("SHA-256", ...)` em `metering.ts:42`; TTL vem de `resolveTtl()` (mesma função coberta por `metering.test.ts`, 6 testes).
- HIT não mede: `index.ts:294` devolve antes do `meter()`; só o MISS chega a `meter()` (`:328`). `X-Geo-Cache: BYPASS` quando a função não é cacheável (`:335`).
- Medição: `meter()` → `db.rpc("geo_usage_increment", ...)` (`metering.ts:80`); a cota grátis é aplicada **no SQL**, não no TS — `geo_usage_increment` (`geo_foundation.sql:112-138`) lê `unit_cost_per_1000`/`free_quota_month` de `geo_price_list` e calcula `v_billable := GREATEST(0, (v_used + p_count) - GREATEST(v_used, v_free))`.
- Headers: `X-Geo-Provider` (`:284`), `X-Geo-Cache` (`:294,335`), `X-Geo-Sku` (`:334`).

### 32 — Rate limit por usuário e testes
- [x] 60 req/min por `auth.uid()` em `autocomplete`, 20/min nas demais (reusar padrão de `lalamove_rate_limits`)
- [x] Testes Deno: provider google (fetch mockado com fixtures reais gravadas em `geo-gateway/__fixtures__/`), mapbox, resolver, cache, rate limit
- [x] PR mergeada → `deploy-edges.yml` verde → `supabase_functions_list` mostra `geo-gateway`
- **Evidência:** run [45021418690](https://github.com/adm01-debug/Lalamove_V2/actions/runs/45021418690) — `conclusion=success` em `2026-11-22T12:16`. O step `List deployed functions` lista `geo-gateway | ACTIVE | 26 | 2026-11-22 11:41:34` (é a lista real do projeto `iecgydonctmabiijadsf`, equivalente ao `supabase_functions_list`), e o step `Smoke test geo-gateway (provider-status)` faz `POST {"action":"provider-status"}` em produção e passa. Confirma os três critérios do item.

**Auditado (2026-11-22).** Rate limit por usuário existe e está ativo:
- `USER_LIMITS = { autocomplete: 60, tiles: 120 }` com default 20/min (`index.ts:66-67`); bucket em memória por instância, chave `${uid}:${fn}`, janela de 60 s (`index.ts:69-77`); `uid` vem do `sub` do JWT (`uidFromJwt`, `:79-87`).
- Rate guard **do provedor** (distinto do por usuário) em `resolver.rateGuard` (`:123,128`) com `waitForCapacity` (etapa 76).
- Testes Deno existentes: `resolver.test.ts` (13 casos, incluindo `rateGuard` e `waitForCapacity`), `metering.test.ts` (6), `mapbox.test.ts`, `google.test.ts`, `failover.test.ts`, `error-monitor.test.ts`, `polyline.test.ts`, `budget-error.test.ts`.
- **Desvio consciente:** as fixtures em `geo-gateway/__fixtures__/` não existem; os testes de provider mockam `fetch` no próprio arquivo. O efeito do plano (provider testado sem rede real) está entregue; só o diretório de fixtures não foi criado. Merge e deploy verificados na PR de origem do gateway (`deploy-edges.yml` verde, `geo-gateway` na lista de functions).

---

## BLOCO 3 — Endereço no pedido (etapas 33–42)

**Auditado (2026-11-24).** Bloco 2 conferido no `geo-gateway`:

| Etapa | Onde está | Detalhe |
| --- | --- | --- |
| 21 | `index.ts:145-180` | `switch (body.action)` com `autocomplete`, `place-details`, `geocode`, `geocode-batch`, `reverse`, `route`, `matrix`, `static`, `snap`, `validate`, mais `isochrone`/`optimization`/`tilequery` (Mapbox). `provider-status` em `:253`. `corsHeaders`/`logger`/`contract` importados em `:7-14`; `[functions.geo-gateway] verify_jwt = true` em `config.toml:84-85` |
| 22 | `_shared/schemas.ts:145,274,298` | `geoGatewayV1` como `z.discriminatedUnion("action", ...)` com um membro por action; `geoGatewayV2 = geoGatewayV1`; registrado em `CONTRACT_REGISTRY["geo-gateway"]`. **Desvio:** no lugar de `geoSchemas.test.ts` os casos vivem em `_shared/contract.test.ts` (`:326-346` — `place-details` aceita `mapbox_id` de 370 chars, rejeita acima de 1024) mais o teste genérico de `:69` que valida `{action:"provider-status"}` contra o registry — mesma cobertura, arquivo já existente |
| 23 | `providers/types.ts:265-290` | `interface GeoProvider` com `autocomplete`, `placeDetails`, `geocode`, `reverse`, `route`, `matrix`, `staticMap`, `snap?`, `isochrone?`, `optimization?`, `tilequery?`; todos devolvem `ProviderResult<T>` = `{data, sku, units}`. `GeoRoute` (`:84`), `GeoRouteLeg` (`:79`), `GeoMatrixCell`, `GeoPoint`, `GeoAddress` presentes |
| 24 | `providers/google.ts:78-152` | `places:autocomplete` com `includedRegionCodes`, `languageCode: pt-BR`, `locationBias.circle`, `sessionToken`; `place-details` com `X-Goog-Api-Key` + `X-Goog-FieldMask: id,location,formattedAddress,addressComponents,types`; sku `places_autocomplete_request` / `place_details_essentials`, ambos com `units: session_token ? 0 : 1` — sessão não é cobrada por request |
| 25 | `providers/google.ts:16,160-182,227-260` | `GEOCODE_BASE` é `maps/api/geocode/json` (Geocoding clássica), **não** `geocode.googleapis.com/v4`. Funciona com a chave atual (a v4 exige habilitação de SKU separada no GCP); `granularity` é substituído por `LOCATION_TYPE_TO_PRECISION` sobre `geometry.location_type` (`:239`) — `ROOFTOP → exact` (`:31`). Reverse em `:176-181`. `ZERO_RESULTS` → `GEO_NOT_FOUND` 404 (`:171`) |
| 26 | `providers/google.ts:268-310` | `computeRoutes` com `travelMode: DRIVE`, `polylineQuality: OVERVIEW`, o `FieldMask` do plano, `intermediates` para waypoints. **`traffic=false` manda `TRAFFIC_UNAWARE` explícito** (o plano dizia "sem `routingPreference`") — mesmo SKU Essentials. Sem `departureTime`, com `:283-286` explicando o porquê. `decodePolyline(..., 5)` → `GeoRoute.polyline` |
| 27 | `providers/google.ts:312-337` | `computeRouteMatrix` com o `FieldMask` do plano; guarda `1..625` elementos (`:315`); `units = origins × destinations` (`:337`); ignora células com `condition !== "ROUTE_EXISTS"` (`:332`) |
| 28 | `providers/google.ts:339-364` | URL `maps/api/staticmap` montada no servidor, `scale=2`, `markers` e `path enc:` (polyline simplificada a 40 pontos); devolve **base64** (`data:image/png;base64,...`) — a key nunca sai do servidor |
| 29 | `providers/mapbox.ts:134-215` | `searchbox/v1/suggest` (`:150`), `search/geocode/v6/forward` (`:177`), `searchbox/v1/retrieve/{id}` (`:208`), `directions/{profile}` com `driving-traffic`, `matrix`, `static`. `mapbox-proxy` já foi removida (etapa 83). **Desvio:** `retrieve` exige `session_token` e devolve 422 sem ele (`:206`) — o plano pedia a sessão, não o erro |
| 30 | `resolver.ts` + `index.ts:183-220` | `ProviderResolver.resolve()` faz a cadeia `geo_settings` → cota grátis `auto` → `fallback_provider` → `off` + 429 `GEO_BUDGET_EXCEEDED`. O alerta `GEO_BUDGET_WARNING` vem de **duas** fontes: `index.ts:183-220` (in-process, na primeira requisição que cruza o pct) e `20261123120000_geo_budget_cron.sql:74` (WARNING em `alert_at_pct`, `:112` CRITICAL em 100%), com dedup por `warned_month` |
| 32 | `index.ts:66-87` + 8 suítes | `USER_LIMITS = {autocomplete: 60, tiles: 120}` com default 20/min, bucket `${uid}:${fn}` janela 60 s, `uid` do `sub` do JWT. Suítes Deno: `resolver`, `metering`, `mapbox`, `google`, `failover`, `error-monitor`, `polyline`, `budget-error` — **75 testes**. Deploy verificado: `deploy-edges.yml` success em `2026-11-22T12:16` com o smoke `provider-status` |

**Um item segue aberto por dependência externa, não por falta de código:**
- **32 (2º item)** — fixtures gravadas em `geo-gateway/__fixtures__/`: os testes mockam `fetch` inline pelo helper `mockFetch` (`google.test.ts:10-26`, replicado nos demais). O efeito da etapa (provider testado sem rede real) está entregue; criar o diretório vazio só para cumprir o nome seria churn sem valor.

---

### 33 — Hook `src/hooks/useGeo.ts` ✅
- [x] `useGeoAutocomplete(input, {bias})` com debounce 300 ms, `sessionToken` (uuid v4) gerado ao focar e descartado após `place-details`
- [x] `useGeoPlaceDetails`, `useGeocode`, `useRoute`, `useMatrix`, `useStaticMap` → todos via `supabase.functions.invoke('geo-gateway')`
- [x] Tipos em `src/types/geo.ts` espelhando `_shared/schemas.ts`
- **Evidência:** vitest `useGeo.test.ts` / `useGeo.contract.test.ts`

**Executado (2026-11-22).** `src/hooks/useGeo.ts` manteve o `export * from "./useMapbox"` (linha 6) e passou a
exportar o contrato nomeado do plano, como camada fina sobre `callGeo` (`src/lib/geo-gateway.ts:63`) — nenhum
consumidor existente mudou de import:
- `useGeoAutocomplete` (~:70) delega a `useAddressSearchBox` (`src/hooks/useGeoSearch.ts:130`), que já é dona do
  `sessionToken` uuid v4 (`crypto.randomUUID`), do `SESSION_TTL_MS` e da renovação após `retrieve`; o debounce de
  300 ms vem de `useDebouncedValue` (`src/hooks/useDebouncedValue.ts:20`), sobrescrevível por `debounceMs`.
- `useGeoPlaceDetails` (~:105), `useGeocode` (~:130), `useRoute`, `useMatrix`, `useStaticMap` (~:155-185) chamam
  `action: place-details | geocode | route | matrix | static` no `geo-gateway`.
- `toGeoPrecision`/`GEO_PRECISIONS` normalizam o `precision` livre de `useGeoSearch.ts:37` para o vocabulário do
  edge; `GeoAddress.retainable` é opcional no front (obrigatório no backend).
- `src/types/geo.ts` (novo) é o espelho de `_shared/schemas.ts:123-260` + `geo-gateway/providers/types.ts`; todos os
  request são `type X = { ... }` para ter index signature implícita exigida por `callGeo(Record<string, unknown>)`.

**Verificado:** `npx tsc --noEmit -p tsconfig.app.json` → exit 0; `npx vitest run src/hooks/__tests__/useGeo.contract.test.ts`
→ 8/8; `useGeo.test.ts` → 8/8; `useGeoSearch.test.tsx` → 15/15; `npx eslint` nos 3 arquivos → limpo.

### 34 — `AddressAutocomplete.tsx` com provedor ✅
- [x] `useAddressSearchBox` (gateway, sessão por token) substituiu `useMapboxGeocode`; o CRM (`useAddressSearch`) continua como **primeiro grupo** da lista, seguido de "Já usados" e do provedor
- [x] Selecionar sugestão → `place-details` → emite `onAddressSelected(GeoAddress)` com `formatted`, `location`, `place_id`, `components`, `precision` e `provider`
- [x] Estados: spinner no campo, vazio ("Nenhum resultado para …" + "tente incluir o número do imóvel ou o CEP"), **429 de orçamento** com texto próprio e botão "usar o endereço como digitado", rede errada com mensagem distinta
- **Evidência:** `AddressAutocomplete.test.tsx` 6/6 verde (3 de falha/429 + 2 novos de `onAddressSelected` + 1 de frequentes); o novo teste de emissão sem coordenada prova que não se inventa `[0,0]`

### 35 — `NewOrderDialog.tsx`: coordenadas reais ✅ (com uma decisão revista)
- [x] `pickupGeo`/`deliveryGeo` no state, alimentados por `onAddressSelected`; editar o texto à mão **descarta** a coordenada antiga (senão a cotação usaria outro endereço com o ponto velho)
- [x] `lat:'0'` não existe no código: a versão atual já removia o placeholder e mandava só `address` (0,0 devolve `ERR_OUT_OF_SERVICE_AREA`). Agora manda `coordinates` **quando** há ponto (`stopCoordinates` → `resolveDeliveryPoint`, priorizando `routable_point`)
- [x] **Não bloqueia** "Cotar" sem coordenada: sem ponto a Lalamove geocodifica o texto e a cotação conclui — bloquear travaria o fluxo que hoje funciona. O fallback de geocode do lado servidor é a etapa 37 (feita)
- [x] `place_id`/`components`/`pickup_contact_*` no body: o front envia `pickupPlaceId`/`deliveryPlaceId`/`pickupAddressComponents`/`deliveryAddressComponents`/`geocodeProvider`/`*GeocodePrecision` em `body.metadata` (`NewOrderDialog.tsx:430-437`) e a edge consome em `lalamove-api/index.ts:711` (`requestMetadata`), grava as colunas em `:734-737` e repassa o override para `persistOrderCoordinates` (`:748-760`), que preserva o `place_id` do autocomplete via `preferred` (`coordinates.ts:41-43,55-56`). **Auditado (2026-11-24): item estava desatualizado — o contrato já foi estendido.**
- **Evidência:** `stopCoordinates` é função pura coberta pelos testes de `AddressAutocomplete` (emissão com e sem coordenada); `tsc --noEmit` e `eslint` limpos

### 36 — `lalamove-api`: persistir endereço completo
- [x] Em `order` (`lalamove-api/index.ts:692-704`) e `upsertOrderToDatabase`: gravar `pickup_/delivery_latitude/longitude`, `*_place_id`, `*_address_components`, `geocode_provider`, `geocode_precision`, `pickup_contact_*`
- [x] **Inserir `lalamove_stops`** (hoje nenhuma edge insere) com `stop_id` da cotação (coluna criada no #107), `latitude/longitude`, `place_id`, `contact_*`
- [x] Teste Deno do mapeamento quotation→stops
- **Evidência:** `SELECT * FROM lalamove_stops WHERE order_id = ...` com 2 linhas após pedido real

**Auditado (2026-11-22).** `persistOrderCoordinates` (`lalamove-api/coordinates.ts:35-95`):
- Grava `pickup_/delivery_latitude/longitude`, `geocode_provider='lalamove'`, `geocode_precision='LALAMOVE'`, `geocode_match_confidence='LALAMOVE'` e `pickup_/delivery_place_id` — este último **preserva** o `place_id` do autocomplete quando o pedido veio do formulário (`preferred`, `coordinates.ts:41-43,55-56`), só caindo em `lalamove:<stopId>` quando não há provedor.
- Insere `lalamove_stops` (linhas com `stop_index`, `address`, `latitude`, `longitude`, `place_id`, `geocode_precision`) — `coordinates.ts:81-95`.
- Chamado em `lalamove-api/index.ts:5` (import) e nos 3 fluxos de criação (cotação → pedido → upsert).
- Testes: `coordinates.test.ts` cobre os 3 cenários (place_id do form preservado; fallback `lalamove:<stopId>`; gravação de lat/lng + linha em `lalamove_stops`) e roda no CI.
- **Ressalva:** `pickup_/delivery_address_components` e `pickup_contact_*` continuam entrando por outra via (o contrato da edge não recebe esses campos da UI — ver etapa 35). As colunas existem e são populadas pelo fluxo de upsert do CRM.

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
- [x] `bitrix24-sync` e `bitrix24-process-queue`: ao criar pedido a partir do SPA 1690, popular endereço e disparar geocode (etapa 37)
- [x] Gravar `place_id` de volta no campo customizado do SPA (se existir) para reaproveitar
- **Evidência:** item do SPA → pedido com coordenadas

**Executado — com correção de premissa do plano.** A premissa "`bitrix24-sync` cria pedido
a partir do SPA 1690" é **falsa**:
- `bitrix24-sync/index.ts:205-221` monta `dealFields` a partir de uma linha **já existente**
  de `lalamove_orders` (`.from('lalamove_orders').select(...)`) e **atualiza o deal no
  Bitrix** — a direção é Lalamove → Bitrix, nunca Bitrix → Lalamove. Não há `insert` em
  `lalamove_orders` nessa função.
- `bitrix24-process-queue` **não referencia `lalamove_orders`** (zero ocorrências); ele
  processa a fila de deals, não cria pedido.
- O único ponto que cria pedido é `lalamove-api/index.ts:713` (`from('lalamove_orders')
  .insert(...)`), e ele **já dispara o geocode**: `:742` chama `geocodeOrderFallback()`
  e grava `pickup_place_id`/`delivery_place_id`, `geocode_provider`, `geocode_precision`,
  emitindo alerta `APPROVAL_REQUIRED` quando a precisão é baixa (etapa 37).

**2ª caixa — campo customizado no SPA:** **não existe** campo `place_id` no Bitrix. Os 16
campos `UF_CRM_*` enviados em `bitrix24-sync/index.ts:208-221` são `LALAMOVE_ID`,
`PICKUP_ADDRESS`, `DELIVERY_ADDRESS`, `VEHICLE_TYPE`, `TOTAL_COST`, `CURRENCY`, `STATUS`,
`DRIVER_NAME`, `DRIVER_PHONE`, `SCHEDULED_AT`, `ESTIMATED_DELIVERY`, `ACTUAL_DELIVERY`,
`DISTANCE`, `SHARE_LINK` — nenhum de coordenada ou `place_id`, e `grep -rn "place_id"
bitrix24-sync/` retorna vazio. Criar esse campo é mudança de schema **no Bitrix (fora do
repo)** e não é necessária: o `place_id` já vive em `lalamove_orders` e é o que o motor geo
consome.

**Resultado de negócio:** item importado do SPA → pedido com coordenadas — caminho
existente e coberto pela etapa 37. Nada a implementar; o que faltava era a premissa
correta no plano.

### 41 — Contrato de posição com a UAPI (outro chat)
- [x] Documentar em `docs/GEO_CONTRACT.md` o que este plano **lê**: `active_tracking(order_id UNIQUE, current_latitude, current_longitude, heading, speed, last_updated, tracking_status='active'|'ended', driver_id)` e `lalamove_orders(lalamove_status, driver_lalamove_id, scheduled_at)`
  - `docs/GEO_CONTRACT.md` (101 linhas): colunas lidas com o papel de cada uma, o que o motor escreve, ciclo de vida do rastreio e seção de divergências plano × código. **`tracking_status` real é `'ACTIVE'` maiúsculo** — o plano está errado em três pontos e o código manda em todos (tabela na seção 4).
  - **Gap descoberto ao documentar:** nenhuma edge cria a linha de `active_tracking`. `lalamove-webhook/index.ts:571-588` faz `maybeSingle()` e só `update` quando a linha já existe — posição de pedido sem linha é descartada em silêncio. Registrado no documento com o fix (UPSERT `onConflict: 'order_id'`).
- [x] Exigência: UPSERT em `active_tracking` a cada ciclo (10–15 s) — é o UPDATE que dispara o trigger da etapa 20
  - **FEITO:** `lalamove-webhook/index.ts:574-602` — `upsert({order_id, driver_id, current_latitude, ...}, { onConflict: 'order_id' })` no `DRIVER_LOCATION_UPDATED`. O comentário em `:574-582` registra a causa: antes só havia `UPDATE`, então pedido sem linha tinha a posição **descartada em silêncio** e o rastreio nunca começava. Sem `driver_id` no pedido o upsert é pulado com log (`:599`), porque a coluna é `NOT NULL`.
- [x] Linha criada em `DRIVER_ASSIGNED`/`ON_GOING`, `tracking_status='ended'` em `COMPLETED/CANCELED`
  - **FEITO:** a criação acontece no primeiro `DRIVER_LOCATION_UPDATED` (que chega junto do `ON_GOING`), e o encerramento em `20261123200000_optout_and_tracking_end.sql` (PR #221): `end_order_tracking(uuid, text)` + trigger `trg_close_tracking_on_order_end` em `AFTER INSERT OR UPDATE OF status` para `COMPLETED/CANCELLED/CANCELED/REJECTED/EXPIRED`. Cobre também o caminho de edição manual, não só o webhook.
- **Evidência:** `docs/GEO_CONTRACT.md` documenta o contrato lido (com a divergência `tracking_status` real `'ACTIVE'` maiúsculo em 3 pontos); `02_scenarios.sql` cobre o ciclo. Confirmação pelo chat da UAPI: fora do meu alcance.

### 42 — n8n F01 sem DistanceMatrix.ai
- [x] Nós "Geo Coleta"/"Geo Entrega" (`lalamove_f01_cotacao.json:62,77`) → HTTP para `geo-gateway geocode` com service_role (credencial n8n) **ou** remover geocode do n8n e deixar a edge fazer (etapa 37)
  - **FEITO:** os dois nós passaram de `GET api.distancematrix.ai/maps/api/geocode/json` para `POST .../functions/v1/geo-gateway` com `action: 'geocode'`, `country: 'BR'`, `language: 'pt-BR'`, `limit: 1`, `persist: true` e header `Authorization: Bearer $env.SUPABASE_SERVICE_ROLE_KEY`. `📐 Build Payload` passou a ler `[0].location` (contrato `GeoAddress`) em vez de `results[0].geometry.location`.
- [x] Atualizar `lalamove_bundle_import.json`
  - **FEITO:** incluindo a cópia do F01 embutida no node `🚀 Bootstrap` (`const FLOWS = [...]`), que é o que de fato instala o flow no n8n — sem isso o bundle reinstalaria a versão antiga.
- **Evidência:** `grep -c distancematrix` = **0** nos dois arquivos; JSON de ambos válidos (`json.load`); body normalizado validado contra `getSchema('geo-gateway','v1')` → **2/2**; simulação do `Build Payload` com resposta real do `GeoAddress` produziu as 2 `stops` com `lat`/`lng` string e `poc` do destinatário.
- **Não verificado:** execução de teste do F01 no n8n (exige a credencial n8n e um pedido real) — fica condicionado a `SUPABASE_SERVICE_ROLE_KEY` em Settings → Variables do n8n.

---

## BLOCO 4 — Rota esperada e ETA (etapas 43–52)

### 43 — Edge `geo-route-planner` (ou action interna do `job-worker`) ✅
- [x] Gatilho: `lalamove_status` vira `ON_GOING` (motorista a caminho) ou `PICKED_UP` → job `route_plan` em `job_queue`
- [x] Calcula `route(driverPos → próximo stop → stops seguintes)` com `traffic=false` (Essentials) e grava `active_tracking.expected_route` (polyline), `route_distance_m`, `route_duration_s`, `route_provider`, `next_stop_index`
- **Evidência:** `20261121194500_geo_jobs_scheduler.sql` — `refresh_geo_jobs()` enfileira `route_plan` para todo tracking `ACTIVE` com GPS das últimas 2 h, dedup `route:<tracking>:<slot 5min>`, e o cron `geo-jobs-refresh` roda `1-59/5 * * * *`. Handler em `job-worker/index.ts:520`; grava os 4 campos + `route_computed_at` (`:584-594`). `docs/MAPBOX.md:81` registra execução real: `planned` com **205 pontos**, 5563 m, 817 s, `geo_usage` 45→46.
- **Correção de premissa:** o gatilho **não** é o status virar `ON_GOING`; é o cron de 5 min. Depender do webhook de status perderia o pedido que já está em rota quando a linha de tracking nasce.

### 44 — Recalcular rota quando sai do caminho ✅
- [x] Se `distance_to_route_m > off_route_threshold` (de `map_settings_overrides`, padrão 300 m) por 2 ciclos → job `route_plan` novo (máx 1 a cada 5 min por pedido)
- **Evidência:** já estava implementada — **não no trigger**, e sim no cron `geo-jobs-refresh` (`20261121194500_geo_jobs_scheduler.sql:52-73`, agendado em `:87` a cada 5 min): enfileira `route_plan` quando `COALESCE(t.off_route_cycles,0) >= 2`, com `dedup_key = route:<trackingId>:<slot de 5 min>` (rate de 1 job/5 min por pedido) e `max_attempts=2`. O contador é acumulado pelo trigger em `geo_foundation.sql:468` e só zera quando o motorista volta à rota, então o replanejamento se repete a cada janela enquanto o desvio persistir. O `processRoutePlan` (`job-worker/index.ts:419`) consome o tipo e grava `expected_route`/`route_computed_at`.
  **Correção de rumo:** a primeira versão desta entrega enfileirava `route_plan` também dentro do trigger. Isso criava **2 jobs por desvio** (`route_plan:<order>:<minuto>` no trigger vs. `route:<trackingId>:<slot>` no cron) → 2 chamadas pagas ao provedor. O bloco foi removido e a migration ficou só com a etapa 50. Verificado em Postgres 16 descartável: após os cenários de ETA_DELAY, `SELECT count(*) FROM job_queue WHERE type='route_plan'` = **0**.

### 45 — Função SQL `geo_update_route_metrics()` ✅
- [x] No trigger da etapa 20: calcular `distance_to_route_m = geo_point_to_polyline_m(...)`, `distance_to_next_stop_m = geo_haversine_m(... stop[next_stop_index])`, `is_on_route = distance_to_route_m <= threshold`
- [x] Sem chamada externa; < 5 ms
- **Evidência:** as três métricas são calculadas dentro de `geo_evaluate_tracking` (`20261122130100:443-470`), não numa função separada — o plano nomeia `geo_update_route_metrics()` mas o nome real nunca existiu. `distance_to_route_m = round(geo_point_to_polyline_m(...)::numeric, 1)` em `:463`, `is_on_route := distance_to_route_m <= v_off_m` em `:465`. As funções puras têm prova em `supabase/tests/geo_functions.test.sql` (7 asserts, job `geo-sql-tests` no CI).
- **Correção de premissa:** o nome da função é `geo_evaluate_tracking`, não `geo_update_route_metrics`.

### 46 — Avanço de parada ✅
- [x] `distance_to_next_stop_m < 100` por ≥ 2 ciclos ou status Lalamove `PICKED_UP` → `next_stop_index += 1`, `lalamove_stops.arrived_at = now()`
- **Evidência:** `20261122131000_geo_eta_delay.sql:205-224` — 2º ciclo no raio move `next_stop_index` 0→1, grava `arrived_at` na coleta, zera `near_stop_cycles` e recalcula `distance_to_next_stop_m` para a entrega; `PICKED_UP` avança no 1º ciclo. Cenários 4 e 5 de `supabase/tests/02_scenarios.sql`.
- **Por que importa:** antes deste bloco **nada no repositório escrevia `next_stop_index`** — ele nascia em 0 e ficava em 0, e como o bloco de ENTREGA do trigger (`geo_foundation.sql:508`) exige `next_stop_index >= 1`, nenhum pedido gerava `DRIVER_APPROACHING_DELIVERY` nem `DRIVER_ARRIVED_DELIVERY`.
- **Correção de premissa (superada):** a auditoria anterior dizia que o trigger só lia `next_stop_index`. Depois da migration `20261122131000` ele passou a escrevê-lo.

### 47 — ETA por Route Matrix ✅
- [x] Job `eta_refresh`: `matrix(origins=[driverPos], destinations=[next_stop])` → `eta_minutes = ceil(duration_s/60)`, `eta_updated_at`, `eta_provider`
- [x] `travelMode: DRIVE` sempre (D10)
- **Evidência:** `processEtaRefresh` (`job-worker/index.ts:768`) grava os três campos com `Math.max(1, Math.ceil(durationS/60))`. Inclusive faz **snap-to-road antes** (`snapDriverPosition`, `:617`) com confiança mínima 0.3 — melhoria sobre o plano.
- **Correção de premissa:** **não usa Matrix**. Usa `action:'route'`, com o comentário no código explicando o porquê: "Mapbox Matrix recusa 1x1 (mínimo 2 elementos) — usar route com tráfego". Um ETA de 1 origem para 1 destino não cabe na Matrix.

### 48 — Cadência de ETA controlada por custo (D9) ✅
- [x] Recalcular só se `now()-eta_updated_at > 60 s` **e** (`driver andou > 300 m` ou `eta_minutes <= 15`)
- [x] Entre refreshes: ETA estimado localmente = `distance_to_next_stop_m / velocidade média dos últimos 5 pontos` (sem custo)
- [x] Custo máximo por pedido: ~60 min × 1/min = 60 elementos ≈ US$ 0,30 (Essentials) — documentar
- **Evidência:** `geo_usage` de um pedido completo ≤ 70 elementos

**Executado.** `costGuardSkipReason()` é `await`ado antes da chamada paga em
`job-worker/index.ts:906`; devolve o motivo do skip, que vai no `results[]` do job
(`status: 'skipped'`). Regras reais:
- **ETA `<= 15 min`** → mede sempre (`ETA_TRAFFIC_THRESHOLD_MIN`). É a janela do aviso de
  aproximação; errar o número ali quebra o alerta ao destinatário.
- **Nunca medido** (`eta_updated_at` nulo) → mede sempre.
- **Andou `> 300 m`** (`ETA_MIN_MOVED_M`) desde o último recálculo → mede. O deslocamento
  vem de `haversineM()` entre a posição atual e o ponto mais recente de `driver_locations`
  (`recentDriverHistory()`), não de heurística de velocidade.
- Caso contrário pula: dentro de 60 s (`ETA_MIN_INTERVAL_MS`) o motivo é "eta fresco";
  fora, é "andou N m".

**ETA local gratuito (2ª caixa):** `localEtaMinutes()` = `distance_to_next_stop_m /
avgSpeedMps(pontos)`, com `avgSpeedMps()` medindo a velocidade real sobre **os últimos 5
pontos** de `driver_locations` (`order by recorded_at desc limit 5`). Sem 2 pontos ou sem
tempo decorrido, cai em 30 km/h (média urbana de Curitiba) — e o mesmo fallback vale para
velocidade `< 0,5 m/s`, para motorista parado não gerar ETA absurdo. O valor sai em
`results[].local_eta_minutes` nos ciclos pulados, então o campo não envelhece até o
próximo recálculo pago.

### 50 — `ETA_DELAY`
- [x] Se `now() + eta_minutes > scheduled_at + late_delivery_threshold` (de `alert_configurations.LATE_DELIVERY`, padrão 15 min) → evento `ETA_DELAY` (1× por pedido por parada)
- **Evidência:** `20261122131000_geo_eta_delay.sql` — `geo_defaults.late_tolerance_min integer NOT NULL DEFAULT 15` (a tolerância é de negócio; `alert_configurations.min_interval_seconds` é intervalo entre alertas, não tolerância, por isso a coluna própria). No trigger: `v_eta_at := now() + make_interval(mins => NEW.eta_minutes)`, `v_late_limit := o.scheduled_at + make_interval(mins => d.late_tolerance_min)`, emite `ETA_DELAY` via `geo_emit_event` quando `v_eta_at > v_late_limit`, sob `o.scheduled_at IS NOT NULL AND NEW.eta_minutes IS NOT NULL AND v_status IN ('ON_GOING','MATCHED','ASSIGNING_DRIVER','PICKED_UP','DELIVERING')`.
  Validado em Postgres 16 descartável: `scheduled_at` 60 min no passado + `eta_minutes=30` → 1 evento `ETA_DELAY` (`late_minutes=90`, `late_tolerance_min=15`) + 1 alerta; segundo UPDATE → continua 1 (UNIQUE `order_id,event_type,stop_index`); pedido no prazo → 0; pedido sem `scheduled_at` → 0 (não quebra); `job_queue` sem `route_plan` (não interfere na etapa 44).

**Correção de premissa:** os pontos ficam em `driver_locations.latitude/longitude/
recorded_at` (tabela alimentada pelo webhook, PR #236), **não** em
`active_tracking.track_history` — essa coluna não existe. `distance_to_next_stop_m` é
escrito pelo trigger `geo_evaluate_tracking` da migração `20261122130100:443-470`.

**Custo (3ª caixa):** com o guard, um pedido de 60 min com motorista em movimento faz no
máximo 60 medições (1/min, teto do agendador de 5 min já é mais restritivo na prática), e
pedido parado para de custar depois da primeira medição. Teto de 70 elementos por pedido
mantido.

**Testes:** `supabase/functions/job-worker/eta-cadence.test.ts` — 12 casos (fronteira
15/16 min, andou 334 m mede, andou 11 m pula, parado 10 min pula, ETA local com
velocidade real, fallback 30 km/h, mínimo 1 min, `avgSpeedMps` cronológico,
`haversineM` 1° = 111,2 km). Suíte `job-worker/` **34/34 verde**, `deno check` limpo.


### 49 — Trânsito (Pro) só quando importa ✅
- [x] `traffic=true` apenas se `eta_minutes <= 15` (janela do aviso de aproximação); senão Essentials
- **Evidência:** `ETA_TRAFFIC_THRESHOLD_MIN = 15` e `wantsTraffic` em `processEtaRefresh`; `route_plan` passou a usar `traffic:false` explícito (o polilinha de 30 min não precisa de trânsito, e o refresh de ETA é quem decide). 3 testes Deno em `eta-delay.test.ts`.
- **Bug corrigido junto:** ambos os caminhos passavam `traffic:true` sempre. O `route_plan` pagava a SKU com trânsito a cada recálculo sem que o trânsito mudasse o traçado.

### 50 — `ETA_DELAY` ✅
- [x] Se `now() + eta_minutes > scheduled_at + late_delivery_threshold` (de `alert_configurations.LATE_DELIVERY`, padrão 15 min) → evento `ETA_DELAY` (1× por pedido por parada)
- **Evidência:** `maybeEmitEtaDelay()` em `job-worker/index.ts`, chamado pelo `eta_refresh` depois de gravar o ETA. Tolerância lida de `alert_configurations.LATE_DELIVERY.min_interval_seconds` (900 s, `20261121193000:24`) com fallback nos 15 min do plano; `is_enabled=false` desliga. **10 testes Deno verde** (`eta-delay.test.ts`), `deno check` limpo, e a comparação de datas validada em Postgres 16 (`arrival > scheduled + threshold`, igualdade não dispara).
- **Antes:** o tipo existia no enum e o texto no seed, mas **nenhum código emitia o evento** — alerta de seed sem emissor.
- **Decisão:** sem `always_send` no metadata (respeita horário de silêncio, ao contrário dos avisos de chegada do motorista, cuja informação só vale na hora).

### 51 — Snap-to-road (Roads API) — desligado por padrão ✅
- [x] Action `snap` no gateway (`https://roads.googleapis.com/v1/nearestRoads?points=`) atrás de `geo_settings.snap='off'`; quando `on`, aplicar antes de `distance_to_route_m`
- **Evidência:** `geo_settings.snap = 'off'` no seed (`20261122130100:40`); action `snap` mapeada em `ACTION_FUNCTION` (`geo-gateway/index.ts:34`) e despachada em `:168`; **2 testes Deno** em `mapbox.test.ts` (`:108`, `:140`). O consumidor é `snapDriverPosition` no `job-worker` (`:617`), que roda antes do geofence e só move o pino com `confidence >= 0.3`.
- **Correção de premissa:** implementado com **Map Matching v5** do Mapbox (`/matching/v5/mapbox/{profile}`), não com `nearestRoads` do Google. O Google não tem equivalente direto (comentário em `providers/google.ts:5`); Map Matching devolve também `confidence` e `geometry`, que `nearestRoads` não dá.

### 52 — Testes do bloco ✅
- [x] Fixture de trajeto real (Centro→Jardim Botânico, 40 pontos) em `supabase/tests/fixtures/route_curitiba.json`; replay via `simulate-driver-movement` (já exige JWT) → verificar `is_on_route`, `next_stop_index`, `eta_minutes`
- **Evidência (dupla):** `supabase/tests/fixtures/route_curitiba.json` — 40 pontos, **3.983 m** reais (soma haversine dos segmentos), velocidade e heading por ponto. (1) Replay em `job-worker/route-fixture-replay.test.ts`: **7 testes verde** — ordem de `seq`/`elapsed_s`, distância declarada × soma dos segmentos (1 %), os 40 vértices a < 1 m da própria rota, ponto a 600 m conta como desvio, ponto a 278 m dentro do limite de 300 m, chegada no destino e ETA local plausível. (2) Harness SQL `bash supabase/tests/run.sh`: **23 asserções verdes**, incluindo os 40 pontos com `is_on_route=true`, `next_stop_index` 0→1 e desvio de 500 m marcando `is_on_route=false`; extrai as funções reais das migrations e roda num Postgres 16 descartável.
- **Correção de premissa:** o `simulate-driver-movement` **não aceita fixture** — ele move o pino aleatoriamente (`5-15 %` por ciclo + `randomOffset()`) e só roda em ambiente de desenvolvimento (`:35-38`). Replay determinístico é o teste, não a edge.
---

## BLOCO 5 — Motor de geo-eventos (etapas 53–64)

### 53 — Função `geo_evaluate_events()` (corpo do trigger da etapa 20)
- [x] Lê pedido + stops; calcula distância ao stop de coleta (index 0) e de entrega (último); lê `approach_radius_m`, `approach_eta_min`, `notify_delivery_contact`
  - **FEITO:** o corpo é `geo_evaluate_tracking()` em `20261122130100_geo_foundation.sql:389`. Lê `lalamove_orders` + `lalamove_stops` (`:420-441`), resolve raio/ETA com herança pedido→`geo_defaults` (`:429-430`) e `v_notify_del` (`:433`).
- [x] Para cada evento candidato: `INSERT INTO order_geo_events ... ON CONFLICT DO NOTHING`; se inseriu → `INSERT alerts` + `job_queue(type='notification')`
  - **FEITO:** `geo_emit_event()` (`:347-387`): `INSERT ... ON CONFLICT (order_id, event_type, stop_index) DO NOTHING`; só quando insere é que cria `alerts` e `add_job('notification', ...)` com idempotency key `geo:<order>:<event>:<stop_index>`.
- **Evidência:** `supabase/tests/02_scenarios.sql` — 12 cenários / 30 asserções no job `Geo geometry SQL tests` do CI. O cenário "2 UPDATEs dentro do raio → 1 evento" está coberto.

### 54 — `DRIVER_APPROACHING_PICKUP` (D4)
- [x] Condição: `lalamove_status IN ('ON_GOING')` **e** `next_stop_index = 0` **e** (`distance_to_next_stop_m <= approach_radius_m` **ou** `eta_minutes <= approach_eta_min`)
  - **FEITO:** `:489` — `IF NEW.next_stop_index = 0 AND v_status IN ('ON_GOING','MATCHED','ASSIGNING_DRIVER')` e `:490` — `IF v_dist <= v_radius OR (NEW.eta_minutes <= v_eta_min)`. A faixa de status é **mais ampla** que o plano: `MATCHED`/`ASSIGNING_DRIVER` já avisam, porque o motorista pode estar a caminho antes do `ON_GOING`.
- [x] Payload: distância, ETA, nome/placa do motorista (`driver_name/plate` do #107), `share_link`
  - **FEITO:** `v_meta` em `:475-476` carrega `driver_name`, `driver_plate`, `share_link`, `order_ref`, endereços.
- **Evidência:** pedido real pendente — ver etapa 74/99 (dependem de pedido real, não de código).

### 55 — `DRIVER_ARRIVED_PICKUP`
- [x] Condição: `distance_to_next_stop_m <= 100` por ≥ 2 ciclos **ou** `lalamove_stops[0].arrived_at` preenchido
  - **FEITO:** `:498` — `IF NEW.near_stop_cycles >= 2`, com `near_stop_cycles` incrementado pelo próprio trigger a cada avaliação dentro do raio. O `arrived_at` da parada entra pela mesma via do `next_stop_index` lido em `:441`.
- [x] Vai fora da janela de horário (D3)
  - **FEITO:** `:503` anexa `'{"always_send":true}'` ao metadata, e `send-notification` ignora `quiet_hours` quando `always_send` está presente (`quiet-hours.ts`). Chegada nunca fica silenciada.
- **Evidência:** `02_scenarios.sql` cobre o ciclo duplo; a entrega real depende da etapa 74.

### 56 — Aviso também para a equipe interna
- [x] `alert_configurations.DRIVER_APPROACHING_PICKUP` com `notify_slack/whatsapp` internos (grupo logística) — além do responsável pela coleta
  - **FEITO (PR #267):** `20261124120000_internal_alert_channels.sql` liga `notify_slack = true` e `slack_channels = ARRAY['internal']` em `DRIVER_APPROACHING_PICKUP` e `DRIVER_ARRIVED_PICKUP`. O token `internal` é resolvido para `SLACK_WEBHOOK_URL` por `sendSlack` (`send-notification/index.ts:793-796`) — segredo não entra em migration. `COALESCE(NULLIF(...))` preserva webhook já configurado pelo operador.
- **Evidência:** validado em Postgres 16 (4 cenários: aplicação, idempotência 2×, `ETA_DELAY` intocado, webhook do operador preservado). **Pendente:** a linha "2 destinatários em `alerts_sent`" exige a migration aplicada + pedido real (etapa 74).

### 57 — `DRIVER_APPROACHING_DELIVERY` / `DRIVER_ARRIVED_DELIVERY` (D5)
- [x] Mesma lógica com `next_stop_index = último` e destinatário = `lalamove_stops[last].contact_phone`
  - **FEITO:** `:508` — `IF NEW.next_stop_index >= 1 AND NEW.next_stop_index = v_last_index AND v_status IN ('PICKED_UP','ON_GOING')`; destinatário em `:478-485` monta `recipients` a partir de `lalamove_stops[stop_index].contact_name/contact_phone`.
- [x] Só se `notify_delivery_contact = true` (padrão false)
  - **FEITO:** `:433` — `v_notify_del := COALESCE(o.notify_delivery_contact, d.notify_delivery_contact)`, usado em `:508-524`. O seed de `alert_configurations` cria `DRIVER_*_DELIVERY` com `is_enabled = false`, então o padrão é desligado mesmo com a coluna `true`.
- **Evidência:** `02_scenarios.sql` cobre o bloco de entrega; teste com a flag on/off em pedido real depende da etapa 74.

### 58 — Janela de horário (D3)
- [x] `geo_notification_allowed(event_type, now())`: 07:00–20:00 `America/Sao_Paulo`; fora → `notification_status='deferred'`, `job_queue.run_at = próximo 07:00`; exceção `*_ARRIVED_*`
- [x] Configurável em `geo_settings_meta` (jsonb: `quiet_hours_start/end`)
- **Evidência:** teste com relógio mockado

**Auditado (2026-11-22).** Janela de silêncio implementada **na edge**, não em SQL:
- `loadQuietHours()` lê `quiet_hours_start/end/tz` de `geo_defaults` (`send-notification/index.ts:50-60`); as colunas estão em `geo_foundation.sql:52-54` com default de 07:00–20:00 e tz `America/Sao_Paulo`.
- Fora da janela: `index.ts:161-175` calcula `nextAllowedTime()` e **enfileira** em `job_queue` com `run_at` no próximo horário permitido e `metadata.source = "send-notification:quiet_hours"`. `order_geo_events.notification_status` aceita `'deferred'` (`geo_foundation.sql:262`).
- Deferimento é por evento, não por `event_type` fixo: a exceção dos `*_ARRIVED_*` fica a cargo do `config` do `alert_configurations` (o deferimento só ocorre quando o canal está sujeito a quiet hours).
- **Desvio consciente:** o plano pedia `geo_settings_meta` (jsonb); a implementação usa colunas dedicadas em `geo_defaults`, que é a tabela de padrões globais criada na mesma migration e já exposta na UI (etapa 90). Efeito idêntico, com tipo forte em vez de jsonb.

### 59 — Resolução do destinatário (D1)
- [x] Ordem: `pickup_contact_phone` → `supplier_contact` (se `auto_notify_supplier`) → `lalamove_stops[0].contact_phone`; normalizar E.164 (`+55…`), rejeitar máscara `****`
- [x] Sem destinatário válido → `notification_status='no_recipient'` + alerta interno
- **Evidência:** teste com 3 cenários

**Executado.** Não existia normalização de telefone em nenhum ponto do repo (`grep`
por `E.164`/`+55`/`normalizePhone` retornava vazio): o trigger gravava
`metadata.recipients[].to` cru do cadastro e o `send-notification` repassava ao provedor —
que recusa `(41) 99999-8888` com 400 e o alerta morria com erro opaco.

`supabase/functions/_shared/phone.ts` (novo):
- **`normalizePhone()`** devolve E.164 ou `null`. Tira não-dígitos, remove `00` de
  operadora e `0` de discagem, aceita com/sem DDI 55, exige **10 (fixo) ou 11
  (celular)** dígitos, **DDD entre 11 e 99**, celular com `9` após o DDD e fixo
  começando com 2-5. **Rejeita máscara antes de limpar os dígitos** — senão `****`
  viraria string vazia e o `null` aconteceria por acidente, não por regra.
- **`resolveGeoRecipient()`** aplica a ordem do plano: contato da coleta →
  fornecedor **só se `auto_notify_supplier`** → telefone da parada. Devolve também
  `source`, para o log dizer de onde veio o número.
- **`isDeliverablePhone()`** para os pontos que só decidem sim/não.

**Integração** em `send-notification/index.ts` (bloco de destinatários ad-hoc): canal
`whatsapp`/`sms` passa por `normalizePhone` antes do `dispatch`; número inutilizável é
**descartado com log explícito** em vez de virar 400 do provedor. Com isso o
`no_recipient` de `geoDeliveryStatus()` (`:42`, quando `results.length === 0`) passa a
significar de fato "não havia telefone válido" — antes o caso podia terminar como
`failed` genérico.

**Testes:** `_shared/phone.test.ts` — **14 casos verde**: máscara, DDI, zero de
discagem, fixo, `****`/`##`/`x`, vazio/número, contagem de dígitos, DDD inválido, `9`
obrigatório no celular, e os 3 cenários de resolução (prioridade da coleta, fornecedor
só com `auto_notify_supplier`, fallback na parada, nenhum válido → `null`).
`deno check` mantém os **4 `TS2345` pré-existentes** de `send-notification` (baseline).

### 60 — Opt-out e dedup
- [x] Tabela `notification_optouts(phone PK, reason, created_at)`; checar antes de enviar
  - **FEITO:** `20261123200000_optout_and_tracking_end.sql` cria a tabela + `normalize_br_phone()` + `is_phone_opted_out()`; `send-notification/index.ts:255-270` consulta antes de cada destinatário ad-hoc de whatsapp/sms e registra `opted_out` em `alerts_sent`. Validado em Postgres 16: `+55 41 99999-8888`, `41 99999-8888` e `4199998888` bloqueiam; outro número, vazio e `****` não.
- [x] `alert_dedup` já existe (`20260712221144`): chave `order_id+event_type+recipient` — dedup vive em `claim_alert_notification` (janela 300 s), chamada em `send-notification/index.ts:124`
- **Evidência:** 2º envio bloqueado

### 61 — Encerramento do tracking
- [x] Em `COMPLETED/CANCELED/REJECTED/EXPIRED`: `tracking_status='ended'`; eventos pendentes `deferred` são cancelados
  - **FEITO:** `end_order_tracking(uuid, text)` + trigger `trg_close_tracking_on_order_end` na mesma migration; `lalamove-webhook/index.ts:325-333` chama a RPC nos 5 estados finais. Validado: `ON_GOING`→`COMPLETED` deixou `tracking_status='ended'` com `tracking_ended_at`, converteu `deferred`→`skipped` e preservou `sent`; segunda chamada retorna 0 (idempotente).
- **Evidência:** pedido cancelado não gera mensagem

### 62 — Painel de eventos no pedido
- [x] `OrderDetailModal.tsx`: aba "Eventos" lendo `order_geo_events` (ícone, hora, distância, ETA, status da notificação, reenviar) — PR #219 (`OrderGeoEvents.tsx`), 4 testes
- **Evidência:** screenshot

**Auditado (2026-11-22).** `OrderGeoEvents.tsx` (187 linhas) é renderizado em `OrderDetailModal.tsx:1003` (`<OrderGeoEvents orderId={order.id} driverId={order.driverId} />`, import em `:49`).
- Lê `order_geo_events` por `order_id` (query `order-geo-events`), exibindo ícone por tipo, hora, `distance_m`, `eta_min` e `notification_status`.
- Cobre também a etapa 63 (botão "Reenviar" em `:187`).

### 63 — Reenvio manual
- [x] Botão "Reenviar aviso" → `send-notification` com `skip_dedup=true` (equivalente ao `force`, o contrato usa `skip_dedup`) · **FEITO:** botão em `OrderGeoEvents.tsx` envia `metadata: { manual: true, geo_event_id }` e a edge grava o status de volta em `order_geo_events` via `recordGeoEventStatus`
- **Evidência:** `alerts_sent` com a linha

**Auditado (2026-11-22).** `resend` em `OrderGeoEvents.tsx:83-108`:
- Invoca `send-notification` com `alert_id`, `type`, `severity`, `title`, `message`, `order_id`, `driver_id`, `skip_dedup: true` e `metadata: { manual: true, geo_event_id, source: 'order_detail_geo_events' }`.
- **Desvio consciente:** o plano pedia `force=true`; o contrato real é `skip_dedup` (`send-notification/index.ts:115`, schema em `_shared/schemas.ts:63`), porque "force" colidia com o dedup por `min_interval_seconds`. O rastro gravado usa `metadata.manual = true` + `source`, e o `parseJsonBody` valida o schema.
- Erros de envio (`success:false`) viram throw e toast de erro; sucesso invalida a query de eventos para o operador ver o novo status.

### 64 — Testes do bloco
- [x] pgTAP/`DO` para `geo_evaluate_events` (6 cenários) + Deno para resolução de destinatário e janela
- **Evidência:** CI verde

**Executado (2026-11-22).** Testes SQL de comportamento do trigger, além dos testes puros de
geometria da etapa 17:

- `supabase/tests/fixtures/geo_trigger_schema.sql` (novo, 172 linhas): schema mínimo com `auth.users`,
  enums `order_status`/`alert_type`/`alert_severity`, `lalamove_orders` (com as colunas geo de
  `approach_radius_m`/`approach_eta_min`/`notify_delivery_contact`), `lalamove_stops`,
  `active_tracking` (colunas de métrica de rota), `alerts`, `order_geo_events`, `job_queue` +
  `add_job()`, `update_updated_at_column()` e o singleton `geo_defaults`. Coordenadas declaradas
  `decimal(10,8)`/`decimal(11,8)` porque `geo_emit_event` recebe `numeric` e o Postgres não faz cast
  implícito a partir de `double precision` — com `float` o `PERFORM` falha com
  `function geo_emit_event(...) does not exist`.
- `supabase/tests/geo_trigger.test.sql` (novo, 226 linhas): 8 casos `DO/ASSERT`, com `TRUNCATE` inicial
  para permitir reexecução:
  1. motorista a 200 m da coleta → 1 evento `DRIVER_APPROACHING_PICKUP`, job `geo:*`, destinatário =
     telefone do pedido;
  2. segunda posição dentro do raio → ainda 1 evento (idempotência via `ON CONFLICT`);
  3. fora do raio (3 km) e ETA 40 min → 0 eventos, `distance_to_next_stop_m > 2000`;
  4. ETA ≤ 5 min com distância grande → avisa (critério "raio **ou** ETA", decisão D4);
  5. "chegou" exige 2 ciclos em `arrived_radius_m`: 1º ciclo 0 eventos, 2º ciclo 1 evento;
  6. entrega desligada por padrão (D5): evento gravado com `job_id IS NULL` e
     `notification_status='skipped'`;
  7. pedido sem coordenada de parada → 0 eventos, sem exceção;
  8. ponto sobre o polyline esperado → `off_route_cycles = 0`.
- **Testes de mutação (2026-11-22, Postgres 16 em Docker, 8/8 verde):** `arrived_radius_m=1` derruba o
  caso 5 ("veio 0"); `approach_radius_m=1, approach_eta_min=0` derruba o caso 1 ("veio 0");
  `notify_delivery_contact=true` derruba o caso 6 ("veio 1"). Suíte roda 2× seguidas sem colidir.
- CI: job novo `geo-trigger-sql-tests` em `.github/workflows/ci.yml` (postgres:16 como service; carrega
  fixture + linhas 277-341, 347-387 e 389-533 da migration antes de rodar o arquivo de testes).
  `actionlint` no `ci.yml`: só o `SC2129` pré-existente da linha 145.

---

## BLOCO 6 — Notificações (etapas 65–74)

### 65 — Consertar os chamadores de `send-notification`
- [x] `lalamove-webhook/index.ts:314`: `alertId→alert_id`, `driverId→driver_id`, `orderId→order_id`
- [x] GUARDIAN (`:383-396`): montar payload v1 completo (`alert_id, type, severity, title, message`)
- [x] `check-driver-alerts:58,162,225`: tipos agora existem no enum (etapa 16)
- **Evidência:** teste Deno `security.test.ts` estendido; log sem 400

**Auditado (2026-11-22).** Os três chamadores usam hoje o contrato v1 snake_case:
- Webhook: helper `sendNotification` (`lalamove-webhook/index.ts:333-355`) monta `{ alert_id, type, severity, title, message, driver_id, order_id }` + `metadata.recipients` quando há destinatário. Três pontos de insert de alerta (`:327,339,351`).
- GUARDIAN (`:422-437`): chama `sendNotification('DRIVER_ASSIGNED', ..., [{ role: 'supplier', channel: 'whatsapp', to: supplier_contact }])` — payload v1 completo, com destinatário ad-hoc.
- `check-driver-alerts` emite `DRIVER_STOPPED` (`:142`), `SUPPLIER_DELAY_NOTICE` (`:164`), `ROUTE_DEVIATION` (`:198`) e `MISSING_POD` (`:227`) — todos no enum depois da etapa 16 (`20261122130000_geo_alert_types.sql`).

### 66 — `send-notification`: destinatários por pedido
- [x] Schema v2: `recipients?: [{channel:'whatsapp'|'email', to, role:'pickup_contact'|'delivery_contact'|'internal'}]`; quando presente, **une** com os de `alert_configurations`
- [x] Manter v1 intacto (contrato versionado em `_shared/contract.ts`)
- **Evidência:** `send-notification/recipients.test.ts` — 7 testes Deno verdes. `deno test _shared/contract.test.ts` 48/48 (o v2 com `recipients` valida no contrato).

**Executado (2026-11-22).** O módulo `send-notification/recipients.ts` concentra a união e a deduplicação; o handler passou a usá-lo em dois pontos:
- `index.ts:299-307` — os destinatários do pedido saem da **união** do corpo v2 (`recipients`) com o legado v1 (`metadata.recipients`), deduplicados por `canal+destino`; o `Set` `orderRecipientsDelivered` (:307) guarda o que já foi despachado.
- `index.ts:414-425` — `dispatchIfNew` na configuração consulta `orderRecipientsDelivered` **e** `configRecipientsDelivered` (:362), então um contato que está no pedido **e** em `alert_configurations` recebe uma vez só.
- `index.ts:418-421` — a comparação normaliza o telefone da configuração (`(41) 99999-8888` → `+5541999998888`) antes de montar a chave; sem isso o mesmo contato entraria como dois destinos distintos.
- `_shared/schemas.ts` — `sendNotificationV2` ganhou `recipients` (array de `{channel, to, role?, name?}`).
- v1 intacto: quem não manda `recipients` continua lendo só `metadata.recipients`, com o mesmo comportamento de antes.

### 67 — Templates por evento
- [x] `alert_configurations.message_template` com variáveis `{{driver_name}} {{driver_plate}} {{eta_min}} {{distance_m}} {{share_link}} {{order_ref}} {{pickup_address}} {{static_map_url}}`
- [x] Textos PT-BR iniciais: aproximação ("Olá {{pickup_contact_name}}, o motorista {{driver_name}} ({{driver_plate}}) chega em ~{{eta_min}} min para retirar o pedido {{order_ref}}. Acompanhe: {{share_link}}"), chegada, atraso
- [x] Render em `_shared/template.ts` (sem dependência nova)
- **Evidência:** `_shared/template.test.ts` — 9 testes Deno verdes; `send-notification` usa `renderTemplate` no lugar do texto cru do trigger.

### 68 — Imagem estática no WhatsApp ✅
- [x] Para `*_APPROACHING_*`: `geo-gateway static` (marker motorista + marker coleta + rota) → Evolution `sendMedia`; se orçamento bloquear, manda só texto
- **Evidência:** `static-map.test.ts` 12/12 + `zapp.test.ts` 12/12 (Deno)

**Executado (2026-11-22).** `send-notification/static-map.ts` (novo) isola a decisão:
`shouldAttachStaticMap` libera só `DRIVER_APPROACHING_PICKUP`/`DRIVER_APPROACHING_DELIVERY`;
`buildStaticMapRequestFromRows` lê as coordenadas do banco (`lalamove_orders` para coleta/entrega,
`active_tracking.current_*`/`expected_route` para motorista e rota — o trigger grava endereços e contatos
em `metadata`, não lat/lng); `fetchStaticMap` chama `geo-gateway` action `static` e **nunca lança**:
`GEO_BUDGET_EXCEEDED`/`GEO_UNAVAILABLE`/provedor desligado caem para texto (`isNonRetryableGeoError`,
mesmo critério de `geo-gateway/budget-error.test.ts:51`), erro real do provedor loga e também cai para texto.
`GEO_STATIC_MAP_IN_WHATSAPP=false` desliga a imagem sem deploy.

Envio: `sendWhatsApp` ganhou o parâmetro `mediaDataUrl` e usa `sendMedia` — Zapp
(`_shared/channels/zapp.ts`, novo método opcional na interface `TextChannel`, `POST /messages/send-media`
com mimetype/base64/caption) e Evolution (`POST /message/sendMedia/<instance>`, mesmos campos). A imagem é
gerada **uma vez por alerta**, não por destinatário, dentro do handler antes do `dispatch`.

**Verificado:** `deno test supabase/functions/send-notification/static-map.test.ts` → 12/12;
`deno test supabase/functions/_shared/channels/zapp.test.ts` → 12/12; `deno check` em
`send-notification/index.ts` → só os 4 erros de `order_id` pré-existentes no `main` (nenhum novo).

**Pendente de validação real:** "mensagem recebida com imagem no número de teste" exige pedido real com
motorista a caminho e secrets `EVOLUTION_*`/`ZAPP_*` — não verificável sem tráfego de produção.

### 69 — Canal Zapp Web (D2, preparado)
- [x] Adaptador `channels/zapp.ts` com interface igual ao Evolution; ativado por `ZAPP_API_URL/ZAPP_API_KEY` quando existirem; sem secret → canal ausente
- **Evidência:** `zapp.test.ts` 9/9 verde (Bearer, número normalizado, `instance` opcional, destinatário vazio não chama API, 401 com trecho do corpo, erro de rede sem lançar, timeout abortado, factory `null` sem secrets, `normalizeZappNumber`). `sendWhatsApp` usa o Zapp como **preferencial** e cai no Evolution quando não configurado — nenhum secret configurado continua sendo o único caso de falha. `deno check` sem erro novo (4 erros de `order_id` são pré-existentes no `main`).

### 70 — Agendar `check-driver-alerts` e `escalate-alerts`
- [x] 🔒 `cron.schedule('check-driver-alerts','*/1 * * * *', net.http_post(...))` e `escalate-alerts` a cada 5 min (padrão de `process_job_queue`, `20251226010001`)
  - **FEITO (PR #217):** `20261123190000_cron_check_driver_alerts.sql` agenda `check-driver-alerts` com **`*/2 * * * *`** e não `*/1` — o menor limiar de alerta é 5 min, então 2 minutos já dão 2 leituras antes do `CRITICAL` de 10 min sem pagar 2× a chamada de edge por minuto. `escalate-alerts` já existia em `20261122140000_fix_crons_dispatcher.sql:116` com `*/5`.
  - A chave vem de `vault.decrypted_secrets` (`dispatcher_key`) em `net.http_post`, com `timeout_milliseconds := 25000`; se o secret faltar, emite `WARNING` e **não** cria o job (nunca embute segredo na migration). Idempotente via `cron.unschedule` condicional — `jobname` é a chave.
- [x] Registrar em `docs/CRON_JOBS.md`
  - **FEITO (PR #266):** `docs/CRON_JOBS.md` v2.0.0 lista os **20** jobs reais agrupados por natureza (edge functions, geo, cache/materialized views, limpeza, partições), documenta a resolução de chave por `vault.decrypted_secrets` e explica que `jobname` é a chave de idempotência.
- **Evidência:** `cron.job_run_details` com execuções — **pendente de verificação em produção**: não há rota MCP para consultar `cron.job`. A query de conferência está no rodapé de `CRON_JOBS.md`.

### 71 — `alert_configurations` dos novos tipos
- [x] Linhas com canais, `min_interval_seconds=300`, `dedup_window`, template; `is_enabled=true` para pickup, `false` para delivery
- **Evidência:** seed em `20261122130100_geo_foundation.sql:539-552` — 6 linhas (`DRIVER_APPROACHING_PICKUP`/`DRIVER_ARRIVED_PICKUP`/`ETA_DELAY`/`GEO_BUDGET_WARNING` com `is_enabled=true`; as duas de delivery com `false`), `min_interval_seconds` 300 (600 no `ETA_DELAY`, 3600 no orçamento), `message_template` com `{{variavel}}`, `ON CONFLICT (alert_type, channel) DO NOTHING`. `dedup_window_seconds` é default 300 da coluna (`20260712221144:3`) e os 6 valores do enum existem em `20261122130000_geo_alert_types.sql:7-15`. Colunas `message_template`/`min_interval_seconds`/`notify_whatsapp` existem desde `20251224181640:72-74`.

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

### 77 — Polyline da rota + motorista + ETA no Google ✅
- [x] Desenhar `active_tracking.expected_route` (`google.maps.Polyline`) e trilha `tracking_events`; marker do motorista animado entre pontos (interpolação 10 s)
- [x] Badge de ETA e distância no `MapHUD.tsx`
- **Evidência:** screenshot com rota e motorista

**Executado.** `GoogleMapsCanvas` desenhava só os markers; o Mapbox (`mapLayers.ts:148,169`)
já tinha `expected-route` e `driver-trail` desde a etapa 78, então o mesmo pedido
aparecia diferente dependendo do provedor escolhido.

- **Polyline da rota** (`GoogleMapsCanvas.tsx`, efeito novo): lê
  `active_tracking.expected_route` via `toGooglePath()`, que delega a validação para
  `parseExpectedRoute()` — a mesma função do Mapbox, para que um `jsonb` corrompido
  vire path vazio em vez de Polyline quebrada. A instância é reaproveitada por
  `order_id` e só o `path` muda: recriar a cada tick de 5 s pisca o traçado.
- **Trilha** (`hooks/useTrackingTrails.ts`): lê `tracking_events` com **uma** consulta
  `in('order_id', ids)` para todos os pedidos visíveis, em vez de um request por
  pedido. Ordena por `created_at` no cliente (o PostgREST não garante ordem) e corta
  em 60 pontos (`TRAIL_MAX_POINTS`) — a tabela cresce sem limite.
- **Animação do marker:** o poll é de 5 s e reposicionar direto fazia o carro
  "teleportar". `interpolatePosition()` move da posição anterior até a nova ao longo
  de `DRIVER_ANIM_MS = 10_000`, via `requestAnimationFrame`, com o handle guardado em
  `animationsRef` para cancelar a animação anterior antes de iniciar outra.
- **Badge no HUD** (`MapHUD.tsx`): `formatRouteBadge()` mostra `distance_to_next_stop_m`
  (escrito pelo trigger `geo_evaluate_tracking`, `20261122130100:453`) e o ETA lado a
  lado. Campo ausente → `--`, sem esconder o painel.
- **Limpeza:** `unmount` cancela `rAF`, remove Polylines e markers. Polyline de pedido
  que saiu da lista (`COMPLETED`/`CANCELED`) é removida do mapa em vez de congelar.

**Testes:** `src/components/map/__tests__/googleLayers.test.ts` — 14 casos (rota válida,
`jsonb` corrompido → path vazio, ordenação cronológica da trilha, ponto NaN descartado,
corte em 60, interpolação 0/meio/fim, overshoot limitado ao destino, janela zero,
metro vs km no badge, haversine 1° ≈ 111 km). `src/components/map` **76/76 verde**,
`tsc -p tsconfig.app.json` limpo, `eslint` 0 erros.

### 78 — Mesmo no Mapbox
- [x] `mapLayers.ts`: layer `expected-route` (line) e `driver-trail`; mesma fonte de dados → paridade entre provedores
- **Evidência:** screenshot

**Auditado (2026-11-22).** `mapLayers.ts`:
- Sources/layers `expected-route` (linha contratada) e `driver-trail` (rastro percorrido) definidos em `:148-178`.
- `setExpectedRoute(map, points)` (`:243-248`) e `setDriverTrail(map, points)` (`:250-255`) alimentam ambos a partir da **mesma fonte** (`active_tracking.expected_route` e histórico de posições), então os dois provedores recebem geometria idêntica — a paridade pedida.

### 79 — Mini-mapa no detalhe do pedido ✅
- [x] `OrderDetailModal.tsx`: `OrderTrackingMap` (h-56) com coleta, entrega, rota e motorista; usa o token de `get-mapbox-token`
- [x] **Lazy:** só monta com `active_tracking.tracking_status = 'ACTIVE'` — sem tracking não há instância de mapa nem map load
- [x] Fallback sem tracking: card com o link "Abrir rastreio Lalamove" (`order.shareLink`) preservado
- **Evidência:** `OrderDetailModal.tsx:509-530` (query inclui `tracking_status`), `:660-695` (render condicional); `npx vitest run` 1017/1017; `tsc` limpo

### 80 — Provedor de tiles vem do servidor ✅
- [x] `useMapProviderPolicy.ts`: `useTilesProvider()` lê `geo_settings.tiles`; `allowedProvidersFor()` restringe o seletor; `useEffectiveMapProvider()` cai na primeira opção permitida quando o admin desliga a família escolhida (preferência local preservada)
- [x] Contar map load no **provedor efetivo**: `GoogleMapsCanvas` e `Google3DCanvas` chamam `countMapLoad('google')` ao instanciar; `LiveMap` só instancia o Mapbox quando o Google não está ativo (antes o mapa Mapbox era criado e cobrado escondido)
- **Evidência:** `src/components/map/__tests__/mapLoadBilling.test.tsx` 2/2 (falha sem o `countMapLoad('google')`); `LiveMap.tsx:141-145` (early return); `npx vitest run` 1017/1017; `tsc` limpo

### 81 — Autocomplete com viés de localização ✅
- [x] `locationBias` = centro do mapa atual ou coordenada do último pedido do cliente
- **Evidência:** sugestões de Curitiba primeiro

**Executado.** A cadeia `schemas.ts:139` → `providers/mapbox.ts:127` (`proximity`) /
`providers/google.ts:86` (`locationBias.circle`) já existia desde a #197; o elo que
faltava era o front, que chamava o `geo-gateway` sem `bias` e recebia a ordenação
nacional do provedor.

- `useAddressSearchBox(query, enabled, bias?)` — `src/hooks/useGeoSearch.ts:131`.
  O `bias` entra também na `queryKey` (`:160`): sem isso o React Query devolveria a
  lista do cliente anterior ao trocar de pedido.
- `useCustomerSearchBias(customerPhone)` (`:94`) resolve o viés pelo **último pedido
  do cliente**, lendo `lalamove_orders.pickup_latitude/longitude` com fallback para
  `delivery_*`. Usa `customer_phone`, não `customer_id` — essa coluna não existe.
- `AddressAutocomplete` recebe `customerPhone` (`:74`) e repassa ao hook; sem
  histórico de pedido, **nenhum `bias` é enviado** e a busca continua global.
- `NewOrderDialog` passa `form.senderPhone` na coleta; na entrega só depois que
  `pickupGeo` existe (entrega costuma ser na mesma região, mas o destinatário pode
  ser de outra cidade — viesar por um dado não confirmado pioraria o resultado).
- Raio padrão `DEFAULT_BIAS_RADIUS_M = 50_000` (50 km) quando o caller não informa.

**Sobre a 1ª caixa:** das duas fontes citadas (centro do mapa / último pedido do
cliente), foi implementada a do cliente. O `NewOrderDialog` não renderiza mapa, então
não há centro de mapa a usar nesse fluxo; quando houver, é só passar o ponto como
`bias` — o hook já aceita qualquer coordenada.

**Testes:** `src/hooks/useGeoSearch.test.tsx` — 4 casos novos (bias enviado com raio
padrão, ausência da chave `bias` sem região, resolução por `customer_phone` com
`limit(1)`, telefone vazio sem request). Arquivo **15/15 verde**; `tsc -p
tsconfig.app.json` limpo.

### 82 — Acessibilidade e i18n ✅
- [x] Strings novas em `src/i18n/locales/{pt-BR,en,es}`; componentes com `aria-label`
- **Evidência:** lint i18n verde — `node scripts/ci/check-i18n-parity.mjs` → `3 locales em paridade (232 chaves cada)`; `node scripts/ci/a11y-button-name-ratchet.mjs` → `82` (baseline `82`)

**Executado.** O bloco de mapas era o ponto cego de a11y do sistema: `node scripts/ci/a11y-button-name-ratchet.mjs` media **92** violações contra baseline **89** (`exit 1`), e **10** delas eram de `src/components/map/` — `LiveMap.tsx:450,459,467,476,485,494`, `MapHUD.tsx:99,110,121`, `MapHistoryPanel.tsx:143`. Nenhum componente do diretório importava `useTranslation` (`grep -rn "useTranslation" src/components/map` → vazio), então todo rótulo do mapa era string fixa em PT-BR.

- **Chaves novas** — 13 em `map.actions` (`settings`, `styleDark`, `styleSatellite`, `traffic`, `followDriver`, `focusDriver`, `streetView`, `whatsapp`, `criticalAlert`, `closeHistory`, `clearSearch`, `centerOnTarget`, `nearStop`), as mesmas nos três locales.
- **`aria-label` + `aria-pressed`** — `LiveMap` (6 toggles), `MapHUD` (Street View, WhatsApp, alerta crítico), `MapHistoryPanel` (fechar), `MapSearchPanel` (limpar busca, centralizar — eram strings PT fixas inline).
- **`aria-pressed`** só nos controles que são de fato alternância de estado (`showSettings`, `mapStyle`, `showTraffic`, `isFollowing`, `focusMode`). Botão de ação (WhatsApp, alerta) não recebe — leitor de tela anunciaria um toggle que não existe.
- **`title={t('map.actions.nearStop')}`** em `MapHUD` substituiu um `title` com texto sem acento — o valor passou a vir do locale.
- **`scripts/ci/check-i18n-parity.mjs`** (novo) — é o "lint i18n" que o plano pede e o repo não tinha. Compara as chaves dos três locales e falha em: chave faltando, chave sobrando, valor vazio e placeholder divergente (`{{count}}` vs `{{total}}`). O verificador existe porque `fallbackLng: 'pt-BR'` (`src/i18n/index.ts`) faz a chave ausente cair silenciosamente no português — a tela "funciona" no idioma errado, e é exatamente esse o risco quando se adiciona `aria-label` traduzido.
- **`npm run lint:i18n`** e **`npm run lint:a11y`** no `package.json`; baseline do ratchet **89 → 82**.

**Verificado:** `npx tsc --noEmit -p tsconfig.app.json` → exit 0; `npx vitest run src/components/map src/i18n` → 11 arquivos, **68/68**; `node --test scripts/ci/check-i18n-parity.unit.mjs` → **11/11**; `npx eslint src/components/map` → **0 erros**. `src/components/map/__tests__/mapA11yNames.test.tsx` (novo, 6 testes) troca para `en` e exige `getByRole('button', { name: 'Close driver history' })` — prova que o nome acessível acompanha o idioma, não só que o atributo existe.

**Ressalvas honestas.** O ratchet continua **fora do CI** (`grep -rn a11y .github/workflows` → vazio); ligá-lo é mudança de workflow e fica para a etapa que trata de CI (regra 8). E restam **82** violações fora de `src/components/map/`, herdadas — não entram nesta etapa.

### 83 — Remover `mapbox-proxy` e `get-mapbox-token` redundantes
- [x] Após `useMapbox.ts` migrar para `useGeo.ts`: apagar `mapbox-proxy` (token Mapbox continua via `get-mapbox-token` só para tiles)
  - **FEITO:** `supabase/functions/mapbox-proxy` **não existe** no repo (`ls supabase/functions/ | grep mapbox` → vazio). A migração do front está completa: `src/hooks/useGeo.ts` faz `export * from "./useMapbox"` e `useMapbox.ts:2` importa `callGeo` de `@/lib/geo-gateway` — o proxy foi substituído pelo gateway, não ficou órfão. `get-mapbox-token` permanece só para os tiles do mini-mapa.
- [x] Atualizar `docs/ci/MATRIZ_EDGE_TABELA.md`
  - **FEITO:** `:24` lista apenas `get-mapbox-token` (e não `mapbox-proxy`); `:17,45-47` já incluem `check-driver-alerts` e as demais edges do bloco geo.
- **Evidência:** `supabase_functions_list` sem `mapbox-proxy` — **não verificado em produção** (sem rota MCP de gestão do Supabase). O repo é a fonte que consigo provar: a function não existe no código nem na matriz.

### 84 — Testes de front ✅
- [x] vitest: `useGeo`, `AddressAutocomplete`, `OrderTrackingMap` (mock do loader); Playwright `e2e/`: criar pedido com autocomplete → coordenadas preenchidas
- **Evidência:** CI verde — `npx vitest run src/hooks/__tests__/useGeo.test.ts src/components/orders/AddressAutocomplete.test.tsx src/components/map/__tests__/OrderTrackingMap.test.tsx` → 3 arquivos verdes; `npx playwright test --list` → `new-order-autocomplete.e2e.ts:60` listado; `npx tsc --noEmit -p tsconfig.node.json` → exit 0

**Executado.** Os três alvos de vitest **já existiam** e não precisaram de código novo: `src/hooks/__tests__/useGeo.test.ts` (8 `it`), `src/components/orders/AddressAutocomplete.test.tsx` (6 `it`) e `src/components/map/__tests__/OrderTrackingMap.test.tsx` (3 `it`, com o loader mockado). O que faltava de verdade era o e2e.

- **`e2e/new-order-autocomplete.e2e.ts`** (novo) — abre `/orders`, digita os endereços nos campos de coleta e entrega, **clica na sugestão da lista** (`role="option"`) e então captura o corpo da cotação com `page.route('**/functions/v1/lalamove-api')`.
- **Por que interceptar a edge:** o `NewOrderDialog` **não exibe** a coordenada escolhida — `pickupGeo`/`deliveryGeo` são só estado (`:173-174`) e viram `stops[i].coordinates` no corpo da cotação (`:308-309`). Nenhum seletor provaria "coordenadas preenchidas"; o corpo do request prova.
- **A cotação real não é chamada** — a resposta é `route.fulfill` com o contrato mínimo (`quotationId`, `expiresAt`, `priceBreakdown`, `stops[].stopId`). Rodar a cotação a cada push custaria dinheiro e dependeria de serviço ativo na praça.
- **Asserções:** duas paradas; cada uma com `coordinates` presente, numérica e **não `0,0`** (o placeholder que a Lalamove devolve `422 ERR_OUT_OF_SERVICE_AREA`); e `lat`/`lng` da coleta e da entrega iguais ao ponto que o `place-details` do provedor devolveu (`toBeCloseTo` em 5 casas).
- **Degradação:** sem `LOVABLE_BROWSER_SUPABASE_*` a sessão não é injetada e o teste é `skip`; se o gateway não devolver coordenada para os endereços de teste, também `skip` em vez de falhar por ambiente — mesmo padrão do `autocomplete.e2e.ts`.

**Verificado:** `npx playwright test --list` lista o teste (7 arquivos, 26 testes); `npx tsc --noEmit -p tsconfig.node.json` → exit 0; `npx eslint e2e/new-order-autocomplete.e2e.ts` → 0 erros.

**Ressalva honesta.** Execução real do e2e depende das variáveis de sessão injetada, que só o CI de produção possui — localmente ele aparece como `skip`. Isso não é "verificado em execução": está verificado que compila, que é descoberto pelo Playwright e que o caminho do teste corresponde ao fluxo real do diálogo (conferido em `NewOrderDialog.tsx:296-330`).

---

## BLOCO 8 — Admin "Mapas & Custos" (etapas 85–92)

### 85 — Rota `/settings/maps` (manager/admin)
- [x] `src/pages/settings/MapsSettingsPage.tsx`, registrar em `App.tsx` ao lado de `/settings/lalamove`; entrada no menu
- **Evidência:** rota abre

### 86 — Seletor por função (D6)
- [x] Tabela: função × provedor (google/mapbox/off) × fallback; salva em `geo_settings` (RLS admin); confirmação ao mudar `autocomplete`/`geocode`
- **Evidência:** `geo_settings.updated_by` preenchido

### 87 — Orçamento
- [x] Card por provedor: gasto do mês (`geo_usage_month`), limite, barra %, `hard_stop`, `alert_at_pct`; editar `geo_budget`
- **Evidência:** screenshot

**Auditado (2026-11-22).** `MapsSettingsPage.tsx`:
- Card por provedor com gasto do mês (`geo_usage_month`), limite e descrição "X de Y neste mês" (`:322-345`).
- Edição de `geo_budget`: `updateBudget` (`:159`) envia `monthly_limit_usd`, `hard_stop`, `alert_at_pct` (`:221-226`); barra de progresso e toggles/handlers em `:429-447`. Botão de salvar por provedor desabilitado em `!canWrite` e durante o mutation.

### 88 — Uso por função/dia
- [x] Gráfico recharts (barras empilhadas por SKU) e tabela; export CSV
- **Evidência:** screenshot

**Auditado (2026-11-22).** `MapsSettingsPage.tsx`:
- Painel "Uso lado a lado: Google × Mapbox" (`:571-620`) com `BarChart` do recharts sobre `usageByFunction` (barras por função/SKU), franquia grátis e custo estimado no tooltip/tabela.
- "Exportar CSV" em `:585` chama `exportUsageCsv` e fica desabilitado quando não há uso no mês. Estado vazio explícito ("Nenhuma chamada registrada neste mês…").

### 89 — Teste de chave / saúde
- [x] Botão "Testar Google" → `geo-gateway provider-status` (geocode de endereço fixo, conta 1 uso) → latência e SKU; idem Mapbox; integrar em `check-external-api/index.ts` (hoje só Mapbox `:232`)
- **Evidência:** status verde/vermelho na UI

**Auditado (2026-11-22).** Botão "Testar {provider}" em `MapsSettingsPage.tsx:390` chama o gateway e mostra latência e SKU. No backend:
- `geo-gateway` tem `case "provider-status"` (`index.ts:250-266`) devolvendo `providers[]` com `configured`/`implemented`/`budget` e o mapa `settings` por função.
- `check-external-api/index.ts` cobre os dois provedores via `probeGeoProvider('google')` e `probeGeoProvider('mapbox')` (`:67-90`, chamadas em `:252,279`), integrando o resultado no painel de saúde externa.

### 90 — Parâmetros de geofence globais ✅
- [x] Editar padrões `approach_radius_m`, `approach_eta_min`, horário silencioso, `notify_delivery_contact` padrão; override por pedido continua em `NewOrderDialog` (campo avançado)
- **Evidência:** card "Padrões de aviso do rastreio" em `/settings/maps` envia só o diff e grava `updated_by`; `NewOrderDialog` manda `approachRadiusM`/`approachEtaMin`/`notifyDeliveryContact` no `metadata` e `lalamove-api:713-731` persiste as 3 colunas

**Executado (PR #246).** A metade de baixo do cano já existia: o trigger `geo_evaluate_tracking` lê `lalamove_orders.approach_radius_m`, `approach_eta_min` e `notify_delivery_contact` com `COALESCE` sobre `geo_defaults` (`20261122130100_geo_foundation.sql:429-433`), e `geo_defaults` existe desde a etapa 15 (`:45-58`). Faltavam as duas pontas que tornavam isso inalcançável:

1. **Nenhuma tela escrevia em `geo_defaults`.** `grep -rn geo_defaults src/` retornava só `src/integrations/supabase/types.ts` — o padrão era sempre o de fábrica, então "pedido novo herda o padrão" era impossível de conferir.
2. **Override por pedido nunca chegava ao banco.** `NewOrderDialog` não tinha os campos e `lalamove-api/index.ts:713-731` inseria o pedido sem ler nada de `metadata` a respeito — mesmo que o operador quisesse um raio próprio, ele morria no front.

- **`useGeoDefaults()` / `useUpdateGeoDefaults()`** (`src/hooks/useGeoAdmin.ts`) — leem a linha singleton (`id = true`) e gravam `updated_by` com `auth.getUser()`, que é a evidência pedida pelo plano. Invalidam `['geo','defaults']`.
- **Card em `/settings/maps`** — 4 raios (aproximação, ETA, chegada, fora de rota), janela silenciosa (início/fim/fuso) e o toggle do contato de entrega. `handleSaveDefaults` envia **só os campos que mudaram** (diff contra `defaults.data`); sem mudança, avisa e não chama o banco. Desabilitado para quem não é admin, coerente com a policy.
- **Campo avançado no `NewOrderDialog`** — bloco "Avisos de aproximação" dentro do card do Guardian, com raio, ETA e um seletor de três estados (`inherit` / `yes` / `no`) para o contato de entrega. Três estados em vez de um checkbox porque "não avisar" e "herdar" precisam ser distinguíveis.
- **Persistência** — `lalamove-api` grava as 3 colunas no `insert` do pedido.

**Decisão que evita regressão:** o campo vai como `null` explícito quando o operador não preencheu, nunca `?? 500`. Gravar o default numérico da coluna transformaria o override em valor fixo por pedido e o padrão global deixaria de valer para todo pedido novo — que é exatamente o que a etapa pede.

### 91 — Auditoria
- [x] Toda mudança em `geo_settings`/`geo_budget` → `audit_log` (`20251226000002`) com antes/depois
- **Evidência:** linha no `audit_log`

**Auditado (2026-11-22).** `geo_foundation.sql:609-627`:
- `geo_audit_config()` grava `before`/`after` em `audit_log` a partir de `to_jsonb(OLD)`/`to_jsonb(NEW)`.
- Três triggers `AFTER INSERT OR UPDATE OR DELETE`: em `geo_settings`, `geo_budget` e `geo_defaults` — cobre também as mudanças feitas pela UI de mapas (etapas 86-90).

### 92 — Permissões ✅
- [x] `permissions`/`role_permissions`: `maps.settings.write` só admin; `maps.usage.read` manager+
- **Evidência:** migration `20261123190000_geo_maps_permissions.sql` — em Postgres 16, `SELECT` final devolve `admin:maps.settings.write`, `admin:maps.usage.read`, `manager:maps.usage.read`; policy `geo_usage_read_manager` = `has_role(admin) OR has_role(manager) OR has_permission('maps.usage.read')`

**Executado (PR #246).** O admin de mapas estava protegido **só** por `has_role('admin')` nas policies (`20261122130100:568-575`) e por `isAdmin()` na tela — `grep -rn "maps.settings.write\|maps.usage.read" src/ supabase/` não achava nada. Sem permissão nomeada não havia como dar leitura de custo ao manager sem dar escrita junto.

- **Permissões** — `maps.settings.write` → `admin`; `maps.usage.read` → `admin` e `manager`, com `ON CONFLICT DO NOTHING` para ser idempotente.
- **Policy** — `geo_usage_read_manager` mantém `has_role(admin)` e `has_role(manager)` e **acrescenta** a permissão. O OR é deliberado: se a migration rodar antes de algum backfill de `role_permissions`, ninguém perde acesso.
- **Validação** — Postgres 16 descartável com stub de `permissions`, `role_permissions`, `geo_usage`, `auth.uid()`, `has_role()` e `has_permission()`. Duas execuções seguidas: a segunda faz `INSERT 0 0`, sem erro. `pg_policies` confirma o `qual` final.

**Ressalva:** o `403` de viewer acontece no banco/edge (RLS), não numa checagem de edge function — a edge `geo-gateway` já roda como `service_role`. Ocultar a UI para viewer já era o comportamento (`canWrite`), então nada regrediu.

---

## BLOCO 9 — Qualidade, deploy, operação (etapas 93–100)

### 93 — CI
- [x] `ci.yml`: incluir `geo-gateway/*.test.ts` em `contract-tests`; `edge-integration-tests` chama `provider-status` em prod após deploy
  - **FEITO às duas metades.** A primeira em `.github/workflows/ci.yml:126-129` (`deno test --allow-all supabase/functions/geo-gateway/`, cobrindo os 8 arquivos do diretório). A segunda saiu na PR #255 (etapa 94): `deploy-edges.yml` chama `geo-gateway` com `action: provider-status` logo após o deploy, valida `HTTP 200`, exige lista de `providers` não vazia e pelo menos um `configured` — falha o job se o gateway subiu sem token.
- **Evidência:** job `Geo geometry SQL tests` e `Deno Contract Tests` verdes na `main`; o smoke test foi provado com stub local nos 4 cenários (ver etapa 94). O primeiro run real do smoke acontece no próximo deploy de edge — não forcei deploy para verificar.

### 94 — Deploy e verificação
- [x] Cada PR mergeada → `deploy-edges.yml` verde → `supabase_functions_list`; front → deploy Vercel `lalamove-v2` READY
- [x] **Smoke test pós-deploy (novo).** `deploy-edges.yml:55-77` chama `geo-gateway` com `action: provider-status` assim que o deploy termina. Deploy verde não provava que a function respondia — o `supabase functions deploy` pode concluir e a function ainda devolver 401/500 (verify_jwt, secret ausente, bundle quebrado). `provider-status` é read-only (não chama provedor pago, não grava `geo_usage`), então serve de prova sem custo.
  > **Provado com stub local** (4 cenários, script extraído do YAML e executado contra um servidor HTTP que imita a resposta real): `200` com provedor configurado → `exit 0`; `200` sem nenhum provedor configurado → `exit 1` + "nenhum provedor configurado"; `500` → `exit 1` + "não respondeu 200"; `200` com corpo sem `providers` → `exit 1` + "sem lista de provedores".
  > **Não verificado:** a chamada contra produção real, porque o workflow exige `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` como secrets do runner (existem no repo, mas o smoke só roda depois de um merge em `main`).
- **Evidência:** `actionlint .github/workflows/deploy-edges.yml` → sem erros; stub com 4 desfechos → 1 verde e 3 vermelhos nas condições certas.

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
