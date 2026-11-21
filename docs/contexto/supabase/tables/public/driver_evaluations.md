# public.driver_evaluations

> Historico de avaliacoes de risco dos motoristas com fatores detalhados.

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
| 2 | `driver_id` | `uuid` | não |  |  |  |
| 3 | `order_id` | `uuid` | sim |  |  |  |
| 4 | `triggered_by` | `text` | não | `'SYSTEM'::text` |  |  |
| 5 | `approved` | `boolean` | não | `false` |  |  |
| 6 | `requires_manual` | `boolean` | não | `false` |  |  |
| 7 | `auto_blocked` | `boolean` | não | `false` |  |  |
| 8 | `risk_score` | `numeric` | não | `0` |  |  |
| 9 | `risk_level` | `text` | não | `'LOW'::text` |  |  |
| 10 | `risk_factors` | `jsonb` | não | `'[]'::jsonb` |  |  |
| 11 | `risk_reasons` | `text[]` | sim | `'{}'::text[]` |  |  |
| 12 | `total_deliveries` | `integer` | sim | `0` |  |  |
| 13 | `completed_deliveries` | `integer` | sim | `0` |  |  |
| 14 | `failure_rate` | `numeric` | sim | `0` |  |  |
| 15 | `incident_count` | `integer` | sim | `0` |  |  |
| 16 | `recommendation` | `text` | sim |  |  |  |
| 17 | `action_required` | `text` | sim |  |  |  |
| 18 | `evaluated_at` | `timestamp with time zone` | não | `now()` |  |  |
| 19 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| driver_evaluations_completed_deliveries_non_negative | CHECK | `CHECK (completed_deliveries IS NULL OR completed_deliveries >= 0)` |  |  | sim |
| driver_evaluations_completed_lte_total | CHECK | `CHECK (completed_deliveries IS NULL OR total_deliveries IS NULL OR completed_deliveries <= total_deliveries)` |  |  | sim |
| driver_evaluations_driver_id_fkey | FOREIGN KEY | `FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| driver_evaluations_failure_rate_range | CHECK | `CHECK (failure_rate IS NULL OR failure_rate >= 0::numeric AND failure_rate <= 1::numeric)` |  |  | sim |
| driver_evaluations_incident_count_non_negative | CHECK | `CHECK (incident_count IS NULL OR incident_count >= 0)` |  |  | sim |
| driver_evaluations_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| driver_evaluations_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| driver_evaluations_risk_score_range | CHECK | `CHECK (risk_score >= 0::numeric AND risk_score <= 100::numeric)` |  |  | sim |
| driver_evaluations_total_deliveries_non_negative | CHECK | `CHECK (total_deliveries IS NULL OR total_deliveries >= 0)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| driver_evaluations_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX driver_evaluations_pkey ON public.driver_evaluations USING btree (id)` |
| idx_driver_evaluations_approved | btree | approved | não | sim |  | `CREATE INDEX idx_driver_evaluations_approved ON public.driver_evaluations USING btree (approved)` |
| idx_driver_evaluations_driver_id | btree | driver_id | não | sim |  | `CREATE INDEX idx_driver_evaluations_driver_id ON public.driver_evaluations USING btree (driver_id)` |
| idx_driver_evaluations_evaluated_at | btree | evaluated_at | não | sim |  | `CREATE INDEX idx_driver_evaluations_evaluated_at ON public.driver_evaluations USING btree (evaluated_at DESC)` |
| idx_driver_evaluations_order_id | btree | order_id | não | sim |  | `CREATE INDEX idx_driver_evaluations_order_id ON public.driver_evaluations USING btree (order_id)` |
| idx_driver_evaluations_requires_manual | btree | requires_manual | não | sim |  | `CREATE INDEX idx_driver_evaluations_requires_manual ON public.driver_evaluations USING btree (requires_manual)` |


## Policies (RLS)

### `Admins can delete evaluations`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |

### `Authorized roles can view evaluations`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| WITH CHECK |  |

### `Managers can update evaluations`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can insert evaluations`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |

### `Viewers can view driver evaluations`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'viewer'::app_role)` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
