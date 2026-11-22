# Lalamove V2 — Análise Exaustiva e Plano de Integração Completo

Nov 21, 2026 · @Joaquim

> Commitado no repo a partir do artefato claude.ai `UwpRyTnTXcLPs5wnsHdXW6` (conteúdo idêntico, sem edição). Ver também `docs/PLANO_ESTADO_LALAMOVE_V2_2026-11-21.md` (continuidade de sessão) e `docs/LALAMOVE_MASTER_ANALYSIS.md` (referência de endpoints/enums da API, documento distinto).

## 1. Veredito executivo

A integração Lalamove do `Lalamove_V2` **nunca operou em produção**: o banco oficial tem 0 pedidos reais, 0 webhooks recebidos, 0 sessão UAPI e 3 chamadas à API v3 em toda a história (31/08/2026). O app, as edge functions e o n8n estão desconectados entre si e da Lalamove.

**O que existe e serve de base (reaproveitável):**

- Cliente HMAC v3 correto em `supabase/functions/lalamove-api/index.ts` (assinatura, retry/backoff, Request-ID estável, leitura de `ratelimits-*`).
- Modelo de dados completo: `lalamove_orders` (49 colunas), `lalamove_stops`, `lalamove_stop_proofs`, `lalamove_status_history`, `lalamove_priority_fee_history`, `lalamove_order_replacements`, `lalamove_rate_limits`, `lalamove_uapi_sessions`, `webhook_events` — todas com RLS.
- Documentação de campo de altíssimo valor (auditoria v3 BR com errata, catálogo UAPI de 174 endpoints, paginação `order_list_new` validada com 7.740 pedidos, POP/POD confirmado em produção).
- Catálogo BR tipado no front (`src/lib/lalamoveCatalog.ts`, 14 serviceTypes, 28 specialRequests), guardas de errata, timeline, matriz de edição.
- Infra de alerta/dedup (`claim_alert_notification`), telemetria (`query_telemetry`), cron `pg_cron` funcionando.

**O que está quebrado ou é fictício (bloqueia qualquer operação):**

1. O front manda **tudo** pelo `lalamove-gateway`, que exige os secrets `LALAMOVE_UNIFIED_PROXY_URL/KEY` e `LALAMOVE_UAPI_PROXY_URL/KEY` — **nenhum existe em produção**. Toda tela Lalamove recebe 500.
2. O handler de webhook valida uma assinatura que **não é a da Lalamove** (header `x-lalamove-signature` sobre o corpo inteiro). A Lalamove manda `signature` **dentro do corpo**, HMAC de `timestamp\r\nPOST\r\n{path}\r\n\r\n{JSON.stringify(data)}`. Além disso filtra IPs AWS Singapura hardcoded. Resultado: 100% dos eventos reais seriam rejeitados.
3. `lalamove-api` grava `status = 'ASSIGNING_DRIVER'` / `'CANCELED'` numa coluna enum que só aceita `PENDING, MATCHED, ON_GOING, PICKED_UP, COMPLETED, CANCELLED, REJECTED, EXPIRED`. O INSERT pós-criação falha em silêncio: **pedido pago criado na Lalamove e não registrado no sistema**.
4. Edge functions em produção são de **21/08/2026 (v3)**; os fixes de segurança de 03/09 (webhook fail-closed) e 06/09 (`requireAdmin` no `lalamove-uapi`) nunca foram deployados. `lalamove-api` roda com `verify_jwt=false` (config.toml diz `true`).
5. Token UAPI: dois mecanismos concorrentes e incompatíveis (worker `lalamove-token-refresh` renova via proxy externo inexistente e nunca grava o novo token; `lalamove-uapi` lê de `lalamove_uapi_sessions`, que está vazia). 1.287 alertas CRITICAL acumulados.
6. n8n: só o F01 foi importado (inativo). F02/F03/F04 nunca entraram. O F03 também valida assinatura errada (`x-llm-signature` em header).
7. O `docs/LALAMOVE_SCORECARD.md` ("10,0/10 em 22 dimensões") e o P-12 ("100% do planejado implementado") descrevem código, não comportamento: nada disso foi verificado contra produção.

**Decisão que o plano assume:** manter o Supabase (`iecgydonctmabiijadsf`) como único backend de integração, com a REST API v3 para escrever (cotar, criar, cancelar, priority fee, trocar motorista) e webhook v3 para rastrear; UAPI apenas para o que a v3 não oferece (carteira, extrato, histórico antigo, cupons, frota). n8n vira consumidor do Supabase, não um segundo backend.

## 2. Estado real em produção (evidência, 21/11/2026)

Consultas somente leitura no projeto Supabase `iecgydonctmabiijadsf` via Management API, listagem de edge functions e secrets (só nomes), e lista de workflows do n8n `n8n.atomicabr.com.br`.

### 2.1 Banco de dados

| Tabela | Linhas | O que mostra |
| --- | --- | --- |
| `lalamove_orders` | 50 | 100% com `metadata.source = 'seed_script'`; status PENDING 11, MATCHED 5, ON\_GOING 13, PICKED\_UP 8, COMPLETED 8, CANCELLED 5; datas 29/07–27/08/2026 (seed) |
| `lalamove_uapi_sessions` | **0** | nenhuma sessão UAPI jamais cadastrada |
| `webhook_events` | **0** | nenhum evento Lalamove jamais recebido |
| `lalamove_rate_limits` | 3 | únicas chamadas v3 reais: `POST /quotations` 422, 422, 201 em 31/08/2026 16:57 |
| `lalamove_stops` / `lalamove_stop_proofs` | 0 / 0 | nenhuma parada ou POD/POP persistida |
| `lalamove_status_history` | 128 | todas derivadas do seed |
| `drivers` | 20 | seed |
| `bitrix24_tokens` / `bitrix24_sync` / `bitrix24_stage_mappings` | 0 / 0 / 0 | OAuth Bitrix24 nunca conectado; sem mapeamento de estágios |
| `query_telemetry` (`operation='lalamove'`) | 0 | gateway nunca completou uma chamada |
| `alerts` INTEGRATION\_FAILURE | 1.288 | 1.287 × "Nenhuma sessão UAPI ativa" (horário, desde set/2026) + 1 × "Erro no worker de refresh UAPI" |

Ledger de migrations em `20261122090000` (igual ao repo). Enum `order_status` = `PENDING, MATCHED, ON_GOING, PICKED_UP, COMPLETED, CANCELLED, REJECTED, EXPIRED`; enum `vehicle_type` = `MOTORCYCLE, CAR, VAN, TRUCK`.

### 2.2 Edge functions deployadas (24) vs. repo

| Edge | Versão no ar | `verify_jwt` no ar | `verify_jwt` no `config.toml` | Observação |
| --- | --- | --- | --- | --- |
| `lalamove-api` | v3 (21/08) | **false** | true | qualquer caller com a chave pública cria pedido pago |
| `lalamove-gateway` | v4 (28/08) | true | true | 500 em toda chamada: secrets de proxy ausentes |
| `lalamove-uapi` | v3 (21/08) | true | true | versão no ar **não tem** o `requireAdmin` de 06/09 |
| `lalamove-webhook` | v3 (21/08) | false | (não declarado) | versão no ar **não tem** o fail-closed de 03/09 |
| `lalamove-token-refresh` | v3 (21/08) | false | — | chamado pelo cron `17 * * * *`; sempre termina em alerta |
| `llm-wh` | v3 | true | — | proxy de webhook com `verify_jwt=true`: a Lalamove **não** envia JWT → 401 antes de chegar ao handler |
| `send-notification`, `route-analyzer`, `get-mapbox-token`, `simulate-driver-movement` | v3 | false | true | drift igual ao `lalamove-api` |
| `migrate-helper` | — | — | removida do repo | não está mais no ar (confirmado) |

Não há deploy automático de edge function no repo: merge em `main` não publica nada no Supabase.

### 2.3 Secrets em produção (só nomes)

Existem: `LALAMOVE_API_KEY`, `LALAMOVE_API_SECRET`, `LALAMOVE_BASE_URL`, `LALAMOVE_MARKET`, `LALAMOVE_UAPI_URL`, `MAPBOX_ACCESS_TOKEN` e os `SUPABASE_*` padrão.

**Não existem** (e o código depende deles): `LALAMOVE_UNIFIED_PROXY_URL`, `LALAMOVE_UNIFIED_PROXY_KEY`, `LALAMOVE_UAPI_PROXY_URL`, `LALAMOVE_UAPI_PROXY_KEY`, `LALAMOVE_TRUSTED_IPS`, `ALLOWED_ORIGINS`, `BITRIX24_CLIENT_ID`, `BITRIX24_CLIENT_SECRET`, `LOVABLE_API_KEY`, `RESEND_API_KEY`, `EVOLUTION_API_*`, `SLACK_WEBHOOK_URL`.

### 2.4 Cron (`pg_cron`)

10 jobs ativos. Relevantes: `lalamove_uapi_token_refresh_hourly` (`17 * * * *`, último run 21/11 15:17 "succeeded" — o HTTP responde 200 mesmo quando o worker falha) e `escalate-unacknowledged-alerts` (a cada 5 min). Não existe cron de `sync` de pedidos ativos nem de reconciliação.

### 2.5 n8n

| Workflow | Ativo | Origem | Status |
| --- | --- | --- | --- |
| `🚚 LLM-F01 — Cotação Lalamove` | não | bundle do repo (31/08) | importado, nunca ativado, 0 execuções |
| F02 Pedido, F03 Rastreamento, F04 POD, Bootstrap | — | bundle do repo | **nunca importados** |
| `Cria Cotação LOG - Lalamove` | sim | mar/2026, fora do repo | sem acesso MCP; conteúdo não verificado |
| `Cria Order dentro do Lalamove LOG` | sim | mar/2026, fora do repo | idem |
| `Lalamove LOG - Atualização Status Entregas` | sim | mar/2026, fora do repo | idem (provavelmente o receptor de webhook atual) |
| `Cancelar Corrida Lalamove` | sim | mar/2026, fora do repo | idem |
| `Agrupar Pedidos Lalamove - Bitrix24` | sim | mar/2026, fora do repo | 0 execuções |

### 2.6 Conta Lalamove

REST v3 produção: credenciais `pk_prod_d386…` / `sk_prod_v30C…` nos secrets. Sandbox: `https://rest.sandbox.lalamove.com/v3` (credenciais `55c6c42d…`/`253b997e…` no arquivo de credenciais, nunca configuradas). Conta web `11935024030` (Andressa Galvão, `user_fid qDdE35mo`, enterprise `is_ep=1`, carteira corporativa). URL de webhook registrada na Lalamove: **desconhecida** — `GET /v3/webhook` retorna 405; só o Partner Portal mostra.

## 3. Visão macro: sistemas e fluxos

Há **quatro sistemas** que precisam conversar; hoje nenhum par está ligado de ponta a ponta.

| Sistema | Papel na operação | Como fala com a Lalamove | Estado |
| --- | --- | --- | --- |
| **Lalamove (origem)** | motoristas, preços, pedidos, POD/POP | REST v3 (`rest.lalamove.com`, HMAC) · Webhook v3 (push) · UAPI interna (`br-uapi.lalamove.com`, token de sessão 24 h, WAF Argus) | operando (conta enterprise Promo Brindes) |
| **Lalamove\_V2 (Supabase + React/Vercel)** | painel de operação, histórico, motoristas, alertas, telemetria | edges `lalamove-api` (v3), `lalamove-uapi` (UAPI), `lalamove-webhook` (push), `lalamove-gateway` (proxy externo inexistente) | código existe, nunca ligado |
| **n8n (`n8n.atomicabr.com.br`)** | automação Bitrix24 ↔ Lalamove (fluxos de mar/2026) | HMAC v3 direto nos Code nodes (chaves hardcoded) | 5 fluxos ativos fora do repo, conteúdo não auditado |
| **Bitrix24 (SPA 1690, funil 730)** | onde a equipe cria e aprova entregas | via n8n (webhook de entrada `promobrindes.bitrix24.com.br/rest/1/{token}/`) | em uso pela operação |

### 3.1 Fluxo alvo (o que o plano entrega)

1. **Origem do pedido**: Bitrix24 (SPA 1690) **ou** painel Lalamove\_V2. Os dois chamam o mesmo backend Supabase.
2. **Cotação**: geocodificação → `POST /v3/quotations` (edge `lalamove-api`) → `quotationId` + `stopIds` + preço gravados em `lalamove_orders` (status local `QUOTED`, TTL 5 min).
3. **Aprovação**: humana (Bitrix24 stage APPROVAL ou botão no painel).
4. **Pedido**: `POST /v3/orders` com `sender`/`recipients` (E.164) e `metadata: {spa_id, internal_order_id}` → `orderId`, `shareLink` → `lalamove_orders` + `lalamove_stops`.
5. **Rastreamento**: Lalamove → `POST` webhook (edge `lalamove-webhook` com assinatura **no corpo**) → `webhook_events` → máquina de estados em `lalamove_orders` → `lalamove_status_history` → notificação Bitrix24 (stage) e alertas.
6. **Motorista**: `DRIVER_ASSIGNED` → `GET /v3/orders/{id}/drivers/{driverId}` → `drivers` + avaliação de risco (`evaluate-driver`).
7. **Conclusão**: `COMPLETED` → `GET /v3/orders/{id}` → `stops[].POD/POP` → `lalamove_stop_proofs` → comentário na timeline do SPA com as fotos.
8. **Reconciliação**: cron a cada 10 min faz `GET /v3/orders/{id}` dos pedidos ativos (webhooks podem chegar fora de ordem ou não chegar).
9. **Financeiro e histórico**: UAPI (`wallet_balance`, `wallet_flow_list`, `order_list_new`, extratos) com token mantido por um único worker.

