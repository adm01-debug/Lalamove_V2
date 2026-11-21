# public.lalamove_orders

> Pedidos Lalamove com campos customizados e status em tempo real.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 6 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |
| usada por views | public.delivery_metrics_cache, public.hourly_metrics_cache, public.orders_operator_view, public.orders_safe_view |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `lalamove_id` | `text` | não |  |  |  |
| 3 | `internal_order_id` | `text` | sim |  |  |  |
| 4 | `status` | `order_status` | não | `'PENDING'::order_status` |  |  |
| 5 | `pickup_address` | `text` | não |  |  |  |
| 6 | `pickup_latitude` | `numeric(10,8)` | sim |  |  |  |
| 7 | `pickup_longitude` | `numeric(11,8)` | sim |  |  |  |
| 8 | `delivery_address` | `text` | não |  |  |  |
| 9 | `delivery_latitude` | `numeric(10,8)` | sim |  |  |  |
| 10 | `delivery_longitude` | `numeric(11,8)` | sim |  |  |  |
| 11 | `customer_name` | `text` | não |  |  |  |
| 12 | `customer_phone` | `text` | sim |  |  |  |
| 13 | `scheduled_at` | `timestamp with time zone` | sim | `now()` |  |  |
| 14 | `estimated_delivery` | `timestamp with time zone` | sim |  |  |  |
| 15 | `actual_delivery` | `timestamp with time zone` | sim |  |  |  |
| 16 | `driver_id` | `uuid` | sim |  |  |  |
| 17 | `vehicle_type` | `vehicle_type` | não | `'MOTORCYCLE'::vehicle_type` |  |  |
| 18 | `total_cost` | `numeric(10,2)` | não | `0` |  |  |
| 19 | `currency` | `text` | não | `'BRL'::text` |  |  |
| 20 | `tags` | `text[]` | sim | `'{}'::text[]` |  |  |
| 21 | `quotation_id` | `text` | sim |  |  |  |
| 22 | `metadata` | `jsonb` | sim | `'{}'::jsonb` |  |  |
| 23 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 24 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |
| 25 | `bitrix24_deal_id` | `integer` | sim |  |  |  |
| 26 | `cost_center` | `text` | sim |  |  |  |
| 27 | `department` | `text` | sim |  |  |  |
| 28 | `is_urgent` | `boolean` | sim | `false` |  |  |
| 29 | `internal_status` | `text` | sim |  |  |  |
| 30 | `share_link` | `text` | sim |  |  |  |
| 31 | `distance_meters` | `integer` | sim |  |  |  |
| 32 | `custom_rating` | `numeric(3,2)` | sim |  |  |  |
| 33 | `internal_notes` | `text` | sim |  |  |  |
| 34 | `outcome` | `delivery_outcome` | sim |  |  |  |
| 35 | `delay_minutes` | `integer` | sim |  |  |  |
| 36 | `duration_minutes` | `integer` | sim |  |  |  |
| 37 | `supplier_contact` | `text` | sim |  |  |  |
| 38 | `auto_notify_supplier` | `boolean` | sim | `false` |  |  |
| 39 | `stalled_threshold_minutes` | `integer` | sim | `15` |  |  |
| 40 | `route_deviation_threshold_minutes` | `integer` | sim | `10` |  |  |
| 41 | `requires_pod` | `boolean` | sim | `true` |  |  |
| 42 | `pod_received` | `boolean` | sim | `false` |  |  |
| 43 | `cancellation_reason` | `text` | sim |  |  |  |
| 44 | `cancellation_notes` | `text` | sim |  |  |  |
| 45 | `cancelled_by` | `uuid` | sim |  |  |  |
| 46 | `cancelled_at` | `timestamp with time zone` | sim |  |  |  |
| 47 | `priority_fee` | `numeric(10,2)` | sim |  |  |  |
| 48 | `priority_fee_currency` | `text` | sim |  |  |  |
| 49 | `priority_fee_updated_at` | `timestamp with time zone` | sim |  |  |  |
| 50 | `service_type` | `text` | sim |  |  | serviceType BR da v3 (14 valores). vehicle_type (enum de 4) passa a ser derivado deste. |
| 51 | `lalamove_status` | `text` | sim |  |  |  |
| 52 | `quotation_expires_at` | `timestamp with time zone` | sim |  |  |  |
| 53 | `driver_lalamove_id` | `text` | sim |  |  | ID do motorista NA Lalamove (driverId v3 numerico ou driver_fid UAPI) — nunca o UUID da tabela drivers. |
| 54 | `driver_name` | `text` | sim |  |  |  |
| 55 | `driver_phone` | `text` | sim |  |  |  |
| 56 | `driver_plate` | `text` | sim |  |  |  |
| 57 | `source` | `text` | sim | `'painel'::text` |  |  |
| 58 | `spa_id` | `integer` | sim |  |  |  |
| 59 | `spa_category_id` | `integer` | sim |  |  |  |
| 60 | `pickup_place_id` | `text` | sim |  |  |  |
| 61 | `delivery_place_id` | `text` | sim |  |  |  |
| 62 | `pickup_address_components` | `jsonb` | sim |  |  |  |
| 63 | `delivery_address_components` | `jsonb` | sim |  |  |  |
| 64 | `geocode_provider` | `text` | sim |  |  |  |
| 65 | `geocode_precision` | `text` | sim |  |  |  |
| 66 | `requires_address_review` | `boolean` | não | `false` |  |  |
| 67 | `pickup_contact_name` | `text` | sim |  |  |  |
| 68 | `pickup_contact_phone` | `text` | sim |  |  |  |
| 69 | `approach_radius_m` | `integer` | sim |  |  |  |
| 70 | `approach_eta_min` | `integer` | sim |  |  |  |
| 71 | `notify_delivery_contact` | `boolean` | sim |  |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_orders_cancellation_reason_check | CHECK | `CHECK (cancellation_reason IS NULL OR (cancellation_reason = ANY (ARRAY['USER_REQUESTED'::text, 'DRIVER_UNRESPONSIVE'::text, 'DRIVER_LATE'::text, 'DRIVER_ASKED_CHANGE'::text, 'DRIVER_ASKED_CANCEL'::text, 'DRIVER_RUDE'::text, 'DRIVER_ASKED_FOR_MORE_MONEY'::text, 'DELIVERY_ETA_TOO_LONG'::text, 'PRICE_TOO_HIGH'::text, 'INCORRECT_ORDER_DETAILS'::text, 'MISTAKEN_ORDER'::text, 'WRONG_ADDRESS'::text, 'NO_CAPACITY'::text, 'OTHER'::text])))` |  |  | sim |
| lalamove_orders_cancelled_by_fkey | FOREIGN KEY | `FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| lalamove_orders_delay_nonneg | CHECK | `CHECK (delay_minutes IS NULL OR delay_minutes >= 0)` |  |  | sim |
| lalamove_orders_delivery_lat_range | CHECK | `CHECK (delivery_latitude IS NULL OR delivery_latitude >= '-90'::integer::numeric AND delivery_latitude <= 90::numeric)` |  |  | sim |
| lalamove_orders_delivery_lng_range | CHECK | `CHECK (delivery_longitude IS NULL OR delivery_longitude >= '-180'::integer::numeric AND delivery_longitude <= 180::numeric)` |  |  | sim |
| lalamove_orders_distance_nonneg | CHECK | `CHECK (distance_meters IS NULL OR distance_meters >= 0)` |  |  | sim |
| lalamove_orders_driver_id_fkey | FOREIGN KEY | `FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| lalamove_orders_duration_nonneg | CHECK | `CHECK (duration_minutes IS NULL OR duration_minutes >= 0)` |  |  | sim |
| lalamove_orders_lalamove_id_key | UNIQUE | `UNIQUE (lalamove_id)` |  |  | sim |
| lalamove_orders_pickup_lat_range | CHECK | `CHECK (pickup_latitude IS NULL OR pickup_latitude >= '-90'::integer::numeric AND pickup_latitude <= 90::numeric)` |  |  | sim |
| lalamove_orders_pickup_lng_range | CHECK | `CHECK (pickup_longitude IS NULL OR pickup_longitude >= '-180'::integer::numeric AND pickup_longitude <= 180::numeric)` |  |  | sim |
| lalamove_orders_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| lalamove_orders_rating_range | CHECK | `CHECK (custom_rating IS NULL OR custom_rating >= 0::numeric AND custom_rating <= 5::numeric)` |  |  | sim |
| lalamove_orders_route_dev_threshold_nonneg | CHECK | `CHECK (route_deviation_threshold_minutes IS NULL OR route_deviation_threshold_minutes >= 0)` |  |  | sim |
| lalamove_orders_service_type_chk | CHECK | `CHECK (service_type IS NULL OR (service_type = ANY (ARRAY['LALAGO'::text, 'LALAPRO'::text, 'LALAGOFOUR'::text, 'CAR'::text, 'CARFOURH'::text, 'HATCHBACK'::text, 'HATCHFOURH'::text, 'UV_FIORINO'::text, 'UV_4H'::text, 'VAN'::text, 'VANFOURH'::text, 'TRUCK330'::text, 'TRUCK3_5T'::text, 'TRUCK_6H'::text])))` |  |  | sim |
| lalamove_orders_stalled_threshold_nonneg | CHECK | `CHECK (stalled_threshold_minutes IS NULL OR stalled_threshold_minutes >= 0)` |  |  | sim |
| lalamove_orders_total_cost_nonneg | CHECK | `CHECK (total_cost >= 0::numeric)` |  |  | sim |


