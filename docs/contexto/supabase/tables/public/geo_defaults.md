# public.geo_defaults

> Parametros globais de geofence/notificacao (raio, ETA, horario silencioso).

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
| 1 | `id` | `boolean` | não | `true` |  |  |
| 2 | `approach_radius_m` | `integer` | não | `500` |  |  |
| 3 | `approach_eta_min` | `integer` | não | `5` |  |  |
| 4 | `arrived_radius_m` | `integer` | não | `100` |  |  |
| 5 | `off_route_threshold_m` | `integer` | não | `300` |  |  |
| 6 | `notify_delivery_contact` | `boolean` | não | `false` |  |  |
| 7 | `quiet_hours_start` | `time without time zone` | não | `'07:00:00'::time without time zone` |  |  |
| 8 | `quiet_hours_end` | `time without time zone` | não | `'20:00:00'::time without time zone` |  |  |
| 9 | `quiet_hours_tz` | `text` | não | `'America/Sao_Paulo'::text` |  |  |
| 10 | `updated_by` | `uuid` | sim |  |  |  |
| 11 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |
| 12 | `late_tolerance_min` | `integer` | não | `15` |  | Minutos de atraso tolerados antes de emitir ETA_DELAY (etapa 50). Junto com lalamove_orders.scheduled_at. |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| geo_defaults_id_check | CHECK | `CHECK (id)` |  |  | sim |
| geo_defaults_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| geo_defaults_updated_by_fkey | FOREIGN KEY | `FOREIGN KEY (updated_by) REFERENCES auth.users(id)` | NO ACTION | NO ACTION | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| geo_defaults_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX geo_defaults_pkey ON public.geo_defaults USING btree (id)` |


## Policies (RLS)

### `geo_defaults_admin_all`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | public |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK | `has_role(auth.uid(), 'admin'::app_role)` |

### `geo_defaults_read_authenticated`

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
| trg_geo_defaults_audit | AFTER | UPDATE | ROW | enabled | public.geo_audit_config |
| update_geo_defaults_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
