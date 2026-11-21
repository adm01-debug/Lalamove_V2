# public.map_settings_overrides

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
| 2 | `user_id` | `uuid` | sim |  |  |  |
| 3 | `context_key` | `text` | não |  |  |  |
| 4 | `geofence_radius` | `integer` | sim |  |  |  |
| 5 | `off_route_threshold` | `integer` | sim |  |  |  |
| 6 | `stopped_threshold` | `integer` | sim |  |  |  |
| 7 | `created_at` | `timestamp with time zone` | sim | `now()` |  |  |
| 8 | `updated_at` | `timestamp with time zone` | sim | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| map_settings_overrides_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| map_settings_overrides_user_id_context_key_key | UNIQUE | `UNIQUE (user_id, context_key)` |  |  | sim |
| map_settings_overrides_user_id_fkey | FOREIGN KEY | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| map_settings_overrides_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX map_settings_overrides_pkey ON public.map_settings_overrides USING btree (id)` |
| map_settings_overrides_user_id_context_key_key | btree | user_id, context_key | sim | sim |  | `CREATE UNIQUE INDEX map_settings_overrides_user_id_context_key_key ON public.map_settings_overrides USING btree (user_id, context_key)` |


## Policies (RLS)

### `Users can manage their own settings overrides`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(auth.uid() = user_id)` |
| WITH CHECK | `(auth.uid() = user_id)` |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| update_map_settings_overrides_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
