# public.lalamove_stops

> Paradas/stops dos pedidos Lalamove com endereco e horarios.

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
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `order_id` | `uuid` | não |  |  |  |
| 3 | `stop_index` | `integer` | não |  |  |  |
| 4 | `address` | `text` | não |  |  |  |
| 5 | `latitude` | `numeric(10,8)` | sim |  |  |  |
| 6 | `longitude` | `numeric(11,8)` | sim |  |  |  |
| 7 | `contact_name` | `text` | sim |  |  |  |
| 8 | `contact_phone` | `text` | sim |  |  |  |
| 9 | `arrived_at` | `timestamp with time zone` | sim |  |  |  |
| 10 | `completed_at` | `timestamp with time zone` | sim |  |  |  |
| 11 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 12 | `pod_status` | `text` | sim | `'NOT_REQUIRED'::text` |  |  |
| 13 | `pod_image_url` | `text` | sim |  |  |  |
| 14 | `pod_delivered_at` | `timestamp with time zone` | sim |  |  |  |
| 15 | `remarks` | `text` | sim |  |  |  |
| 16 | `stop_id` | `text` | sim |  |  |  |
| 17 | `place_id` | `text` | sim |  |  |  |
| 18 | `address_components` | `jsonb` | sim |  |  |  |
| 19 | `geocode_precision` | `text` | sim |  |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_stops_latitude_range | CHECK | `CHECK (latitude IS NULL OR latitude >= '-90'::integer::numeric AND latitude <= 90::numeric)` |  |  | sim |
| lalamove_stops_longitude_range | CHECK | `CHECK (longitude IS NULL OR longitude >= '-180'::integer::numeric AND longitude <= 180::numeric)` |  |  | sim |
| lalamove_stops_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| lalamove_stops_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| lalamove_stops_pod_status_valid | CHECK | `CHECK (pod_status IS NULL OR (pod_status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text])))` |  |  | sim |
| lalamove_stops_stop_index_non_negative | CHECK | `CHECK (stop_index >= 0)` |  |  | sim |


## Referenciada por (FKs de outras tabelas)

| tabela | constraint | colunas | on delete |
|---|---|---|---|
| public.lalamove_stop_proofs | lalamove_stop_proofs_stop_id_fkey | stop_id | CASCADE |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_lalamove_stops_order_id | btree | order_id | não | sim |  | `CREATE INDEX idx_lalamove_stops_order_id ON public.lalamove_stops USING btree (order_id)` |
| idx_stops_pod_status | btree | pod_status | não | sim | `(pod_status <> 'NOT_REQUIRED'::text)` | `CREATE INDEX idx_stops_pod_status ON public.lalamove_stops USING btree (pod_status) WHERE (pod_status <> 'NOT_REQUIRED'::text)` |
| lalamove_stops_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_stops_pkey ON public.lalamove_stops USING btree (id)` |
| uq_lalamove_stops_order_stop_index | btree | order_id, stop_index | sim | sim |  | `CREATE UNIQUE INDEX uq_lalamove_stops_order_stop_index ON public.lalamove_stops USING btree (order_id, stop_index)` |


## Policies (RLS)

### `Admins can delete stops`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |

### `Admins managers can view all stops`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Managers can update stops`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can insert stops`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |

### `Operators can view stops limited`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'operator'::app_role)` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
