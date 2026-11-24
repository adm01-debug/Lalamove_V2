# Plano Mensageria aos Motoristas — Zapp Web V2 (WhatsApp) + SMS × Lalamove V2 — 150 etapas (22/11/2026)

Base verificada: repo `adm01-debug/Lalamove_V2` @ `83fe5ba`, repo `adm01-debug/Zapp_Web_V2` @ `main` (22/11/2026),
banco Lalamove `iecgydonctmabiijadsf` e banco Zapp `tnnnlkbymytvtqngbbqh` (leitura).

**Objetivo de negócio:** o Lalamove V2 conversa com o motorista de aplicativo durante todo o ciclo do pedido
(atribuição → coleta → entrega → comprovante) pelo **WhatsApp oficial da Promo Brindes via Zapp Web V2**, com
**SMS como contingência** (e como canal principal em evento crítico), e toda resposta do motorista volta para
o pedido e para a fila de atendimento humano no Zapp. O mesmo transporte serve fornecedor (coleta), cliente
(entrega) e equipe interna — o plano do Google Maps (etapas 55–70) já consome este canal.

**Fora de escopo:** ingestão da posição do motorista (UAPI — outro chat) e camada de mapas (planos Google/Mapbox).

Legenda: **[L]** = repo Lalamove_V2 · **[Z]** = repo Zapp_Web_V2 · **[D]** = decisão/ação do dono ·
🔒 = PR fica aberta para o dono (DDL em produção, segredo, CI, custo) · cada etapa tem checklist e **Evidência**
(o que prova que está pronta). Ao concluir uma etapa, marque `[x]` na mesma PR que a entregou.

---

## 1. Estado real em 22/11/2026 (o ponto de partida)

| # | Achado | Evidência |
|---|---|---|
| A1 | O Lalamove **já escolhe o Zapp como canal preferencial** de WhatsApp quando `ZAPP_API_URL`/`ZAPP_API_KEY` existem; senão cai no Evolution direto | `supabase/functions/send-notification/index.ts:680` (`zappChannelFromEnv()`) |
| A2 | O cliente Zapp do Lalamove chama `POST {ZAPP_API_URL}/messages/send-text` e `/messages/send-media` com `Authorization: Bearer` | `supabase/functions/_shared/channels/zapp.ts:67` e `:118` |
| A3 | **Esse endpoint não existe no Zapp.** Nenhuma das 93 edge functions tem a rota; a API pública está desligada | Zapp `supabase/functions/public-api/index.ts:7` → `410 Public API is disabled` |
| A4 | Todo envio do Zapp exige **usuário humano logado** | Zapp `evolution-api/index.ts:93-99` (JWT obrigatório); `enqueue_outbound_message` exige `auth.role()='authenticated'` + permissão `send_messages`; `message-delivery` usa `requireAuth` e `agent_id` do perfil |
| A5 | Nenhum segredo de WhatsApp/SMS no Lalamove: faltam `ZAPP_*`, `EVOLUTION_*`, `SMS_*` → hoje **nenhum WhatsApp sai** | `list_secrets` do projeto `iecgydonctmabiijadsf` (18 secrets, nenhum de mensageria) |
| A6 | Nenhuma notificação jamais foi registrada | `select count(*) from alerts_sent` → 0 linhas |
| A7 | SMS não existe em nenhum dos dois sistemas. No Lalamove há colunas `notify_sms`/`sms_numbers` em `alert_configurations` e normalização de telefone para `sms`, mas o despacho não tem o caso `sms` → `Unsupported channel` | `send-notification/index.ts:244-257` (switch sem `sms`), `:376` |
| A8 | Opt-out **quebrado em produção**: a migration existe no repo, mas a tabela `notification_optouts` e a RPC `is_phone_opted_out` não existem no banco; o código loga erro e envia mesmo assim (fail-open) | `supabase/migrations/20261123200000_optout_and_tracking_end.sql` (não aplicada); `send-notification/index.ts:347` |
| A9 | Telefones de motorista já chegam em E.164 (`+55…`, 13 dígitos) — 20 motoristas, 50 pedidos | `drivers.phone` formato `+9999999999999`; `lalamove_orders.driver_phone` existe |
| A10 | O Zapp tem 2 conexões: "Promo Brindes WhatsApp" (`connected`, saúde `degraded`) e "[E2E] Conexão WhatsApp Teste" (`disconnected`) — **um único número para comercial + logística** | `whatsapp_connections` (Zapp) |
| A11 | O Zapp já tem peças reaproveitáveis: fila de entrega com lease/idempotência (`claim_outbound_message`, `complete_outbound_message`, `client_message_id`), reconciliação de efeito incerto, pausa automática da instância em 429, `outbox_events`, `queues`, `talkx_blacklist`, `talkx_optout_keywords`, `message_templates`, tipos `buttons`/`list`/`poll`/`location`/`contact` | Zapp `message-delivery/index.ts`, tabelas listadas no banco Zapp |
| A12 | Tipos de alerta já existentes no Lalamove: `DRIVER_ASSIGNED`, `DRIVER_APPROACHING_PICKUP/DELIVERY`, `DRIVER_ARRIVED_PICKUP/DELIVERY`, `ETA_DELAY`, `DRIVER_STOPPED`, `ROUTE_DEVIATION`, `MISSING_POD`, `ORDER_CANCELLED`, `SUPPLIER_DELAY_NOTICE`… | `alert_configurations` (16 tipos) |
| A13 | Eventos de webhook Lalamove tratados: `ORDER_STATUS_CHANGED`, `DRIVER_ASSIGNED`, `ORDER_REPLACED`, `ORDER_EDITED`, `POD_STATUS_CHANGED`, `ORDER_AMOUNT_CHANGED`, `WALLET_BALANCE_CHANGED` | `supabase/functions/lalamove-webhook/index.ts:375` |
| A14 | PRs abertas no Lalamove que tocam notificação: #226 (ETA_DELAY/parada), #267 (canal interno Slack) — este plano não conflita, mas as etapas 88–112 dependem delas mergeadas | `github_list_pull_requests` |

## 2. Arquitetura alvo

```
                 ┌──────────────────────── Lalamove V2 (iecgydonctmabiijadsf) ────────────────────────┐
 webhook v3 ───► │ lalamove-webhook / geo_evaluate_tracking / check-driver-alerts                     │
 (Lalamove)      │        │ evento (pedido, papel, destinatário)                                       │
                 │        ▼                                                                            │
                 │ send-notification ──► _shared/messaging (roteador evento×papel, idempotência,       │
                 │                        opt-out, silêncio, teto de custo, fallback temporizado)      │
                 │        │ WhatsApp                         │ SMS                                     │
                 │        ▼                                  ▼                                         │
                 │  canal Zapp (zapp.ts)               canal SMS (provedor Z2)                         │
                 │        │                                  │            ▲ DLR / resposta             │
                 │  ledger notification_messages ◄── zapp-callback ◄──┐   └── sms-callback             │
                 └────────┼──────────────────────────────────────────┼─────────────────────────────────┘
                          │ Bearer zik_… (M2M)                       │ HMAC (status + respostas)
                 ┌────────▼────────────── Zapp Web V2 (tnnnlkbymytvtqngbbqh) ─┼────────────────────────┐
                 │ integration-messages ─► enqueue_integration_message ─► messages (fila com lease)    │
                 │        │                                   │                                       │
                 │        ▼                                   ▼                                       │
                 │ integration-delivery-worker ─► Evolution GO ─► número de LOGÍSTICA (Z1)            │
                 │ whatsapp-webhook (status/inbound) ─► outbox_events ─► integration-callbacks ───────┘
                 │ fila "Logística" no inbox: operador vê e responde a conversa do motorista          │
                 └────────────────────────────────────────────────────────────────────────────────────┘
```

Princípios: (1) **o Zapp é o único dono do WhatsApp** — o Lalamove nunca fala com a Evolution em produção;
(2) toda mensagem vira conversa no inbox do Zapp (atendimento humano vê tudo); (3) idempotência ponta a ponta por
`client_message_id`; (4) nenhum reenvio cego em resultado ambíguo (regra PD-79/IA-047 do Zapp); (5) canal caiu →
fallback para SMS automático, nunca silêncio; (6) motorista com pedido ativo **não** entra em horário de silêncio.

## 3. Decisões do dono (Z1–Z12)

