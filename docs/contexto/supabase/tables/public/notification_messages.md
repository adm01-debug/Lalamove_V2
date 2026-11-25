# public.notification_messages

> Etapa 73: ledger de mensagens (outbound e inbound) ao motorista e aos contatos. Substitui alerts_sent como fonte de timeline; alerts_sent continua sendo escrito ate a etapa 138 migrar a tela.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 2 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `alert_id` | `uuid` | sim |  |  |  |
| 3 | `order_id` | `uuid` | sim |  |  |  |
| 4 | `driver_id` | `uuid` | sim |  |  |  |
| 5 | `stop_id` | `uuid` | sim |  |  |  |
| 6 | `event` | `text` | não |  |  |  |
| 7 | `role` | `text` | não |  |  |  |
| 8 | `direction` | `text` | não | `'outbound'::text` |  |  |
| 9 | `channel` | `text` | não |  |  |  |
| 10 | `provider` | `text` | sim |  |  |  |
| 11 | `recipient_phone` | `text` | sim |  |  |  |
| 12 | `client_message_id` | `text` | sim |  |  |  |
| 13 | `provider_message_id` | `text` | sim |  |  |  |
| 14 | `template_key` | `text` | sim |  |  |  |
| 15 | `template_version` | `integer` | sim |  |  |  |
| 16 | `body_preview` | `text` | sim |  |  |  |
| 17 | `status` | `text` | não | `'queued'::text` |  |  |
| 18 | `error_code` | `text` | sim |  |  |  |
| 19 | `attempt` | `integer` | não | `1` |  |  |
| 20 | `fallback_of` | `uuid` | sim |  |  |  |
| 21 | `cost_cents` | `integer` | sim |  |  |  |
| 22 | `segments` | `integer` | sim |  |  |  |
| 23 | `provider_sequence` | `bigint` | sim |  |  |  |
| 24 | `occurred_at` | `timestamp with time zone` | sim |  |  |  |
| 25 | `sent_at` | `timestamp with time zone` | sim |  |  |  |
| 26 | `delivered_at` | `timestamp with time zone` | sim |  |  |  |
| 27 | `read_at` | `timestamp with time zone` | sim |  |  |  |
| 28 | `failed_at` | `timestamp with time zone` | sim |  |  |  |
| 29 | `expires_at` | `timestamp with time zone` | sim |  |  |  |
| 30 | `metadata` | `jsonb` | não | `'{}'::jsonb` |  |  |
| 31 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 32 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| notification_messages_alert_id_fkey | FOREIGN KEY | `FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| notification_messages_channel_check | CHECK | `CHECK (channel = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text, 'slack'::text, 'n8n'::text]))` |  |  | sim |
| notification_messages_direction_check | CHECK | `CHECK (direction = ANY (ARRAY['outbound'::text, 'inbound'::text]))` |  |  | sim |
| notification_messages_fallback_of_fkey | FOREIGN KEY | `FOREIGN KEY (fallback_of) REFERENCES notification_messages(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| notification_messages_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| notification_messages_role_check | CHECK | `CHECK (role = ANY (ARRAY['driver'::text, 'pickup_contact'::text, 'delivery_contact'::text, 'internal'::text]))` |  |  | sim |
| notification_messages_status_check | CHECK | `CHECK (status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'uncertain'::text, 'expired'::text, 'suppressed'::text]))` |  |  | sim |


## Referenciada por (FKs de outras tabelas)

| tabela | constraint | colunas | on delete |
|---|---|---|---|
| public.notification_messages | notification_messages_fallback_of_fkey | fallback_of | SET NULL |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| notification_messages_alert_id_idx | btree | alert_id | não | sim |  | `CREATE INDEX notification_messages_alert_id_idx ON public.notification_messages USING btree (alert_id)` |
| notification_messages_client_message_id_key | btree | client_message_id | sim | sim | `(client_message_id IS NOT NULL)` | `CREATE UNIQUE INDEX notification_messages_client_message_id_key ON public.notification_messages USING btree (client_message_id) WHERE (client_message_id IS NOT NULL)` |
| notification_messages_driver_created_idx | btree | driver_id, created_at | não | sim |  | `CREATE INDEX notification_messages_driver_created_idx ON public.notification_messages USING btree (driver_id, created_at DESC)` |
| notification_messages_fallback_of_idx | btree | fallback_of | não | sim |  | `CREATE INDEX notification_messages_fallback_of_idx ON public.notification_messages USING btree (fallback_of)` |
| notification_messages_order_created_idx | btree | order_id, created_at | não | sim |  | `CREATE INDEX notification_messages_order_created_idx ON public.notification_messages USING btree (order_id, created_at DESC)` |
| notification_messages_pending_idx | btree | status | não | sim | `(status = ANY (ARRAY['queued'::text, 'sent'::text]))` | `CREATE INDEX notification_messages_pending_idx ON public.notification_messages USING btree (status) WHERE (status = ANY (ARRAY['queued'::text, 'sent'::text]))` |
| notification_messages_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX notification_messages_pkey ON public.notification_messages USING btree (id)` |
| notification_messages_provider_message_id_key | btree | provider, provider_message_id | sim | sim | `(provider_message_id IS NOT NULL)` | `CREATE UNIQUE INDEX notification_messages_provider_message_id_key ON public.notification_messages USING btree (provider, provider_message_id) WHERE (provider_message_id IS NOT NULL)` |
| notification_messages_recipient_created_idx | btree | recipient_phone, created_at | não | sim |  | `CREATE INDEX notification_messages_recipient_created_idx ON public.notification_messages USING btree (recipient_phone, created_at DESC)` |


## Policies (RLS)

### `operator le ledger de mensagens`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'operator'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role))` |
| WITH CHECK |  |

### `service role escreve ledger de mensagens`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | service_role |
| USING | `true` |
| WITH CHECK | `true` |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| notification_messages_touch_trg | BEFORE | UPDATE | ROW | enabled | public.notification_messages_touch |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
