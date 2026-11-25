# public.job_queue_processing_log

> Historico das rodadas do processador de fila (processados, sucesso, falha, duracao).

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 1 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `run_at` | `timestamp with time zone` | não | `now()` |  |  |
| 3 | `processed` | `integer` | não |  |  |  |
| 4 | `succeeded` | `integer` | não |  |  |  |
| 5 | `failed` | `integer` | não |  |  |  |
| 6 | `skipped` | `integer` | não |  |  |  |
| 7 | `duration_ms` | `integer` | sim |  |  |  |
| 8 | `metadata` | `jsonb` | não | `'{}'::jsonb` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| job_queue_processing_log_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_job_queue_processing_log_run_at | btree | run_at | não | sim |  | `CREATE INDEX idx_job_queue_processing_log_run_at ON public.job_queue_processing_log USING btree (run_at DESC)` |
| job_queue_processing_log_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX job_queue_processing_log_pkey ON public.job_queue_processing_log USING btree (id)` |


## Policies (RLS)

### `Admins read job queue processing log`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