| # | Decisão | Recomendação técnica | Por quê |
|---|---|---|---|
| Z1 | Número de WhatsApp **dedicado à logística** (chip novo) ou o mesmo do comercial | **Dedicado** | Mandar mensagem a dezenas de números desconhecidos por WhatsApp Web (Evolution GO, API não oficial) é o padrão que leva a banimento; com número separado, um bloqueio não derruba o atendimento comercial. O Zapp já é multi-conexão (E15) |
| Z2 | Provedor de SMS | Abstração + 1 provedor nacional (Zenvia, Comtele ou equivalente) escolhido por custo/segmento e DLR por webhook | Custo por mensagem é decisão de negócio; a interface permite trocar sem refazer |
| Z3 | SMS só como contingência ou também principal em evento crítico | Contingência + principal em `ORDER_CANCELLED` e troca de motorista | Cancelamento não pode depender de o motorista abrir o WhatsApp |
| Z4 | Quem atende as respostas dos motoristas no Zapp e em que horário | Fila "Logística" no Zapp, horário comercial; fora dele auto-resposta com telefone de plantão | Resposta sem dono vira motorista parado |
| Z5 | Teto mensal de gasto (SMS) | Valor fixo em R$ com alerta em 80 % e corte em 100 % (exceto críticos) | Mesmo modelo do `geo_budget` |
| Z6 | Ledger de mensagens novo ou estender `alerts_sent` | Tabela nova `notification_messages` e `alerts_sent` mantida por compatibilidade | `alerts_sent` não tem id do provedor, status de entrega, custo nem direção |
| Z7 | Botões interativos | Texto com respostas numeradas ("responda 1, 2 ou 3") como padrão; botões/lista só após teste no número real | Botões via WhatsApp Web não renderizam em todos os aparelhos |
| Z8 | Retenção (LGPD) | Conteúdo 90 dias; metadados (status, horário, custo) 5 anos; telefone mascarado em log | Base legal = execução de contrato de transporte; minimização |
| Z9 | Horário de silêncio para motorista | Isento enquanto houver pedido ativo; fornecedor/cliente seguem `geo_defaults` (07–20 h) | O motorista está trabalhando naquele momento |
| Z10 | Quem pode enviar mensagem manual ao motorista pelo Lalamove | `operator` ou acima | Mesmo RBAC das telas de pedido |
| Z11 | Mensagem automática de avaliação ao final | Desligada no piloto | Evita ruído antes de medir |
| Z12 | Aplicar a migration pendente de opt-out (A8) | Aplicar já (etapa 1) | Hoje quem pede para sair continua recebendo |

## 4. Catálogo de mensagens ao motorista (M1–M12)

| Código | Gatilho | Canal padrão | Conteúdo essencial | Pede resposta |
|---|---|---|---|---|
| M1 | `DRIVER_ASSIGNED` | WhatsApp → SMS | Identificação Promo Brindes, pedido interno, endereço/janela da coleta, responsável, instruções (portaria, doca, volumes, NF), link de rota | — |
| M2 | M1 + 2 min | WhatsApp | "Confirma que está a caminho? 1 = sim · 2 = problema" | Sim (timeout → alerta interno) |
| M3 | junto do M1 | WhatsApp | Localização da coleta + cartão de contato do responsável | — |
| M4 | `DRIVER_ARRIVED_PICKUP` | WhatsApp | Procurar X, conferir volumes/NF, código do pedido | 1 = coletado · 2 = problema |
| M5 | `PICKED_UP` | WhatsApp → SMS | Endereço/recebedor/horário da entrega, comprovante obrigatório se `requires_pod` | — |
| M6 | parada concluída (multi-parada) | WhatsApp | Próxima parada (endereço, contato) | — |
| M7 | `ORDER_EDITED` | WhatsApp + SMS | O que mudou (antes → depois) | 1 = ciente |
| M8 | `ORDER_CANCELLED` / troca de motorista | **SMS + WhatsApp** | "Pedido X cancelado — não siga para a coleta" | — |
| M9 | `MISSING_POD` | WhatsApp | Lembrete do comprovante (foto + nome do recebedor) | Foto |
| M10 | `ETA_DELAY` / `DRIVER_STOPPED` / `ROUTE_DEVIATION` | WhatsApp | "Está tudo bem? 1 = trânsito · 2 = problema no veículo · 3 = endereço errado" | Sim |
| M11 | pedido agendado (`scheduled_at` − 30 min) | WhatsApp → SMS | Lembrete da coleta | 1 = confirmado |
| M12 | `COMPLETED` | WhatsApp | Agradecimento; encerra a correlação | — |

---

## Bloco 0 — Pré-requisitos e decisões (1–10)

### 1 — [L] Aplicar a migration de opt-out pendente 🔒
- [x] Aplicar `supabase/migrations/20261123200000_optout_and_tracking_end.sql` pelo fluxo de `docs/agentes/banco.md`
- [x] Conferir `notification_optouts` e `is_phone_opted_out` no banco
  - **Auditado 2026-11-23 21:15 UTC (sessão fa722515)** por consulta real ao banco de producao (`/v1/projects/iecgydonctmabiijadsf/database/query`):
    - ledger `supabase_migrations.schema_migrations` contem `20261123200000` (migration ja aplicada, nao pendente)
    - `notification_optouts` existe, `relrowsecurity = true`, 2 policies; `is_phone_opted_out(p_phone text)` existe
    - `notification_messages` (32 colunas), `message_templates` (13), `notification_routes` (9) existem com RLS
    - funcoes `notification_messages_scrub_bodies` (retencao) e `notification_messages_touch` presentes
    - indices conferidos: `(order_id, created_at DESC)`, `unique(client_message_id)` partial, `unique(provider, provider_message_id)` partial, `(status) WHERE status in ('queued','sent')`, alem de `(driver_id, created_at DESC)` e `(recipient_phone, created_at DESC)`
    - cron `notification_messages_scrub_bodies` agendado `25 4 * * *` (diario) confirmado em `cron.job`
- **Evidência:** `select to_regclass('public.notification_optouts')` não nulo; log do `send-notification` sem `Opt-out check failed`

### 2 — [D] Decidir Z1 (número dedicado de logística) 🔒
- [ ] Dono decide e providencia o chip/linha
- [ ] Registrar a decisão neste arquivo (tabela Z)
- **Evidência:** linha Z1 marcada como decidida, com data

### 3 — [Z] Conectar o número de logística no Zapp
- [ ] Nova linha em `whatsapp_connections` ("Promo Brindes Logística") com instância Evolution GO própria e token no Vault (E18/E19)
- [ ] Não marcar como `is_default` (o comercial continua padrão)
- [ ] `connection-health-check` cobrindo a nova conexão
- **Evidência:** `status='connected'`, `health_status='healthy'` por 24 h

### 4 — [D] Decidir Z2/Z3 e contratar o provedor SMS 🔒
- [ ] Comparar custo por segmento, DLR por webhook, resposta (two-way), remetente, SLA
- [ ] Contratar conta e gerar credencial (fica com o dono até a etapa 122)
- **Evidência:** provedor e preço registrados na tabela Z

### 5 — [D] Decidir Z4 (atendimento das respostas)
- [ ] Definir equipe e horário da fila "Logística" no Zapp
- [ ] Telefone de plantão para a auto-resposta fora do horário
- **Evidência:** Z4 preenchido; membros conhecidos para a etapa 66

### 6 — [D] Decidir Z5 (teto mensal) e Z8 (retenção)
- [ ] Teto em R$ e limiares 80/100 %
- [ ] Prazos de retenção de conteúdo e metadados
- **Evidência:** Z5 e Z8 preenchidos

### 7 — [L] Inventário de telefones de motorista
- [ ] Medir % de `drivers.phone` e `lalamove_orders.driver_phone` em E.164 válido, nulos e mascarados
- [ ] Identificar a origem de cada um (webhook v3 `DRIVER_ASSIGNED` vs UAPI)
- **Evidência:** tabela de qualidade anexada à PR (contagens por categoria)

### 8 — [L] Mergear as dependências de notificação
- [ ] Acompanhar #226 (ETA_DELAY/parada) e #267 (canal interno) até merge pelo dono
- **Evidência:** ambas mergeadas antes do Bloco 8

### 9 — [L] ADR "Zapp como gateway único de WhatsApp"
- [ ] `docs/adr/00X-zapp-gateway-mensageria.md` com contexto (A1–A11), decisão, consequências
- **Evidência:** arquivo mergeado e citado em `docs/agentes/regras-dominio.md` > Alertas e notificações

### 10 — [L][Z] Mapa de responsabilidades por repositório
- [ ] Registrar neste plano e no `AGENTS.md` do Zapp (seção de integrações) o que cada lado faz
- **Evidência:** seções existentes nos dois repos

## Bloco 1 — Contrato Lalamove ⇄ Zapp (11–20)

### 11 — [Z] Especificação OpenAPI da API de mensageria
- [ ] `docs/integracoes/zapp-messaging-api.yaml`: rotas, autenticação, corpos, erros, callbacks
- [ ] Manter os caminhos que o Lalamove já usa (`/messages/send-text`, `/messages/send-media`) sob a função `integration-messages` → `ZAPP_API_URL = https://tnnnlkbymytvtqngbbqh.supabase.co/functions/v1/integration-messages`
- **Evidência:** YAML válido (`npx @redocly/cli lint`)

### 12 — [Z][L] Envelope de envio
- [ ] Campos: `number`, `text`, `client_message_id` (UUID, obrigatório), `correlation {source, order_id, event, role, recipient_ref}`, `expires_at`, `priority`, `instance` (opcional; o padrão vem do cliente)
- **Evidência:** schema no YAML + exemplo válido

