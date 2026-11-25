# public.order_geo_events

> Eventos geograficos por pedido (aproximando/chegou coleta e entrega, atraso) - 1 por (pedido, evento, parada).

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
| 2 | `order_id` | `uuid` | não |  |  |  |
| 3 | `event_type` | `alert_type` | não |  |  |  |
| 4 | `stop_index` | `integer` | não | `0` |  |  |
| 5 | `triggered_at` | `timestamp with time zone` | não | `now()` |  |  |
| 6 | `driver_lat` | `numeric(10,7)` | sim |  |  |  |
| 7 | `driver_lng` | `numeric(10,7)` | sim |  |  |  |
| 8 | `distance_m` | `numeric(10,1)` | sim |  |  |  |
| 9 | `eta_min` | `integer` | sim |  |  |  |
| 10 | `alert_id` | `uuid` | sim |  |  |  |
| 11 | `job_id` | `uuid` | sim |  |  |  |
| 12 | `notified_at` | `timestamp with time zone` | sim |  |  |  |
| 13 | `notification_status` | `text` | não | `'queued'::text` |  |  |
| 14 | `payload` | `jsonb` | não | `'{}'::jsonb` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| order_geo_events_alert_id_fkey | FOREIGN KEY | `FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| order_geo_events_notification_status_check | CHECK | `CHECK (notification_status = ANY (ARRAY['queued'::text, 'deferred'::text, 'sent'::text, 'failed'::text, 'no_recipient'::text, 'skipped'::text, 'cancelled'::text]))` |  |  | sim |
| order_geo_events_order_id_event_type_stop_index_key | UNIQUE | `UNIQUE (order_id, event_type, stop_index)` |  |  | sim |
| order_geo_events_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| order_geo_events_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_order_geo_events_alert_id | btree | alert_id | não | sim |  | `CREATE INDEX idx_order_geo_events_alert_id ON public.order_geo_events USING btree (alert_id)` |
| idx_order_geo_events_order | btree | order_id, triggered_at | não | sim |  | `CREATE INDEX idx_order_geo_events_order ON public.order_geo_events USING btree (order_id, triggered_at DESC)` |
| order_geo_events_order_id_event_type_stop_index_key | btree | order_id, event_type, stop_index | sim | sim |  | `CREATE UNIQUE INDEX order_geo_events_order_id_event_type_stop_index_key ON public.order_geo_events USING btree (order_id, event_type, stop_index)` |
| order_geo_events_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX order_geo_events_pkey ON public.order_geo_events USING btree (id)` |


## Policies (RLS)

### `order_geo_events_read`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(( SELECT auth.role() AS role) = 'authenticated'::text)` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
