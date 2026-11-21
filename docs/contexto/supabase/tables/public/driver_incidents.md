# public.driver_incidents

> Incidentes registrados por motorista (desvio de rota, parada longa, atraso, dano).

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
| 4 | `type` | `incident_type` | não |  |  |  |
| 5 | `severity` | `incident_severity` | não | `'LOW'::incident_severity` |  |  |
| 6 | `description` | `text` | não |  |  |  |
| 7 | `metadata` | `jsonb` | sim | `'{}'::jsonb` |  |  |
| 8 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 9 | `evidence_urls` | `text[]` | sim |  |  |  |
| 10 | `reported_by` | `text` | sim |  |  |  |
| 11 | `resolved` | `boolean` | sim | `false` |  |  |
| 12 | `resolution_notes` | `text` | sim |  |  |  |
| 13 | `resolved_at` | `timestamp with time zone` | sim |  |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| driver_incidents_driver_id_fkey | FOREIGN KEY | `FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| driver_incidents_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| driver_incidents_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| driver_incidents_resolution_consistency | CHECK | `CHECK (resolved IS NOT TRUE AND resolved_at IS NULL OR resolved IS TRUE)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| driver_incidents_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX driver_incidents_pkey ON public.driver_incidents USING btree (id)` |
| idx_driver_incidents_driver_created | btree | driver_id, created_at | não | sim |  | `CREATE INDEX idx_driver_incidents_driver_created ON public.driver_incidents USING btree (driver_id, created_at DESC)` |
| idx_driver_incidents_order_id | btree | order_id | não | sim |  | `CREATE INDEX idx_driver_incidents_order_id ON public.driver_incidents USING btree (order_id)` |
| idx_incidents_resolved | btree | resolved | não | sim | `(resolved = false)` | `CREATE INDEX idx_incidents_resolved ON public.driver_incidents USING btree (resolved) WHERE (resolved = false)` |
| idx_incidents_type | btree | type | não | sim |  | `CREATE INDEX idx_incidents_type ON public.driver_incidents USING btree (type)` |


## Policies (RLS)

### `Admins can delete incidents`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |

### `Authorized roles can view incidents`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| WITH CHECK |  |

### `Managers can update incidents`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can insert incidents`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |

### `Viewers can view incidents`

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