### 13 — [Z] Tipos suportados
- [ ] `send-text`, `send-media` (imagem/documento), `send-location`, `send-contact`, `send-choice` (botões/lista com fallback numerado — Z7)
- **Evidência:** cada tipo com exemplo e limite documentado

### 14 — [Z][L] Códigos de erro estáveis
- [ ] Reaproveitar `DeliveryErrorCode` do Zapp (`invalid_number`, `instance_unavailable`, `rate_limited`, `receipt_unconfirmed`, `provider_rejected`, `media_invalid`) + `recipient_blocked`, `recipient_opted_out`, `expired`, `unauthorized`, `forbidden_connection`
- [ ] Tabela "código → ação no Lalamove" (fallback SMS, retry, desistir, alerta interno)
- **Evidência:** tabela no YAML e no plano

### 15 — [Z] Callback de status
- [ ] `POST {callback_url}` com `event: message.status`, `status ∈ queued|sent|delivered|read|failed|uncertain`, `code`, `occurred_at`, `sequence`
- [ ] Assinatura `X-Zapp-Signature: t=<ts>,v1=<hmac_sha256>` e janela anti-replay de 5 min
- **Evidência:** exemplo assinado verificável no YAML

### 16 — [Z] Callback de resposta (inbound)
- [ ] `event: message.inbound` com texto, id do botão/opção, mídia (URL assinada 24 h), localização, `in_reply_to` (`client_message_id`) e `correlation` resolvida
- **Evidência:** exemplos para texto, opção numerada, foto e localização

### 17 — [Z] Idempotência
- [ ] Mesmo `client_message_id` do mesmo cliente → `200 {idempotent:true, message_id, status}`; corpo diferente com o mesmo id → `409 idempotency_conflict`
- **Evidência:** teste com duas chamadas iguais devolvendo o mesmo `message_id`

### 18 — [Z] Versionamento
- [ ] Header `X-Api-Version: 1` (ausente = 1); mudança incompatível só em versão nova
- **Evidência:** documentado no YAML

### 19 — [Z][L] Testes de contrato compartilhados
- [ ] JSON Schema do envelope copiado nos dois repos com hash conferido no CI (Lalamove: job `Deno Contract Tests`)
- **Evidência:** teste falha se o schema divergir

### 20 — [Z] Limites
- [ ] Texto ≤ 4096; mídia ≤ 5 MB; 60 req/min por cliente; 1 mensagem/10 s por destinatário
- **Evidência:** limites no YAML e aplicados nas etapas 26 e 46

## Bloco 2 — Zapp: autenticação máquina-a-máquina (21–32)

### 21 — [Z] Tabela `integration_clients` 🔒
- [ ] `id, name, key_prefix, key_hash, scopes text[], allowed_connection_ids uuid[], default_connection_id, callback_url, callback_secret_id (Vault), rate_limit_per_min, is_active, created_by, created_at, last_used_at, revoked_at`
- [ ] RLS: só admin lê; escrita só via RPC
- **Evidência:** migration mergeada e aplicada; `db_list_policies` mostra a policy

### 22 — [Z] Geração e rotação de chave
- [ ] Chave `zik_<prefixo>_<segredo>` mostrada uma vez; banco guarda só SHA-256 com pepper do Vault
- [ ] Até 2 chaves ativas por cliente (rotação sem parada)
- **Evidência:** teste: chave correta passa, chave antiga revogada falha

### 23 — [Z] Escopos
- [ ] `messages:send`, `messages:read`, `contacts:upsert`, `health:read`
- **Evidência:** rota sem escopo → 403 `insufficient_scope`

### 24 — [Z] Restrição de conexão
- [ ] Cliente "Lalamove" só envia pelo número de logística (Z1); `instance` diferente → 403 `forbidden_connection`
- **Evidência:** teste com conexão comercial recusada

### 25 — [Z] Origem permitida
- [ ] Opcional: lista de IPs/hosts; padrão aceita só chamadas servidor-a-servidor (sem CORS de navegador)
- **Evidência:** `OPTIONS` de origem de navegador sem `Access-Control-Allow-Origin`

### 26 — [Z] Rate limit por cliente
- [ ] Reaproveitar `edge_rate_limits`/`rate_limit_configs` com chave `integration:<client_id>`
- **Evidência:** 61ª requisição no minuto → 429 `rate_limited`

### 27 — [Z] Perfil de sistema "Integração Lalamove"
- [ ] Linha em `profiles` não-humana (sem login), `is_active=true`, permissão `send_messages`, usada como `agent_id` das mensagens de integração
- **Evidência:** mensagens da integração aparecem no inbox com autor "Integração Lalamove"

### 28 — [Z] Auditoria
- [ ] `integration_audit_log`: cliente, rota, status HTTP, código, latência, `client_message_id` — sem telefone nem texto
- **Evidência:** linhas gravadas em cada chamada; nenhuma coluna com conteúdo pessoal

### 29 — [Z] Tela de integrações no Zapp
- [ ] Criar, revogar, rotacionar chave, ver uso e último acesso; MFA obrigatório
- **Evidência:** rota protegida + entrada no menu; teste de componente

### 30 — [Z] Segredo de callback
- [ ] Gerado por cliente, guardado no Vault, exibido uma vez
- **Evidência:** `vault.secrets` tem a entrada; tabela guarda só o id

### 31 — [Z] Kill switch
- [ ] `is_active=false` → 403 imediato e worker para de entregar mensagens pendentes do cliente
- **Evidência:** teste desligando o cliente com mensagem na fila

### 32 — [Z] Testes de segurança da autenticação
- [ ] Chave inválida, revogada, sem escopo, conexão proibida, corpo > limite, replay de callback
- **Evidência:** suíte Deno verde no CI do Zapp

## Bloco 3 — Zapp: envio (33–50)

### 33 — [Z] Edge `integration-messages`
- [ ] Roteamento por caminho, autenticação do Bloco 2, validação de schema (E45), resposta `202 {message_id, status:'queued'}`
- **Evidência:** chamada real com chave de teste devolve 202

### 34 — [Z] Resolução de contato
- [ ] Busca por `phone_search_digits`; cria se não existir com `contact_type='motorista'|'fornecedor'|'cliente'` (vindo de `correlation.role`), `lead_origin='lalamove'`, tags `['lalamove', <role>]`, `whatsapp_connection_id` = logística
- [ ] Nunca sobrescreve nome/dados de contato comercial existente
- **Evidência:** contato criado uma vez para 3 envios ao mesmo número

### 35 — [Z] Normalização de telefone BR
- [ ] DDI 55, 9º dígito de celular, contatos LID legados (`is_lid_legacy`)
- **Evidência:** testes com `(41) 99999-8888`, `+55 41 9 9999-8888`, `4199998888`

### 36 — [Z] Checagem "tem WhatsApp?"
- [ ] Consulta à Evolution antes do 1º envio ao número, cache de 7 dias no contato
- [ ] Sem WhatsApp → `422 invalid_number` em < 2 s (o Lalamove cai no SMS na hora)
- **Evidência:** número fixo de teste devolve `invalid_number`

### 37 — [Z] RPC `enqueue_integration_message` 🔒
- [ ] `SECURITY DEFINER`, `EXECUTE` só para `service_role`; grava em `messages` com `sender='agent'`, `agent_id` do perfil de sistema, `client_message_id`, `media_meta.integration = {client_id, correlation, expires_at}`
- [ ] Mesmas validações de tipo/mídia da `enqueue_outbound_message`
- **Evidência:** migration aplicada; chamada com `authenticated` → 42501

### 38 — [Z] Núcleo de entrega reutilizável
- [ ] Extrair de `message-delivery/index.ts` a função `deliverClaimedMessage(service, messageId, agentId)` sem mudar o comportamento do inbox
- [ ] `message-delivery` passa a chamar o núcleo (mesmos testes verdes)
- **Evidência:** suíte de `message-delivery` inalterada e verde

### 39 — [Z] `integration-delivery-worker`
- [ ] Tentativa imediata após o enqueue + varredura por cron a cada 1 min para pendentes
- [ ] Usa `claim_outbound_message` (lease 90 s), `mark_outbound_post_started`, `complete_outbound_message`
- **Evidência:** mensagem enfileirada vira `sent` sem ação humana

### 40 — [Z] `send-text`
- [ ] Texto com formatação WhatsApp (`*negrito*`), personalização já resolvida pelo Lalamove
- **Evidência:** mensagem recebida no aparelho de teste

### 41 — [Z] `send-media`
- [ ] Aceita data URL (PNG do mapa estático — etapa 68 do plano Google) ou URL https; sobe no bucket `whatsapp-media` e envia URL assinada
- **Evidência:** imagem do trajeto recebida com legenda

### 42 — [Z] `send-location`
- [ ] Coordenada + nome/endereço da coleta ou entrega
- **Evidência:** pin abre no Maps/Waze do aparelho

### 43 — [Z] `send-contact`
- [ ] Cartão do responsável pela coleta (nome, telefone, empresa)
- **Evidência:** cartão salvo pelo aparelho de teste

