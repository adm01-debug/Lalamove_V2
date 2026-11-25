# public.auth_logs

> Auditoria de autenticacao: IP, user agent e evento de cada acesso.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 3 |
| realtime (publication) | sim |
| replica identity | full |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `user_id` | `uuid` | sim |  |  |  |
| 3 | `event_type` | `text` | não |  |  |  |
| 4 | `ip_address` | `inet` | sim |  |  |  |
| 5 | `user_agent` | `text` | sim |  |  |  |
| 6 | `success` | `boolean` | sim | `true` |  |  |
| 7 | `failure_reason` | `text` | sim |  |  |  |
| 8 | `metadata` | `jsonb` | sim | `'{}'::jsonb` |  |  |
| 9 | `created_at` | `timestamp with time zone` | sim | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| auth_logs_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| auth_logs_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX auth_logs_pkey ON public.auth_logs USING btree (id)` |
| idx_auth_logs_created | btree | created_at | não | sim |  | `CREATE INDEX idx_auth_logs_created ON public.auth_logs USING btree (created_at DESC)` |
| idx_auth_logs_event_created | btree | event_type, created_at | não | sim |  | `CREATE INDEX idx_auth_logs_event_created ON public.auth_logs USING btree (event_type, created_at DESC)` |
| idx_auth_logs_failures | btree | created_at | não | sim | `(success = false)` | `CREATE INDEX idx_auth_logs_failures ON public.auth_logs USING btree (created_at DESC) WHERE (success = false)` |
| idx_auth_logs_user_created | btree | user_id, created_at | não | sim | `(user_id IS NOT NULL)` | `CREATE INDEX idx_auth_logs_user_created ON public.auth_logs USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL)` |


## Policies (RLS)

### `Admins can view all auth logs`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK |  |

### `Authenticated can insert auth logs`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'operator'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role))` |

### `Users can view own auth logs`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(( SELECT auth.uid() AS uid) = user_id)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| sanitize_auth_log_metadata_trigger | BEFORE | INSERT | ROW | enabled | public.sanitize_auth_log_metadata |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
