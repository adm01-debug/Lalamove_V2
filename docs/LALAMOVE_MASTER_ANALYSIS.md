# 🔬 Lalamove — Análise Mestra e Roteiro de Evolução

**Versão:** 1.0 · **Gerado em:** 26/07/2026
**Fontes consolidadas:**
- `lalamove_api_docs_v3.md` — REST API v3 BR auditada em produção (03/03/2026)
- `lalamove_documentacao_completa.md` — Auditoria mestra v3 + UAPI interna (08/03/2026)
- `LALAMOVE_UNIFIED_PROXY_INTEGRATION.md` — Contrato do proxy unificado
- Código-fonte do Intelligence Hub (`src/`, `supabase/functions/`)

> Este documento é a **fonte única de verdade** para qualquer trabalho de integração Lalamove neste
> repositório. Toda divergência entre a documentação oficial da Lalamove e este arquivo deve ser
> resolvida **a favor deste arquivo**, pois aqui estão registradas correções validadas em produção.

---

## Índice

1. [Mapa do ecossistema](#1-mapa-do-ecossistema)
2. [Autenticação e segurança](#2-autenticação-e-segurança)
3. [Errata de produção (obrigatória)](#3-errata-de-produção-obrigatória)
4. [Catálogo de serviços e special requests](#4-catálogo-de-serviços-e-special-requests)
5. [Fluxo de status e ciclo de vida do pedido](#5-fluxo-de-status-e-ciclo-de-vida-do-pedido)
6. [Enums completos](#6-enums-completos)
7. [Códigos de erro](#7-códigos-de-erro)
8. [Rate limits](#8-rate-limits)
9. [Matriz de cobertura — documentado × implementado × gap](#9-matriz-de-cobertura)
10. [Roteiro de 30 etapas](#10-roteiro-de-30-etapas)
11. [Riscos conhecidos](#11-riscos-conhecidos)

---

## 1. Mapa do ecossistema

A Lalamove opera **duas APIs paralelas e independentes**. O Intelligence Hub consome ambas.

| Camada | Host | Autenticação | Expiração | Uso no Hub |
|--------|------|--------------|-----------|-----------|
| **REST API v3** | `rest.lalamove.com` | HMAC-SHA256 (`Authorization: hmac key:ts:sig`) | Permanente | Cotação, pedidos, motorista, cidades, webhook |
| **UAPI interna** | `br-uapi.lalamove.com` | Session token em query param | **~24 h** | Carteira, perfil, histórico, cupons, frota, extratos |
| **br-umeta** | `br-umeta.lalamove.com` | — | — | Configuração da região BR (não consumido) |
| **region-configuration** | `region-configuration.lalamove.com` | — | — | Configuração global (não consumido) |
| **br-sign-api (Argus/WAF)** | `br-sign-api.lalamove.com` | SDK anti-bot | — | Bloqueia UAPI sem assinatura → contornado via Playwright no token manager |
| **Firebase RTDB** | `lalamoveglobal.firebaseio.com` | — | — | Tempo real / chat MQTT5 (não consumido) |
| **br-oimg** | `br-oimg.lalamove.com` | Público | — | Avatares e ícones de veículo (não consumido) |

### Região Brasil

```
countryId / hcountry : 20000
datacenter           : SAO
city_id_sao_paulo    : 21001
moeda                : BRL (valores monetários em centavos — "fen" na UAPI)
```

### Topologia atual no Intelligence Hub

```
React (src/lib/lalamove-api.ts, src/lib/uapi-proxy.ts)
        │            │
        │            └────────► lalamove-uapi-proxy   (projeto Supabase EXTERNO, chave em bundle) ⚠️
        └─────────────────────► lalamove-unified      (projeto Supabase EXTERNO, chave em bundle) ⚠️
                                        │
Edge Functions do Hub                   ├─► rest.lalamove.com  (v3, HMAC)
  ├─ lalamove-api      (v3 HMAC direto) └─► br-uapi.lalamove.com (UAPI, token)
  ├─ lalamove-uapi     (UAPI)
  ├─ lalamove-webhook  (HMAC + anti-replay + idempotência)
  └─ rotate-tokens
```

⚠️ **Duplicidade estrutural:** o frontend fala com um proxy externo usando chaves fixas no bundle
(`promo-llm-unified-2026`, `promo-lalamove-2026`), enquanto o backend do próprio Hub já tem
Edge Functions equivalentes. Ver etapa 19.

---

## 2. Autenticação e segurança

### v3 — HMAC-SHA256

```
rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`
signature    = HMAC_SHA256(rawSignature, API_SECRET) → hex
Authorization: hmac ${API_KEY}:${timestamp}:${signature}
Market: BR   (ou X-LLM-COUNTRY: BR)
```

- Credenciais **permanentes**, sem refresh.
- Auth inválida **não** retorna `401` — o gateway devolve **`502` sem corpo `errors[]`**.

### UAPI — session token

- Token em query param, TTL ~24 h.
- `refresh_token` é de **uso único** e só funciona **enquanto o token atual ainda é válido**
  (por isso a renovação é agendada em 20 h, não em 24 h).
- Se a janela for perdida → re-login via Playwright (30-60 s) para contornar o WAF Argus.
- Senha trafega com **RSA-OAEP**; há anti-CSRF via `record_id`.

### Webhook

- `PATCH /v3/webhook` registra a URL. **`GET /v3/webhook` retorna `405`** — não dá para consultar
  a URL configurada; é preciso manter registro próprio.
- No Hub, o handler já aplica HMAC *timing-safe*, janela anti-replay de ±5 min e idempotência por
  hash SHA-256, persistindo `SIGNATURE_INVALID`, `REPLAY_REJECTED` e `DUPLICATE_IGNORED`.

---

## 3. Errata de produção (obrigatória)

Três divergências entre a documentação oficial da Lalamove e o comportamento real da API BR.
**Violá-las quebra o sistema em produção.**

| # | Regra | Correto | Errado |
|---|-------|---------|--------|
| 1 | Campo de serviços da cidade | `city.services` | `city.serviceTypes` → `KeyError` / `undefined` |
| 2 | Motorista atribuído | `order.driverId !== ""` | `order.driverId === null` → **nunca** verdadeiro |
| 3 | Motivo de cancelamento | Não existe na BR | `cancelParty`, `cancelledReason` → sempre `undefined` |

Detalhes:

- **`driverId` é sempre `string`.** Sem motorista → `""`. Com motorista → `"967219"`. Após
  cancelamento → volta a `""`. Nunca `null`, nunca `undefined`.
- Chamar `GET /v3/orders/{id}/drivers/` com `driverId === ""` retorna **`404 ERR_DRIVER_NOT_FOUND`**.
- `GET /v3/cities` retorna objetos com **exatamente 3 chaves**: `locode`, `name`, `services`.

> **Guarda de regressão:** a etapa 26 do roteiro adiciona testes que falham se `serviceTypes`,
> `cancelParty` ou `cancelledReason` reaparecerem no código.

---

## 4. Catálogo de serviços e special requests

### 16 cidades cobertas

`BR AJU` Aracaju · `BR BEL` Belém · `BR BHZ` Belo Horizonte · `BR BSB` Brasília ·
`BR CWB` Curitiba · `BR FLN` Florianópolis · `BR FOR` Fortaleza · `BR GYN` Goiânia ·
`BR MAO` Manaus · `BR POA` Porto Alegre · `BR RAO` Ribeirão Preto · `BR REC` Recife ·
`BR RIO` Rio de Janeiro · `BR SAO` São Paulo & Campinas · `BR SLZ` São Luís · `BR SSA` Salvador

### 14 serviceTypes

| serviceType | Carga máx. | Dimensões (C×L×A) | Aceita `item`? | Disponibilidade |
|-------------|-----------|-------------------|----------------|-----------------|
| `LALAGO` | 20 kg | 0,3×0,4×0,3 m | Não | Todas |
| `LALAPRO` | 20 kg | 0,4×0,4×0,3 m | Não | Apenas SAO e RIO |
| `LALAGOFOUR` | 20 kg | 0,3×0,4×0,3 m | Não | BHZ, CWB, RIO, SAO |
| `CAR` | 300 kg | 1,2×0,8×0,6 m | Não | Todas |
| `CARFOURH` | 300 kg | 1,2×0,8×0,6 m | Não | Apenas SAO |
| `HATCHBACK` | 200 kg | 1×0,7×0,6 m | Não | Todas |
| `HATCHFOURH` | 200 kg | 1×0,7×0,6 m | Não | Apenas SAO |
| `UV_FIORINO` | 500 kg | 1,8×1,3×1,1 m | ✅ | BHZ, CWB, FOR, POA, RIO, SAO, GYN, FLN, RAO, SSA |
| `UV_4H` | 500 kg | 1,8×1,3×1,1 m | Não | idem UV_FIORINO |
| `VAN` | 1000 kg | 2,7×1,8×1,6 m | ✅ | BHZ, BSB, CWB, POA, RIO, SAO |
| `VANFOURH` | 1000 kg | 2,7×1,8×1,6 m | Não | BHZ, RIO, SAO |
| `TRUCK330` | 1500 kg | 3×1,8×2 m (SAO) / 2×2×2,5 m (RIO) | ✅ | BHZ, BSB, CWB, FOR, POA, RIO, SAO |
| `TRUCK3_5T` | 2500 kg | 4×2,2×2,2 m | Não | Apenas SAO |
| `TRUCK_6H` | 1500 kg | 3×1,8×2 m (SAO) / 2×2×2,5 m (RIO) | Não | BHZ, RIO, SAO |

> ⚠️ `TRUCK330` e `TRUCK_6H` têm **dimensões diferentes por cidade**.

### 28 specialRequests (resumo por família)

| Família | Códigos | Veículos |
|---------|---------|----------|
| Térmico | `THERMAL_BAG_1` | LALAGO, LALAPRO |
| Retorno | `RETURN` | CAR, HATCHBACK, LALAGO, LALAPRO |
| Espera | `WAITING_TIME_030MIN`, `WAITING_TIME_060MIN`, `WAITING_TIME_1` | CAR, HATCHBACK, LALAGO, LALAPRO, TRUCK330, UV_FIORINO, VAN |
| Ajuda motorista | `LOADING_1DRIVER_MAX030MIN` … `MAX180MIN` | CAR, HATCHBACK, TRUCK330, TRUCK3_5T, UV_FIORINO, VAN |
| Motorista + ajudante | `LOADING_1DRIVER1HELPER_MAX060MIN`, `_MAX120MIN`, `_MAX180MIN`, `LOADING_1DRIVER1HELPER` | TRUCK330, TRUCK3_5T, VAN, TRUCK_6H |
| Mudança | `HOUSE_MOVING_MAX120MIN`, `_MAX180MIN`, `_MAX240MIN` | TRUCK330 |
| Temperatura | `REFRIGERATED_VEHICLE`, `INSULATED_VEHICLE`, `FROZEN_VEHICLE` | UV_FIORINO — **apenas SAO** |
| Locação horária | `HOURLY_RENTAL_1..4` | CARFOURH, HATCHFOURH, VANFOURH |
| Tempo extra | `RENTAL_TIME_1HR..4HR` | LALAGOFOUR, TRUCK_6H, UV_4H, VANFOURH, CARFOURH, HATCHFOURH |

> A lista válida **depende do serviceType**. Enviar um SR incompatível → `422 ERR_INVALID_FIELD`
> em `/data/specialRequests/0`.

### `deliveryItemSpecification` (campo `item`)

Processado **apenas** por `TRUCK330`, `UV_FIORINO` e `VAN`. Os demais aceitam e **ignoram em silêncio**.

| serviceType | valores de `weight` |
|-------------|--------------------|
| `TRUCK330` | `LESS_THAN_300_KG`, `300_KG_TO_750_KG`, `750_KG_TO_1500_KG` |
| `UV_FIORINO` | `LESS_THAN_100_KG`, `100_KG_TO_250_KG`, `250_KG_TO_500_KG` |
| `VAN` | `LESS_THAN_200_KG`, `200_KG_TO_500_KG`, `500_KG_TO_1000_KG` |

`categories`: `FOOD_PRODUCTS_OR_GROCERY`, `CONSTRUCTION_MATERIALS_OR_PARTS`,
`RETAIL_AND_WHOLESALE_`, `FURNITURE_OR_HOME_APPLIANCES`, `FRAGILE_ITEMS`

`handlingInstructions`: `FRAGILE_OR_HANDLE_WITH_CARE`, `DO_NOT_STACK`, `KEEP_UPRIGHT`,
`KEEP_DRY`, `NO_BENDING`

### Preços de referência (SP, ~4,5 km, 03/03/2026)

| serviceType | Base | Special request | Total |
|-------------|------|-----------------|-------|
| HATCHBACK | R$ 16,97 | — | R$ 16,97 |
| LALAPRO | R$ 22,32 | — | R$ 22,32 |
| VAN | R$ 75,53 | — | R$ 75,53 |
| UV_FIORINO | R$ 39,41 | `REFRIGERATED_VEHICLE` (+R$ 85,00) | R$ 124,41 |
| TRUCK330 | R$ 110,00 | `LOADING_1DRIVER1HELPER_MAX060MIN` (+R$ 90,00) | R$ 200,00 |
| LALAPRO (3 paradas) | R$ 25,02 | `multiStopSurcharge` (+R$ 3,00) | R$ 28,02 |

---

## 5. Fluxo de status e ciclo de vida do pedido

```
ASSIGNING_DRIVER ──► ON_GOING ──► PICKED_UP ──► DELIVERING ──► COMPLETED
       │                                                            │
       ├──► REJECTED   (nenhum motorista disponível)                └──► CANCELED
       ├──► EXPIRED    (expirou sem atribuição)
       └──► CANCELED   (cancelado pelo cliente)
```

### Operações e restrições

| Operação | Endpoint | Restrição confirmada |
|----------|----------|---------------------|
| Cotar | `POST /v3/quotations` | `quotationId` expira em **5 min** |
| Consultar cotação | `GET /v3/quotations/{id}` | — |
| Criar | `POST /v3/orders` | Exige `quotationId` válido |
| Consultar | `GET /v3/orders/{id}` | — |
| Editar | `PATCH /v3/orders/{id}` | **Impossível** em `ASSIGNING_DRIVER` → `422 ERR_ORDER_EDIT` |
| Cancelar | `DELETE /v3/orders/{id}` | Sucesso = `204` sem corpo; recancelar → `422 ERR_CANCELLATION` |
| Priority fee | `POST /v3/orders/{id}/priority-fee` | Só pode **aumentar** → reduzir gera `422 ERR_INVALID_TIPS` |
| Motorista | `GET /v3/orders/{id}/drivers/{driverId}` | Só quando `driverId !== ""` |
| Webhook | `PATCH /v3/webhook` | `GET` retorna `405` |

Eventos de webhook: `ASSIGNING_DRIVER`, `ON_GOING`, `PICKED_UP`, `DELIVERING`, `COMPLETED`,
`CANCELED`, `REJECTED`, `EXPIRED`.

---

## 6. Enums completos

> Extraídos do bundle JS da UAPI. Valores **numéricos** — a UAPI não usa strings.

<details open>
<summary><strong>Order Status (<code>Im0</code>/<code>Pt</code>)</strong></summary>

| Nome | Valor |
|------|-------|
| MATCHING | 0 |
| ONGOING | 1 |
| COMPLETED | 2 |
| CANCELLED | 3 |
| DRIVER_REJECTED | 4 |
| ORDER_TIMEOUT | 5 |
| ORDER_NOPAY | 6 |
| ORDER_LOADED | 7 |
| LOADING | 15 |
| UNLOADING | 16 |
</details>

| Enum | Valores |
|------|---------|
| **Payment Types (`xn`)** | CASH 0 · ENTERPRISE_WALLET 3 · WALLET 4 · ONLINE 31 · POSTPAID_ENTERPRISE_WALLET 32 |
| **Payment Channels (`j8`)** | BusinessWallet 301 · PersonalWallet 302 · BusinessPostpaidWallet 2501 |
| **Quote Types (`nr`)** | REGULAR 100 · SAVER 101 · PRICE_NEGOTIATION 102 · PRIORITY 103 |
| **Order Plan (`hf`)** | DEFAULT 1 · REGULAR 2 · SAVER 3 · PRICE_NEGOTIATION 4 · PRIORITY 5 |
| **Pay Status (`OJ0`)** | NO_PAY 0 · PAY_SUCCESS 1 · PAY_FAILURE 2 · REFUNDING 3 · REFUNDED 4 · PAY_WAIT 5 |
| **Postpaid Wallet (`f9e`)** | CREATED 0 · DISABLED 5 · ENABLED 10 · REMOVED 15 · NO_POSTPAID_WALLET 13001 |
| **Profile Types (`ct`)** | BUSINESS 1 · PERSONAL 2 · Staff: NONBUSINESS 0, ADMIN 1, STAFF 2, MANAGER 3 |
| **Fleet Types (`EAe`)** | favorited 1 · blocked 2 |
| **Order Types (`Xs`)** | STANDARD 1 · BUNDLED 101 |
| **Addr Op Mode (`Ip`)** | NO_EDIT 0 · UPDATE_DELIVERY_INFO 1 · ADD_POINT 2 · REORDER_POINT 3 · REMOVE_CASH_PAYEE_POINT 4 |
| **Terminal (`Up`)** | APP 1 · PC/S4W 2 · L4W 3 |
| **Priority Level (`YR`)** | LOWEST 1 · LOWER 4 · DEFAULT 5 · HIGHER 6 · HIGHEST 9 |
| **Vehicle Wheel** | TWO_WHEELS 2 · FOUR_WHEELS 4 |
| **SR Price Type** | FIXED_PRICE 1 · PERCENTAGE 2 · DRIVER_NEGOTIABLE 3 · FREE 4 |
| **POD Status (`ole[]`)** | índice → `["PENDING","SIGNED","DELIVERED","FAILED","NOT_APPLICABLE"]` |
| **POD Feedback (`lJ0`)** | NO_FEEDBACK 0 · THUMB_UP 1 · THUMB_DOWN 2 |

---

## 7. Códigos de erro

### v3 — estrutura

```json
{ "errors": [ { "id": "ERR_INVALID_FIELD", "message": "…", "detail": "/data/campo" } ] }
```

`detail` (JSON pointer) existe **apenas** em `ERR_INVALID_FIELD`.

| HTTP | `errors[0].id` | Causa |
|------|---------------|-------|
| 422 | `ERR_INVALID_FIELD` | Campo inválido, ausente ou valor não aceito |
| 422 | `ERR_INVALID_QUOTATION_ID` | `quotationId` inexistente ou expirado (>5 min) |
| 422 | `ERR_ORDER_EDIT` | `PATCH` em pedido não editável |
| 422 | `ERR_CANCELLATION` | `DELETE` em pedido já cancelado |
| 422 | `ERR_INVALID_TIPS` | `priorityFee` ≤ valor atual |
| 404 | `ERR_ORDER_NOT_FOUND` | `orderId` inexistente |
| 404 | `ERR_DRIVER_NOT_FOUND` | `driverId` inválido (inclui `""`) |
| 502 | *(sem `errors[]`)* | **Auth HMAC inválida** — gateway devolve 502 genérico |

Mensagens reais de `ERR_INVALID_FIELD`:

| `detail` | mensagem |
|----------|----------|
| `/data/stops` | `minimum 2 items required, but found 1 items` |
| `/data/serviceType` | `value must be one of "CAR", "LALAPRO", …` |
| `/data/scheduleAt` | `… is not valid. Date cannot be a past date or more than 30 days in advance.` |
| `/data/specialRequests/0` | `value must be one of "WAITING_TIME_030MIN", …` |

### UAPI — códigos numéricos (`ret`)

| Código | Significado |
|--------|-------------|
| 0 | Sucesso |
| 10002 | PARAMS_ERROR |
| 10004 | No matched route |
| 10007 | Permissão negada / não autenticado (**token expirado**) |
| 10008 | SERVER_ERROR |
| 10010 | Gateway signature error (**WAF Argus**) |
| 10012 | OPS_CONFIGURATION_ERROR |
| 10102 | ORDER_CANCELLATION_PERIOD_EXPIRED |
| 22018 | SELECTED_PRICE_OPTION_UNAVAILABLE |
| 40125 / 40126 | Survey WONT_SHOW / NEVER_SHOW |
| 40304 | Contract: erro de configuração |
| 42000 | order_tracking: link expirado |
| 42201 | RATE_LIMIT_EXCEEDED |
| 70004 | SYSTEM_ERROR_DOWNSTREAM |

**Postpaid wallet (`qp`):** 13001 NOT_CREATED · 27103 DISABLED · 27104 REMOVED · 27105 INSUFFICIENT
**Bulk order:** 10002 · 10008 · 10012 · 70004

---

## 8. Rate limits

Headers por endpoint (não globais):

```
ratelimits-limit-{endpoint}
ratelimits-remaining-{endpoint}
ratelimits-reset-{endpoint}     ← Unix timestamp
```

Confirmados: `getcities` = **300 req/janela**; `patchweb` presente no `PATCH /v3/webhook`.
UAPI sinaliza excesso com `ret = 42201`.

---

## 9. Matriz de cobertura

Legenda: ✅ implementado · 🟡 parcial · ❌ ausente

### REST API v3

| Recurso | Documentado | Hub | Onde | Gap |
|---------|-------------|-----|------|-----|
| HMAC-SHA256 | ✅ | ✅ | `supabase/functions/lalamove-api` | — |
| `GET /v3/cities` | ✅ | 🟡 | `useCities()` | Não valida serviço × cidade antes da cotação (etapa 7) |
| `POST /v3/quotations` | ✅ | ✅ | `NewOrderDialog` | Expiração de 5 min não revalidada (etapa 10) |
| `GET /v3/quotations/{id}` | ✅ | ❌ | — | Sem reconsulta de cotação (etapa 10) |
| `POST /v3/orders` | ✅ | ✅ | `lalamove-api` | — |
| `GET /v3/orders/{id}` | ✅ | ✅ | `useOrderGet` | — |
| `PATCH /v3/orders/{id}` | ✅ | ❌ | — | Sem edição de pedido (etapa 11) |
| `DELETE /v3/orders/{id}` | ✅ | 🟡 | `orderCancel` | Sem códigos de cancelamento BR (etapa 12) |
| `POST …/priority-fee` | ✅ | ✅ | `OrderDetailModal` | — |
| `GET …/drivers/{id}` | ✅ | 🟡 | `driverLocation` | Sem detalhe completo do motorista (etapa 16) |
| `PATCH /v3/webhook` | ✅ | 🟡 | `lalamove-webhook` | URL registrada não é auditável (`GET` = 405) |
| 14 serviceTypes | ✅ | 🟡 | `lalamoveValidation.ts` | Sem metadados de carga/dimensão/cidade (etapa 4) |
| 28 specialRequests | ✅ | 🟡 | `NewOrderDialog` | Lista não filtra por serviceType (etapa 8) |
| `deliveryItemSpecification` | ✅ | ❌ | — | Etapa 9 |
| Códigos `ERR_*` | ✅ | 🟡 | `src/lib/orderErrors.ts` | Só telefone/schedule/address (etapa 5) |
| Rate limit headers | ✅ | ❌ | — | Headers ignorados (etapa 14) |
| `x-request-id` | ✅ | ❌ | — | Sem rastreabilidade de suporte (etapa 13) |

### UAPI interna

| Recurso | Hub | Gap |
|---------|-----|-----|
| `get_user_info`, `wallet` | ✅ | — |
| `wallet_flow_list` | ✅ | — |
| `vehicles`, `service_areas` | ✅ | — |
| `order_list_new` (cursor) | 🟡 | Paginação por cursor incompleta (etapa 20) |
| Extratos / comprovantes | ❌ | Etapa 21 |
| Cupons | 🟡 | Sem UI nem erros `qp` (etapa 22) |
| Frota / times enterprise | 🟡 | Sem UI de atribuição (etapa 23) |
| Bulk order | ❌ | Fora de escopo imediato |
| E-commerce | ❌ | Fora de escopo imediato |
| Chat MQTT5 do motorista | ❌ | Fora de escopo imediato |
| Refresh automático de token | 🟡 | `rotate-tokens` existe; falta fallback documentado (etapa 24) |

### Segurança e observabilidade

| Item | Hub | Gap |
|------|-----|-----|
| Webhook HMAC timing-safe + anti-replay + idempotência | ✅ | — |
| Painel de segurança de webhooks + export CSV | ✅ | — |
| Chaves de proxy no bundle | ❌ | **`promo-llm-unified-2026` e `promo-lalamove-2026` expostas** (etapa 19) |
| Telemetria por endpoint Lalamove | 🟡 | `query_telemetry` não cobre chamadas Lalamove (etapa 27) |
| Alertas de falha de auth v3/UAPI | ❌ | Etapa 28 |

---

## 10. Roteiro de 30 etapas

Prioridade: **P0** crítico · **P1** alto · **P2** médio.
Risco: **A** alto (toca produção) · **M** médio · **B** baixo.

### Bloco A — Fundação e conformidade

| # | Etapa | P | R | Critério de aceite |
|---|-------|---|---|--------------------|
| 1 | Este documento mestre | P1 | B | `docs/LALAMOVE_MASTER_ANALYSIS.md` versionado e referenciado no README |
| 2 | Tipos canônicos em `src/types/lalamove.ts` | P1 | B | Zero `any`; `services`, `driverId: string`; typecheck limpo |
| 3 | Guardas de errata (`hasDriver(order)`) | P1 | B | Helper usado em todos os pontos que testam motorista |
| 4 | Catálogo tipado de 14 serviceTypes + 28 SRs | P1 | B | Metadados de carga, dimensão, cidade e compatibilidade |
| 5 | Mapa completo de `ERR_*` e `ret` UAPI | P1 | B | `parseOrderError` cobre todos os IDs da seção 7 |
| 6 | Enums centralizados | P2 | B | Um único módulo exporta todos os enums da seção 6 |

### Bloco B — Cotação e pedido

| # | Etapa | P | R | Critério de aceite |
|---|-------|---|---|--------------------|
| 7 | Validar cidade × serviço via `/v3/cities` cacheado | P1 | M | Serviço indisponível bloqueia cotação com mensagem clara |
| 8 | SRs dinâmicos por serviceType com impacto de preço | P1 | M | Lista muda ao trocar veículo; nenhum SR incompatível enviado |
| 9 | `deliveryItemSpecification` no fluxo | P2 | M | Campo enviado apenas para TRUCK330/UV_FIORINO/VAN |
| 10 | Expiração e revalidação de `quotationId` | P0 | M | Cotação >5 min é refeita automaticamente antes do pedido |
| 11 | `PATCH /v3/orders/{id}` | P2 | M | Edição bloqueada em `ASSIGNING_DRIVER` com aviso na UI |
| 12 | Códigos de cancelamento BR | P2 | B | Motivo registrado localmente (API BR não retorna) |

### Bloco C — Operação e rastreio

| # | Etapa | P | R | Critério de aceite |
|---|-------|---|---|--------------------|
| 13 | `x-request-id` ponta a ponta | P1 | B | ID gerado, enviado e persistido em toda chamada Lalamove |
| 14 | Token bucket respeitando `ratelimits-*` | P1 | M | Nenhum 429/42201 sob carga simulada |
| 15 | Retry/backoff por classe de erro | P1 | M | 4xx não retenta; 5xx com backoff exponencial + jitter |
| 16 | Detalhe completo do motorista | P2 | B | Modal exibe dados só quando `driverId !== ""` |
| 17 | Timeline alinhada ao fluxo oficial | P2 | B | 8 status da seção 5 representados |
| 18 | Painel de saúde v3 × UAPI | P1 | B | Alerta quando token UAPI passa de 20 h |

### Bloco D — UAPI

| # | Etapa | P | R | Critério de aceite |
|---|-------|---|---|--------------------|
| 19 | **Cliente único sem chave no bundle** | **P0** | **A** | Nenhuma chave literal em `src/`; tráfego via Edge Function do Hub |
| 20 | Cursor em `order_list_new` | P1 | M | Histórico completo paginado sem duplicatas |
| 21 | Extratos e comprovantes | P2 | M | Download disponível na área financeira |
| 22 | Cupons + postpaid com erros `qp` | P2 | M | 13001/27103/27104/27105 traduzidos em PT-BR |
| 23 | Frota e times enterprise | P2 | M | Favoritos e bloqueados visíveis por pedido |
| 24 | Auto-refresh de token com fallback | P0 | M | Renovação em 20 h; runbook para janela perdida |

### Bloco E — Qualidade e observabilidade

| # | Etapa | P | R | Critério de aceite |
|---|-------|---|---|--------------------|
| 25 | Suíte de contrato com fixtures reais | P1 | B | Parsers validados contra payloads da doc |
| 26 | Testes de regressão da errata | P0 | B | Build falha se `serviceTypes`/`cancelParty` reaparecerem |
| 27 | Telemetria por endpoint Lalamove | P1 | M | Latência, erro e custo em `query_telemetry` |
| 28 | Alertas de auth e picos de `ERR_*` | P1 | M | Alerta `CRITICAL` em 502 de auth v3 e `ret=10007` |
| 29 | Runbook (token expirado, WAF Argus) | P2 | B | `docs/RUNBOOK_LALAMOVE.md` publicado |
| 30 | Scorecard 22 dimensões + memórias | P2 | B | Scorecard no repo; `@security-memory` atualizada |

---

## 11. Riscos conhecidos

1. **Chaves de proxy no bundle** (`promo-llm-unified-2026`, `promo-lalamove-2026`) — qualquer visitante
   do app publicado pode ler e chamar o proxy Lalamove diretamente. **Risco mais grave do inventário.**
2. **Token UAPI de 24 h com refresh de uso único** — perder a janela de renovação exige Playwright e
   re-login manual; um cron parado por 24 h derruba carteira, histórico e cupons.
3. **WAF Argus** pode passar a bloquear o caminho atual sem aviso (`ret=10010`).
4. **Auth v3 inválida retorna 502**, não 401 — monitoramento ingênuo classifica como indisponibilidade
   da Lalamove em vez de credencial errada.
5. **`GET /v3/webhook` = 405** — a URL de webhook registrada não é auditável pela API; a fonte de
   verdade precisa ser mantida no nosso lado.

---

*Documento mantido pelo time de engenharia do Intelligence Hub · Próxima revisão ao concluir o Bloco C.*