### 44 — [Z] `send-choice` com fallback numerado
- [ ] Padrão Z7: texto "responda 1, 2 ou 3"; botões/lista só se `capabilities.buttons=true` na conexão
- [ ] Guarda o mapa opção→id em `media_meta.integration.choices` para o inbound (etapa 63)
- **Evidência:** resposta "1" vira `choice_id` no callback

### 45 — [Z] Expiração
- [ ] `expires_at` vencido no momento do claim → não envia, status `failed`/`expired`
- **Evidência:** mensagem com `expires_at` no passado nunca chega ao provedor

### 46 — [Z] Ritmo anti-banimento
- [ ] Mínimo de 10 s entre mensagens ao mesmo número, teto por hora no número de logística (reaproveitar `talkx_connection_send_budget`), presença "digitando" curta
- **Evidência:** rajada de 5 mensagens sai espaçada; teto devolve `rate_limited`

### 47 — [Z] Instância pausada ou caída
- [ ] `isInstancePaused`/`auto_pause_instance` (429 do provedor pausa 30 min) → erro `instance_unavailable` + callback
- **Evidência:** com a instância pausada, callback chega e o Lalamove aciona SMS

### 48 — [Z] Primeira mensagem a número novo
- [ ] Prefixo de identificação "Promo Brindes — Logística" + "responda SAIR para não receber"
- **Evidência:** 1º envio a contato novo contém o prefixo; os seguintes não

### 49 — [Z] Bloqueios do Zapp
- [ ] `contacts.blocked_at`, `talkx_blacklist` → `recipient_blocked` sem enviar
- **Evidência:** teste com contato bloqueado

### 50 — [Z] Leitura e saúde
- [ ] `GET /messages/{id}` (status atual) e `GET /health` (estado da conexão de logística, fila pendente)
- **Evidência:** `/health` reflete `connected`/`degraded`/`disconnected` em tempo real

## Bloco 4 — Zapp: status e callbacks (51–62)

### 51 — [Z] Evento na outbox 🔒
- [ ] Trigger em `messages` (só linhas com `media_meta.integration`) grava em `outbox_events` a cada mudança de status
- **Evidência:** migration aplicada; mudança de status gera 1 linha

### 52 — [Z] Dispatcher `integration-callbacks`
- [ ] Cron 1 min + disparo imediato; assina HMAC; retry exponencial (1, 5, 15, 60 min); após 8 falhas → fila morta visível
- **Evidência:** callback chega no Lalamove; endpoint fora do ar acumula e depois entrega

### 53 — [Z] Mapa de status da Evolution
- [ ] `sent`/`delivered`/`read`/`failed` do `whatsapp-webhook` → status do contrato
- **Evidência:** "lido" no aparelho vira `read` no callback

### 54 — [Z] Resultado ambíguo
- [ ] `receipt_unconfirmed` → callback `uncertain`; o Lalamove **não** reenvia pelo WhatsApp (pode mandar SMS se o evento for crítico)
- **Evidência:** teste com 5xx simulado do provedor

### 55 — [Z] Falha definitiva
- [ ] Callback `failed` com `code` estável e mensagem fixa (sem corpo do provedor)
- **Evidência:** número inválido gera `failed/invalid_number`

### 56 — [Z] Ordem e duplicidade
- [ ] `sequence` crescente por mensagem; o receptor ignora sequência menor que a gravada
- **Evidência:** teste entregando `read` antes de `delivered`

### 57 — [Z] Painel de entregas por integração
- [ ] Volume, % entregue, % lido, falhas por código, fila morta — na tela da etapa 29
- **Evidência:** números batem com `select` em `messages`

### 58 — [Z] Alerta de taxa de falha
- [ ] Falha > 20 % em 15 min ou fila morta > 0 → alerta interno do Zapp
- **Evidência:** simulação dispara o alerta

### 59 — [Z] Canal caído proativo
- [ ] Conexão de logística sai de `connected` → callback `channel.status` para o Lalamove
- **Evidência:** desconectar a instância de teste gera o callback em < 2 min

### 60 — [Z] Retenção da outbox
- [ ] Expurgo de callbacks entregues > 30 dias
- **Evidência:** job agendado e contagem estável

### 61 — [Z] Testes do dispatcher
- [ ] Assinatura, retry, fila morta, ordem
- **Evidência:** suíte verde no CI do Zapp

### 62 — [Z] Documentação operacional
- [ ] `docs/integracoes/lalamove.md` no Zapp: como criar cliente, rotacionar chave, ler fila morta
- **Evidência:** arquivo mergeado

## Bloco 5 — Zapp: respostas do motorista e atendimento humano (63–72)

### 63 — [Z] Correlação do inbound
- [ ] No `whatsapp-webhook`, mensagem de contato com tag `lalamove` → busca a última mensagem de integração ao mesmo contato nas últimas 24 h → `correlation`
- [ ] Citação (reply) de uma mensagem específica tem prioridade sobre "a última"
- **Evidência:** resposta citando o M4 é correlacionada ao pedido certo mesmo com 2 pedidos no dia

### 64 — [Z] Encaminhar inbound ao Lalamove
- [ ] Callback `message.inbound` (etapa 16) para texto, opção, mídia e localização
- **Evidência:** resposta no aparelho aparece no ledger do Lalamove

### 65 — [Z] Opt-out por palavra-chave
- [ ] `SAIR`, `PARAR`, `CANCELAR` (reaproveitar `talkx_optout_keywords`) → marca o contato, confirma por mensagem e envia callback `contact.optout`
- **Evidência:** após "SAIR", novo envio devolve `recipient_opted_out`

### 66 — [Z] Fila "Logística"
- [ ] Criar a fila (`queues`) com membros da Z4; contatos `lalamove` caem nela; `whatsapp_connection_queues` liga a conexão de logística à fila
- **Evidência:** conversa de motorista atribuída à fila automaticamente

### 67 — [Z] Contexto do pedido no inbox
- [ ] Cartão lateral com pedido, status, coleta, entrega e link para o Lalamove (chamada de leitura ao Lalamove, etapa 96)
- **Evidência:** operador vê o pedido sem sair do Zapp

### 68 — [Z] Resposta humana também vai para o Lalamove
- [ ] Mensagem do operador para contato `lalamove` gera callback `message.outbound_manual`
- **Evidência:** timeline do pedido mostra a resposta do operador

### 69 — [Z] Auto-resposta fora do horário
- [ ] Fora do horário da fila: texto com telefone de plantão (Z4), no máximo 1 vez a cada 2 h por contato
- **Evidência:** teste fora do horário

### 70 — [Z] Mídia do motorista
- [ ] Foto/documento recebido → URL assinada no callback (comprovante, avaria, NF)
- **Evidência:** foto enviada pelo aparelho chega ao Lalamove

### 71 — [Z] IA desligada para motorista
- [ ] `chatbot-l1`, `copilot-live` e `automation-suggest-reply` não respondem automaticamente a contatos `lalamove` (só sugestão ao operador)
- **Evidência:** mensagem do motorista não gera resposta automática

### 72 — [Z] E2E com a conexão de teste
- [ ] Reconectar "[E2E] Conexão WhatsApp Teste" e cobrir envio → status → resposta → callback
- **Evidência:** spec E2E verde no CI do Zapp

## Bloco 6 — Lalamove: banco (73–84)

