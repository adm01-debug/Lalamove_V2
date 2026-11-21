# public.audit_log

> Registro de auditoria de ações

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
| 2 | `user_id` | `uuid` | sim |  |  |  |
| 3 | `action` | `text` | não |  |  |  |
| 4 | `resource_type` | `text` | não |  |  |  |
| 5 | `resource_id` | `uuid` | não |  |  |  |
| 6 | `changes` | `jsonb` | sim |  |  |  |
| 7 | `ip_address` | `text` | sim |  |  |  |
| 8 | `user_agent` | `text` | sim |  |  |  |
| 9 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| audit_log_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| audit_log_user_id_fkey | FOREIGN KEY | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| audit_log_created_at_idx | btree | created_at | não | sim |  | `CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at DESC)` |
| audit_log_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX audit_log_pkey ON public.audit_log USING btree (id)` |
| audit_log_resource_idx | btree | resource_type, resource_id | não | sim |  | `CREATE INDEX audit_log_resource_idx ON public.audit_log USING btree (resource_type, resource_id)` |
| audit_log_user_id_idx | btree | user_id | não | sim |  | `CREATE INDEX audit_log_user_id_idx ON public.audit_log USING btree (user_id)` |


## Policies (RLS)

### `audit_log_insert`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | public |
| USING |  |
| WITH CHECK | `true` |

### `audit_log_select`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(auth.uid() IS NOT NULL)` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
