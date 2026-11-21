# public.driver_approval_queue

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
| 3 | `order_id` | `uuid` | não |  |  |  |
| 4 | `status` | `approval_status` | não | `'PENDING'::approval_status` |  |  |
| 5 | `risk_score` | `numeric(3,1)` | não |  |  |  |
| 6 | `risk_factors` | `text[]` | sim | `'{}'::text[]` |  |  |
| 7 | `requested_at` | `timestamp with time zone` | não | `now()` |  |  |
| 8 | `reviewed_at` | `timestamp with time zone` | sim |  |  |  |
| 9 | `reviewed_by` | `uuid` | sim |  |  |  |
| 10 | `notes` | `text` | sim |  |  |  |
| 11 | `driver_name` | `text` | sim |  |  |  |
| 12 | `priority` | `integer` | sim | `5` |  |  |
| 13 | `decision_notes` | `text` | sim |  |  |  |
| 14 | `approval_priority` | `approval_priority` | sim | `'MEDIUM'::approval_priority` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| driver_approval_queue_driver_id_fkey | FOREIGN KEY | `FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| driver_approval_queue_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| driver_approval_queue_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| driver_approval_queue_priority_non_negative | CHECK | `CHECK (priority IS NULL OR priority >= 0)` |  |  | sim |
| driver_approval_queue_risk_score_range | CHECK | `CHECK (risk_score >= 0::numeric AND risk_score <= 100::numeric)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| driver_approval_queue_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX driver_approval_queue_pkey ON public.driver_approval_queue USING btree (id)` |
| idx_approval_priority | btree | priority | não | sim |  | `CREATE INDEX idx_approval_priority ON public.driver_approval_queue USING btree (priority DESC)` |
| idx_approvals_driver | btree | driver_id | não | sim |  | `CREATE INDEX idx_approvals_driver ON public.driver_approval_queue USING btree (driver_id)` |
| idx_approvals_status | btree | status | não | sim |  | `CREATE INDEX idx_approvals_status ON public.driver_approval_queue USING btree (status)` |
| idx_driver_approval_queue_order_id | btree | order_id | não | sim |  | `CREATE INDEX idx_driver_approval_queue_order_id ON public.driver_approval_queue USING btree (order_id)` |
| idx_driver_approval_queue_pending_priority | btree | priority, requested_at | não | sim | `(status = 'PENDING'::approval_status)` | `CREATE INDEX idx_driver_approval_queue_pending_priority ON public.driver_approval_queue USING btree (priority DESC, requested_at DESC) WHERE (status = 'PENDING'::approval_status)` |
| idx_driver_approval_queue_pending_recent | btree | requested_at | não | sim | `(status = 'PENDING'::approval_status)` | `CREATE INDEX idx_driver_approval_queue_pending_recent ON public.driver_approval_queue USING btree (requested_at DESC) WHERE (status = 'PENDING'::approval_status)` |
| idx_driver_approval_queue_status_reviewed | btree | status, reviewed_at | não | sim |  | `CREATE INDEX idx_driver_approval_queue_status_reviewed ON public.driver_approval_queue USING btree (status, reviewed_at)` |


## Policies (RLS)

### `Admins can delete approvals`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |

### `Authorized roles can view approvals`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| WITH CHECK |  |

### `Managers can insert approvals`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |

### `Managers can update approvals`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Viewers can view approval queue`

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
