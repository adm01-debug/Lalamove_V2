# public.cache_refresh_log

> Historico de refresh das materialized views de cache (inicio, fim, duracao, erro).

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
| usada por views | public.cache_status |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `view_name` | `text` | não |  |  |  |
| 3 | `refresh_started_at` | `timestamp with time zone` | não | `now()` |  |  |
| 4 | `refresh_completed_at` | `timestamp with time zone` | sim |  |  |  |
| 5 | `refresh_duration_ms` | `integer` | sim |  |  |  |
| 6 | `row_count` | `bigint` | sim |  |  |  |
| 7 | `status` | `text` | não | `'running'::text` |  |  |
| 8 | `error_message` | `text` | sim |  |  |  |
| 9 | `triggered_by` | `text` | não | `'system'::text` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| cache_refresh_log_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| cache_refresh_log_status_check | CHECK | `CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'failed'::text]))` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| cache_refresh_log_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX cache_refresh_log_pkey ON public.cache_refresh_log USING btree (id)` |
| idx_cache_refresh_log_running | btree | view_name | sim | sim | `(status = 'running'::text)` | `CREATE UNIQUE INDEX idx_cache_refresh_log_running ON public.cache_refresh_log USING btree (view_name) WHERE (status = 'running'::text)` |
| idx_cache_refresh_log_status | btree | status, refresh_started_at | não | sim |  | `CREATE INDEX idx_cache_refresh_log_status ON public.cache_refresh_log USING btree (status, refresh_started_at DESC)` |
| idx_cache_refresh_log_view | btree | view_name, refresh_started_at | não | sim |  | `CREATE INDEX idx_cache_refresh_log_view ON public.cache_refresh_log USING btree (view_name, refresh_started_at DESC)` |


## Policies (RLS)

### `Admins read cache refresh log`

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
