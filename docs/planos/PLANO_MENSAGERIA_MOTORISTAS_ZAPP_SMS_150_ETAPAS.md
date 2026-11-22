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
- [ ] Aplicar `supabase/migrations/20261123200000_optout_and_tracking_end.sql` pelo fluxo de `docs/agentes/banco.md`
- [ ] Conferir `notification_optouts` e `is_phone_opted_out` no banco
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
- [ ] `id, alert_id, order_id, driver_id, stop_id, event, role (driver|pickup_contact|delivery_contact|internal), direction (outbound|inbound), channel (whatsapp|sms|email|slack), provider, recipient_phone, client_message_id unique, provider_message_id, template_key, template_version, body_preview, status, error_code, attempt, fallback_of uuid, cost_cents, segments, sent_at, delivered_at, read_at, failed_at, expires_at, created_at`
- **Evidência:** migration mergeada e aplicada; `describe_table` confere

### 74 — [L] Máquina de estados
- [ ] `queued → sent → delivered → read`; `failed`, `uncertain`, `expired`, `suppressed` terminais; transição inválida rejeitada por função
- **Evidência:** teste SQL em Postgres descartável

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
- [ ] `(order_id, created_at)`, `unique(client_message_id)`, `unique(provider, provider_message_id)`, `(status) where status in ('queued','sent')`
- **Evidência:** `EXPLAIN` da timeline do pedido usa índice

### 84 — [L] Retenção (Z8)
- [ ] `pg_cron` diário zera `body_preview`/mídia > 90 dias e mantém metadados
- **Evidência:** job em `cron.job`; execução registrada em `cron_job_logs`

## Bloco 7 — Lalamove: motor de comunicação (85–98)

### 85 — [L] Módulo `_shared/messaging/`
- [ ] Extrair de `send-notification` o despacho WhatsApp/SMS para `channels/`, `router.ts`, `ledger.ts` — e-mail, Slack, Bitrix24 e n8n ficam onde estão
- **Evidência:** testes atuais de `send-notification` verdes sem alteração

### 86 — [L] Canal Zapp completo
- [ ] `zapp.ts` envia `client_message_id`, `correlation`, `expires_at`; lê `202 {message_id}`; mapeia os códigos da etapa 14
- **Evidência:** teste de unidade com `fetchImpl` injetado

### 87 — [L] Secrets do Zapp 🔒
- [ ] `ZAPP_API_URL`, `ZAPP_API_KEY` (chave `zik_` da etapa 22), `ZAPP_CALLBACK_SECRET` nas edges
- **Evidência:** `list_secrets` mostra os 3 nomes

### 88 — [L] Roteador evento × papel
- [ ] Lê `notification_routes`, monta a lista ordenada de canais e o template por canal
- **Evidência:** teste: `ORDER_CANCELLED/driver` → `[sms, whatsapp]`

### 89 — [L] Idempotência
- [ ] `client_message_id = uuidv5(order_id|event|role|telefone|seq)`; reprocessar o mesmo evento não duplica mensagem
- **Evidência:** webhook repetido gera 1 linha no ledger

### 90 — [L] Fallback temporizado
- [ ] WhatsApp sem `delivered` em `sms_fallback_after_min` → `job_queue` tipo `message_fallback` envia SMS
- **Evidência:** teste com Zapp sem callback → SMS sai no prazo

### 91 — [L] Fallback imediato
- [ ] `invalid_number`, `instance_unavailable`, `recipient_blocked`, `channel.status=down` → SMS na hora
- **Evidência:** cada código testado

### 92 — [L] Opt-out unificado
- [ ] Consulta `is_phone_opted_out` antes de qualquer canal; opt-out do motorista gera alerta interno (a operação precisa de outro meio)
- **Evidência:** número em opt-out → `suppressed` no ledger

### 93 — [L] Horário de silêncio por papel (Z9)
- [ ] Motorista com pedido ativo isento; fornecedor/cliente seguem `geo_defaults`
- **Evidência:** teste às 22 h: motorista recebe, fornecedor é adiado

### 94 — [L] Deduplicação
- [ ] `claim_alert_notification` com chave `event:order:role` para os eventos M*
- **Evidência:** ETA oscilando gera 1 mensagem por janela

