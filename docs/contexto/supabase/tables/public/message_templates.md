# public.message_templates

> Textos aprovados por evento x canal (etapas 76/77). O SMS tem linha propria por causa do limite de 160 caracteres.

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
| 2 | `key` | `text` | não |  |  |  |
| 3 | `event` | `text` | não |  |  |  |
| 4 | `role` | `text` | não | `'driver'::text` |  |  |
| 5 | `channel` | `text` | não |  |  |  |
| 6 | `version` | `integer` | não | `1` |  |  |
| 7 | `body` | `text` | não |  |  |  |
| 8 | `variables` | `text[]` | não | `'{}'::text[]` |  |  |
| 9 | `max_length` | `integer` | sim |  |  |  |
| 10 | `is_active` | `boolean` | não | `true` |  |  |
| 11 | `updated_by` | `uuid` | sim |  |  |  |
| 12 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 13 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| message_templates_body_check | CHECK | `CHECK (length(btrim(body)) > 0)` |  |  | sim |
| message_templates_channel_check | CHECK | `CHECK (channel = ANY (ARRAY['whatsapp'::text, 'sms'::text]))` |  |  | sim |
| message_templates_key_channel_version_key | UNIQUE | `UNIQUE (key, channel, version)` |  |  | sim |
| message_templates_max_length_check | CHECK | `CHECK (max_length IS NULL OR max_length > 0)` |  |  | sim |
| message_templates_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| message_templates_role_check | CHECK | `CHECK (role = ANY (ARRAY['driver'::text, 'supplier'::text, 'customer'::text, 'internal'::text]))` |  |  | sim |
| message_templates_updated_by_fkey | FOREIGN KEY | `FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| message_templates_version_check | CHECK | `CHECK (version > 0)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| message_templates_active_key_idx | btree | key, channel | sim | sim | `is_active` | `CREATE UNIQUE INDEX message_templates_active_key_idx ON public.message_templates USING btree (key, channel) WHERE is_active` |
| message_templates_event_idx | btree | event, role, channel | não | sim | `is_active` | `CREATE INDEX message_templates_event_idx ON public.message_templates USING btree (event, role, channel) WHERE is_active` |
| message_templates_key_channel_version_key | btree | key, channel, version | sim | sim |  | `CREATE UNIQUE INDEX message_templates_key_channel_version_key ON public.message_templates USING btree (key, channel, version)` |
| message_templates_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX message_templates_pkey ON public.message_templates USING btree (id)` |
| message_templates_updated_by_idx | btree | updated_by | não | sim |  | `CREATE INDEX message_templates_updated_by_idx ON public.message_templates USING btree (updated_by)` |


## Policies (RLS)

### `admin edita templates`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |

### `equipe le templates`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'operator'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role))` |
| WITH CHECK |  |

### `service role gerencia templates`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | service_role |
| USING | `true` |
| WITH CHECK | `true` |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
