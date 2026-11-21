# public.tracking_events

> Eventos de tracking particionados por mes (particionamento).

| propriedade | valor |
|---|---|
| tipo | partitioned |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | sim |
| policies | 1 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |
| chave de partição | `RANGE (created_at)` |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `order_id` | `uuid` | sim |  |  |  |
| 3 | `driver_id` | `uuid` | sim |  |  |  |
| 4 | `latitude` | `numeric` | não |  |  |  |
| 5 | `longitude` | `numeric` | não |  |  |  |
| 6 | `heading` | `numeric` | sim |  |  |  |
| 7 | `speed` | `numeric` | sim |  |  |  |
| 8 | `event_type` | `text` | sim |  |  |  |
| 9 | `metadata` | `jsonb` | sim |  |  |  |
| 10 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| tracking_events_heading_check | CHECK | `CHECK (heading IS NULL OR heading >= 0::numeric AND heading <= 360::numeric)` |  |  | sim |
| tracking_events_latitude_check | CHECK | `CHECK (latitude >= '-90'::integer::numeric AND latitude <= 90::numeric)` |  |  | sim |
| tracking_events_longitude_check | CHECK | `CHECK (longitude >= '-180'::integer::numeric AND longitude <= 180::numeric)` |  |  | sim |
| tracking_events_speed_check | CHECK | `CHECK (speed IS NULL OR speed >= 0::numeric)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_tracking_driver_created | btree | driver_id, created_at | não | sim |  | `CREATE INDEX idx_tracking_driver_created ON ONLY public.tracking_events USING btree (driver_id, created_at)` |
| idx_tracking_events_created_brin | brin | created_at | não | sim |  | `CREATE INDEX idx_tracking_events_created_brin ON ONLY public.tracking_events USING brin (created_at) WITH (pages_per_range='32')` |
| idx_tracking_order_created | btree | order_id, created_at | não | sim |  | `CREATE INDEX idx_tracking_order_created ON ONLY public.tracking_events USING btree (order_id, created_at)` |


## Policies (RLS)

### `Operational roles can view tracking`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