### 95 — [L] Limite por motorista
- [ ] No máximo 6 mensagens automáticas a cada 10 min por motorista (exceto M8)
- **Evidência:** teste de rajada

### 96 — [L] Edge `zapp-callback`
- [ ] Verifica HMAC e janela anti-replay; atualiza ledger (status/sequência); grava inbound; responde 2xx rápido
- [ ] Rota de leitura para o cartão do Zapp (etapa 67), autenticada pela mesma chave
- **Evidência:** callback assinado → 200; assinatura errada → 401

### 97 — [L] Compatibilidade com `alerts_sent`
- [ ] Continuar gravando `alerts_sent` até a etapa 138 migrar a tela
- **Evidência:** `NotificationHistoryPage` continua mostrando envios

### 98 — [L] Testes de contrato do motor
- [ ] `deno test` para roteador, idempotência, fallback, opt-out, silêncio, limite
- **Evidência:** job `Deno Contract Tests` verde

## Bloco 8 — Lalamove: eventos ao motorista (99–112)

### 99 — [L] Telefone do motorista confiável
- [ ] Em `DRIVER_ASSIGNED`: buscar dados do motorista na API v3, gravar `lalamove_orders.driver_phone` e `drivers.phone` normalizados; UAPI como reserva
- **Evidência:** pedido novo com `driver_phone` em E.164 (consulta)

### 100 — [L] Troca de motorista
- [ ] `ORDER_REPLACED`/`lalamove_order_replacements`: M8 ao motorista antigo e M1 ao novo
- **Evidência:** simulação de troca gera as 2 mensagens

### 101 — [L] M1 Briefing de atribuição
- [ ] Variáveis: pedido interno, endereço/janela da coleta, responsável, instruções, link de rota (`share_link`)
- **Evidência:** mensagem real no piloto

### 102 — [L] M2 Confirmação com prazo
- [ ] Sem resposta em `reply_timeout_min` → alerta interno `DRIVER_NO_CONFIRMATION` (tipo novo com linha em `alert_configurations`)
- **Evidência:** teste sem resposta gera o alerta

### 103 — [L] M3 Localização e contato
- [ ] `send-location` da coleta + `send-contact` do responsável
- **Evidência:** recebidos no aparelho

### 104 — [L] M4 Chegada na coleta
- [ ] Gatilho `DRIVER_ARRIVED_PICKUP` (geofence do plano Google)
- **Evidência:** simulação com `simulate-driver-movement`

### 105 — [L] M5 Pós-coleta
- [ ] Gatilho `PICKED_UP`; inclui exigência de comprovante quando `requires_pod`
- **Evidência:** mensagem no piloto

### 106 — [L] M6 Multi-paradas
- [ ] Ao concluir parada (`lalamove_stops.completed_at`), envia a próxima
- **Evidência:** pedido com 3 paradas gera 2 mensagens M6

### 107 — [L] M7 Pedido editado
- [ ] `ORDER_EDITED`: diferença antes → depois (endereço, contato, horário)
- **Evidência:** teste com edição de endereço

### 108 — [L] M8 Cancelamento
- [ ] SMS + WhatsApp em paralelo, ignora teto de custo
- **Evidência:** cancelamento no piloto chega pelos 2 canais

### 109 — [L] M9 Lembrete de comprovante
- [ ] Gatilho `MISSING_POD`; foto recebida (etapa 116) encerra o lembrete
- **Evidência:** teste

### 110 — [L] M10 Checagem de atraso/parada/desvio
- [ ] Gatilhos `ETA_DELAY`, `DRIVER_STOPPED`, `ROUTE_DEVIATION`; resposta vira motivo no pedido
- **Evidência:** resposta "1" grava motivo "trânsito"

### 111 — [L] M11 Pedido agendado
- [ ] `job_queue` agenda o lembrete para `scheduled_at − 30 min`; cancela se o pedido mudar
- **Evidência:** job criado e executado no horário

### 112 — [L] M12 Encerramento
- [ ] `COMPLETED`: agradecimento; fecha a correlação para respostas posteriores irem só à fila humana
- **Evidência:** resposta após M12 não altera o pedido

## Bloco 9 — Lalamove: respostas do motorista (113–118)

### 113 — [L] Interpretador de respostas
- [ ] Ordem: id de opção → número "1/2/3" → palavras-chave ("cheguei", "a caminho", "problema", "coletado") → texto livre
- **Evidência:** tabela de casos em teste de unidade

