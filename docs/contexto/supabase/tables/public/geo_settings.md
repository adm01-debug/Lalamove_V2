# public.geo_settings

> Provedor de mapas por funcao (google|mapbox|off) com fallback. Admin edita em /settings/maps.

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
| 1 | `function` | `text` | não |  |  |  |
| 2 | `provider` | `text` | não |  |  |  |
| 3 | `fallback_provider` | `text` | sim |  |  |  |
| 4 | `config` | `jsonb` | não | `'{}'::jsonb` |  |  |
| 5 | `updated_by` | `uuid` | sim |  |  |  |
| 6 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| geo_settings_fallback_provider_check | CHECK | `CHECK (fallback_provider = ANY (ARRAY['google'::text, 'mapbox'::text, 'off'::text]))` |  |  | sim |
| geo_settings_function_check | CHECK | `CHECK (function = ANY (ARRAY['tiles'::text, 'autocomplete'::text, 'geocode'::text, 'reverse'::text, 'route'::text, 'matrix'::text, 'static'::text, 'snap'::text, 'validate'::text]))` |  |  | sim |
| geo_settings_pkey | PRIMARY KEY | `PRIMARY KEY (function)` |  |  | sim |
| geo_settings_provider_check | CHECK | `CHECK (provider = ANY (ARRAY['google'::text, 'mapbox'::text, 'off'::text]))` |  |  | sim |
| geo_settings_updated_by_fkey | FOREIGN KEY | `FOREIGN KEY (updated_by) REFERENCES auth.users(id)` | NO ACTION | NO ACTION | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| geo_settings_pkey | btree | function | sim | sim |  | `CREATE UNIQUE INDEX geo_settings_pkey ON public.geo_settings USING btree (function)` |


## Policies (RLS)

### `geo_settings_admin_all`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | public |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK | `has_role(auth.uid(), 'admin'::app_role)` |

### `geo_settings_read_authenticated`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(auth.role() = 'authenticated'::text)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_geo_settings_audit | AFTER | INSERT OR DELETE OR UPDATE | ROW | enabled | public.geo_audit_config |
| update_geo_settings_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
