# Google Maps na Lalamove V2

Documentação operacional da conta Google Cloud própria da Promo Brindes (etapas 1-10 do
`docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md`). Este arquivo é o lugar onde ficam os
identificadores (project_id, nomes de chave, Map ID) — **nunca os valores das chaves**.

> **Por que conta própria:** até 2026-11-12 o front usava o conector gerenciado do Lovable
> (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*`). Esse conector cobra no billing do Lovable, não
> tem quota controlável por nós e não permite Map ID. A conta própria move o billing para a
> Promo Brindes (D12) e habilita `AdvancedMarkerElement`.

## 1. Projeto e billing

| Item | Valor |
|---|---|
| Projeto GCP | `promo-brindes-lalamove` (`project_id` a confirmar no console após a criação) |
| Dono do billing | Joaquim (Promo Brindes) |
| Alerta de orçamento | US$ 50 (80% do teto operacional) e US$ 100 (freio) no Cloud Billing |
| Teto operacional interno | US$ 50/mês em `geo_budget` (D11), aplicado pelo `geo-gateway` |

O teto do `geo_budget` é **independente** do alerta do Cloud Billing: o primeiro bloqueia
chamadas no gateway antes da fatura chegar; o segundo é a rede de segurança se algo escapar
do gateway (por exemplo, chamada feita fora do `geo-gateway`).

## 2. APIs habilitadas

| API | Uso | Habilitada |
|---|---|---|
| Maps JavaScript API | mapa vetorial no front | sim (etapa 2) |
| Places API (New) | autocomplete de endereço | sim (etapa 2) |
| Geocoding API | geocode/reverse no `geo-gateway` | sim (etapa 2) |
| Routes API | rota, ETA, matrix | sim (etapa 2) |
| Maps Static API | miniatura de rota na mensagem | sim (etapa 2) |
| Roads API | snap-to-road | **não** — `geo_settings.snap = 'off'` (D6) |
| Address Validation API | validação de endereço (Pro, US$ 17/1k) | **não** — D7 |

Habilitar Roads ou Address Validation só junto com a mudança de `geo_settings` correspondente,
senão o gateway passa a cobrar uma API que ninguém configurou.

## 3. Chaves

Duas chaves, com escopos diferentes. **Nunca a mesma chave nos dois lugares.**

### `maps-browser-key` (front, pública)

- Variável: `VITE_GOOGLE_MAPS_BROWSER_KEY` no Vercel (Production, Preview, Development).
- Restrição de aplicação: **HTTP referrer** — `https://lalamove-v2*.vercel.app/*`, o domínio de
  produção e `http://localhost:*`.
- Restrição de API: **só** Maps JavaScript API.
- Pode aparecer no bundle: é pública por natureza. A restrição de referrer é o que a protege.

### `maps-server-key` (edges, secreta)

- Secret: `GOOGLE_MAPS_SERVER_KEY` nas Edge Function Secrets do Supabase (`iecgydonctmabiijadsf`).
- Restrição de API: Places (New), Geocoding, Routes, Maps Static.
- Sem restrição de IP: as edges do Supabase não têm IP de saída fixo. A compensação é quota cap
  por API (item 4) + `verify_jwt` na função + o teto de `geo_budget`.
- Conferir presença sem revelar valor: `supabase secrets list` mostra só o nome.

### Map ID

- `lalamove-v2-web` — vetorial, JS, tema escuro (compatível com o `mapbox-dark`).
- Variável: `VITE_GOOGLE_MAPS_MAP_ID`.
- **Só é lido quando a chave própria está presente** (`getGoogleMapsMapId()` em
  `src/components/map/hooks/useGoogleMapsLoader.ts` devolve `undefined` no modo conector). O
  conector gerenciado proíbe `mapId`, e passar um Map ID nele quebra o mapa.

## 4. Quotas (teto diário por API)

| API | Teto/dia | Conta (30 dias) |
|---|---|---|
| Routes `computeRoutes` | 2.000 | 60.000 |
| Routes `computeRouteMatrix` (elementos) | 5.000 | 150.000 |
| Geocoding | 1.000 | 30.000 |
| Autocomplete | 3.000 | 90.000 |
| Static Maps | 500 | 15.000 |
| Map loads | 1.000 | 30.000 |

30 dias × teto fica abaixo de US$ 50 com os preços de `geo_price_list`. Se um teto for elevado,
recalcular aqui e em `geo_budget.monthly_limit_usd` **antes** de subir.

## 5. SKUs e custo

A tabela de preços é a `public.geo_price_list` (seed em
`supabase/migrations/20261122130100_geo_foundation.sql:74-97`). Custo real sai de
`geo_usage.est_cost_usd`, com a cota grátis mensal por SKU já descontada em
`geo_usage_increment`.

| Provedor | SKU | Grátis/mês | US$/1.000 |
|---|---|---|---|
| google | `dynamic_maps` | 10.000 | 7,00 |
| google | `static_maps` | 10.000 | 2,00 |
| google | `places_autocomplete_request` | 10.000 | 2,83 |
| google | `geocoding` | 10.000 | 5,00 |
| google | `routes_compute_routes` | 10.000 | 5,00 |
| google | `routes_compute_routes_pro` | 5.000 | 10,00 |
| google | `routes_matrix` | 10.000 | 5,00 |
| google | `address_validation` | 5.000 | 17,00 |

Leitura do mês corrente: view `geo_usage_month`
(`supabase/migrations/20261122130100_geo_foundation.sql:158-163`). Status de orçamento por
provedor: RPC `geo_budget_status()`.

## 6. Conferência mensal: gateway × fatura

O `est_cost_usd` do `geo_usage` é uma **estimativa** — ele usa a primeira faixa de preço e não
sabe de descontos ou de chamadas feitas fora do gateway. Divergência esperada: até 5%.

Mensalmente:

1. Abrir o Cloud Billing do projeto e anotar o total do mês fechado.
2. Rodar: `SELECT provider, sum(est_cost_usd) FROM geo_usage_month GROUP BY provider;`
3. Comparar. **Acima de 5% de diferença para baixo** significa chamada fora do gateway (chave
   vazando no front ou script manual) — investigar antes de qualquer outra coisa.
4. Diferença **para cima** (estimativa maior que a fatura) é normal: cota grátis e faixas de
   desconto não modeladas.

## 7. Rotação de chave

Vazou uma chave? A chave é pública se for a de navegador e secreta se for a de servidor — o
procedimento muda.

**`maps-server-key` vazada** (a grave):

1. No console, criar `maps-server-key-v2` com as mesmas restrições de API.
2. Atualizar o secret: `supabase secrets set GOOGLE_MAPS_SERVER_KEY=<novo>`.
3. Testar o gateway: `geo-gateway` com `action: "provider-status"` deve mostrar
   `configured: true` para `google`.
4. Só então desabilitar a chave antiga no console.
5. Registrar a data no `docs/RUNBOOK_GOOGLE_MAPS.md` §1.

**`maps-browser-key` vazada** (menos grave, mas o atacante consegue gastar a quota):

1. Criar a nova chave com a mesma restrição de referrer.
2. Atualizar `VITE_GOOGLE_MAPS_BROWSER_KEY` no Vercel (os três ambientes) e redeploy.
3. Desabilitar a antiga depois que o deploy estiver no ar.
4. Conferir quota cap: um ataque de referrer spoof ainda é barrado pelo teto diário.

**Map ID vazado:** não é segredo, é só um estilo. Se alguém estiver usando, criar um novo e
trocar `VITE_GOOGLE_MAPS_MAP_ID`.

## 8. Por que a chave própria é opcional, não obrigatória

`src/components/map/hooks/useGoogleMapsLoader.ts` usa `OWN_KEY || CONNECTOR_KEY`. Sem
`VITE_GOOGLE_MAPS_BROWSER_KEY`, o mapa continua funcionando pelo conector Lovable em `v=beta`
com `maps3d` — o que mantém a produção viva enquanto o projeto Google Cloud não estiver
configurado. Com a chave própria, o loader migra para `v=weekly` com
`libraries=maps,marker,routes` e habilita `AdvancedMarkerElement`.

O que **só funciona** com a chave própria:

- `AdvancedMarkerElement` (marcador de motorista com `content` HTML). Sem Map ID o Google lança
  erro, então o canvas cai no `google.maps.Marker` legado com SVG inline.
- `v=weekly` (o conector exige `beta`).

O que funciona nos dois modos: mapa, polylines de rota, `InfoWindow`, `fitBounds`.
