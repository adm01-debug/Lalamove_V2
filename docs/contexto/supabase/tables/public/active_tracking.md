# public.active_tracking

> Tracking em tempo real dos motoristas: velocidade, heading, ETA, deteccao de parada e desvio de rota.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | sim |
| policies | 5 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `order_id` | `uuid` | não |  |  |  |
| 3 | `driver_id` | `uuid` | não |  |  |  |
| 4 | `current_latitude` | `numeric(10,8)` | não |  |  |  |
| 5 | `current_longitude` | `numeric(11,8)` | não |  |  |  |
| 6 | `heading` | `numeric(5,2)` | sim | `0` |  |  |
| 7 | `speed` | `numeric(6,2)` | sim | `0` |  |  |
| 8 | `is_on_route` | `boolean` | sim | `true` |  |  |
| 9 | `is_stopped` | `boolean` | sim | `false` |  |  |
| 10 | `stopped_since` | `timestamp with time zone` | sim |  |  |  |
| 11 | `eta_minutes` | `integer` | sim |  |  |  |
| 12 | `last_updated` | `timestamp with time zone` | não | `now()` |  |  |
| 13 | `expected_route` | `jsonb` | sim |  |  |  |
| 14 | `tracking_status` | `text` | sim | `'ACTIVE'::text` |  |  |
| 15 | `tracking_started_at` | `timestamp with time zone` | sim | `now()` |  |  |
| 16 | `tracking_ended_at` | `timestamp with time zone` | sim |  |  |  |
| 17 | `alerts_sent` | `jsonb` | sim | `'[]'::jsonb` |  |  |
| 18 | `origin_lat` | `numeric(10,7)` | sim |  |  |  |
| 19 | `origin_lng` | `numeric(10,7)` | sim |  |  |  |
| 20 | `destination_lat` | `numeric(10,7)` | sim |  |  |  |
| 21 | `destination_lng` | `numeric(10,7)` | sim |  |  |  |
| 22 | `eta_updated_at` | `timestamp with time zone` | sim |  |  |  |
| 23 | `eta_provider` | `text` | sim |  |  |  |
| 24 | `route_provider` | `text` | sim |  |  |  |
| 25 | `route_distance_m` | `integer` | sim |  |  |  |
| 26 | `route_duration_s` | `integer` | sim |  |  |  |
| 27 | `route_computed_at` | `timestamp with time zone` | sim |  |  |  |
| 28 | `distance_to_route_m` | `numeric(10,1)` | sim |  |  |  |
| 29 | `distance_to_next_stop_m` | `numeric(10,1)` | sim |  |  |  |
| 30 | `next_stop_index` | `integer` | não | `0` |  |  |
| 31 | `near_stop_cycles` | `integer` | não | `0` |  |  |
| 32 | `off_route_cycles` | `integer` | não | `0` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| active_tracking_curlat_check | CHECK | `CHECK (current_latitude >= '-90'::integer::numeric AND current_latitude <= 90::numeric)` |  |  | sim |
| active_tracking_curlon_check | CHECK | `CHECK (current_longitude >= '-180'::integer::numeric AND current_longitude <= 180::numeric)` |  |  | sim |
| active_tracking_driver_id_fkey | FOREIGN KEY | `FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| active_tracking_dstlat_check | CHECK | `CHECK (destination_lat IS NULL OR destination_lat >= '-90'::integer::numeric AND destination_lat <= 90::numeric)` |  |  | sim |
| active_tracking_dstlng_check | CHECK | `CHECK (destination_lng IS NULL OR destination_lng >= '-180'::integer::numeric AND destination_lng <= 180::numeric)` |  |  | sim |
| active_tracking_eta_non_negative | CHECK | `CHECK (eta_minutes IS NULL OR eta_minutes >= 0)` |  |  | sim |
| active_tracking_heading_check | CHECK | `CHECK (heading IS NULL OR heading >= 0::numeric AND heading <= 360::numeric)` |  |  | sim |
| active_tracking_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| active_tracking_order_id_key | UNIQUE | `UNIQUE (order_id)` |  |  | sim |
| active_tracking_orglat_check | CHECK | `CHECK (origin_lat IS NULL OR origin_lat >= '-90'::integer::numeric AND origin_lat <= 90::numeric)` |  |  | sim |
| active_tracking_orglng_check | CHECK | `CHECK (origin_lng IS NULL OR origin_lng >= '-180'::integer::numeric AND origin_lng <= 180::numeric)` |  |  | sim |
| active_tracking_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| active_tracking_speed_check | CHECK | `CHECK (speed IS NULL OR speed >= 0::numeric)` |  |  | sim |


## Referenciada por (FKs de outras tabelas)

| tabela | constraint | colunas | on delete |
|---|---|---|---|
| public.driver_locations | driver_locations_tracking_id_fkey | tracking_id | CASCADE |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| active_tracking_order_id_key | btree | order_id | sim | sim |  | `CREATE UNIQUE INDEX active_tracking_order_id_key ON public.active_tracking USING btree (order_id)` |
| active_tracking_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX active_tracking_pkey ON public.active_tracking USING btree (id)` |
| idx_active_tracking_driver_id | btree | driver_id | não | sim |  | `CREATE INDEX idx_active_tracking_driver_id ON public.active_tracking USING btree (driver_id)` |
| idx_tracking_status_active | btree | tracking_status | não | sim | `(tracking_status = 'ACTIVE'::text)` | `CREATE INDEX idx_tracking_status_active ON public.active_tracking USING btree (tracking_status) WHERE (tracking_status = 'ACTIVE'::text)` |


## Policies (RLS)

### `Admins can delete tracking`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role))` |
| WITH CHECK |  |

### `Authorized roles can view tracking`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'operator'::app_role))` |
| WITH CHECK |  |

### `Managers can insert tracking`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'operator'::app_role))` |

### `Managers can update tracking`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'operator'::app_role))` |
| WITH CHECK |  |

### `Viewers can view tracking`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'viewer'::app_role)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_active_tracking_geo | BEFORE | INSERT OR UPDATE | ROW | enabled | public.geo_evaluate_tracking |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