### 114 — [L] Ações por resposta
- [ ] Confirmação → `tracking_events` + `metadata.driver_confirmed_at`; problema → `driver_incidents` + alerta interno
- **Evidência:** resposta "2" abre incidente

### 115 — [L] Texto livre
- [ ] Vai para a timeline e sinaliza "aguardando operador" (a conversa já está na fila do Zapp)
- **Evidência:** badge no pedido

### 116 — [L] Mídia recebida
- [ ] Foto como comprovante → `lalamove_stop_proofs` (pendente de validação); avaria → anexo do incidente
- **Evidência:** foto do piloto aparece no pedido

### 117 — [L] Opt-out do motorista
- [ ] Callback `contact.optout` → `notification_optouts` + alerta interno
- **Evidência:** "SAIR" no aparelho cria a linha

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
- [ ] Usar `share_link` da Lalamove ou rota curta própria para detalhes
- **Evidência:** link abre o acompanhamento

### 126 — [L] Edge `sms-callback`
- [ ] Recibo de entrega (DLR) com verificação da assinatura do provedor → ledger
- **Evidência:** status `delivered` gravado após SMS real

### 127 — [L] Resposta por SMS
- [ ] Inbound do provedor → mesmo interpretador da etapa 113
- **Evidência:** resposta "1" por SMS confirma

### 128 — [L] Opt-out por SMS
- [ ] "SAIR" → `notification_optouts`; texto de saída no 1º SMS ao número
- **Evidência:** teste com "SAIR"

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
- [ ] Estado do Zapp (`/health`), provedor SMS, botão "enviar teste"; `requireMFA`; rota em `src/App.tsx` + `sidebar-config.ts`
- **Evidência:** tela acessível só a admin com MFA

### 134 — [L] Editor de templates
- [ ] Prévia com dados de um pedido real, variáveis disponíveis, contador SMS, versionamento
- **Evidência:** editar M1 muda a próxima mensagem

### 135 — [L] Matriz evento × papel
- [ ] Ligar/desligar, ordem de canais, prazo de fallback, exige resposta
- **Evidência:** desligar M10 para o motorista → nenhuma mensagem M10

### 136 — [L] Opt-outs
- [ ] Listar, adicionar, remover com motivo (admin)
- **Evidência:** CRUD funcionando com RLS

### 137 — [L] Uso e custo
- [ ] Mensagens e custo por dia/mês/canal, barra do teto
- **Evidência:** números batem com `messaging_usage`

### 138 — [L] Histórico de notificações no ledger
- [ ] `NotificationHistoryPage` passa a ler `notification_messages`; `alerts_sent` fica só como legado
- **Evidência:** `NotificationHistoryPage.geo.test.tsx` adaptado e verde

### 139 — [L] Estados e testes das telas
- [ ] Carregando, erro e vazio em todas as telas novas; vitest + tsc + eslint
- **Evidência:** CI verde (`lint-and-typecheck`, `test`, `build`)

## Bloco 12 — Observabilidade, custo, LGPD e segurança (140–144)

### 140 — [L][Z] Métricas
- [ ] % entregue, tempo até entregue, % fallback SMS, % motorista que confirmou, tempo de resposta do operador
- **Evidência:** painel com dados do piloto

### 141 — [L][Z] Alertas operacionais
- [ ] Zapp caído, falha > 20 %, teto de SMS 80/100 %, fila morta de callbacks
- **Evidência:** cada alerta disparado em simulação

### 142 — [L][Z] LGPD
- [ ] Telefone mascarado em log (`+55 41 9****-8888`), base legal registrada, retenção (etapa 84), exclusão a pedido do titular
- **Evidência:** busca no log sem telefone completo

### 143 — [L][Z] Revisão de segurança
- [ ] HMAC nos dois sentidos, rotação de chave testada, MFA nas telas, nenhum segredo em `VITE_*`
- **Evidência:** checklist assinado na PR; `security` do CI verde

### 144 — [L][Z] Runbook
- [ ] `docs/agentes/mensageria.md`: número banido, conexão caída, provedor SMS fora, fila morta, rotação de chave
- **Evidência:** arquivo mergeado e listado no `AGENTS.md`

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
