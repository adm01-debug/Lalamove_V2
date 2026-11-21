# public.lalamove_uapi_sessions

> Sessoes da Unified API da Lalamove (token e expiracao).

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
| 2 | `access_token` | `text` | não |  |  |  |
| 3 | `refresh_token` | `text` | não |  |  |  |
| 4 | `user_fid` | `text` | sim |  |  |  |
| 5 | `ep_role` | `integer` | sim | `1` |  |  |
| 6 | `city_id` | `integer` | sim | `21001` |  |  |
| 7 | `token_obtained_at` | `timestamp with time zone` | não | `now()` |  |  |
| 8 | `token_expires_at` | `timestamp with time zone` | não | `(now() + '24:00:00'::interval)` |  |  |
| 9 | `last_refreshed_at` | `timestamp with time zone` | sim |  |  |  |
| 10 | `refresh_method` | `text` | sim | `'manual'::text` |  |  |
| 11 | `is_active` | `boolean` | sim | `true` |  |  |
| 12 | `created_at` | `timestamp with time zone` | sim | `now()` |  |  |
| 13 | `updated_at` | `timestamp with time zone` | sim | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_uapi_sessions_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_uapi_sessions_active | btree | is_active | sim | sim | `(is_active = true)` | `CREATE UNIQUE INDEX idx_uapi_sessions_active ON public.lalamove_uapi_sessions USING btree (is_active) WHERE (is_active = true)` |
| lalamove_uapi_sessions_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_uapi_sessions_pkey ON public.lalamove_uapi_sessions USING btree (id)` |


## Policies (RLS)

### `Admins can manage UAPI sessions`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK | `has_role(auth.uid(), 'admin'::app_role)` |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