### 3.2 Princípios de arquitetura

- **Um backend**: Supabase é a fonte de verdade de pedidos e estados; n8n/Bitrix24 chamam edges do Supabase (JWT de serviço), nunca a Lalamove direto.
- **v3 para escrever, UAPI para ler**: criar/cancelar/priority fee/trocar motorista só pela v3 (contrato estável, HMAC permanente). UAPI só para carteira, extrato, histórico anterior à integração, cupons, frota.
- **Webhook é o caminho primário; polling é rede de segurança**.
- **Sandbox antes de produção**: `rest.sandbox.lalamove.com` com as credenciais de sandbox para todos os testes de criação/cancelamento; produção só com pedido real aprovado pelo dono.
- **Segredo só em secret**: nenhuma chave em Code node do n8n (hoje `sk_prod_*` está em 5 Code nodes dos JSONs F01–F04 e na documentação).

## 4. Inventário micro do repositório (`adm01-debug/Lalamove_V2`, `main` @ `18c9d83`)

896 arquivos: `src/` 393, `supabase/` 198 (24 edges + 153 migrations), `scripts/` 176, `docs/` 54. Sem PR aberta. Vercel `lalamove-v2` (team `juca1`) faz deploy do front; edges e migrations são aplicadas à mão.

### 4.1 Edge functions ligadas à Lalamove

| Edge | Linhas | Função real | Ações |
| --- | --- | --- | --- |
| `lalamove-api` | \~1.000 | cliente REST v3 + persistência | `cities`, `quotation`, `get-quotation`, `order`, `get-order`, `fetch-order`, `fetch-orders-bulk`, `edit-order`, `cancel`, `priority-fee`, `get-driver`, `change-driver`, `set-webhook`, `sync` |
| `lalamove-gateway` | 369 | proxy JWT → **proxy externo** (`LALAMOVE_UNIFIED_PROXY_URL` / `LALAMOVE_UAPI_PROXY_URL`) + telemetria + alerta de auth | `target: unified` ou `uapi`, `action` livre |
| `lalamove-uapi` | 792 | cliente UAPI com token em `lalamove_uapi_sessions` | 24 ações (`list-orders`, `order-detail`, `wallet-balance`, `fleet-*`, `coupons`, `bulk-import`, `refresh-token`, `set-token`…) |
| `lalamove-token-refresh` | 192 | worker horário; renova via **proxy externo** e só atualiza `last_refreshed_at` | — |
| `lalamove-webhook` | 899 | receptor de eventos; HMAC (formato errado), anti-replay, idempotência, máquina de estados, POD/POP, replacements | 13 tipos de evento |
| `llm-wh` | 70 | proxy de URL curta → `lalamove-webhook` com `service_role` | — |
| `check-external-api` | — | health check v3 | — |
| `bitrix24-sync` / `bitrix24-process-queue` | — | OAuth2 Bitrix24 + `crm.deal.update` (**deals**, não SPA 1690) | `sync_order`, `get_deals`… |

### 4.2 Front (`src/`)

| Arquivo | Papel | Chama |
| --- | --- | --- |
| `src/lib/lalamove-api.ts` | cliente `lalamove` (`quote`, `orderCreate`, `wallet`, `refreshToken`, `updateV3Keys`…) | `lalamove-gateway` target `unified` (ações `quote`, `order_create`, `order_get`, `user`, `wallet`… — contrato do proxy externo, **não** da edge `lalamove-api`) |
| `src/lib/uapi-proxy.ts` | cliente `uapi` | `lalamove-gateway` target `uapi` |
| `src/hooks/useLalamove.ts`, `useLalamoveUapi.ts`, `useUAPI.ts`, `useLalamoveQuota.ts`, `useQuotationExpiry.ts` | hooks | `lalamove-api`, `lalamove-uapi`, gateway |
| `src/components/orders/NewOrderDialog.tsx`, `OrderDetailModal.tsx`, `FetchOrderDialog.tsx`, `ImportCSVDialog.tsx` | cotação, pedido, priority fee, troca de motorista, importação | `lalamove-api` direto |
| `src/pages/LalamoveOperationsPage.tsx`, `LalamoveQuotaPage.tsx`, `LalamoveSettingsPage.tsx`, `UAPISettingsPage.tsx`, `lalamove/LalamoveV3Explorer.tsx` | telas | gateway / edges |
| `src/lib/lalamoveCatalog.ts`, `lalamoveValidation.ts`, `lalamoveGuards.ts`, `lalamoveTimeline.ts`, `lalamoveErrors.ts`, `lalamoveOrderEdit.ts`, `lalamoveReasons.ts`, `uapiErrors.ts`, `uapiStatement.ts` | regra de negócio pura (testada) | — |
| `src/components/lalamove/Uapi*Panel.tsx` | histórico, extrato, cupons, frota | `lalamove-uapi` |

### 4.3 Tabelas (produção)

`lalamove_orders` (49 col., `status order_status`, `vehicle_type vehicle_type`, `bitrix24_deal_id`, `quotation_id`, `share_link`, `priority_fee*`, `cancellation_*`, `requires_pod`, `pod_received`…) · `lalamove_stops` (15) · `lalamove_stop_proofs` (14) · `lalamove_status_history` (9; `status order_status`, `order_id uuid` — **não tem** `lalamove_id` nem `changed_at`) · `lalamove_priority_fee_history` · `lalamove_order_replacements` · `lalamove_rate_limits` · `lalamove_uapi_sessions` (13) · `webhook_events` (9; `received_at`, `idempotency_key`) · `drivers` (32) · `bitrix24_tokens/sync/activities/stage_mappings` · `alerts` · `query_telemetry`.

### 4.4 Artefatos n8n/Python na raiz (fora do build)

`lalamove_token_manager.py` (servidor HTTP local de token UAPI com Playwright fallback), `lalamove_cron_setup.sh`, `lalamove_f00_bootstrap.json`, `lalamove_f01_cotacao.json` … `f04_pod.json`, `lalamove_bundle_import.json` (72 KB, concatena F00–F04), `lalamove_n8n_integration.md`, `lalamove_setup_guide.html`, docs `.md/.html/.docx/.pdf` (duplicatas do mesmo conteúdo). Todos contêm `sk_prod_*` e a chave DistanceMatrix em texto puro.

### 4.5 Docs internos relevantes

`docs/LALAMOVE_MASTER_ANALYSIS.md` (roteiro de 30 etapas, jul/2026), `LALAMOVE_SCORECARD.md`, `LALAMOVE_API_V3.md`, `WEBHOOK_HANDLER.md`, `RUNBOOK_LALAMOVE.md`, `LALAMOVE_FAILURE_SIMULATION.md`, `agentes/lalamove-api.md`, `pendencias/P-12` (veredito "100% implementado"). `AGENTS.md` e `docs/agentes/*` são as regras de trabalho e estão corretas; os scorecards não.

## 5. Catálogo exaustivo de endpoints do sistema original e cobertura real

