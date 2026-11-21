# public.alerts

> Alertas do sistema (ROUTE_DEVIATION, DRIVER_STOPPED, LATE_DELIVERY etc) com severidade e status.

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
| 2 | `type` | `alert_type` | não |  |  |  |
| 3 | `severity` | `alert_severity` | não | `'INFO'::alert_severity` |  |  |
| 4 | `title` | `text` | não |  |  |  |
| 5 | `message` | `text` | não |  |  |  |
| 6 | `order_id` | `uuid` | sim |  |  |  |
| 7 | `driver_id` | `uuid` | sim |  |  |  |
| 8 | `is_read` | `boolean` | sim | `false` |  |  |
| 9 | `is_dismissed` | `boolean` | sim | `false` |  |  |
| 10 | `metadata` | `jsonb` | sim | `'{}'::jsonb` |  |  |
| 11 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 12 | `acknowledged_at` | `timestamp with time zone` | sim |  |  |  |
| 13 | `acknowledged_by` | `uuid` | sim |  |  |  |
| 14 | `escalated_at` | `timestamp with time zone` | sim |  |  |  |
| 15 | `escalation_level` | `integer` | não | `0` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| alerts_driver_id_fkey | FOREIGN KEY | `FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| alerts_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| alerts_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Referenciada por (FKs de outras tabelas)

| tabela | constraint | colunas | on delete |
|---|---|---|---|
| public.alerts_sent | alerts_sent_alert_id_fkey | alert_id | CASCADE |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| alerts_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX alerts_pkey ON public.alerts USING btree (id)` |
| idx_alerts_created | btree | created_at | não | sim |  | `CREATE INDEX idx_alerts_created ON public.alerts USING btree (created_at DESC)` |
| idx_alerts_driver_active | btree | driver_id, created_at | não | sim | `((is_dismissed = false) AND (driver_id IS NOT NULL))` | `CREATE INDEX idx_alerts_driver_active ON public.alerts USING btree (driver_id, created_at DESC) WHERE ((is_dismissed = false) AND (driver_id IS NOT NULL))` |
| idx_alerts_driver_id | btree | driver_id | não | sim |  | `CREATE INDEX idx_alerts_driver_id ON public.alerts USING btree (driver_id)` |
| idx_alerts_not_dismissed | btree | is_dismissed, created_at | não | sim | `(is_dismissed = false)` | `CREATE INDEX idx_alerts_not_dismissed ON public.alerts USING btree (is_dismissed, created_at DESC) WHERE (is_dismissed = false)` |
| idx_alerts_order_active | btree | order_id, created_at | não | sim | `((is_dismissed = false) AND (order_id IS NOT NULL))` | `CREATE INDEX idx_alerts_order_active ON public.alerts USING btree (order_id, created_at DESC) WHERE ((is_dismissed = false) AND (order_id IS NOT NULL))` |
| idx_alerts_order_id | btree | order_id | não | sim |  | `CREATE INDEX idx_alerts_order_id ON public.alerts USING btree (order_id)` |
| idx_alerts_pending_escalation | btree | severity, created_at | não | sim | `((acknowledged_at IS NULL) AND (escalated_at IS NULL) AND (is_dismissed = false))` | `CREATE INDEX idx_alerts_pending_escalation ON public.alerts USING btree (severity, created_at) WHERE ((acknowledged_at IS NULL) AND (escalated_at IS NULL) AND (is_dismissed = false))` |
| idx_alerts_severity | btree | severity | não | sim |  | `CREATE INDEX idx_alerts_severity ON public.alerts USING btree (severity)` |
| idx_alerts_type | btree | type | não | sim |  | `CREATE INDEX idx_alerts_type ON public.alerts USING btree (type)` |
| idx_alerts_unread | btree | is_read | não | sim | `(is_read = false)` | `CREATE INDEX idx_alerts_unread ON public.alerts USING btree (is_read) WHERE (is_read = false)` |


## Policies (RLS)

### `Authorized roles can view alerts`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| WITH CHECK |  |

### `Managers can delete alerts`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can insert alerts`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |

### `Operators can update alerts`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| WITH CHECK |  |

### `Viewers can view alerts`

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
