# public.lalamove_webhook_config

> URL de webhook registrada na Lalamove por ambiente (GET /v3/webhook retorna 405, mantemos o registro).

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
| 2 | `environment` | `text` | não | `'production'::text` |  |  |
| 3 | `url` | `text` | não |  |  |  |
| 4 | `is_active` | `boolean` | não | `true` |  |  |
| 5 | `registered_at` | `timestamp with time zone` | não | `now()` |  |  |
| 6 | `registered_by` | `uuid` | sim |  |  |  |
| 7 | `notes` | `text` | sim |  |  |  |
| 8 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 9 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_webhook_config_environment_check | CHECK | `CHECK (environment = ANY (ARRAY['sandbox'::text, 'production'::text]))` |  |  | sim |
| lalamove_webhook_config_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| lalamove_webhook_config_registered_by_fkey | FOREIGN KEY | `FOREIGN KEY (registered_by) REFERENCES auth.users(id)` | NO ACTION | NO ACTION | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| lalamove_webhook_config_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_webhook_config_pkey ON public.lalamove_webhook_config USING btree (id)` |
| lalamove_webhook_config_registered_by_idx | btree | registered_by | não | sim |  | `CREATE INDEX lalamove_webhook_config_registered_by_idx ON public.lalamove_webhook_config USING btree (registered_by)` |
| uq_webhook_config_active_env | btree | environment | sim | sim | `is_active` | `CREATE UNIQUE INDEX uq_webhook_config_active_env ON public.lalamove_webhook_config USING btree (environment) WHERE is_active` |


## Policies (RLS)

### `Admins manage webhook config`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