### 73 — [L] Ledger `notification_messages` 🔒
- [~] `id, alert_id, order_id, driver_id, stop_id, event, role (driver|pickup_contact|delivery_contact|internal), direction (outbound|inbound), channel (whatsapp|sms|email|slack), provider, recipient_phone, client_message_id unique, provider_message_id, template_key, template_version, body_preview, status, error_code, attempt, fallback_of uuid, cost_cents, segments, sent_at, delivered_at, read_at, failed_at, expires_at, created_at`
- **Evidência:** escrita em `supabase/migrations/20261125120000_notification_ledger.sql` (PR #283, `MERGEABLE`), com todas as colunas acima mais `provider_sequence`/`occurred_at`/`metadata`. **Falta:** merge e `apply-migrations` — a tabela ainda não existe em produção (regra 8).

### 74 — [L] Máquina de estados
- [~] `queued → sent → delivered → read`; `failed`, `uncertain`, `expired`, `suppressed` terminais; transição inválida rejeitada por função
- **Evidência:** `notification_status_transition_allowed(from,to)` na mesma migration é `IMMUTABLE` e testável sem tabela: `('sent','delivered')` → true, `('read','sent')` → false. Implementação em `nextStatus()` de `zapp-callback/payload.ts` (teste `nextStatus nao ressuscita mensagem falhada`). **Falta:** merge/aplicação da migration e o teste SQL em Postgres descartável.

### 75 — [L] `messaging_settings` (linha única) 🔒
- [ ] `whatsapp_provider (zapp|evolution|off)`, `sms_provider`, `sms_fallback_after_min`, `monthly_budget_cents`, `quiet_hours_by_role jsonb`, `pilot_mode`, `shadow_mode`
- **Evidência:** linha seed criada; RLS admin

### 76 — [L] `message_templates` 🔒
- [ ] `key, event, role, channel, version, body, variables text[], is_active, updated_by`
- [ ] Variante SMS separada (≤ 160 caracteres)
- **Evidência:** migration aplicada

### 77 — [L] Seed dos templates M1–M12
- [ ] Textos aprovados pelo dono para WhatsApp e SMS
- **Evidência:** 24 linhas (12 eventos × 2 canais)

### 78 — [L] Rotas evento × papel 🔒
- [ ] `notification_routes`: `event, role, channels text[] (ordem), fallback_after_min, requires_reply, reply_timeout_min, is_enabled`
- [ ] Usar as colunas já existentes `notify_sms`/`sms_numbers` de `alert_configurations` para destinatários fixos internos
- **Evidência:** rotas do catálogo seção 4 semeadas

### 79 — [L] Estado de canal do motorista 🔒
- [ ] Em `drivers`: `whatsapp_status (valid|invalid|unknown)`, `whatsapp_checked_at`, `preferred_channel`, `last_reply_at`
- **Evidência:** colunas criadas; atualizadas pelos callbacks

### 80 — [L] Inbound no ledger
- [ ] `direction='inbound'` com `body_preview`, `choice_id`, `media_url`, `location`
- **Evidência:** resposta real gravada

### 81 — [L] Uso e custo 🔒
- [ ] `messaging_usage (dia, canal, provedor, mensagens, segmentos, custo_cents)` + RPC de consumo, no modelo do `geo_budget`
- **Evidência:** soma diária bate com o ledger

### 82 — [L] RLS
- [ ] `operator` lê ledger e templates; `admin` edita templates/rotas/settings; escrita de ledger só `service_role`
- **Evidência:** `get_advisors` sem alerta de RLS nas tabelas novas

### 83 — [L] Índices
- [x] `(order_id, created_at)`, `unique(client_message_id)`, `unique(provider, provider_message_id)`, `(status) where status in ('queued','sent')`
- **Evidência:** os 5 índices estão na migration `20261125120000` (`notification_messages_order_created_idx`, `..._client_message_id_key`, `..._provider_message_id_key`, `..._pending_idx`, `..._recipient_created_idx`). **Falta:** aplicar e rodar o `EXPLAIN` de verdade.

### 84 — [L] Retenção (Z8)
- [x] `pg_cron` diário zera `body_preview`/mídia > 90 dias e mantém metadados
- **Evidência:** `notification_messages_scrub_bodies(int)` + `cron.schedule('25 4 * * *')` na migration `20261125120000`, com guarda para banco sem `pg_cron`. **Falta:** aplicar (regra 8).

## Bloco 7 — Lalamove: motor de comunicação (85–98)

### 85 — [L] Módulo `_shared/messaging/`
- [x] Extrair de `send-notification` o despacho WhatsApp/SMS para `channels/`, `router.ts`, `ledger.ts` — e-mail, Slack, Bitrix24 e n8n ficam onde estão
- **Evidência:** `_shared/messaging/` tem `router.ts` (roteamento, silêncio, teto, dedup: 19 testes), `inbound.ts` (10 testes) e `_shared/channels/{zapp,sms}.ts` com suas interfaces; `send-notification` importa os helpers puros e mantém só o I/O. Testes do `send-notification` seguem verdes (40 passed). **Falta:** `ledger.ts` — sai junto com a migration `20261125120000` (PR #283), porque sem a tabela `notification_messages` não há onde escrever.

### 86 — [L] Canal Zapp completo
- [x] `zapp.ts` envia `client_message_id`, `correlation`, `expires_at`; lê `202 {message_id}`; mapeia os códigos da etapa 14
- **Evidência:** `_shared/channels/zapp.ts` (`SendOptions`, `correlationFields`, `parseZappAccepted`, `errorCodeFromResponse`, `ERROR_CODE_ACTIONS`); 11 testes novos em `_shared/channels/zapp.test.ts`; `send-notification/index.ts:248` passa o id estável

### 87 — [L] Secrets do Zapp 🔒
- [ ] `ZAPP_API_URL`, `ZAPP_API_KEY` (chave `zik_` da etapa 22), `ZAPP_CALLBACK_SECRET` nas edges
- **Evidência:** `list_secrets` mostra os 3 nomes

### 88 — [x] Roteador evento → papel
- [x] Lê `notification_routes`, monta a lista ordenada de canais e o template por canal
- **Evidência:** `_shared/messaging/registry.ts` (`loadRoutes`/`loadTemplates`, fallback para `DEFAULT_ROUTES` quando a tabela falta) e `dispatch.ts` (`planDriverMessage` decide pela rota do banco, pelo template por canal e pela preferência do motorista). `deno test supabase/functions/_shared/messaging/` → 86 testes, 0 falhas. Em produção o motor lê `messaging_settings` (zapp / sms `none` / `shadow_mode=true`) e as 14 rotas ativas.

### 89 — [L] Idempotência
- [x] `client_message_id = uuidv5(order_id|event|role|telefone|seq)`; reprocessar o mesmo evento não duplica mensagem
- **Evidência:** `send-notification/message-id.ts` (`buildClientMessageId` determinístico, telefone normalizado antes do hash); 9 testes em `message-id.test.ts`; índice único parcial `notification_messages_client_message_id_key` na migration `20261125120000`

### 90 — [L] Fallback temporizado
- [ ] WhatsApp sem `delivered` em `sms_fallback_after_min` → `job_queue` tipo `message_fallback` envia SMS
- **Evidência:** teste com Zapp sem callback → SMS sai no prazo
- **Estado:** a regra pura já existe e está testada (`shouldFallback` em `_shared/messaging/router.ts`), mas o disparo depende de três peças que ainda não existem: `sms_fallback_after_min` (coluna — hoje só no catálogo `DEFAULT_ROUTES`), o tipo `message_fallback` no CHECK de `job_queue` (o `job-worker/index.ts:1013-1075` tem `switch` exaustivo com `never`, então um tipo novo não compila) e o `delivered` do callback (PR #283). É DDL — não sai sem a sua liberação.

### 91 — [L] Fallback imediato
- [x] `invalid_number`, `instance_unavailable`, `recipient_blocked`, `channel.status=down` → SMS na hora
- **Evidência:** `_shared/messaging/router.ts` (`IMMEDIATE_FALLBACK_REASONS`, `needsImmediateFallback`); `zapp.ts` mapeia o código → `errorCode`; `send-notification/index.ts` (dentro do `dispatch`) troca por SMS quando o código está naquela lista e o canal SMS existe; os 4 códigos e o negativo (`timeout`) testados em `router.test.ts`

### 92 — [~] Opt-out unificado
- [~] Consulta `is_phone_opted_out` antes de qualquer canal; opt-out do motorista gera alerta interno (a operação precisa de outro meio)
- **Evidência:** número em opt-out → `suppressed` no ledger
- **Estado:** consulta aplicada aos **dois** caminhos de destinatário em `send-notification/index.ts` (ad-hoc e `alert_configurations`, canais WhatsApp/SMS) — antes só o ad-hoc consultava. Falta o alerta interno à operação e a linha `suppressed` no ledger (depende da migration `20261125120000`, PR #283).

### 93 — [x] Horário de silêncio por papel (Z9)
- [x] Motorista com pedido ativo isento; fornecedor/cliente seguem `geo_defaults`
- **Evidência:** `dispatch.ts` (`quietWindowFor` + exceção `hasActiveOrder`) com `notify-driver.ts` contando pedidos em `PENDING/MATCHED/ON_GOING/PICKED_UP`; testes "Z9: madrugada silencia o motorista parado" e "Z9: madrugada nao cala o motorista com pedido em andamento". Em produção `quiet_hours_by_role = {}` → nenhuma janela ativa até o operador configurar.

### 94 — [L] Deduplicação
- [x] `claim_alert_notification` com chave `event:order:role` para os eventos M*
- **Evidência:** `claim_alert_notification` já existia (`20260712221144_...sql:58`) e a chave era `evento:pedido:severidade`; passou a `evento:pedido` sem severidade para os eventos de rastreio (`DEDUP_SEVERITY_FREE_EVENTS` em `_shared/messaging/router.ts`, consumido em `send-notification/index.ts`) — ETA oscilando entre WARNING e CRITICAL a cada atualização de posição gerava uma mensagem por oscilação. `role` fica fora da chave porque cada despacho tem um único destinatário hoje; entra junto com os templates M1–M12 (etapas 101–112).

### 95 — [L] Limite por motorista
- [x] No máximo 6 mensagens automáticas a cada 10 min por motorista (exceto M8)
- **Evidência:** `_shared/messaging/router.ts` (`DRIVER_RATE_LIMIT`, `isRateLimited`, `RATE_LIMIT_EXEMPT_EVENTS`); ligado no despacho em `send-notification/index.ts` (`isDriverRateLimited`, conta `alerts_sent` por telefone normalizado — a tabela não tem `driver_id`); 5 testes em `router.test.ts`

### 96 — [L] Edge `zapp-callback`
- [x] Verifica HMAC e janela anti-replay; atualiza ledger (status/sequência); grava inbound; responde 2xx rápido
- [x] Rota de leitura para o cartão do Zapp (etapa 67), autenticada pela mesma chave
- **Evidência:** `supabase/functions/zapp-callback/` — `security.ts` (HMAC `${t}.${corpoCru}`, janela 5 min simétrica, fail-closed sem `ZAPP_CALLBACK_SECRET`), `payload.ts` (3 eventos, tabela código→ação da etapa 14, `nextStatus` que não regride), `ledger.ts` (status/inbound/outbound_manual com idempotência). 42 testes verdes; `deno check` limpo; `GET ?order_id=` autenticado pela mesma chave.

### 97 — [L] Compatibilidade com `alerts_sent`
- [x] Continuar gravando `alerts_sent` até a etapa 138 migrar a tela
- **Evidência:** `send-notification/index.ts` chama `recordNotificationLog` (insert em `alerts_sent`) em todos os caminhos de despacho — whatsapp (:448), sms da contingência da etapa 91 (:435), bitrix (:930) e ad-hoc (:976); `NotificationHistoryPage` continua lendo `alerts_sent` (`useNotificationHistory`). 125 tests verdes localmente.

### 98 — [x] Testes de contrato do motor
- [x] `deno test` para roteador, idempotência, fallback, opt-out, silêncio, limite
- **Evidência:** job `Deno Contract Tests` (`.github/workflows/ci.yml:110`) roda `_shared/messaging/` (29 testes: roteamento, silêncio por papel, teto por motorista, dedup, interpretador de inbound), `_shared/channels/` (Zapp e SMS) e `send-notification/` (40 testes: idempotência em `message-id.test.ts`, silêncio em `quiet-hours.test.ts`, opt-out e destinatários em `recipients.test.ts`, SMS em `sms-dispatch.test.ts`). CI `success` em `83e41fd`.

## Bloco 8 — Lalamove: eventos ao motorista (99–112)

### 99 — [x] Telefone do motorista confiável
- [x] Normaliza para E.164 antes de gravar e completa o telefone de quem já existia
- **Evidência:** `lalamove-webhook/index.ts` no `DRIVER_ASSIGNED` (`normalizePhone`, `UPDATE drivers.phone` só quando muda, descarte logado de número inutilizável) e `notify-driver.ts` recusando motorista sem telefone (`sem_telefone`).

### 100 — [L] Troca de motorista
- [ ] `ORDER_REPLACED`/`lalamove_order_replacements`: M8 ao motorista antigo e M1 ao novo
- **Evidência:** simulação de troca gera as 2 mensagens
- **Estado:** o lado do dado está pronto — `lalamove-webhook/index.ts:791-864` grava a trilha idempotente em `lalamove_order_replacements`, atualiza `lalamove_id` só quando ainda está no antigo e registra `ORDER_REPLACED` em `lalamove_status_history`. Faltam os dois disparos, que dependem dos templates M1/M8 (etapas 101–112 + `message_templates`, DDL do Bloco 6): hoje não existe evento de alerta para "motorista trocado".

### 101 — [~] M1 Briefing de atribuição
- [~] Variáveis: pedido interno, endereço/janela da coleta, responsável, instruções, link de rota (`share_link`)
- **Evidência:** motor pronto e ligado no webhook (`DRIVER_ASSIGNED` → `notifyDriverEvent`); variáveis montadas de `lalamove_orders` por `loadOrderVariables` (`order_number`, `pickup_address`, `pickup_window` em BRT, `pickup_contact`, `pickup_notes`, `share_link`, `pickup_location_link`). **Falta:** `shadow_mode=true` em produção e secrets do Zapp (etapa 87) — hoje o aviso é decidido e gravado como `suppressed` (`modo_sombra`), sem envio.

### 102 — [~] M2 Confirmação com prazo
- [x] Pedido de confirmação ao motorista 2 min depois do M1, quando o pedido ainda não tem `driver_pickup_confirmed_at`
- [ ] Sem resposta em `reply_timeout_min` → alerta interno `DRIVER_NO_CONFIRMATION` (tipo novo com linha em `alert_configurations`)
- **Evidência (emissor):** `sendConfirmationNudges` (`_shared/messaging/auto-notices.ts`) roda no cron de 2 min do `check-driver-alerts`; a base é a linha outbound de `DRIVER_ASSIGNED` no ledger (não o pedido com motorista) e a janela é `now-6h .. now-2min`. Ledger e `client_message_id` determinístico são a trava de duplicidade. Testes em `auto-notices.test.ts` (janelas, já-confirmado, já-cobrado, status bloqueados, pedido ausente).
- **Falta:** o alerta de timeout (item acima) e o `DRIVER_NO_CONFIRMATION` ainda só nasce da resposta "2 = problema" (`zapp-callback/inbound-exec.ts:57`), não da ausência de resposta.

### 103 — [~] M3 Localização e contato
- [~] `send-location` da coleta + `send-contact` do responsável
- **Evidência:** template `M3_LOCALIZACAO_CONTATO` e rota `DRIVER_ASSIGNED` existem em produção; `loadOrderVariables` monta `pickup_location_link` (link de mapa sem chave) e `pickup_contact`. **Limite conhecido:** o motor dispara um template por evento/canal e vence o de menor `key` (`M1_BRIEFING`), determinístico desde esta PR. O M3 como segunda mensagem exige disparo próprio com `seq` diferente — próximo passo.

### 104 — [x] M4 Chegada na coleta
- [x] Gatilho `DRIVER_ARRIVED_PICKUP` (geofence do plano Google) → ponte no `job-worker`: o job `notification` do evento geo passa também pelo motor do Bloco 7 (`geoAlertDriverEvent` + `avisarMotorista`)
- **Evidência:** `job-worker/notification-bridge.test.ts` (5 testes, `deno test` verde, `deno check` limpo) e simulação com payload real de produção (`job_queue` do evento geo do pedido `608ae635`/motorista `0e0f111c`): plano `shadow [whatsapp]`, template `M4_CHEGADA_COLETA v1`, rota ligada em produção; rota desligada no painel → `suppress evento_desligado`; `APPROACHING_PICKUP` (destinatário é o contato da coleta) não gera aviso ao motorista
- **Limite conhecido:** `simulate-driver-movement` é bloqueada em produção (403 por ambiente); a evidência veio do payload real do trigger. Falta a ação sobre a resposta "1 = coletado" (etapa 102)

### 105 — [~] M5 Pós-coleta
- [~] Gatilho `PICKED_UP`; inclui exigência de comprovante quando `requires_pod`
- **Evidência:** `lalamove-webhook` `ORDER_PICKED_UP` → `notifyDriverEvent`; `loadOrderVariables` fornece `delivery_address`, `delivery_contact`, `delivery_window` e `pod_requirement` só quando `requires_pod`. **Falta:** envio real (ver M1).

### 106 — [L] M6 Multi-paradas
- [ ] Ao concluir parada (`lalamove_stops.completed_at`), envia a próxima
- **Evidência:** pedido com 3 paradas gera 2 mensagens M6

### 107 — [~] M7 Pedido editado
- [~] `ORDER_EDITED`: diferença antes → depois (endereço, contato, horário)
- **Evidência:** `lalamove-webhook` `ORDER_EDITED` → `notifyDriverEvent` com `change_summary` gerado por `describeOrderChanges` (paradas atualizadas e novo valor); sem resumo descritível o aviso não é disparado (texto com placeholder não resolvido é pior que silêncio). **Falta:** envio real e o diff completo de endereço/contato/horário (hoje o payload só traz `stops` e `priceBreakdown`).

### 108 — [~] M8 Cancelamento
- [~] SMS + WhatsApp em paralelo, ignora teto de custo
- **Evidência:** `lalamove-webhook` `ORDER_CANCELLED` → `notifyDriverEvent`; rota de produção `ORDER_CANCELLED = sms,whatsapp` (Z3). **Limite conhecido:** `sms_provider = none` em produção filtra o SMS e o aviso sai só por WhatsApp quando o Zapp tiver token; e o teto mensal (Z5) ainda corta o SMS — "ignora teto" para o M8 não está implementado.

### 109 — [L] M9 Lembrete de comprovante
- [ ] Gatilho `MISSING_POD`; foto recebida (etapa 116) encerra o lembrete
- **Evidência:** teste

### 110 — [L] M10 Checagem de atraso/parada/desvio
- [ ] Gatilhos `ETA_DELAY`, `DRIVER_STOPPED`, `ROUTE_DEVIATION`; resposta vira motivo no pedido
- **Evidência:** resposta "1" grava motivo "trânsito"

### 111 — [L] M11 Pedido agendado
- [ ] `job_queue` agenda o lembrete para `scheduled_at − 30 min`; cancela se o pedido mudar
- **Evidência:** job criado e executado no horário

### 112 — [~] M12 Encerramento
- [~] `COMPLETED`: agradecimento; fecha a correlação para respostas posteriores irem só à fila humana
- **Evidência:** `lalamove-webhook` `ORDER_COMPLETED` → `notifyDriverEvent` com `order_number` e `driver_name` do pedido/cadastro. **Falta:** envio real e encerrar a correlação no inbound (etapa 116).

## Bloco 9 — Lalamove: respostas do motorista (113–118)

### 113 — [L] Interpretador de respostas
- [x] Ordem: id de opção → número "1/2/3" → palavras-chave ("cheguei", "a caminho", "problema", "coletado") → texto livre
- **Evidência:** `_shared/messaging/inbound.ts` (`classifyInbound`, `normalizeInboundText`); 10 testes em `inbound.test.ts` com a tabela de frases reais — id de opção vence dígito, dígito vence palavra, "não consigo chegar" é `problem` e não `arrived`/`decline`, acento e caixa alta não mudam nada, e "assim" não vira "sim". Ligado no consumo do inbound (`zapp-callback/ledger.ts` → `classifyReply`). O dígito só é interpretado com o mapa do evento que originou a mensagem (`inbound-event.ts`, `EVENT_CHOICES`), porque "1" não significa nada fora do template que perguntou.

### 114 — [L] Ações por resposta
- [x] Confirmação → `tracking_events` + `metadata.driver_confirmed_at`; problema → `driver_incidents` + alerta interno
- **Estado real:** decisão pura em `_shared/messaging/inbound-actions.ts` (`planInboundAction`) e
  execução em `zapp-callback/inbound-exec.ts` (`executeInboundPlan`), chamada por
  `applyCallback` logo depois de gravar a linha inbound. Respeita os NOT NULL do schema:
  `tracking_events` só sai com motorista **e** posição, `driver_incidents` só com
  `driver_id` — sem eles o efeito é convertido em badge e o motivo vai para `skipped`.
  Carimbos no pedido são "primeira vez" (não reescrevem) e nunca tocam `status`, que é
  o que dispara sincronia Bitrix24. Recusa abre alerta `DRIVER_NO_CONFIRMATION`;
  problema não duplica alerta porque já nasce em `driver_incidents`. Foto de
  comprovante fica no inbox: `lalamove_stop_proofs` separa POP de POD e
  `lalamove_stops` não diz o tipo da parada.
- **Evidência:** 12 testes em `inbound-actions.test.ts` + 9 em `inbound-exec.test.ts` +
  2 de integração em `zapp-callback/ledger.test.ts` (resposta "1" ao M4 carimba
  `metadata.driver_pickup_confirmed_at` e a linha inbound nasce com `order_id`/`driver_id`).

### 115 — [L] Texto livre
- [ ] Vai para a timeline e sinaliza "aguardando operador" (a conversa já está na fila do Zapp)
- **Evidência:** badge no pedido

### 116 — [L] Mídia recebida
- [x] Foto como comprovante → `lalamove_stop_proofs` (pendente de validação); avaria → anexo do incidente
- **Evidência:** `classifyInboundMedia` em `_shared/messaging/inbound.ts` + `inbound-actions.ts` (etapa 116): foto sem texto vira `stop_proof` quando há parada; sem parada vira badge `media_avaria`/`media_comprovante`; texto com foto mantém o intent. 49 passed em `_shared/messaging/` (PR #281).

### 117 — [L] Opt-out do motorista
- [~] Callback `contact.optout` → `notification_optouts` + alerta interno
- **Estado real:** o reconhecimento do pedido de saída está feito e testado
  (`isOptOutKeyword`/`classifyInbound` → `intent: "optout"`, PR #281); a tabela e a RLS
  existem desde `20261123200000_optout_and_tracking_end.sql` e o leitor
  `is_phone_opted_out()` já é chamado no `send-notification:413`. Falta o evento
  `contact.optout` do `zapp-callback` (PR #283) gravar a linha e abrir o alerta interno —
  os dois lados são DDL/edge da #283, não código novo deste PR.
- **Evidência:** `_shared/messaging/inbound.test.ts` — testes "SAIR e PARAR sao pedido de descadastro" e "CANCELAR nao descadastra"

### 118 — [L] Registro no Bitrix24
- [ ] Mensagens enviadas/recebidas viram atividade no item SPA 1690 (`bitrix24_activities`, fila existente)
- **Evidência:** atividade visível no item do pedido

## Bloco 10 — SMS (119–130)

### 119 — [L] Interface `SmsChannel`
- [x] `send(to, text, ref)`, `parseDeliveryReport(req)`, `parseInbound(req)`; resultado no mesmo formato do canal Zapp
- **Evidência:** `supabase/functions/_shared/channels/sms.ts` exporta `SmsChannel`; `sms.test.ts` cobre DLR e inbound dos dois provedores (PR #281)

### 120 — [L] Provedor principal (Z2)
- [~] Comtele (`auth-key`) e Zenvia (`X-API-TOKEN`) implementados com `AbortSignal.timeout(10_000)` e erro prefixado pelo provedor
- **Evidência:** `createComteleChannel`/`createZenviaChannel` em `_shared/channels/sms.ts`; payload conferido em teste. **Falta:** provedor escolhido (Z2) e SMS real no número interno — sem `SMS_PROVIDER_API_KEY` nenhum envio aconteceu

### 121 — [L] Seletor de provedor
- [~] Seletor por env `SMS_PROVIDER` (`comtele` | `zenvia`), devolvendo `null` sem secret
- **Evidência:** `smsChannelFromEnv()` em `_shared/channels/sms.ts`, coberto por teste. **Falta:** ler de `messaging_settings.sms_provider` (tabela do Bloco 6, DDL pendente) para trocar sem deploy

### 122 — [L] Secrets SMS 🔒
- [ ] `SMS_PROVIDER_API_KEY`, `SMS_WEBHOOK_SECRET`, remetente — só nas edges
- **Evidência:** `list_secrets` mostra os nomes

### 123 — [L] Remetente
- [ ] Remetente do provedor (código curto, número longo ou alfanumérico) e cadastro de modelo se o provedor exigir
- **Evidência:** SMS chega identificado

### 124 — [L] Texto SMS econômico
- [x] Transliteração de acentos (evita a codificação de 70 caracteres), contador de segmentos, corte seguro em 160
- **Evidência:** `toGsm7`/`smsSegments`/`composeSmsText` em `_shared/channels/sms.ts`; `sms.test.ts` prova 160 no 1º segmento e 153 nos seguintes, e que acento não cai para UCS-2 (PR #281)

### 125 — [L] Link curto no SMS
- [x] Usar `share_link` da Lalamove ou rota curta própria para detalhes
- **Evidência:** `shareLink` em `send-notification/sms-dispatch.ts` (`buildSmsBody`) entra sempre no fim do SMS — mesmo quando o template do operador não inclui `{{share_link}}` — porque o SMS não leva o mapa estático do WhatsApp. `send-notification/index.ts` lê de `metadata.share_link`; 2 testes em `sms-dispatch.test.ts`. **Falta:** rota curta própria (`lalamo.ve/…`) — hoje o link da Lalamove tem ~90 caracteres e come um segmento do SMS.

### 126 — [L] Edge `sms-callback`
- [ ] Recibo de entrega (DLR) com verificação da assinatura do provedor → ledger
- **Evidência:** status `delivered` gravado após SMS real

### 127 — [L] Resposta por SMS
- [ ] Inbound do provedor → mesmo interpretador da etapa 113
- **Evidência:** resposta "1" por SMS confirma

### 128 — [L] Opt-out por SMS
- [~] "SAIR" → `notification_optouts`; texto de saída no 1º SMS ao número
- **Estado real:** o reconhecimento existe e está testado — `isOptOutKeyword()` e
  `classifyInbound()` em `_shared/messaging/inbound.ts` devolvem `intent: "optout"` para
  SAIR/PARAR/descadastrar e **não** para CANCELAR (que segue sendo recusa de corrida do
  motorista). Falta o consumidor gravar: o `zapp-callback` (branch da PR #283) normaliza o
  inbound mas ainda não chama `classifyInbound` nem grava em `notification_optouts` — a
  tabela já existe (`20261123200000_optout_and_tracking_end.sql`) e o leitor
  `is_phone_opted_out()` já é usado no `send-notification:413`. O 1º SMS também ainda não
  carrega o rodapé de saída.
- **Evidência:** `_shared/messaging/inbound.test.ts` — 4 testes de opt-out (PR #281)

### 129 — [L] Custo e teto (Z5)
- [ ] Custo por segmento → `messaging_usage`; 80 % alerta, 100 % bloqueia (exceto M8)
- **Evidência:** simulação de teto atingido

### 130 — [L] Teste ponta a ponta do SMS
- [ ] Envio, DLR, resposta e opt-out no número interno
- **Evidência:** 4 linhas no ledger com status corretos

## Bloco 11 — Lalamove: telas (131–139)

### 131 — [L] Aba "Comunicação" no pedido
- [ ] Timeline enviada/recebida, canal, status, custo, operador; realtime
- **Evidência:** rota existente (`OrdersPage`) com a aba; teste de componente

### 132 — [L] Mensagem manual ao motorista
- [ ] Template ou texto livre, confirmação antes de enviar, `operator`+ (Z10)
- **Evidência:** envio manual aparece no aparelho e no ledger

### 133 — [L] Admin > Mensageria
- [~] Estado do Zapp (`/health`), provedor SMS, botão "enviar teste"; `requireMFA`; rota em `src/App.tsx` + `sidebar-config.ts`
- **Evidência:** tela acessível só a admin com MFA
  **Estado real:** a tela existe e cobre a maior parte da etapa — `src/pages/MessagingSettingsPage.tsx`, rota `/settings/messaging` com `requireMFA` em `src/App.tsx`, item em `src/components/layout/sidebar-config.ts` (admin). Aba **Provedores**: provedor de WhatsApp, provedor de SMS, fallback em minutos, teto mensal em R$, `shadow_mode` e `pilot_mode`, com a lista de bloqueios que impedem envio real. **Botao "enviar teste" entregue:** a aba Provedores envia uma mensagem real e a edge `test-notification` usa o mesmo remetente do motor (Zapp quando configurado, senao Evolution) — `supabase/functions/_shared/channels/whatsapp-test.ts` + `useSendTestWhatsApp` em `src/hooks/useMessaging.ts`. **Falta:** `/health` do Zapp (endpoint nao documentado no repo) e as secrets `ZAPP_API_URL`/`ZAPP_API_KEY`, que hoje nao existem no projeto: sem elas nenhum canal de WhatsApp envia e o botao de teste responde exatamente isso ao operador.

### 134 — [L] Editor de templates
- [~] Prévia com dados de um pedido real, variáveis disponíveis, contador SMS, versionamento
- **Evidência:** editar M1 muda a próxima mensagem
  **Estado real:** aba **Templates** versiona de verdade (`useSaveTemplateVersion` insere `version+1` ativa e desativa as anteriores), com variaveis disponiveis, contador de segmentos SMS (160 caracteres) e previa `{{var}}`. **Falta:** previa com dados de um pedido real — hoje usa valores de exemplo (`PREVIEW_VALUES`).

### 135 — [L] Matriz evento × papel
- [x] Ligar/desligar, ordem de canais, prazo de fallback, exige resposta
- **Evidência:** desligar M10 para o motorista → nenhuma mensagem M10
  **Estado real:** aba **Rotas** liga/desliga cada evento, edita `fallback_after_min` e `reply_timeout_min`, e agora tambem edita a **ordem dos canais** (mover cima/baixo, remover, adicionar entre `whatsapp`, `sms`, `email`, `slack`, `n8n`) e o campo `requires_reply` - `RouteRow` em `src/pages/MessagingSettingsPage.tsx` + `useUpdateNotificationRoute`, que passou a filtrar por `(event, role)`, a chave real de `notification_routes` (14 eventos em producao). Corrigido tambem o `Salvar` que mandava `reply_timeout_min = 0` e era recusado pelo CHECK `reply_timeout_min IS NULL OR > 0`: o campo vazio agora vai como `null`. Validacao na UI: rota nao salva sem canal e rota que exige resposta exige prazo maior que zero.

### 136 — [L] Opt-outs
- [x] Listar, adicionar, remover com motivo (admin)
- **Evidência:** CRUD funcionando com RLS
  **Estado real:** aba **Opt-outs** lista, adiciona (telefone normalizado pelos digitos, mesma chave de `is_phone_opted_out`) e remove com motivo. Escrita/leitura so para admin — as policies de `notification_optouts` nao tem SELECT para operador, por isso a rota exige `admin`.

### 137 — [L] Uso e custo
- [x] Mensagens e custo por dia/mês/canal, barra do teto
- **Evidência:** números batem com `messaging_usage`
  **Estado real:** aba **Uso e custo** consome `messaging_month_cost_cents()` e os ultimos 60 registros de `messaging_usage` (mensagens, segmentos, custo por dia/canal) com barra do teto e aviso de teto nao definido.

### 138 — [L] Histórico de notificações no ledger
- [x] `NotificationHistoryPage` passa a ler `notification_messages`; `alerts_sent` fica só como legado
  **Estado real:** `useNotificationHistory` busca o ledger (`notification_messages`) e o legado (`alerts_sent`) em paralelo, mapeia o ledger para a timeline (`mapLedgerRow`, com evento, papel, provedor, tentativa e corpo) e une as duas fontes ordenadas por data, limitadas a 200 linhas - nenhum envio antigo sumiu da tela. Os cards de `useNotificationStats` somam as duas fontes (`read` conta como entregue; `expired`/`uncertain`/`suppressed` como falha). A pagina ganhou canal **SMS** (icone, cor, filtro), os status novos (`Na fila`, `Lida`, `Incerta`, `Expirada`, `Suprimida`) no badge e no filtro, e mostra o **corpo enviado** com o provedor no detalhe. Producao hoje: `notification_messages` = 0 linhas, `alerts_sent` = 0 linhas - migracao sem regressao de historico; o legado continua na uniao para quando voltar a ser escrito.
- **Evidência:** `NotificationHistoryPage.geo.test.tsx` adaptado e verde

### 139 — [L] Estados e testes das telas
- [x] Carregando, erro e vazio em todas as telas novas; vitest + tsc + eslint
- **Evidência:** CI verde (`lint-and-typecheck`, `test`, `build`)
  **Estado real:** a tela nova cobre carregando, erro com "tentar novamente", vazio e ausencia de config; `src/pages/MessagingSettingsPage.test.tsx` com 4 testes. `tsc` sem erros, `eslint` limpo, `vitest run src/pages src/hooks` = 30 arquivos / 167 testes verdes.

## Bloco 12 — Observabilidade, custo, LGPD e segurança (140–144)

### 140 — [L][Z] Métricas
- [ ] % entregue, tempo até entregue, % fallback SMS, % motorista que confirmou, tempo de resposta do operador
- **Evidência:** painel com dados do piloto

### 141 — [L][Z] Alertas operacionais
- [ ] Zapp caído, falha > 20 %, teto de SMS 80/100 %, fila morta de callbacks
- **Evidência:** cada alerta disparado em simulação

### 142 — [L][Z] LGPD
- [~] Telefone mascarado em log (`+55 41 9****-8888`), base legal registrada, retenção (etapa 84), exclusão a pedido do titular
- **Estado real:** a máscara existe e está testada — `maskPhone()` em `_shared/phone.ts`
  devolve `+55 41 9****-8888` e `null` para número inválido (nunca uma máscara falsa), e os
  dois logs de envio (`[WhatsApp]` e `[SMS]` em `send-notification/index.ts`) já usam ela.
  Retenção está resolvida pela etapa 84 (`notification_messages_scrub_bodies` + cron, na
  migration da PR #283). **Falta:** base legal registrada em documento e o fluxo de exclusão
  a pedido do titular — os dois são processo, não código.
- **Evidência:** 3 testes em `_shared/phone.test.ts` (PR #281); `grep` no log de envio não mostra dígitos completos

### 143 — [L][Z] Revisão de segurança
- [ ] HMAC nos dois sentidos, rotação de chave testada, MFA nas telas, nenhum segredo em `VITE_*`
- **Evidência:** checklist assinado na PR; `security` do CI verde

### 144 — [L][Z] Runbook
- [x] `docs/agentes/mensageria.md`: número banido, conexão caída, provedor SMS fora, fila morta, rotação de chave
- **Evidência:** `docs/agentes/mensageria.md` criado e referenciado em `AGENTS.md` > "Serviços" (PR #281);
  guarda `scripts/ci/check-agents-md-integrity.mjs` passa com 8 seções

## Bloco 13 — Testes, piloto e liberação (145–150)

### 145 — [L] Feature flags e modo sombra
- [ ] Flag por evento M1–M12 em `feature_flags`; `shadow_mode` grava o ledger sem enviar
- **Evidência:** 1 semana em sombra com ledger coerente com os pedidos

### 146 — [L][Z] E2E ponta a ponta
- [ ] Playwright + número E2E: pedido → M1 → resposta → timeline; harness SQL do motor
- **Evidência:** job `E2E (Playwright)` verde

### 147 — [L] Piloto interno
- [ ] Pedidos de teste com "motorista" = número interno, via `simulate-driver-movement`
- **Evidência:** M1–M12 recebidos e respondidos

### 148 — [L] Piloto real
- [ ] 1 semana só com M1, M5 e M8 + fallback SMS, número de logística (Z1)
- **Evidência:** relatório: entregues, lidos, fallback, respostas, custo

### 149 — [L] Liberação gradual
- [ ] Ligar M2–M4, M6, M7, M9–M12 em 2 ondas, olhando as métricas da etapa 140
- **Evidência:** flags ligadas e métricas estáveis por 7 dias

### 150 — [L][Z] Revisão de 30 dias e encerramento do plano
- [ ] Ajustar templates e prazos com os dados reais; marcar o plano como concluído no cabeçalho
- **Evidência:** cabeçalho atualizado; pendências restantes viram itens em `docs/agentes/pendencias-dono.md`

---

## Ordem de execução recomendada (caminho crítico)

1 → 2/3 → 11–20 → 21–33 → 37–40 → 51–55 → 73 → 85–92 → 96 → 99/101/108 → 145 → 147 → 148.
SMS (119–130) anda em paralelo a partir da etapa 4; telas (131–139) a partir da etapa 73.