## Referenciada por (FKs de outras tabelas)

| tabela | constraint | colunas | on delete |
|---|---|---|---|
| public.active_tracking | active_tracking_order_id_fkey | order_id | CASCADE |
| public.alerts | alerts_order_id_fkey | order_id | SET NULL |
| public.bitrix24_activities | bitrix24_activities_order_id_fkey | order_id | CASCADE |
| public.bitrix24_spa_sync | bitrix24_spa_sync_order_id_fkey | order_id | CASCADE |
| public.bitrix24_sync | bitrix24_sync_order_id_fkey | order_id | CASCADE |
| public.driver_approval_queue | driver_approval_queue_order_id_fkey | order_id | CASCADE |
| public.driver_evaluations | driver_evaluations_order_id_fkey | order_id | SET NULL |
| public.driver_incidents | driver_incidents_order_id_fkey | order_id | SET NULL |
| public.lalamove_order_replacements | lalamove_order_replacements_order_id_fkey | order_id | CASCADE |
| public.lalamove_priority_fee_history | lalamove_priority_fee_history_order_id_fkey | order_id | CASCADE |
| public.lalamove_status_history | lalamove_status_history_order_id_fkey | order_id | CASCADE |
| public.lalamove_stop_proofs | lalamove_stop_proofs_order_id_fkey | order_id | CASCADE |
| public.lalamove_stops | lalamove_stops_order_id_fkey | order_id | CASCADE |
| public.order_geo_events | order_geo_events_order_id_fkey | order_id | CASCADE |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_lalamove_orders_cancellation_reason | btree | cancellation_reason | não | sim | `(cancellation_reason IS NOT NULL)` | `CREATE INDEX idx_lalamove_orders_cancellation_reason ON public.lalamove_orders USING btree (cancellation_reason) WHERE (cancellation_reason IS NOT NULL)` |
| idx_lalamove_orders_cancelled_at | btree | cancelled_at | não | sim | `(cancelled_at IS NOT NULL)` | `CREATE INDEX idx_lalamove_orders_cancelled_at ON public.lalamove_orders USING btree (cancelled_at DESC) WHERE (cancelled_at IS NOT NULL)` |
| idx_lalamove_orders_cancelled_by | btree | cancelled_by | não | sim | `(cancelled_by IS NOT NULL)` | `CREATE INDEX idx_lalamove_orders_cancelled_by ON public.lalamove_orders USING btree (cancelled_by) WHERE (cancelled_by IS NOT NULL)` |
| idx_lalamove_orders_driver_status_updated | btree | driver_id, status, updated_at | não | sim |  | `CREATE INDEX idx_lalamove_orders_driver_status_updated ON public.lalamove_orders USING btree (driver_id, status, updated_at DESC)` |
| idx_lalamove_orders_open_status | btree | created_at | não | sim | `(status = ANY (ARRAY['PENDING'::order_status, 'MATCHED'::order_status, 'ON_GOING'::order_status, 'PICKED_UP'::order_status]))` | `CREATE INDEX idx_lalamove_orders_open_status ON public.lalamove_orders USING btree (created_at DESC) WHERE (status = ANY (ARRAY['PENDING'::order_status, 'MATCHED'::order_status, 'ON_GOING'::order_status, 'PICKED_UP'::order_status]))` |
| idx_lalamove_orders_source | btree | source | não | sim |  | `CREATE INDEX idx_lalamove_orders_source ON public.lalamove_orders USING btree (source)` |
| idx_lalamove_orders_spa_id | btree | spa_id | não | sim | `(spa_id IS NOT NULL)` | `CREATE INDEX idx_lalamove_orders_spa_id ON public.lalamove_orders USING btree (spa_id) WHERE (spa_id IS NOT NULL)` |
| idx_lalamove_orders_status_created | btree | status, created_at | não | sim |  | `CREATE INDEX idx_lalamove_orders_status_created ON public.lalamove_orders USING btree (status, created_at DESC)` |
| idx_orders_bitrix24 | btree | bitrix24_deal_id | não | sim | `(bitrix24_deal_id IS NOT NULL)` | `CREATE INDEX idx_orders_bitrix24 ON public.lalamove_orders USING btree (bitrix24_deal_id) WHERE (bitrix24_deal_id IS NOT NULL)` |
| idx_orders_cost_center | btree | cost_center | não | sim | `(cost_center IS NOT NULL)` | `CREATE INDEX idx_orders_cost_center ON public.lalamove_orders USING btree (cost_center) WHERE (cost_center IS NOT NULL)` |
| idx_orders_created | btree | created_at | não | sim |  | `CREATE INDEX idx_orders_created ON public.lalamove_orders USING btree (created_at DESC)` |
| idx_orders_delivery_place_id | btree | delivery_place_id | não | sim | `(delivery_place_id IS NOT NULL)` | `CREATE INDEX idx_orders_delivery_place_id ON public.lalamove_orders USING btree (delivery_place_id) WHERE (delivery_place_id IS NOT NULL)` |
| idx_orders_driver | btree | driver_id | não | sim |  | `CREATE INDEX idx_orders_driver ON public.lalamove_orders USING btree (driver_id)` |
| idx_orders_pickup_place_id | btree | pickup_place_id | não | sim | `(pickup_place_id IS NOT NULL)` | `CREATE INDEX idx_orders_pickup_place_id ON public.lalamove_orders USING btree (pickup_place_id) WHERE (pickup_place_id IS NOT NULL)` |
| idx_orders_status | btree | status | não | sim |  | `CREATE INDEX idx_orders_status ON public.lalamove_orders USING btree (status)` |
| idx_orders_urgent | btree | is_urgent | não | sim | `(is_urgent = true)` | `CREATE INDEX idx_orders_urgent ON public.lalamove_orders USING btree (is_urgent) WHERE (is_urgent = true)` |
| lalamove_orders_lalamove_id_key | btree | lalamove_id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_orders_lalamove_id_key ON public.lalamove_orders USING btree (lalamove_id)` |
| lalamove_orders_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_orders_pkey ON public.lalamove_orders USING btree (id)` |


## Policies (RLS)

### `Admins managers can view all orders`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Managers can delete orders`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can insert orders`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |

### `Operators can update orders`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| WITH CHECK |  |

### `Operators can view orders`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'operator'::app_role)` |
| WITH CHECK |  |

### `Viewers can view orders`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'viewer'::app_role)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| on_order_status_change_sync_bitrix24 | AFTER | UPDATE | ROW | enabled | public.trigger_bitrix24_sync |
| update_orders_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
