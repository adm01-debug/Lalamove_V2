# public.query_telemetry

> Telemetria de consultas (logica/duracao/erro) para auditoria.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 3 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `operation` | `text` | não | `'select'::text` |  |  |
| 3 | `table_name` | `text` | sim |  |  |  |
| 4 | `rpc_name` | `text` | sim |  |  |  |
| 5 | `duration_ms` | `integer` | não | `0` |  |  |
| 6 | `record_count` | `integer` | sim |  |  |  |
| 7 | `query_limit` | `integer` | sim |  |  |  |
| 8 | `query_offset` | `integer` | sim |  |  |  |
| 9 | `count_mode` | `text` | sim |  |  |  |
| 10 | `severity` | `text` | não | `'normal'::text` |  |  |
| 11 | `error_message` | `text` | sim |  |  |  |
| 12 | `user_id` | `uuid` | sim |  |  |  |
| 13 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| query_telemetry_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_query_telemetry_created_at | btree | created_at | não | sim |  | `CREATE INDEX idx_query_telemetry_created_at ON public.query_telemetry USING btree (created_at DESC)` |
| idx_query_telemetry_errors | btree | created_at | não | sim | `(severity = 'error'::text)` | `CREATE INDEX idx_query_telemetry_errors ON public.query_telemetry USING btree (created_at DESC) WHERE (severity = 'error'::text)` |
| idx_query_telemetry_operation_created | btree | operation, created_at | não | sim |  | `CREATE INDEX idx_query_telemetry_operation_created ON public.query_telemetry USING btree (operation, created_at DESC)` |
| idx_query_telemetry_rpc_created | btree | rpc_name, created_at | não | sim | `(rpc_name IS NOT NULL)` | `CREATE INDEX idx_query_telemetry_rpc_created ON public.query_telemetry USING btree (rpc_name, created_at DESC) WHERE (rpc_name IS NOT NULL)` |
| idx_query_telemetry_severity_created | btree | severity, created_at | não | sim |  | `CREATE INDEX idx_query_telemetry_severity_created ON public.query_telemetry USING btree (severity, created_at DESC)` |
| idx_query_telemetry_slow | btree | duration_ms, created_at | não | sim | `(duration_ms >= 3000)` | `CREATE INDEX idx_query_telemetry_slow ON public.query_telemetry USING btree (duration_ms DESC, created_at DESC) WHERE (duration_ms >= 3000)` |
| idx_query_telemetry_table_created | btree | table_name, created_at | não | sim | `(table_name IS NOT NULL)` | `CREATE INDEX idx_query_telemetry_table_created ON public.query_telemetry USING btree (table_name, created_at DESC) WHERE (table_name IS NOT NULL)` |
| query_telemetry_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX query_telemetry_pkey ON public.query_telemetry USING btree (id)` |


## Policies (RLS)

### `Admins can manage telemetry`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK | `has_role(auth.uid(), 'admin'::app_role)` |

### `Managers can view telemetry`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'manager'::app_role)` |
| WITH CHECK |  |

### `System can insert telemetry`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR can_run_db_diagnostics(auth.uid()))` |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
