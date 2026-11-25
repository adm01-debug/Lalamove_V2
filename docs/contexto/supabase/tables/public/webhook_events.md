# public.webhook_events

> Log completo de todos webhooks recebidos do Lalamove.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 4 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `event_type` | `text` | não |  |  |  |
| 3 | `lalamove_order_id` | `text` | sim |  |  |  |
| 4 | `raw_payload` | `jsonb` | não |  |  |  |
| 5 | `processed` | `boolean` | sim | `false` |  |  |
| 6 | `processed_at` | `timestamp with time zone` | sim |  |  |  |
| 7 | `error_message` | `text` | sim |  |  |  |
| 8 | `received_at` | `timestamp with time zone` | não | `now()` |  |  |
| 9 | `idempotency_key` | `text` | sim |  |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| webhook_events_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_webhook_events_event_type_received_at | btree | event_type, received_at | não | sim |  | `CREATE INDEX idx_webhook_events_event_type_received_at ON public.webhook_events USING btree (event_type, received_at DESC)` |
| idx_webhook_events_idempotency_key | btree | idempotency_key | sim | sim | `(idempotency_key IS NOT NULL)` | `CREATE UNIQUE INDEX idx_webhook_events_idempotency_key ON public.webhook_events USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL)` |
| idx_webhooks_order | btree | lalamove_order_id | não | sim |  | `CREATE INDEX idx_webhooks_order ON public.webhook_events USING btree (lalamove_order_id)` |
| idx_webhooks_processed | btree | processed | não | sim | `(processed = false)` | `CREATE INDEX idx_webhooks_processed ON public.webhook_events USING btree (processed) WHERE (processed = false)` |
| idx_webhooks_received | btree | received_at | não | sim |  | `CREATE INDEX idx_webhooks_received ON public.webhook_events USING btree (received_at DESC)` |
| idx_webhooks_type | btree | event_type | não | sim |  | `CREATE INDEX idx_webhooks_type ON public.webhook_events USING btree (event_type)` |
| webhook_events_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX webhook_events_pkey ON public.webhook_events USING btree (id)` |


## Policies (RLS)

### `Admins can delete events`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK |  |

### `Authorized roles can view webhook events`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role))` |
| WITH CHECK |  |

### `Managers can update events`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can insert events`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'operator'::app_role))` |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_notify_webhook_security_event | AFTER | INSERT | ROW | enabled | public.notify_webhook_security_event |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
