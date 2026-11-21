# public.drivers

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
| usada por views | public.drivers_safe_view |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `lalamove_id` | `text` | sim |  |  |  |
| 3 | `name` | `text` | não |  |  |  |
| 4 | `phone` | `text` | sim |  |  |  |
| 5 | `photo_url` | `text` | sim |  |  |  |
| 6 | `vehicle_type` | `vehicle_type` | não | `'MOTORCYCLE'::vehicle_type` |  |  |
| 7 | `vehicle_plate` | `text` | sim |  |  |  |
| 8 | `risk_score` | `numeric(3,1)` | sim | `5.0` |  |  |
| 9 | `status` | `driver_status` | não | `'PENDING_APPROVAL'::driver_status` |  |  |
| 10 | `total_deliveries` | `integer` | sim | `0` |  |  |
| 11 | `completed_deliveries` | `integer` | sim | `0` |  |  |
| 12 | `rating` | `numeric(2,1)` | sim | `5.0` |  |  |
| 13 | `last_active_at` | `timestamp with time zone` | sim |  |  |  |
| 14 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 15 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |
| 16 | `external_rating` | `numeric(3,2)` | sim |  |  |  |
| 17 | `external_total_deliveries` | `integer` | sim |  |  |  |
| 18 | `external_success_rate` | `numeric(5,2)` | sim |  |  |  |
| 19 | `risk_reasons` | `jsonb` | sim |  |  |  |
| 20 | `risk_level` | `text` | sim |  |  |  |
| 21 | `whitelisted` | `boolean` | sim | `false` |  |  |
| 22 | `blacklisted` | `boolean` | sim | `false` |  |  |
| 23 | `blacklist_reason` | `text` | sim |  |  |  |
| 24 | `notes` | `text` | sim |  |  |  |
| 25 | `last_evaluated_at` | `timestamp with time zone` | sim |  |  |  |
| 26 | `failed_deliveries` | `integer` | sim | `0` |  |  |
| 27 | `cancelled_deliveries` | `integer` | sim | `0` |  |  |
| 28 | `success_rate` | `numeric` | sim | `0` |  |  |
| 29 | `failure_rate` | `numeric` | sim | `0` |  |  |
| 30 | `avg_delay_minutes` | `numeric` | sim | `0` |  |  |
| 31 | `last_delivery_at` | `timestamp with time zone` | sim |  |  |  |
| 32 | `first_seen_at` | `timestamp with time zone` | sim | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| drivers_lalamove_id_key | UNIQUE | `UNIQUE (lalamove_id)` |  |  | sim |
| drivers_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| drivers_rating_check | CHECK | `CHECK (rating >= 0::numeric AND rating <= 5::numeric)` |  |  | sim |
| drivers_risk_score_check | CHECK | `CHECK (risk_score >= 0::numeric AND risk_score <= 10::numeric)` |  |  | sim |


## Referenciada por (FKs de outras tabelas)

| tabela | constraint | colunas | on delete |
|---|---|---|---|
| public.active_tracking | active_tracking_driver_id_fkey | driver_id | CASCADE |
| public.alerts | alerts_driver_id_fkey | driver_id | SET NULL |
| public.driver_approval_queue | driver_approval_queue_driver_id_fkey | driver_id | CASCADE |
| public.driver_evaluations | driver_evaluations_driver_id_fkey | driver_id | CASCADE |
| public.driver_incidents | driver_incidents_driver_id_fkey | driver_id | CASCADE |
| public.lalamove_orders | lalamove_orders_driver_id_fkey | driver_id | SET NULL |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| drivers_lalamove_id_key | btree | lalamove_id | sim | sim |  | `CREATE UNIQUE INDEX drivers_lalamove_id_key ON public.drivers USING btree (lalamove_id)` |
| drivers_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX drivers_pkey ON public.drivers USING btree (id)` |
| idx_drivers_blacklisted | btree | blacklisted | não | sim | `(blacklisted = true)` | `CREATE INDEX idx_drivers_blacklisted ON public.drivers USING btree (blacklisted) WHERE (blacklisted = true)` |
| idx_drivers_risk_level | btree | risk_level | não | sim | `(risk_level IS NOT NULL)` | `CREATE INDEX idx_drivers_risk_level ON public.drivers USING btree (risk_level) WHERE (risk_level IS NOT NULL)` |
| idx_drivers_risk_score | btree | risk_score | não | sim |  | `CREATE INDEX idx_drivers_risk_score ON public.drivers USING btree (risk_score)` |
| idx_drivers_status | btree | status | não | sim |  | `CREATE INDEX idx_drivers_status ON public.drivers USING btree (status)` |
| idx_drivers_whitelisted | btree | whitelisted | não | sim | `(whitelisted = true)` | `CREATE INDEX idx_drivers_whitelisted ON public.drivers USING btree (whitelisted) WHERE (whitelisted = true)` |


## Policies (RLS)

### `Admins can delete drivers`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |

### `Admins managers can view all drivers`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Managers can insert drivers`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |

### `Managers can update drivers`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can view drivers limited`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'operator'::app_role)` |
| WITH CHECK |  |

### `Viewers can view drivers`

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
| update_drivers_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
