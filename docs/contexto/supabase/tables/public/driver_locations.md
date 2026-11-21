# public.driver_locations

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 5 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `bigint` | não | `nextval('driver_locations_id_seq'::regclass)` |  |  |
| 2 | `tracking_id` | `uuid` | não |  |  |  |
| 3 | `latitude` | `numeric(10,7)` | não |  |  |  |
| 4 | `longitude` | `numeric(10,7)` | não |  |  |  |
| 5 | `speed_kmh` | `numeric(5,2)` | sim |  |  |  |
| 6 | `heading_degrees` | `integer` | sim |  |  |  |
| 7 | `accuracy_meters` | `integer` | sim |  |  |  |
| 8 | `is_moving` | `boolean` | sim | `true` |  |  |
| 9 | `recorded_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| driver_locations_accuracy_check | CHECK | `CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0)` |  |  | sim |
| driver_locations_heading_check | CHECK | `CHECK (heading_degrees IS NULL OR heading_degrees >= 0 AND heading_degrees <= 360)` |  |  | sim |
| driver_locations_latitude_check | CHECK | `CHECK (latitude >= '-90'::integer::numeric AND latitude <= 90::numeric)` |  |  | sim |
| driver_locations_longitude_check | CHECK | `CHECK (longitude >= '-180'::integer::numeric AND longitude <= 180::numeric)` |  |  | sim |
| driver_locations_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| driver_locations_speed_check | CHECK | `CHECK (speed_kmh IS NULL OR speed_kmh >= 0::numeric)` |  |  | sim |
| driver_locations_tracking_id_fkey | FOREIGN KEY | `FOREIGN KEY (tracking_id) REFERENCES active_tracking(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| driver_locations_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX driver_locations_pkey ON public.driver_locations USING btree (id)` |
| idx_driver_locations_recorded | btree | recorded_at | não | sim |  | `CREATE INDEX idx_driver_locations_recorded ON public.driver_locations USING btree (recorded_at DESC)` |
| idx_driver_locations_tracking_recorded | btree | tracking_id, recorded_at | não | sim |  | `CREATE INDEX idx_driver_locations_tracking_recorded ON public.driver_locations USING btree (tracking_id, recorded_at DESC)` |


## Policies (RLS)

### `Admins managers can view all locations`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Managers can delete driver locations`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can insert driver locations`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |

### `Operators can update driver locations`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| WITH CHECK |  |

### `Operators can view active delivery locations only`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'operator'::app_role) AND (EXISTS ( SELECT 1    FROM active_tracking at   WHERE ((at.id = driver_locations.tracking_id) AND (at.tracking_status = 'ACTIVE'::text)))))` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
