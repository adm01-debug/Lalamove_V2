# public.job_queue

> Fila assincrona (webhook, notificacao, POD, sync). Recriada no baseline 2026-11 por drift: estava no ledger mas ausente na producao.

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
| 2 | `type` | `text` | não |  |  |  |
| 3 | `payload` | `jsonb` | não |  |  |  |
| 4 | `status` | `text` | não | `'PENDING'::text` |  |  |
| 5 | `attempts` | `integer` | não | `0` |  |  |
| 6 | `max_attempts` | `integer` | não | `3` |  |  |
| 7 | `error_message` | `text` | sim |  |  |  |
| 8 | `error_stack` | `text` | sim |  |  |  |
| 9 | `next_retry_at` | `timestamp with time zone` | sim |  |  |  |
| 10 | `started_at` | `timestamp with time zone` | sim |  |  |  |
| 11 | `completed_at` | `timestamp with time zone` | sim |  |  |  |
| 12 | `priority` | `integer` | não | `5` |  |  |
| 13 | `dedup_key` | `text` | sim |  |  |  |
| 14 | `metadata` | `jsonb` | não | `'{}'::jsonb` |  |  |
| 15 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 16 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |
| 17 | `created_by` | `uuid` | sim |  |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| job_queue_created_by_fkey | FOREIGN KEY | `FOREIGN KEY (created_by) REFERENCES auth.users(id)` | NO ACTION | NO ACTION | sim |
| job_queue_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| job_queue_priority_check | CHECK | `CHECK (priority >= 1 AND priority <= 10)` |  |  | sim |
| job_queue_status_check | CHECK | `CHECK (status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text, 'CANCELLED'::text]))` |  |  | sim |
| job_queue_type_check | CHECK | `CHECK (type = ANY (ARRAY['webhook'::text, 'notification'::text, 'evaluation'::text, 'bitrix_sync'::text, 'email'::text, 'whatsapp'::text, 'slack'::text, 'lalamove_sync'::text, 'pod_fetch'::text]))` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_job_queue_monitoring | btree | type, status, created_at | não | sim |  | `CREATE INDEX idx_job_queue_monitoring ON public.job_queue USING btree (type, status, created_at DESC)` |
| idx_job_queue_pending | btree | next_retry_at, priority | não | sim | `(status = 'PENDING'::text)` | `CREATE INDEX idx_job_queue_pending ON public.job_queue USING btree (next_retry_at, priority DESC) WHERE (status = 'PENDING'::text)` |
| idx_job_queue_status | btree | status | não | sim |  | `CREATE INDEX idx_job_queue_status ON public.job_queue USING btree (status)` |
| idx_job_queue_type | btree | type | não | sim |  | `CREATE INDEX idx_job_queue_type ON public.job_queue USING btree (type)` |
| job_queue_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX job_queue_pkey ON public.job_queue USING btree (id)` |
| uq_job_queue_dedup_open | btree | dedup_key | sim | sim | `((dedup_key IS NOT NULL) AND (status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text])))` | `CREATE UNIQUE INDEX uq_job_queue_dedup_open ON public.job_queue USING btree (dedup_key) WHERE ((dedup_key IS NOT NULL) AND (status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text])))` |


## Policies (RLS)

### `Admins view jobs`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |

### `Service role full access`

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
| trigger_update_job_queue_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_job_queue_updated_at |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