Fonte: [developers.lalamove.com](https://developers.lalamove.com/) (lido em 21/11/2026), deck [v3 Webhook v1.5](https://developers.lalamove.com/files/v3_Webhook_v1.5.pdf) e seu código de referência ([jsfiddle qecvaxwd](https://jsfiddle.net/qecvaxwd/)), mais a auditoria de produção BR anexada (03–09/03/2026). Legenda: ✅ pronto e correto · 🟡 existe com defeito · ❌ ausente.

### 5.1 REST API v3 (`https://rest.lalamove.com`, sandbox `https://rest.sandbox.lalamove.com`)

Autenticação: `Authorization: hmac {KEY}:{ts_ms}:{HMAC_SHA256(secret, "{ts}\r\n{METHOD}\r\n{PATH}\r\n\r\n{BODY}")}` + `Market: BR` + `Request-ID` (uuid, idempotência). Auth inválida devolve **502 sem corpo** (não 401).

| # | Endpoint | Uso no negócio | Regras confirmadas em produção BR | Cobertura no repo |
| --- | --- | --- | --- | --- |
| 1 | `GET /v3/cities` | catálogo de serviços por cidade | campo é `services` (não `serviceTypes`); objeto tem só `locode, name, services`; rate limit 300/janela; 16 cidades BR | ✅ `lalamove-api` `cities` |
| 2 | `POST /v3/quotations` | cotar | `data.serviceType` ∈ 14 BR (`LALAGO, LALAPRO, LALAGOFOUR, CAR, CARFOURH, HATCHBACK, HATCHFOURH, UV_FIORINO, UV_4H, VAN, VANFOURH, TRUCK330, TRUCK3_5T, TRUCK_6H`); `stops[].coordinates.lat/lng` strings; `scheduleAt` ≤ 30 dias; `specialRequests` válidos por serviço; `item` só TRUCK330/UV\_FIORINO/VAN; resposta `quotationId`/`stopId` (19 dígitos), `expiresAt` **\~5 min**, `priceBreakdown.total` em reais (string) | 🟡 `quotation`: matriz `SPECIAL_REQUESTS_BY_SERVICE` **errada** (códigos de outro mercado: `HELP_BUY`, `TOLL_FEE`, `MOTORCYCLE`, `MPV`) derruba SRs válidos em silêncio |
| 3 | `GET /v3/quotations/{id}` | revalidar antes do pedido | mesma estrutura do POST | ✅ `get-quotation` |
| 4 | `POST /v3/orders` | criar pedido | `data.quotationId`, `sender{stopId,name,phone E.164}`, `recipients[]{stopId,name,phone,remarks}`, `isPODEnabled`, `metadata{}`; resposta `orderId`, `status: ASSIGNING_DRIVER`, `driverId: ""`, `shareLink`, `stops[]` sem `stopId`, `phone` sem `+55`, `remarks` vira array; `ERR_INVALID_QUOTATION_ID` se > 5 min | 🟡 `order`: chamada correta; **INSERT local falha** (enum) e `vehicle_type` nunca vem do body |
| 5 | `GET /v3/orders/{id}` | consultar / reconciliar | `driverId` sempre string; `stops[].POD{status,image,deliveredAt}` e `stops[0].POP{imageUrls[],pickedUpAt}`; `priorityFee`; `delivery_code` | 🟡 `get-order`/`fetch-order`: parse ok, grava status cru → enum falha; não persiste `stops`/POP/POD |
| 6 | `PATCH /v3/orders/{id}` | editar paradas/contatos | 422 `ERR_ORDER_EDIT` em `ASSIGNING_DRIVER` | ✅ `edit-order` (+ matriz `lalamoveOrderEdit.ts`) |
| 7 | `DELETE /v3/orders/{id}` | cancelar | 204 sem corpo; permitido em `ASSIGNING_DRIVER` ou até 5 min após `ON_GOING`; depois 409 `ERR_CANCELLATION_FORBIDDEN`; sem `cancelParty`/`cancelledReason` na BR | 🟡 `cancel`: grava `'CANCELED'` (enum só tem `CANCELLED`) |
| 8 | `POST /v3/orders/{id}/priority-fee` | bônus ao motorista | só aumenta; `ERR_INVALID_TIPS` se ≤ atual | ✅ `priority-fee` (teto R$ 500, histórico) |
| 9 | `GET /v3/orders/{id}/drivers/{driverId}` | dados + GPS do motorista | só com `driverId !== ""`; disponível de 1 h antes do `scheduleAt` até conclusão (403 fora); `coordinates.updatedAt`, refresh 10 s; `plateNumber`, `phone`, `photo` | ✅ `get-driver` |
| 10 | `DELETE /v3/orders/{id}/drivers/{driverId}` | trocar motorista | `reason` ∈ `DRIVER_LATE, DRIVER_ASKED_CHANGE, DRIVER_UNRESPONSIVE, DRIVER_RUDE`; 15 min após match e antes da coleta; 422 `ERR_CHANGE_DRIVER` | 🟡 `change-driver`: aceita `DRIVER_ASKED_FOR_MORE_MONEY` (não oficial); grava `'ASSIGNING_DRIVER'` (enum) e `lalamove_status_history.lalamove_id` (coluna não existe) |
| 11 | `PATCH /v3/webhook` | registrar URL | `{data:{url}}`; 422 `ERR_INVALID_RESPONSE` se a URL não responder 200; `GET` = 405 | ✅ `set-webhook` (sem registro local da URL ativa) |

### 5.2 Webhook v3 (Lalamove → nós)

**Formato oficial** (deck v1.5 + jsfiddle): corpo JSON `{ apiKey, timestamp, signature, eventId, eventType, eventVersion, data: { order: {...}, updatedAt, ... } }`. Assinatura **no corpo**: `signature = HMAC_SHA256(secret, "{timestamp}\r\nPOST\r\n{path_do_webhook}\r\n\r\n" + JSON.stringify(data))`, comparada com `apiKey` igual ao seu. Responder **200 antes de processar**; até 10 tentativas em 24 h com backoff; após a 10ª falha a URL é **desativada** no Partner Portal; eventos podem chegar fora de ordem (ordenar por `timestamp`). Lalamove não publica IPs de origem.

| eventType | Conteúdo | Cobertura no repo (`lalamove-webhook`) | n8n F03 |
| --- | --- | --- | --- |
| `ORDER_STATUS_CHANGED` | `data.order.{orderId, status, market, createdAt, scheduleAt, driverId, shareLink, priceBreakdown, ...}`; status ∈ `ASSIGNING_DRIVER, ON_GOING, PICKED_UP, COMPLETED, CANCELED, REJECTED, EXPIRED` | 🟡 handler lê `payload.event` e `payload.orderId` no topo (oficial é `eventType` e `data.order.orderId`); mapeia `CANCELED→CANCELLED` ok | ❌ espera `ORDER_ACCEPTED`, `DRIVER_ARRIVED`, `ORDER_PICKED_UP`, `ORDER_COMPLETED`… (nomes inventados) |
| `DRIVER_ASSIGNED` | `data.order.orderId`, `data.driver.{driverId,name,phone,plateNumber,photo}` | 🟡 lê `data.driverId` (sem `order`/`driver`); cria driver com `vehicle_type:'MOTORCYCLE'` | ❌ |
| `ORDER_AMOUNT_CHANGED` | `priceBreakdown` após priority fee/taxas | 🟡 estrutura presumida | ❌ |
| `ORDER_REPLACED` | cancel-and-clone pela CS: `previousOrderId` → novo `orderId` | 🟡 lógica boa, chaves presumidas | ❌ |
| `ORDER_EDITED` | paradas/preço editados | 🟡 | ❌ |
| `WALLET_BALANCE_CHANGED` | saldo da carteira | 🟡 alerta < 50 | ❌ |
| `POD_STATUS_CHANGED` | por parada: `PENDING, DELIVERED, SIGNED, FAILED` + `image`, `deliveredAt` | 🟡 grava `lalamove_stops`/`stop_proofs` (tabelas vazias: `stops` nunca é populada na criação) | ❌ |
| `POP_STATUS_CHANGED` | coleta: `imageUrls[]`, `pickedUpAt` | 🟡 idem | ❌ |
| `DELIVERY_CODE_STATUS_CHANGED` | código de entrega | 🟡 só histórico | ❌ |
| `ORDER_CREATED` | pedido criado fora da API (app/portal) | 🟡 insere `'ASSIGNING_DRIVER'` (enum) e `vehicle_type:'MOTORCYCLE'` | ❌ |

Validação de assinatura: repo = HMAC do corpo inteiro lido do header `x-lalamove-signature` ❌; F03 = HMAC de `ts\r\nPOST\r\n/webhook/lalamove-eventos\r\n\r\n{corpo inteiro}` com headers `x-llm-*` ❌. Ambos rejeitam 100% dos eventos reais. Os campos exatos de cada `data` precisam ser capturados no sandbox (os slides do deck são imagens) — tarefa F0.4 do plano.

### 5.3 UAPI interna (`https://br-uapi.lalamove.com/index.php?_m={m}`)

Sessão: token 24 h obtido por login no portal (`login_by_pwd` bloqueado pelo WAF Argus `ret=10010` fora de browser real); `refresh_token` **não** é bloqueado, é de uso único e só funciona com o access token ainda válido; resposta em `data.token` + `data.raw.refresh_token`. Headers anti-WAF obrigatórios (`Origin/Referer web.lalamove.com`, `X-LLM-LOCATION: BR`, UA Chrome). `hcountry=20000`, `city_id=21001` (SP), `is_ep=1`.

| Método UAPI | Uso | Status confirmado | Cobertura `lalamove-uapi` | Observação |
| --- | --- | --- | --- | --- |
| `get_user_info`, `get_corporate`, `get_staffs` | conta/empresa/time | ✅ ret=0 | ✅ `user-info`, `corporate-info` (sem `get_staffs`) | — |
| `wallet_balance`, `wallet_flow_list` | saldo (`balance_fen` centavos) e extrato | ✅ | ✅ `wallet-balance`, `wallet-transactions` | base do financeiro |
| `order_list_new` | histórico paginado por cursor | ✅ `{limit:20,last_id:""}` obrigatório; `is_end`, `last_id`; 7.740 pedidos extraídos | ✅ `list-orders`, `bulk-import` | `bulk-import` grava `pickup_address 'N/A'` quando `addr_info` ausente |
| `order_repeat_list` | — | ❌ HTTP 501 (WAF) | — | não usar |
| `order_detail` | detalhe | ❌ `ret=10002` em todos os formatos; WAF | 🟡 `order-detail` (ação morta) | usar `GET /v3/orders/{id}` |
| `order_status`, `order_search`, `get_laster_order` | status/busca | não testados | 🟡 | — |
| `order_cancel`, `order_cancellation_eligibility`, `order_edit`, `order_request`, `price_calculate` | escrita | ❌ WAF Argus (`ret=10010`) | 🟡 `cancel-order`, `cancel-eligibility` (mortas) | escrita só pela v3 |
| `download_pdf_receipt`, `send_email_receipt`, `generate_statement_token`, `get_statement_report_by_token` | comprovantes/extratos | não testados | 🟡 só `download-receipt` | — |
| `coupon_list_web` (`search` é array), `coupon_exchange_web` | cupons | não testados | ✅ | erros `qp` traduzidos em `uapiErrors.ts` |
| `get_fleet` (1 favoritos, 2 bloqueados), `fleet_add/del_favorite_web`, `fleet_add/del_ban` | frota | não testados | ✅ | — |
| `user_rating` | avaliar motorista | não testado | ✅ `rate-driver` | — |
| `city_info`, `vehicle_list`, `get_service_area` | catálogo UAPI | ✅ `city_info` | ✅ `city-info` | redundante com v3 `/cities` |
| `get_analytics_dashboard`, `get_analytics_dashboard_filters` | BI enterprise | não testados | ❌ | candidato a relatórios |
| `refresh_token` | renovar sessão | ✅ \~400 ms | 🟡 dois caminhos concorrentes (ver §6) | — |
| bulk order (`*_same_day_bulk_order_*`), e-commerce (`*_e_commerce_*`), chat MQTT5 | — | fora de escopo | ❌ | — |

Códigos UAPI que o sistema precisa tratar: `10007` sessão expirada · `10010` WAF · `42201` rate limit · `10002` parâmetro · `13001/27103/27104/27105` postpaid wallet.

## 6. Divergências e bugs encontrados

Ordenados por impacto no negócio. Linhas referem-se a `main @ 18c9d83`.

| # | Severidade | Onde | Defeito | Efeito no negócio |
| --- | --- | --- | --- | --- |
| B1 | **Bloqueante** | `lalamove-gateway/index.ts:42-45` + secrets de produção | exige `LALAMOVE_UNIFIED_PROXY_URL/KEY` e `LALAMOVE_UAPI_PROXY_URL/KEY`; nenhum existe; o proxy externo que eles apontavam não está no repo | todo o front Lalamove (`src/lib/lalamove-api.ts`, `uapi-proxy.ts`) recebe 500 |
| B2 | **Bloqueante** | `lalamove-webhook/index.ts:148-166` e `security.ts:22-45` | assinatura lida do header `x-lalamove-signature` e calculada sobre o corpo inteiro; oficial = campo `signature` no corpo sobre `ts\r\nPOST\r\n{path}\r\n\r\n{data}` | nenhum evento real passa (401 "Missing signature header") |
| B3 | **Bloqueante** | `lalamove-webhook/index.ts:30-33, 123-131` | allowlist de IP hardcoded (`52.76/16`, `54.251/16`, `13.228/16`, `18.136/16` = AWS Singapura); Lalamove não publica IPs e o BR é datacenter SAO | 403 antes da assinatura |
| B4 | **Bloqueante** | `lalamove-webhook/index.ts:188-196` | lê `payload.event` / `payload.orderId` / `payload.timestamp` no topo; oficial: `eventType`, `data.order.orderId`, `timestamp` (epoch) | mesmo com assinatura certa, `eventType = 'UNKNOWN'` e `orderId = null` |
| B5 | **Bloqueante** | `lalamove-api/index.ts` ação `order` (\~l.645), `syncOrderToDatabase` (\~l.433), `cancel` (\~l.767), `change-driver` (\~l.900), webhook `ORDER_CREATED` (\~l.780) | gravam `status` = `ASSIGNING_DRIVER` / `CANCELED` / `DELIVERING`; enum `order_status` não tem esses valores; erro não é verificado | pedido **pago** criado na Lalamove e não salvo; cancelamento não refletido |
| B6 | **Alta** | produção: `lalamove-api` com `verify_jwt=false` (config.toml:17 diz `true`); `send-notification`, `route-analyzer`, `get-mapbox-token`, `simulate-driver-movement` idem | drift de deploy | qualquer caller com a publishable key cria pedido pago, dispara notificações, gasta Lovable AI |
| B7 | **Alta** | edges em produção = v3 de 21/08; repo tem fail-closed do webhook (03/09) e `requireAdmin` (06/09) | sem pipeline de deploy de edge | o que está no `main` não é o que roda |
| B8 | **Alta** | `lalamove-token-refresh/index.ts:120-160` vs `lalamove-uapi/index.ts:108-156` | o worker renova via proxy externo e **não grava** `access_token`/`refresh_token` novos; a edge UAPI renova sozinha e grava em `lalamove_uapi_sessions`. Dois donos de um refresh de uso único | sessão queimada em corrida; hoje a tabela está vazia e o worker alerta de hora em hora (1.287 alertas) |
| B9 | **Alta** | `lalamove-uapi/index.ts` ação `refresh-token` (\~l.690) e `bulk-import` | qualquer usuário autenticado (não só admin) pode queimar o refresh ou disparar importação em massa | derruba a sessão UAPI por 24 h |
| B10 | **Alta** | `lalamove-api/index.ts:241-250` `SPECIAL_REQUESTS_BY_SERVICE` | códigos de outro mercado (`HELP_BUY`, `TOLL_FEE`, `ROUND_TRIP`, `MOTORCYCLE`, `MPV`, `TRUCK175`); para `CAR`/`VAN`/`TRUCK330` descarta os 28 SRs reais BR (`WAITING_TIME_*`, `LOADING_1DRIVER_*`…) | cotação sem ajuda de motorista/espera mesmo quando pedida; o front (`lalamoveCatalog.ts`) tem a lista certa |
| B11 | **Alta** | `llm-wh` deployada com `verify_jwt=true` | Lalamove não manda JWT | a URL curta pensada para o Partner Portal devolve 401 |
| B12 | **Média** | `lalamove-api` ação `order` (\~l.660) | `vehicle_type: body.serviceType \|\| 'MOTORCYCLE'`; o body do pedido não traz `serviceType`; enum `vehicle_type` = `MOTORCYCLE,CAR,VAN,TRUCK` não representa os 14 serviços BR | relatórios por veículo errados |
| B13 | **Média** | `lalamove-api` ação `order` | não grava `lalamove_stops` (coordenadas, contatos, `stopId`) nem `requires_pod` | POD/POP do webhook não tem onde cair (`stops` vazia) |
| B14 | **Média** | `lalamove-api` `change-driver` (\~l.908) | insere `lalamove_status_history.lalamove_id` e `changed_at` (colunas inexistentes); `status 'DRIVER_CHANGED'` fora do enum | histórico da troca perdido |
| B15 | **Média** | `lalamove-api` `cancel` | não checa regra oficial (5 min após `ON_GOING`); não trata 409 `ERR_CANCELLATION_FORBIDDEN` | usuário vê erro genérico |
| B16 | **Média** | `lalamove-uapi/index.ts:50-66` | `device_id` novo a cada request (`crypto.randomUUID()`); o portal persiste um por browser | risco de WAF marcar como bot; usar um `device_id` fixo por sessão |
| B17 | **Média** | `lalamove-uapi` `order-detail`, `cancel-order`, `cancel-eligibility` | endpoints bloqueados pelo WAF (`ret=10002/10010`) | ações mortas na UI |
| B18 | **Média** | `lalamove_token_manager.py:158` | lê `data.refresh_token`; a UAPI devolve `data.raw.refresh_token` | token manager perde o refresh novo e reutiliza o antigo (uso único) → segunda renovação falha |
| B19 | **Média** | `lalamove-webhook` `DRIVER_ASSIGNED` (\~l.283) | cria `drivers` com `vehicle_type:'MOTORCYCLE'`, `risk_level:'HIGH'` e dispara `evaluate-driver` + notificações antes de responder 200 | latência alta na resposta ao webhook; Lalamove retenta e desativa a URL após 10 falhas |
| B20 | **Média** | `lalamove-webhook` `WEBHOOK_MAX_AGE_MS` (l.117) | anti-replay de 5 min contra `payload.timestamp` ISO; oficial é epoch e a Lalamove retenta por até 24 h | retentativas legítimas rejeitadas com 409 |
| B21 | **Média** | `bitrix24-sync/index.ts` | integra com **deals** (`crm.deal.update`, campos `UF_CRM_LALAMOVE_ID`…) via OAuth2; a operação usa **SPA 1690** (`crm.item.*`, campos `ufCrm276_*`) via webhook de entrada; `bitrix24_stage_mappings` vazia; `BITRIX24_CLIENT_*` ausentes | integração Bitrix24 do repo não se aplica ao processo real |
| B22 | **Média** | `src/lib/lalamove-api.ts` | contrato de ações (`quote`, `order_create`, `user`, `update_v3_keys`…) é o do proxy externo; a edge `lalamove-api` usa outro (`quotation`, `order`…) | duas APIs internas para a mesma coisa; telas que usam o gateway nunca funcionarão sem o proxy |
| B23 | **Baixa** | `lalamove-api` `persistRateLimit` (l.39-41) | lê `ratelimits-limit` sem sufixo; a Lalamove envia `ratelimits-limit-{endpoint}` | telemetria de quota sempre nula (o gateway trata certo) |
| B24 | **Baixa** | `lalamove_f0*.json`, `lalamove_bundle_import.json`, `*.md/html/docx/pdf`, `docs/` | `sk_prod_*`, `pk_prod_*`, chave DistanceMatrix e senha do portal em texto puro, no repo **público** | chaves comprometidas; rotação obrigatória |
| B25 | **Baixa** | `docs/LALAMOVE_SCORECARD.md`, `docs/pendencias/P-12` | avaliam código, não comportamento em produção | decisões tomadas sobre premissa falsa ("integração completa") |

Nota sobre o repositório: `AGENTS.md` o descreve como **privado**; a API do GitHub retorna `private: false`. Com B24, isso é um incidente de segurança em aberto.

## 7. Lado n8n + Bitrix24 (SPA 1690)

O processo real da equipe está no Bitrix24 e no n8n, não no painel. O plano precisa unir os dois sem quebrar o que roda hoje.

### 7.1 O que foi documentado (bundle F00–F04, 09/03/2026)

| Flow | Webhook n8n | Gatilho | Faz | Estado |
| --- | --- | --- | --- | --- |
| F01 Cotação | `POST /webhook/lalamove-cotacao` | automação B24 ao entrar em PREPARATION (funil 730) | geocode DistanceMatrix → `POST /v3/quotations` → grava `quotationId`, `stopIds`, preço, distância, tempo no SPA (`ufCrm276_1758655595`, `_1758654848`, `_1758654830`, `_1758654032`, `_1759402004059`, `_1759098131243`, `_1759098064876`) | importado, inativo |
| F02 Pedido | `POST /webhook/lalamove-pedido` | B24 ao entrar em APPROVAL | `crm.item.get` → `POST /v3/orders` → grava `orderId` (`ufCrm276_1758817942`) + stage IN\_PROCESS | nunca importado |
| F03 Rastreamento | `POST /webhook/lalamove-eventos` | Lalamove | valida HMAC (formato errado) → `crm.item.list` por `orderId` → stage → dispara F04 | nunca importado |
| F04 POP+POD | `POST /webhook/lalamove-pod` | F03 | `GET /v3/orders/{id}` → `stops[0].POP.imageUrls[]`, `stops[-1].POD.image` → stage WON + flags (`ufCrm276_1760014914`, `_1760015259`) + `crm.timeline.comment.add` | nunca importado |

Problemas desses JSONs: `sk_prod_*`/`pk_prod_*` hardcoded em 5 Code nodes; F03 mapeia eventos inexistentes (`ORDER_ACCEPTED`, `DRIVER_ARRIVED`…) e assinatura errada; F01 mapeia `vehicle_id` do B24 (`120767, 121120, 666, 120768`) para `MOTORCYCLE, MPV, VAN, TRUCK550` — serviços que **não existem** na API BR (o SPA #258 enviou `"162"`, que nem está no mapa); `ufCrm276_1758913684` chega como `551125651422` e o F02 manda `countryCode:'+55'` + `displayNumber` com 55 na frente (telefone inválido); F01 responde `quotationId` com `$json.quotationId` depois do nó de update do B24 (campo não existe nesse item → `undefined`); F01 não grava `serviceType` no SPA, então F02/F04 não sabem o veículo.

### 7.2 O que roda hoje (mar/2026, fora do repo, sem acesso MCP)

`Cria Cotação LOG - Lalamove`, `Cria Order dentro do Lalamove LOG`, `Lalamove LOG - Atualização Status Entregas`, `Cancelar Corrida Lalamove`, `Agrupar Pedidos Lalamove - Bitrix24` (este com 0 execuções). Conteúdo **NÃO VERIFICADO**: o MCP não tem acesso a eles. É provável que "Atualização Status Entregas" seja a URL de webhook registrada hoje no Partner Portal — confirmar antes de trocar.

### 7.3 Mapa de campos do SPA 1690 (confirmado pelo item #258)

| Campo | Significado | Quem grava |
| --- | --- | --- |
| `ufCrm276_1758913732` / `_1758913724` | endereço coleta / entrega | operador |
| `ufCrm276_1758913712` / `_1758913684` | tel. coleta / destinatário | operador |
| `ufCrm276_1758913742` / `_1758913748` | nome destinatário / referência | operador |
| `ufCrm276_1764346660` | tipo de veículo (array de ids B24) | operador |
| `ufCrm276_1758655595`, `_1758654848`, `_1758654830` | quotationId, stopId coleta, stopId entrega | integração (cotação) |
| `ufCrm276_1758654032`, `_1759402004059`, `_1759098131243`, `_1759098064876` | valor total, taxas, distância, tempo | integração (cotação) |
| `ufCrm276_1758817942` | orderId Lalamove | integração (pedido) |
| `ufCrm276_1760014914`, `_1760015259` | flag entregue, flag tem POD | integração (conclusão) |
| `stageId` | `DT1690_{categoryId}:{NEW\|PREPARATION\|APPROVAL\|IN_PROCESS\|WON\|LOSE}` | ambos |

Funis: 730 LALAMOVE AUTOMÁTICO, 1406 MANUAL, 876 AGENDAMENTOS, 878 HISTÓRICO. Campos que **faltam** no SPA para o fluxo alvo: `serviceType` escolhido, `shareLink`, status Lalamove cru, `driverId`/nome/placa, `scheduleAt`, `expiresAt` da cotação.

### 7.4 Decisão de desenho para o n8n

Os flows F01–F04 viram **chamadas finas** a edges do Supabase (`lalamove-api` com `metadata.spa_id`), sem HMAC nem chaves no n8n. O webhook da Lalamove aponta para o Supabase; o Supabase é quem atualiza o SPA (edge `bitrix24-spa-sync`, nova) ou dispara um webhook n8n já normalizado. Assim há um único lugar que conhece a Lalamove.

## 8. Plano de integração completo

Sete fases, em ordem de dependência. Cada item é uma branch/PR (`claude/<tipo>-<slug>-<AAMMDD-HHMM>`) executável via MCP; DDL, secrets e deploy de edge ficam abertos para o dono (regra 8). "Pronto" = PR mergeada + edge deployada + comportamento verificado em sandbox/produção com evidência.

### Fase 0 — Conter o risco e provar o contrato (sem mexer em fluxo de negócio)

| # | Entrega | Arquivos / onde | Critério de aceite |
| --- | --- | --- | --- |
| 0.1 | Rotacionar `pk/sk_prod_*` no Partner Portal, a chave DistanceMatrix e a senha do portal web; tornar o repo privado; purgar os artefatos com segredo da raiz (`lalamove_f0*.json`, `bundle_import`, docs `.md/.html/.docx/.pdf`) ou substituir por versões redigidas | GitHub settings, Partner Portal, `supabase secrets set` | nenhum `sk_prod`/`pk_prod` em `git grep`; secrets novos no Supabase; chamada `GET /v3/cities` com as novas chaves = 200 |
| 0.2 | Deploy das edges do `main` (fail-closed do webhook, `requireAdmin`) e `verify_jwt=true` em `lalamove-api`, `send-notification`, `route-analyzer`, `get-mapbox-token`, `simulate-driver-movement`; `llm-wh` e `lalamove-webhook` com `verify_jwt=false` | `supabase functions deploy` por função; `supabase/config.toml` | Management API lista `verify_jwt` igual ao `config.toml`; `POST lalamove-api` sem JWT = 401 |
| 0.3 | Workflow de deploy de edges (`.github/workflows/deploy-edges.yml`, gatilho manual + push em `supabase/functions/**`, secret `SUPABASE_ACCESS_TOKEN`) | `.github/workflows/` | run verde deployando 1 função; versão no Management API incrementa |
| 0.4 | **Captura do contrato real de webhook** no sandbox: registrar `PATCH /v3/webhook` (sandbox) → edge temporária `lalamove-webhook-capture` que só grava corpo+headers em `webhook_events` → criar/cancelar 2 pedidos sandbox → salvar fixtures em `supabase/functions/lalamove-webhook/fixtures/*.json` | sandbox + `webhook_events` | fixtures reais de `ORDER_STATUS_CHANGED` (todos os status atingidos), `DRIVER_ASSIGNED`, `ORDER_AMOUNT_CHANGED`, `POD_STATUS_CHANGED`; assinatura recalculada bate com `signature` |
| 0.5 | Desativar o cron `lalamove_uapi_token_refresh_hourly` até a Fase 4 e fechar os 1.287 alertas repetidos (`alerts.acknowledged`) | `cron.unschedule`, UPDATE em `alerts` | zero alerta novo "Nenhuma sessão UAPI ativa" em 24 h |

### Fase 1 — Dados e enums (migration única, idempotente)

| # | Entrega | Detalhe |
| --- | --- | --- |
| 1.1 | `order_status`: adicionar `QUOTED`, `ASSIGNING_DRIVER`, `DELIVERING`; manter `PENDING` (legado) | `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (fora de transação) |
| 1.2 | `lalamove_orders`: `service_type text` (14 valores BR, CHECK), `lalamove_status text` (status cru), `quotation_expires_at`, `schedule_at`, `driver_lalamove_id`, `driver_name`, `driver_phone`, `driver_plate`, `priority_fee` já existe, `source text` (`painel`/`bitrix24`/`externo`), `spa_id int`, `spa_category_id int`; índice em `(lalamove_id)` já é unique, criar em `(spa_id)` e `(status) WHERE status IN (ativos)` | `vehicle_type` passa a derivado (view), não fonte |
| 1.3 | `lalamove_stops`: `stop_id text` (da cotação), `pop_image_urls text[]`, `pop_picked_up_at`; unique `(order_id, stop_index)` | POD/POP precisam disso |
| 1.4 | `lalamove_status_history`: `status` vira `text` (ou enum ampliado) para aceitar `DRIVER_CHANGED`, `POD_DELIVERED` etc. | hoje enum estrito derruba inserts |
| 1.5 | `lalamove_webhook_config` (url ativa, registrada em, por quem, ambiente) | a Lalamove não devolve a URL (`GET` = 405) |
| 1.6 | `lalamove_uapi_sessions`: unique parcial `(is_active) WHERE is_active`, `device_id text` | um único dono do token |
| 1.7 | `bitrix24_spa_sync` (order\_id, spa\_id, last\_stage, last\_synced\_at, last\_error) substituindo o modelo de deals | n8n/SPA 1690 é o processo real |

### Fase 2 — REST v3 correto de ponta a ponta (`lalamove-api`)

| # | Entrega | Critério |
| --- | --- | --- |
| 2.1 | Trocar `SPECIAL_REQUESTS_BY_SERVICE` pelo catálogo BR (importar de um módulo compartilhado `supabase/functions/_shared/lalamoveCatalog.ts` gerado de `src/lib/lalamoveCatalog.ts`) | SR válido nunca é descartado; SR inválido vira 400 com mensagem |
| 2.2 | `quotation`: persistir `QUOTED` em `lalamove_orders` com `quotation_id`, `quotation_expires_at`, `service_type`, preço, distância, `lalamove_stops` com `stop_id` | linha criada; TTL visível |
| 2.3 | `order`: revalidar cotação (`GET /v3/quotations/{id}` se > 4 min, recotar se expirada), gravar `status ASSIGNING_DRIVER`, `lalamove_status`, `share_link`, `metadata.spa_id`; **verificar erro do INSERT** e, se falhar, registrar em `alerts` CRITICAL com o `orderId` | pedido sandbox criado → linha com `lalamove_id` em < 2 s; falha de banco gera alerta |
| 2.4 | `cancel`: aplicar regra oficial (ASSIGNING\_DRIVER ou ≤ 5 min de ON\_GOING), mapear 409 `ERR_CANCELLATION_FORBIDDEN`, gravar `CANCELLED` | cancelamento sandbox reflete em 1 chamada |
| 2.5 | `change-driver`: motivos oficiais (4), corrigir insert do histórico | 422 `ERR_CHANGE_DRIVER` tratado |
| 2.6 | `get-order`/`fetch-order`/`sync`: mapa de status completo (`DELIVERING`→`DELIVERING`), persistir `stops[].POD/POP` em `lalamove_stops`/`stop_proofs`, `driverId` → `GET drivers` só quando `!== ""` | `fetch-order` de um pedido COMPLETED real popula POD/POP |
| 2.7 | `set-webhook`: gravar em `lalamove_webhook_config` | registro local = URL ativa |
| 2.8 | `persistRateLimit`: ler `ratelimits-*-{endpoint}` | `lalamove_rate_limits.limit_total` preenchido |
| 2.9 | `LALAMOVE_BASE_URL` por ambiente (sandbox nas PRs, produção no `main`) + secrets `LALAMOVE_SANDBOX_KEY/SECRET` | mesma edge, dois ambientes |
| 2.10 | Testes Deno de contrato com as fixtures da Fase 0.4 (`_shared/contract.test.ts`) | CI `contract-tests` verde |

### Fase 3 — Webhook v3 correto (`lalamove-webhook`)

| # | Entrega | Critério |
| --- | --- | --- |
| 3.1 | Validar assinatura oficial: `body.signature === HMAC(secret, "{body.timestamp}\r\nPOST\r\n{WEBHOOK_PATH}\r\n\r\n" + JSON.stringify(body.data))` e `body.apiKey === LALAMOVE_API_KEY`; `WEBHOOK_PATH` em secret (`/functions/v1/lalamove-webhook` ou o path do `llm-wh`); timing-safe; fail-closed | fixtures reais validam; assinatura alterada = 401 |
| 3.2 | Remover allowlist de IP (ou torná-la opcional via `LALAMOVE_TRUSTED_IPS`, vazia por padrão) | evento sandbox de IP SAO aceito |
| 3.3 | Parser oficial: `eventType`, `eventId`, `data.order.orderId`, `data.order.status`, `data.driver`, `data.updatedAt`; idempotência por `eventId` (não hash do corpo); ordenação por `timestamp` com rank de status (não regredir) | replay do mesmo `eventId` = 200 `duplicate`; evento antigo não rebaixa status |
| 3.4 | Responder **200 imediatamente** e processar via `job_queue` (`job-worker` já existe) — avaliação de motorista, notificações, Bitrix24 ficam assíncronos | p95 de resposta < 300 ms |
| 3.5 | Anti-replay: janela de 24 h (política de retentativa da Lalamove), não 5 min | retentativa legítima aceita |
| 3.6 | `DRIVER_ASSIGNED`: `drivers` com `lalamove_id`, nome, telefone, placa, foto; `service_type` do pedido (não `MOTORCYCLE`) | driver real criado correto |
| 3.7 | `COMPLETED` → job `fetch-order` para POD/POP + `actual_delivery` | `lalamove_stop_proofs` populada |
| 3.8 | `llm-wh` com `verify_jwt=false` e repasse do corpo **byte a byte** (assinatura depende dele) | evento via `llm-wh` validado |
| 3.9 | Registrar a URL no sandbox e depois em produção (`PATCH /v3/webhook`), após confirmar com o dono qual URL está lá hoje (fluxo n8n de março) | `webhook_events` recebe eventos reais |

### Fase 4 — UAPI com um único dono de token

| # | Entrega | Critério |
| --- | --- | --- |
| 4.1 | Apagar o caminho de proxy externo do `lalamove-token-refresh`; o worker chama `refresh_token` direto na UAPI, grava `access_token`/`refresh_token`/`device_id` em `lalamove_uapi_sessions`, claim anti-corrida mantido | renovação às 20 h grava novo par; alerta só em falha real |
| 4.2 | `lalamove-uapi`: remover a renovação própria (só lê); `device_id` fixo por sessão; `refresh-token` e `bulk-import` com `requireAdmin`; remover ações mortas (`order-detail`, `cancel-*`) | nenhuma ação da UI chama endpoint bloqueado pelo WAF |
| 4.3 | `set-token` inicial: o dono faz login no portal e cola `token` + `raw.refresh_token` na tela `UAPISettingsPage` (admin) — ou `lalamove_token_manager.py` corrigido (B18) rodando num host com Chrome e postando em `set-token` | `token-status` = `hasToken:true`, idade < 1 h |
| 4.4 | Fallback Playwright documentado no runbook (janela perdida → re-login manual) | `docs/RUNBOOK_LALAMOVE.md` atualizado |
| 4.5 | `bulk-import` com cursor persistido (`last_id` em `lalamove_uapi_sessions.metadata`) para importar os 7.740 pedidos históricos sem duplicar | `lalamove_orders` com `source='uapi_import'` ≈ 7.740 |

### Fase 5 — Front consistente

| # | Entrega | Critério |
| --- | --- | --- |
| 5.1 | `src/lib/lalamove-api.ts` passa a chamar `lalamove-api`/`lalamove-uapi` com as ações reais; remover `lalamove-gateway` e `uapi-proxy.ts` (ou reduzir o gateway a telemetria interna) | nenhuma tela depende de `LALAMOVE_*_PROXY_*` |
| 5.2 | `NewOrderDialog`: veículo = 14 serviceTypes BR com disponibilidade por cidade (`/v3/cities` cacheado), SRs filtrados pelo catálogo, `item` só para TRUCK330/UV\_FIORINO/VAN, TTL da cotação visível | cotação sandbox pela UI com SR `LOADING_1DRIVER_MAX030MIN` = 201 |
| 5.3 | `OrderDetailModal`: status cru + mapeado, motorista com guarda `driverId !== ""`, POD/POP, cancelar com regra de 5 min, trocar motorista com 4 motivos | fluxo completo num pedido sandbox |
| 5.4 | `LalamoveSettingsPage`: URL de webhook ativa (de `lalamove_webhook_config`), botão registrar, teste de assinatura | — |
| 5.5 | Remover `LalamoveV3Explorer` ou ligá-lo à edge `lalamove-api` com `requireAdmin` | sem chamada ao proxy inexistente |

### Fase 6 — Bitrix24 (SPA 1690) e n8n sobre o backend único

| # | Entrega | Critério |
| --- | --- | --- |
| 6.1 | Edge `bitrix24-spa-sync` (nova): `crm.item.update`/`crm.timeline.comment.add` no SPA 1690 via webhook de entrada (`BITRIX24_WEBHOOK_TOKEN` secret); mapa status→stage configurável em `bitrix24_stage_mappings`; chamada pelo `job-worker` a cada mudança de status | pedido sandbox move stage no B24 |
| 6.2 | F01/F02 no n8n reescritos como 3 nós: Webhook B24 → HTTP `lalamove-api` (`action: quotation` / `order`, header `Authorization: Bearer <JWT de serviço>`, `metadata.spa_id`) → Respond; mapa `vehicle_id` B24 → serviceType BR num campo de lista do próprio SPA | cotação e pedido pelo B24 sem chave no n8n |
| 6.3 | Campos novos no SPA: `serviceType`, `shareLink`, status Lalamove, motorista (nome/placa/tel), `scheduleAt` | gravados pelo 6.1 |
| 6.4 | Aposentar F03/F04 e os 5 fluxos de março após 1 semana de paralelo (exportar antes; tornar acessíveis ao MCP para auditoria) | nenhum fluxo n8n chama `rest.lalamove.com` |
| 6.5 | Telefones: normalizar para E.164 na edge (`src/lib/phone.ts` já existe; portar para `_shared`) | `551125651422` → `+551125651422`, `1146375517` → `+551146375517` |

### Fase 7 — Operação e observabilidade

| # | Entrega | Critério |
| --- | --- | --- |
| 7.1 | Cron `lalamove-sync-active` (10 min): `GET /v3/orders/{id}` dos ativos há > 15 min sem webhook | pedido com webhook perdido se corrige sozinho |
| 7.2 | Alertas: 502 v3 (auth), `ret=10007`, URL de webhook desativada (sem evento em 6 h com pedido ativo), saldo da carteira < limite configurável | 1 alerta por causa, dedupado 15 min |
| 7.3 | Painel `/lalamove-quota` com `ratelimits-*` reais; `/webhooks` com `eventId`, latência e assinatura | dados reais, não seed |
| 7.4 | Limpar os 50 pedidos e 20 motoristas de seed de produção (ou marcá-los `tags:['seed']` e filtrar) | dashboards sem dado falso |
| 7.5 | Atualizar `docs/LALAMOVE_SCORECARD.md`, `P-12`, `docs/agentes/lalamove-api.md` com o estado real e o novo desenho | docs = código = produção |

### Ordem recomendada e marcos

1. **Marco A (Fases 0–1)**: risco contido, contrato real capturado, banco pronto. Nada visível ao usuário.
2. **Marco B (Fases 2–3)**: cotar → pedir → rastrear → POD **no sandbox**, pela UI. Primeiro pedido real em produção só com `APROVADO` do dono.
3. **Marco C (Fases 4–5)**: carteira, extrato, histórico; front sem proxy fantasma.
4. **Marco D (Fase 6)**: Bitrix24 e n8n sobre o backend único; desligar fluxos antigos.
5. **Marco E (Fase 7)**: reconciliação, alertas e docs verdadeiras.

## 9. Decisões que só o dono pode tomar

1. **Rotação de chaves e repo privado** (Fase 0.1). As chaves `pk/sk_prod_*`, a chave DistanceMatrix e a senha do portal estão em repositório público e em 16 arquivos anexados. Só o dono acessa o Partner Portal para gerar novas.
2. **Qual URL de webhook está registrada hoje na Lalamove** (Partner Portal → Webhook). Se for o fluxo n8n de março, a troca para o Supabase derruba esse fluxo; a Fase 3.9 depende dessa resposta.
3. **Sandbox**: confirmar que as credenciais de sandbox (`55c6c42d…`) ainda são válidas no `partnerportal.sandbox.lalamove.com`. Sem sandbox, o plano só testa com pedidos reais pagos.
4. **Token UAPI inicial** (Fase 4.3): login manual no `web.lalamove.com` por quem tem a conta `11935024030`, ou autorizar rodar o token manager num host com Chrome (VPS/Swarm). A UAPI é API interna não documentada: aceitar que pode quebrar sem aviso.
5. **Fonte da verdade do pedido**: Supabase (recomendado) ou Bitrix24. O plano assume Supabase; se o dono preferir o B24 como mestre, as Fases 5 e 6 invertem (painel só leitura).
6. **Mapa veículo B24 → serviceType BR**: definir quais dos 14 serviços a operação usa (histórico: Carro Hatch 33%, Utilitário 19%, LalaPro 19%, Carro 11%, LalaGo 8%, Van 7%, Carreto 3%) e seus ids no campo `ufCrm276_1764346660`.
7. **Migrations em produção** (Fase 1): DDL só com `APROVADO`.
8. **Dados de seed em produção**: apagar os 50 pedidos/20 motoristas falsos ou mantê-los marcados.
9. **Fluxos n8n de março**: liberar acesso MCP ("Available in MCP" no card de cada workflow) para auditoria antes de desligar.

## 10. Riscos e salvaguardas

| Risco | Probabilidade | Salvaguarda no plano |
| --- | --- | --- |
| Chaves vazadas usadas por terceiros para criar pedidos pagos na conta | alta enquanto não rotacionar | Fase 0.1 primeiro; `verify_jwt=true` em `lalamove-api` (0.2); alerta em 502/auth |
| Formato real do webhook diferente do presumido (slides são imagens) | média | Fase 0.4 captura fixtures reais no sandbox antes de qualquer parser |
| Lalamove desativa a URL após 10 falhas | alta se o handler responder 4xx/5xx | 200 imediato + fila (3.4); monitor "sem evento em 6 h" (7.2) |
| Refresh UAPI de uso único queimado por corrida | alta com dois donos | um único worker (4.1), `requireAdmin` em `refresh-token` (4.2), unique parcial em sessão ativa (1.6) |
| WAF Argus passa a bloquear `refresh_token` ou `order_list_new` | baixa/média | nada crítico depende da UAPI; v3 cobre pedido/rastreio; runbook Playwright (4.4) |
| Pedido criado na Lalamove e não salvo localmente | alta hoje (B5) | enum corrigido (1.1), verificação de erro + alerta CRITICAL com `orderId` (2.3), reconciliação (7.1) |
| Cotação expirada (5 min) entre aprovação no B24 e pedido | alta no fluxo B24 | revalidação/recotação automática (2.3) com preço novo gravado no SPA |
| Dois sistemas escrevendo estado (n8n antigo + Supabase) durante a transição | média | paralelo de 1 semana com o Supabase só lendo; desligamento explícito (6.4) |
| Custo: cada teste de `POST /v3/orders` em produção é cobrado | certa | sandbox obrigatório (2.9); produção só com `APROVADO` |
| Deploy de edge fora de sincronia com o `main` (hoje 3 meses) | certa sem pipeline | workflow de deploy (0.3) + checagem de versão no CI |

## 11. Achados novos (2ª rodada — front, IDs, notificações, fila, ledger)

Leitura de `NewOrderDialog.tsx`, `OrderDetailModal.tsx`, `useRecentOrders.ts`, `useLalamove.ts`, `lalamove-config.ts`, `phone.ts`, `send-notification`, `job-worker`, `_shared/schemas.ts`, `ci.yml`, `package.json`, RLS/índices/triggers e advisors do banco. Numeração continua a tabela da seção 6.

| # | Severidade | Onde | Defeito | Efeito |
| --- | --- | --- | --- | --- |
| B26 | **Bloqueante** | `NewOrderDialog.tsx` `requestQuotation` (\~l.215) | cotação envia `coordinates: { lat: '0', lng: '0' }` para as duas paradas; o `AddressAutocomplete` (Mapbox) existe mas as coordenadas são descartadas | a Lalamove cota "Null Island" ou devolve 422 (provavelmente os 2×422 de 31/08). Nenhuma cotação pela UI pode estar certa |
| B27 | **Bloqueante** | `useRecentOrders.ts:62` + `OrderDetailModal.tsx` (`change-driver`, favoritar/bloquear) | `order.driverId` = `lalamove_orders.driver_id` (UUID da tabela `drivers`), enviado à Lalamove como `driverId` (`DELETE /v3/orders/{id}/drivers/{uuid}`) e à UAPI como `driver_fid` | troca de motorista e frota sempre falham (404). Além disso o `driverId` v3 (numérico) e o `driver_fid` UAPI (8 chars alfanuméricos) são espaços de ID diferentes — o comentário no código diz que são iguais (NÃO VERIFICADO, provável falso) |
| B28 | **Alta** | `lalamove-webhook` `sendNotification` (l.237-250) e Guardian (l.305) vs `_shared/schemas.ts` `sendNotificationV1` | o webhook chama `send-notification` com `alertId, driverId, orderId` (camelCase); o contrato exige `alert_id`, `order_id`, `driver_id` e `severity/title/message` obrigatórios; o aviso ao fornecedor manda `recipient/message` sem `alert_id` | toda notificação originada por webhook é rejeitada com 400 |
| B29 | **Alta** | produção: `alert_configurations` = **0 linhas**; `alerts_sent` = 0; secrets `EVOLUTION_*`, `RESEND_API_KEY`, `SLACK_WEBHOOK_URL` ausentes | `send-notification` sempre termina em "No notification channels configured" | 1.316 alertas gerados, zero entregues a alguém |
| B30 | **Alta** | produção: tabela `job_queue` **não existe**; RPCs `mark_job_completed`/`mark_job_failed` não existem; o ledger registra `20251226000003_create_job_queue` e `20251226010000_create_job_queue_system` como aplicadas | `job-worker`, `useJobQueue` (que lê `bitrix24_sync`/`webhook_events` como pseudo-fila), `JobQueuePage`, `docs/JOB_QUEUE_SYSTEM.md` descrevem algo que não está no banco | a Fase 3.4 do plano (200 imediato + fila) precisa primeiro criar a fila de verdade |
| B31 | **Alta** | ledger `supabase_migrations.schema_migrations`: 164 versões; repo: 153 arquivos; 11 versões só no ledger (ex.: `20260821130000`) e versões "aplicadas" cujo DDL não existe (B30) | ledger ≠ schema ≠ repo | `supabase db reset` local não reproduz a produção; qualquer migration nova parte de premissa falsa |
| B32 | **Alta** | `lalamove-api` ação `order` | `metadata` do pedido (`autoNotifySupplier`, `supplierContact`, `stalledThresholdMinutes`, `requiresPod`) vai para a **Lalamove** e para `lalamove_orders.metadata` jsonb; as colunas `auto_notify_supplier`, `supplier_contact`, `stalled_threshold_minutes`, `requires_pod` ficam nulas; o webhook lê as colunas | "Guardian" (aviso ao fornecedor, POD obrigatório, motorista parado) nunca dispara; telefone do fornecedor é enviado a terceiro |
| B33 | **Média** | `src/lib/phone.ts:46-60` | rejeita telefone fixo (exige 9º dígito) "porque a Lalamove exige celular" — NÃO VERIFICADO; os pedidos reais do histórico usam `1146375517` (fixo da Promo Brindes) como contato | o operador não consegue usar o telefone da empresa como remetente |
| B34 | **Média** | `src/lib/lalamove-config.ts` + `useLalamove.ts` | hooks de carteira/status/cidades só rodam se `localStorage.lalamove_configured === 'true'` | dado some ao trocar de navegador; flag sem fonte no backend |
| B35 | **Média** | `OrderDetailModal.tsx` | `vehicleIcons` com `MOTORCYCLE/MPV/TRUCK175`; lê `order.pod_required`, `order.pod_url`, `order.stalled_threshold_minutes` que o mapeamento de `useRecentOrders` não fornece; botão "Contatar via WhatsApp" só mostra toast; `confirm()` nativo | seção Guardian nunca renderiza; ação morta na UI |
| B36 | **Média** | `lalamove-webhook` `DRIVER_ASSIGNED` | chama `evaluate-driver` e `send-notification` **antes** de responder; `lalamove-webhook` roda sem fila | latência > 1 s por evento; risco de desativação da URL após 10 falhas |
| B37 | **Média** | advisors Supabase | 1 ERROR `security_definer_view` (`cache_status`, criada ontem na PR #106); 46 WARN funções SECURITY DEFINER executáveis por `authenticated` + 3 por `anon`; 3 MVs expostas na API; proteção contra senha vazada desligada; 194 WARN `auth_rls_initplan` (`has_role(auth.uid())` sem `(select ...)`), 60 `multiple_permissive_policies`, 114 índices nunca usados, 3 duplicados, 10 tabelas sem PK | superfície e custo de RLS maiores que o necessário |
| B38 | **Média** | `lalamove_stops` | sem unique `(order_id, stop_index)`; `pod_status` indexado com `<> 'NOT_REQUIRED'` mas o webhook grava minúsculas (`'delivered'`) | upsert de POD por parada pode duplicar; índice inútil |
| B39 | **Média** | `package.json` | `pg`, `@types/pg`, `jsdom`, `vitest`, `@testing-library/*` em `dependencies`; `xlsx` via tarball CDN (0.20.3, sem patch de segurança por npm); `zod ^4` no front e `zod 3.22` nas edges; `react-is ^19` com React 18; `supabase-js` pinado em 2.39.3 em 5 edges e 2.49.1 em outras | build mais pesado, vulnerabilidade conhecida, contratos divergentes |
| B40 | **Média** | `.github/workflows/ci.yml` | job `deploy` = `echo`; `npm audit --audit-level=critical` ignora high; E2E roda contra a **produção** (secrets `VITE_SUPABASE_*` do repo); `edge-integration-tests` também; nenhum `deno check`/`deno lint` das edges; sem typecheck das 24 funções | edge com erro de tipo passa no CI; teste pode escrever em produção |
| B41 | **Média** | `send-notification` `sendEmail` | `message`/`title` interpolados em HTML sem escape | HTML/script injetado por quem controla o texto do alerta (ex.: `remarks` de um pedido) |
| B42 | **Baixa** | `lalamove_orders` | `scheduled_at` é NOT NULL (mapeado como `new Date(order.scheduled_at)`), mas o pedido imediato não tem `scheduleAt` | insert precisa inventar data; `vehicle_type` enum (4 valores) vs 14 serviços |
| B43 | **Baixa** | `useRecentOrders` | `refetchInterval: 30000` + `useOrderGet` 10 s + `useDriverLocation` 10 s | com 20 pedidos abertos, \~180 chamadas/min à edge/Lalamove; rate limit `getorder` desconhecido |
| B44 | **Baixa** | trigger `on_order_status_change_sync_bitrix24` | enfileira em `bitrix24_sync` só quando `bitrix24_deal_id` existe (modelo de deals) | nunca dispara no fluxo SPA 1690 |
| B45 | **Baixa** | usuários | 3 usuários, todos `admin`; nenhum `operator`/`manager`/`viewer` | RBAC de 4 papéis nunca exercitado; policies `operator` nunca testadas |

### O que está bem feito e deve ser preservado

- `src/lib/lalamoveCatalog.ts` + `lalamoveValidation.ts` + `lalamoveOrderEdit.ts` + `lalamoveTimeline.ts` + `lalamoveReasons.ts`: regra de negócio pura, testada, alinhada à errata BR. Vira o módulo compartilhado das edges.
- `NewOrderDialog`: fluxo em 2 passos com TTL, revalidação e detecção de mudança de preço, guarda de duplo clique, contatos reutilizáveis.
- `lalamove-api`: HMAC, retry com `Retry-After`, `Request-ID` estável por tentativa lógica, teto e histórico de priority fee.
- `lalamove-webhook`: idempotência com índice unique, rank de status, `ORDER_REPLACED` idempotente, fail-closed (no repo).
- Banco: RLS em 100% das tabelas por papel, `alert_dedup` + `claim_alert_notification`, partição mensal de `tracking_events`, `idx_uapi_sessions_active` unique parcial (o item 1.6 do plano já existe).
- Processo: `AGENTS.md`/`docs/agentes` com regras claras, guards de CI (`check-agents-md-integrity`, `commit-msg-lint`, ratchets de lint/typecheck), testes de contrato Deno.

## 12. Matriz de melhorias pré-produção por camada

Tudo o que vale mudar antes do primeiro pedido real, além dos bugs das seções 6 e 11. Prioridade: **P0** sem isso não entra em produção · **P1** na primeira semana · **P2** depois de estabilizar. Cada linha é uma PR.

### 12.1 Segurança e segredos

| P | Melhoria | Onde | Ganho |
| --- | --- | --- | --- |
| P0 | Rotacionar `pk/sk_prod`, DistanceMatrix, senha do portal; repo privado; purgar histórico com `git filter-repo` ou aceitar a rotação como suficiente | Partner Portal, GitHub, raiz do repo | chaves comprometidas inutilizadas |
| P0 | `verify_jwt=true` deployado em `lalamove-api`, `send-notification`, `route-analyzer`, `get-mapbox-token`, `simulate-driver-movement`; `requireAdmin` em `refresh-token`, `bulk-import`, `set-webhook`, `sync`, `fetch-orders-bulk` | `supabase/config.toml`, edges | só admin executa ações pagas ou destrutivas |
| P0 | `ALLOWED_ORIGINS` = domínio Vercel + preview (hoje `*` em 20 edges) | secrets | CORS fechado |
| P1 | Ligar "Leaked password protection" no Auth; revisar 46 funções SECURITY DEFINER com EXECUTE para `authenticated` (manter só as RPCs de login/lockout) e 3 para `anon` | painel Auth, migration de `REVOKE EXECUTE` | advisors sem ERROR/WARN de segurança |
| P1 | Tirar `cache_status` de SECURITY DEFINER (ou `security_invoker = true`) e as 3 MVs do schema exposto (`revoke select ... from anon, authenticated` + função de leitura) | migration | fecha o ERROR do advisor criado na PR #106 |
| P1 | Escapar HTML em `send-notification` (`sendEmail`) e sanitizar `remarks`/`title` em todos os canais | `send-notification/index.ts` | sem injeção via texto de pedido |
| P1 | `x-request-id` do cliente limitado a UUID (hoje qualquer string vai para `query_telemetry`) | `lalamove-gateway` / `lalamove-api` | sem lixo em telemetria |
| P2 | Secret scanning + push protection no GitHub (hoje `disabled`); Dependabot security updates ligado | settings do repo | regressão de segredo bloqueada no push |

### 12.2 Banco de dados

| P | Melhoria | Detalhe |
| --- | --- | --- |
| P0 | **Reconciliar ledger × schema × repo**: `supabase db diff` contra produção, listar as 11 versões só no ledger e as versões "aplicadas" sem DDL (`job_queue`), gerar uma migration de baseline e congelar | sem isso toda migration é chute |
| P0 | Fase 1 do plano (enum, `service_type`, `stop_id`, POP, `webhook_config`, `bitrix24_spa_sync`) + criar `job_queue` de verdade (ou adotar `pgmq`, que o Supabase oferece pronto) | base da máquina de estados |
| P1 | `auth_rls_initplan`: reescrever as 194 policies para `(select has_role((select auth.uid()), 'admin'))`; unificar as 60 duplas de policies permissivas por comando | RLS 5–20× mais barata em tabelas grandes (`tracking_events`, `alerts`) |
| P1 | Dropar 3 índices duplicados e revisar os 114 nunca usados (`idx_orders_status` é redundante com `idx_lalamove_orders_status_created`, etc.); criar os que faltam: `lalamove_orders(spa_id)`, `lalamove_stops(order_id, stop_index) unique`, `webhook_events(event_id) unique` | escrita mais barata, buscas do webhook O(1) |
| P1 | PK nas 10 tabelas sem PK (advisor) | replicação/realtime e upserts seguros |
| P1 | `lalamove_orders.scheduled_at` nullable + `schedule_at` da Lalamove separado de `created_at`; `vehicle_type` derivado de `service_type` por view | modelo reflete a API |
| P1 | Retenção: `alerts` (1.316 linhas, 98% ruído do worker) e `webhook_events` com job de limpeza por idade; `cleanup_old_audit_logs` já agendado — conferir que roda sem erro (`cron_job_logs`) | tabelas não crescem sem controle |
| P2 | `lalamove_orders` particionada por mês quando passar de \~500 k linhas (histórico UAPI importado = 7.740; crescimento \~500/mês) | não urgente; registrar como ADR |

### 12.3 Edge functions

| P | Melhoria | Detalhe |
| --- | --- | --- |
| P0 | Módulo `_shared/lalamove/` com: catálogo BR (gerado de `src/lib/lalamoveCatalog.ts`), mapa de status v3 → enum, normalização E.164, cliente HMAC, parser de webhook oficial, tipos | uma única fonte para `lalamove-api`, `lalamove-webhook`, `lalamove-token-refresh`, `check-external-api` |
| P0 | `lalamove-api`: verificar **todo** erro de escrita no banco (hoje `insert`/`update` sem checar `error`) e devolver 500 com `orderId` + alerta CRITICAL quando a Lalamove aceitou e o banco não | nunca mais pedido pago sem registro |
| P0 | Geocodificação no servidor: ação `quotation` aceita endereço sem coordenadas e geocodifica (Mapbox via `mapbox-proxy`, que já existe, ou DistanceMatrix) com cache em `region_cache` | cotação correta pela UI e pelo n8n |
| P1 | `lalamove-webhook` em duas etapas: receber → validar assinatura → gravar `webhook_events` → 200; processar via `job_queue`/`pgmq` + `job-worker` com retry e DLQ | resposta < 300 ms; falha de processamento não perde evento |
| P1 | Unificar runtime: `Deno.serve`, `npm:@supabase/supabase-js@2` (hoje 2.39.3/2.49.1/esm.sh), `zod` único, `std` único; `deno.json` com `imports` | menos superfície, bundles menores, CI consegue `deno check` |
| P1 | `check-external-api` passa a testar v3 (`GET /v3/cities` com HMAC real) e UAPI (`get_user_info`) e a gravar em `system_health` | `/system-health` mostra o estado real da Lalamove |
| P1 | `lalamove-gateway`: ou remover, ou virar apenas BFF interno (telemetria, rate limit, alerta de auth) na frente de `lalamove-api`/`lalamove-uapi`, sem proxy externo | sem secrets fantasma |
| P2 | `simulate-driver-movement`, `seed-fix-rls`, `apply-fixes`, `test-notification`: desligar em produção ou exigir admin + flag `ENVIRONMENT != production` | edges de desenvolvimento fora do ar |

### 12.4 Front (React)

| P | Melhoria | Detalhe |
| --- | --- | --- |
| P0 | `NewOrderDialog`: usar as coordenadas do `AddressAutocomplete`/CEP (ou delegar à edge); mostrar serviços disponíveis na cidade da coleta; bloquear SR restrito a SP fora de SP | cotação válida |
| P0 | `Order` (tipo) ganha `driverLalamoveId`, `driverFid`, `lalamoveStatus`, `serviceType`, `quotationExpiresAt`, `requiresPod`, `podReceived`, `supplierContact`, `stalledThresholdMinutes`; `useRecentOrders` mapeia `drivers.lalamove_id` | ações de motorista com o ID certo; Guardian renderiza |
| P1 | Remover `lalamove-config.ts` (flag em localStorage) — habilitar hooks por `system_health`/`check-external-api` | estado vem do backend |
| P1 | Telefone: aceitar fixo (10 dígitos) até a Lalamove recusar de fato; manter E.164 | operador usa o fixo da empresa |
| P1 | Polling: `useOrderGet`/`useDriverLocation` só com modal aberto e pedido ativo; `useRecentOrders` via Realtime (`lalamove_orders` já está na publicação?) em vez de 30 s | \~10× menos chamadas |
| P1 | `OrderDetailModal`: ícones pelos 14 serviços; botão WhatsApp real (`wa.me/<E.164>`); `AlertDialog` em vez de `confirm()`; esconder favoritar/bloquear até existir mapeamento `driverId → driver_fid` | UI sem ações mortas |
| P1 | `package.json`: mover `pg`, `jsdom`, `vitest`, `@testing-library/*`, `@types/*` para `devDependencies`; trocar `xlsx` por `exceljs` ou `xlsx` do npm com patch; alinhar `react-is` 18 | bundle e auditoria limpos |
| P2 | `LalamoveV3Explorer`, `UAPISettingsPage`, `LalamoveSettingsPage`: apontar para as edges reais ou remover; uma única tela de "Conexão Lalamove" (chaves ok?, webhook registrado?, token UAPI idade, último evento) | operador vê a saúde num lugar |
| P2 | i18n: `pt-BR` é o único idioma usado; `en`/`es` (54 páginas) custam manutenção — congelar | menos churn |

### 12.5 n8n e Bitrix24

| P | Melhoria | Detalhe |
| --- | --- | --- |
| P0 | Tornar os 5 fluxos de março acessíveis ao MCP, exportar e auditar (qual URL de webhook, que chaves, que campos do SPA) antes de qualquer troca | evita derrubar o que a equipe usa hoje |
| P0 | Chaves fora dos Code nodes: credencial "Header Auth" do n8n com JWT de serviço do Supabase; nenhum `sk_prod` | segredo só no Supabase |
| P1 | F01/F02 como chamadas finas à `lalamove-api` (seção 7.4); mapa `ufCrm276_1764346660` → serviceType BR mantido em `bitrix24_stage_mappings`/tabela de de-para, não em código | um único lugar conhece a Lalamove |
| P1 | Campos novos no SPA 1690 (`serviceType`, `shareLink`, status Lalamove, motorista, `scheduleAt`) e automação de PREPARATION → cotação com retry se a cotação expirar antes de APPROVAL | operador vê tudo no card |
| P2 | `Agrupar Pedidos Lalamove - Bitrix24` (0 execuções): decidir se vira multi-stop na v3 (`stops[]` até 17 paradas testadas, `isRouteOptimized`) ou é descartado | consolidação de entregas = economia real |

### 12.6 CI/CD e ambientes

| P | Melhoria | Detalhe |
| --- | --- | --- |
| P0 | Workflow de deploy de edges (`supabase functions deploy <fn>` por diff de pasta) + `supabase db push` gated por `APROVADO` (environment protegido do GitHub) | `main` = produção de verdade |
| P0 | Ambiente de **staging**: projeto Supabase separado ou branch do Supabase (`supabase branches`), com `LALAMOVE_BASE_URL` sandbox e webhook sandbox; E2E e `edge-integration-tests` apontam para ele, nunca para produção | testes não escrevem em produção |
| P1 | CI: `deno check` + `deno lint` de `supabase/functions/**`; `npm audit --audit-level=high`; job `deploy` real ou removido | edge com erro de tipo não chega ao `main` |
| P1 | Branch protection em `main` com `contract-tests` e `lint-and-typecheck` obrigatórios (hoje nenhum) | CI vermelha não entra |
| P2 | Vercel: confirmar `VITE_SUPABASE_*` por ambiente (preview → staging) e `ignore-build.sh` | preview não aponta para produção |

### 12.7 Observabilidade e operação

| P | Melhoria | Detalhe |
| --- | --- | --- |
| P0 | `alert_configurations` com ao menos um canal real (WhatsApp Evolution já existe na Promo Brindes, ou e-mail) para `INTEGRATION_FAILURE`, `ORDER_CANCELLED`, `POD_FAILED`, `WALLET_LOW_BALANCE` | alerta chega em alguém |
| P0 | Cron `lalamove-sync-active` (10 min) e monitor "pedido ativo sem evento há > 1 h" | webhook perdido não trava a operação |
| P1 | `lalamove-token-refresh`: só alertar uma vez por estado (hoje 1 alerta/hora com dedup de 1 h) e silenciar quando a UAPI estiver desligada por decisão | fim do ruído |
| P1 | Painel único de integração: último evento, fila, quota (`ratelimits-*`), idade do token, saldo da carteira, erros por `ERR_*` | operação vê o que importa |
| P1 | Logs estruturados com `request_id` ponta a ponta (front → edge → Lalamove `Request-ID`) e retenção 30 dias | suporte à Lalamove com ID |
| P2 | Sentry (MCP já configurado na conta) nas edges e no front | erro de runtime com stack |

### 12.8 Documentação e processo

| P | Melhoria | Detalhe |
| --- | --- | --- |
| P0 | Substituir `docs/LALAMOVE_SCORECARD.md` e `pendencias/P-12` por este documento como fonte de verdade; marcar `README`, `DEPLOYMENT.md`, `JOB_QUEUE_SYSTEM.md`, `QUEUE_SYSTEM.md`, `CACHE_SYSTEM.md` como "não reflete produção" até revisão | agentes param de herdar premissa falsa |
| P1 | Regra em `AGENTS.md`: "pronto" exige evidência de produção (linha no banco, evento recebido), nunca só teste unitário; scorecards proibidos sem query | corrige a causa do P-12 |
| P1 | Apagar da raiz os `lalamove_*.json/md/html/docx/pdf` (mover para `docs/lalamove/` redigidos) | repo limpo, sem segredo |
| P2 | ADR 003: "Supabase é a fonte de verdade de pedidos; n8n/B24 são clientes"; ADR 004: "v3 escreve, UAPI lê" | decisões registradas |

## 13. Pilar UAPI — emulação da sessão logada do portal (`br-uapi.lalamove.com`)

Decisão do dono (21/11): a UAPI é usada **como sistema logado completo**, não só para leitura. Isso substitui a Fase 4 da seção 8 e muda o princípio "v3 escreve, UAPI lê" para: **v3 é o caminho contratual de pedido; a UAPI é o caminho operacional do portal** (tudo que a equipe faz hoje em `web.lalamove.com` passa a ser automatizável).

### 13.1 Por que a UAPI importa (o que a v3 não dá)

| Capacidade | v3 | UAPI | Métodos |
| --- | --- | --- | --- |
| Histórico completo da conta (7.740 pedidos desde set/2024) | não | sim | `order_list_new` (cursor `last_id`), `order_search` |
| Carteira corporativa, saldo, extrato, top-up, pós-pago | não | sim | `wallet_balance`, `wallet_flow_list`, `get_postpaid_wallet*`, `charge&_a=charge_list`, `contract&_a=*` |
| Comprovantes PDF e extratos contábeis | não | sim | `download_pdf_receipt`, `send_email_receipt`, `generate_statement_token`, `get_statement_report_by_token` |
| Cupons | não | sim | `coupon_list_web`, `coupon_exchange_web` |
| Frota: favoritos/bloqueados, avaliação, gorjeta pós-corrida | não | sim | `get_fleet`, `fleet_add/del_favorite_web`, `fleet_add/del_ban`, `user_rating`, `add_tips` |
| Equipe enterprise (3 admins hoje), permissões, notificações | não | sim | `get_staffs`, `add_invite_member`, `update_staff`, `update_notification_settings` |
| BI da conta (dashboard enterprise) | não | sim | `get_analytics_dashboard`, `get_analytics_dashboard_filters` |
| Preço com cupom/plano (REGULAR, SAVER, PRIORITY) e veto de rota (`get_service_area`) | parcial | sim | `price_calculate`, `city_info`, `vehicle_list`, `get_service_area` |
| Pedido com opções do portal (favoritos primeiro, pagamento, agendamento next-day, bulk) | parcial | sim | `order_request`, `next_day_order_*`, `*_same_day_bulk_order_*` |
| Edição de paradas pós-match, troca de motorista com motivos do portal, cancelamento com taxa | parcial | sim | `order_edit`, `order_edit_eligibility`, `change_driver_web`, `order_cancel`, `order_cancellation_eligibility`, `get_cancel_reason_new` |
| Status em tempo real com ETA e motorista (`driver_fid`, foto, placa, avaliação) | parcial | sim | `order_status`, `order_time_status`, `order_detail` |
| POD com feedback e seguro | parcial | sim | `pod_img_feedback_create`, `insurance_form_link` |

### 13.2 O obstáculo: WAF Argus

A UAPI tem duas classes de método (auditoria 08/03 + supl. 09/03):

- **Livres com token** (chamada direta via HTTP com os headers anti-WAF): `get_user_info`, `get_corporate`, `get_staffs`, `wallet_balance`, `wallet_flow_list`, `order_list_new`, `city_info`, `search_history_list`, `get_laster_order`, `get_bill_unpay_order`, `get_e_commerce_store_integrations`, `refresh_token` (confirmados `ret=0`); cupons, frota, `user_rating`, comprovantes (prováveis, não testados).
- **Protegidos pelo Argus** (`ret=10010` fora de browser real): `login_by_pwd`, `price_calculate`, `order_request`, `order_detail` (`ret=10002`), `order_cancel`, `order_edit`; `order_repeat_list` devolve 501 do container.

O Argus roda no bundle do portal e injeta assinatura por requisição. O front do repo já previa isso: `lalamove.updateUapiToken(token, xSignJs, xFingerprint)` em `src/lib/lalamove-api.ts` envia `x_sign_js` e `x_fingerprint` — ou seja, o proxy externo (hoje inexistente) capturava do browser os headers de assinatura e os replayava. **NÃO VERIFICADO** quanto tempo essa assinatura vale nem se é por rota; isso é a primeira coisa a medir.

### 13.2b Medição do Argus (PoC 21/11, pré-login, Chromium+Playwright)

Abrindo `web.lalamove.com` sem autenticar, capturando o tráfego para `br-uapi.lalamove.com`:

- O Argus injeta **3 headers por requisição**, não 2: `x-sign-js` (\~44 chars base64), `x-javascript-fingerprinting` (\~180+ chars) e `x-h5-sdkversion: 4000`. O código do repo (`updateUapiToken(token, xSignJs, xFingerprint)`) previa dois; o terceiro faltava.
- Aparecem em **toda** chamada, inclusive leitura (`country_list`, `city_info`) — assinatura é por request, gerada pelo SDK no browser. Replay por `fetch` externo exige capturar os 3 a cada chamada; na prática, o worker executa `page.evaluate(fetch(...))` **dentro da origem logada** e deixa o SDK assinar (não há como gerar fora do browser).
- **O portal está em `version 5.79.1` / `revision 57901`** — a documentação e as edges (`APP_VERSION='5.37.0'`, `APP_REVISION='53700'`) estão defasadas (bug B46): o worker deve ler `version`/`revision` do bundle em runtime.
- `device_id` = UUID v4 em `localStorage.og0`; geo-IP abre em México (`hcountry=60000`) — seleção de Brasil (`hcountry=20000`, `+55`) é obrigatória antes de tudo.
- **A etapa de login com usuário/senha não roda nesta sessão** (automação de autenticação em portal de terceiro). Roda na infra da Promo Brindes — o `lalamove_login_v6.js` já faz, e o worker herda. Falta medir (no ambiente do dono): validade da assinatura, se depende de rota/corpo, e se `price_calculate`/`order_request`/`order_detail` passam por `page.evaluate` sem modo UI.

### 13.3 Arquitetura: UAPI Session Worker (a "API que emula o sistema logado")

Um serviço próprio, na infra self-hosted da Promo Brindes (Swarm/Traefik), que **é** o portal logado:

1. **Browser persistente**: container `lalamove-uapi-worker` (Node 22 + Playwright + Chromium headless), um `BrowserContext` com `storageState` persistido em volume (cookies, `localStorage.og0` = `device_id`, estado do Argus). Login automático com `11935024030` + senha via secret, seletor BR (+55) — o `lalamove_login_v6.js` já resolve isso.
2. **Executor de métodos**: `POST /uapi/{method}` `{args, city_id?, is_ep?}` → `page.evaluate(fetch(...))` **dentro da origem `web.lalamove.com`**, usando o mesmo cliente HTTP do bundle (ou interceptando `window.fetch` para injetar `token`, `_su`, `_t`, `device_id` e deixar o SDK assinar). Resposta `{ret, msg, data}` crua + `x-request-id`.
3. **Modo UI** (fallback): para métodos cuja assinatura não for reproduzível por `fetch`, o worker executa a ação pela interface (preencher cotação, confirmar pedido) e captura a resposta de rede — mais lento (\~15 s) mas sempre válido.
4. **Dono único do token**: o worker renova (`refresh_token` às 20 h, uso único) e re-loga quando a janela passa; espelha `token`, `raw.refresh_token`, `device_id`, `user_fid`, `expires_at` em `lalamove_uapi_sessions` via `set-token` (admin). `lalamove-token-refresh` e a renovação interna do `lalamove-uapi` são removidos.
5. **Segurança**: só acessível pela rede interna/Traefik com `UAPI_WORKER_KEY`; allowlist de métodos; `order_request`/`order_cancel`/`add_tips`/`coupon_exchange_web` exigem flag `confirm: true` e ficam auditados em `lalamove_uapi_calls` (método, args redigidos, `ret`, latência, quem chamou).
6. **Consumidores**: edge `lalamove-uapi` (reescrita como cliente fino: métodos livres por HTTP direto, métodos protegidos pelo worker), n8n (fluxos de março migram para o worker) e o painel.

```
Painel / n8n / Bitrix24
        │
        ▼
Supabase edge lalamove-uapi  ── métodos livres ──► br-uapi.lalamove.com (token + headers anti-WAF)
        │
        └── métodos Argus ──► UAPI Session Worker (Chromium logado) ──► web.lalamove.com ──► br-uapi
                               │
                               └── espelha token/refresh em lalamove_uapi_sessions
```

### 13.4 Fase 4 revisada — entregas

| # | Entrega | Critério de aceite |
| --- | --- | --- |
| 4.1 | **Prova de conceito da assinatura Argus** (1 dia): com o Playwright MCP ou o worker em dev, logar, capturar os headers de `price_calculate`/`order_detail` e medir: nome exato dos headers, validade, se dependem da rota/corpo | tabela "método × precisa de browser?" validada com `ret=0` real |
| 4.2 | Worker v1 (Docker, volume de sessão, `/health`, `/session`, `/uapi/{method}`, login/refresh automáticos, allowlist, auditoria) publicado no Swarm atrás do Traefik com chave | `GET /session` = `{logged: true, token_age_h < 20}`; `POST /uapi/get_user_info` = `ret 0` |
| 4.3 | `lalamove-uapi` reescrita: cliente fino + roteamento livre/Argus + `requireAdmin` em escrita; remover ações mortas | `order-detail` e `cancel-eligibility` voltam a funcionar via worker |
| 4.4 | Importação do histórico (7.740) com cursor persistido; `source='uapi_import'`; mapeamento de `order_vehicle_id` → `service_type` (120767 Carro, 121120 Carro Hatch, 666 Utilitário, LalaPro/LalaGo/Van/Carreto a confirmar em `city_info`) | `lalamove_orders` com histórico real; relatórios por veículo batem com `lalamove_order_history_full.md` (R$ 536.358,03; 86,2% concluídos) |
| 4.5 | Financeiro: saldo + extrato + comprovante PDF + alerta de saldo baixo (hoje R$ 2.574,80) e de top-up | tela `/lalamove-operations` com dados reais |
| 4.6 | Frota e avaliação: favoritar/bloquear com `driver_fid` real (vindo de `order_detail`/`order_status`, não do `driverId` v3), `user_rating` após COMPLETED | ação no modal reflete no portal |
| 4.7 | Cotação comparativa: `price_calculate` (REGULAR/SAVER/PRIORITY + cupom) ao lado da v3 antes de confirmar | operador escolhe o plano mais barato |
| 4.8 | Runbook do worker: janela perdida, mudança de bundle (`version 5.37.0`/`revision 53700` precisam acompanhar o portal), hCaptcha no login, bloqueio de conta | `docs/RUNBOOK_LALAMOVE.md` |

### 13.5 Riscos específicos da UAPI

| Risco | Mitigação |
| --- | --- |
| API interna sem contrato: o portal muda `version`/`revision`/campos sem aviso | worker lê `version` do bundle em runtime; testes de contrato diários (`get_user_info`, `order_list_new` página 1) com alerta |
| Argus passa a exigir fingerprint mais forte / hCaptcha no login (`enableLoginHCaptcha`) | modo UI + sessão persistente (login raro); alerta CRITICAL e fallback manual |
| Conta enterprise bloqueada por automação (ToS do portal) | volume baixo (< 1 req/s), `device_id` estável, UA real, horário comercial; escrita só por ação humana |
| Token de uso único queimado por dois processos | um único dono (worker); `lalamove_uapi_sessions` é espelho somente leitura para o resto |
| Pedido criado pela UAPI não chega pelo webhook v3? | **verificar** (4.1): se `order_request` não gera eventos v3, o rastreio desses pedidos vem de `order_status` por polling no worker |

## 14. Checklist de go-live

Cada item é verificável por query, request ou log — nada se marca por leitura de código. Ordem = dependência.

### Segurança e base

- [ ] Chaves v3, DistanceMatrix e senha do portal rotacionadas; `git grep sk_prod` = 0; repo privado; secret scanning ligado
- [ ] Management API lista `verify_jwt` igual ao `config.toml` para as 24 edges; `POST lalamove-api` sem JWT = 401
- [ ] Workflow de deploy de edges rodou e a versão de cada função no ar = `main`
- [ ] Ledger × schema × repo reconciliados; `supabase db reset` local reproduz a produção; `job_queue` (ou `pgmq`) existe
- [ ] Advisors: 0 ERROR; `cache_status` sem SECURITY DEFINER; leaked-password protection ligada
- [ ] Staging (projeto/branch Supabase + sandbox Lalamove) configurado; E2E e integração apontam para ele

### v3 (cotar → pedir → rastrear)

- [ ] Cotação pela UI com endereço real retorna 201 com coordenadas geocodificadas (não `0,0`) e SR `LOADING_1DRIVER_MAX030MIN` aceito
- [ ] Pedido sandbox criado → linha em `lalamove_orders` com `lalamove_id`, `status`, `service_type`, `share_link`, 2 linhas em `lalamove_stops` com `stop_id`
- [ ] Falha forçada de INSERT (enum inválido) gera alerta CRITICAL com `orderId` em vez de silêncio
- [ ] Webhook sandbox: `ORDER_STATUS_CHANGED` para cada status, `DRIVER_ASSIGNED`, `POD_STATUS_CHANGED` recebidos, assinatura validada pelo formato oficial, `webhook_events.event_id` único, resposta p95 < 300 ms
- [ ] Evento repetido = `duplicate`; evento antigo não rebaixa status; retentativa com 2 h de idade aceita
- [ ] `DRIVER_ASSIGNED` cria `drivers` com `lalamove_id` numérico; troca de motorista usa esse ID (não UUID) e retorna 204
- [ ] Cancelamento em `ASSIGNING_DRIVER` = 204 e `status CANCELLED`; após 5 min de `ON_GOING` a UI bloqueia antes de chamar
- [ ] `COMPLETED` popula `lalamove_stop_proofs` com POD e POP; modal mostra as fotos
- [ ] Cron `lalamove-sync-active` corrige um pedido cujo webhook foi suprimido de propósito
- [ ] URL de webhook de produção registrada (`PATCH /v3/webhook`) e gravada em `lalamove_webhook_config`; URL antiga do n8n confirmada e desligada

### UAPI (sessão logada)

- [ ] Prova de conceito do Argus concluída: tabela método × precisa-de-browser com `ret=0` real para `price_calculate`, `order_detail`, `order_cancellation_eligibility`
- [ ] Worker no Swarm: `/session` = logado, token < 20 h, `device_id` estável; renovação às 20 h grava novo par em `lalamove_uapi_sessions` (uma única linha ativa)
- [ ] Zero alertas "Nenhuma sessão UAPI ativa" em 48 h; `lalamove-token-refresh` removido do cron
- [ ] Histórico importado: `count(*) where source='uapi_import'` ≈ 7.740; soma de `total_cost` dos COMPLETED ≈ R$ 536.358,03
- [ ] Saldo da carteira na tela = valor do portal; comprovante PDF baixa
- [ ] Favoritar/bloquear usa `driver_fid` real e reflete em `get_fleet`

### Notificações, Bitrix24, n8n

- [ ] `alert_configurations` com canal real; `alerts_sent` registra entrega de um alerta de teste; contrato `send-notification` casado com o webhook (`alert_id` etc.)
- [ ] Pedido criado pelo Bitrix24 (PREPARATION → cotação → APPROVAL → pedido) chega em `lalamove_orders` com `spa_id` e o SPA recebe `orderId`, `shareLink`, stage e, no fim, fotos na timeline
- [ ] Nenhum Code node do n8n contém `sk_prod`/`pk_prod`; fluxos de março exportados e desativados após 1 semana em paralelo

### Operação

- [ ] Usuários com papéis reais (`operator`, `manager`, `viewer`) criados e RBAC testado em cada tela Lalamove
- [ ] Dados de seed removidos ou marcados; dashboards só com dados reais
- [ ] Runbook atualizado (token UAPI, webhook desativado, 502 de auth, WAF) e testado por uma pessoa que não escreveu o código
- [ ] `docs/LALAMOVE_SCORECARD.md` e `P-12` substituídos por este documento
- [ ] **Primeiro pedido real em produção** com `APROVADO` do dono, acompanhado ao vivo (webhook, POD, Bitrix24) e registrado como evidência

### Sources

- [Lalamove Developers — API v3](https://developers.lalamove.com/) (endpoints, eventos, status, Change Driver, Cancel)
- [Tutorial on Lalamove Webhook v1.5 (PDF)](https://developers.lalamove.com/files/v3_Webhook_v1.5.pdf) (eventos, retentativas, 200 obrigatório)
- [Referência de assinatura do webhook (jsfiddle)](https://jsfiddle.net/qecvaxwd/) (raw string e HMAC sobre `data`)
- Repositório [adm01-debug/Lalamove\_V2](https://github.com/adm01-debug/Lalamove_V2) @ `18c9d83`
- Supabase `iecgydonctmabiijadsf` (Management API: funções, secrets, SQL somente leitura, 21/11/2026)
- n8n `n8n.atomicabr.com.br` (lista de workflows via MCP)
- Anexos: `lalamove_documentacao_completa.md` (08/03/2026), `lalamove_api_docs_v3.md` (03/03/2026), `lalamove_suplemento_v2.md` (09/03/2026), `lalamove_order_history_full.md`, `lalamove_token_manager.py`, `lalamove_f00–f04.json`, `lalamove_bundle_import.json`, `lalamove_cron_setup.sh`, `lalamove_setup_guide.html`, credenciais (`Credencias_-_Lalamove.txt`, `Credenciais_-_Lalamove_-_API_-_Turbo.txt`). Os `.docx`/`.pdf`/`.html` são cópias dos `.md`; o `order_history_full.json` (20 MB) não foi lido — o `.md` traz o resumo.
