# public.lalamove_stop_proofs

> Comprovantes (foto/assinatura) das paradas dos pedidos Lalamove.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 5 |
| realtime (publication) | sim |
| replica identity | full |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `stop_id` | `uuid` | não |  |  |  |
| 3 | `order_id` | `uuid` | não |  |  |  |
| 4 | `pod_status` | `text` | sim |  |  |  |
| 5 | `pod_image_url` | `text` | sim |  |  |  |
| 6 | `pod_delivered_at` | `timestamp with time zone` | sim |  |  |  |
| 7 | `pop_status` | `text` | sim |  |  |  |
| 8 | `pop_image_url` | `text` | sim |  |  |  |
| 9 | `pop_picked_up_at` | `timestamp with time zone` | sim |  |  |  |
| 10 | `delivery_code` | `text` | sim |  |  |  |
| 11 | `delivery_code_status` | `text` | sim |  |  |  |
| 12 | `raw_payload` | `jsonb` | não | `'{}'::jsonb` |  |  |
| 13 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 14 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_stop_proofs_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| lalamove_stop_proofs_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| lalamove_stop_proofs_pod_status_check | CHECK | `CHECK (pod_status IS NULL OR (pod_status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text, 'NOT_REQUIRED'::text])))` |  |  | sim |
| lalamove_stop_proofs_pop_status_check | CHECK | `CHECK (pop_status IS NULL OR (pop_status = ANY (ARRAY['pending'::text, 'picked_up'::text, 'failed'::text, 'NOT_REQUIRED'::text])))` |  |  | sim |
| lalamove_stop_proofs_stop_id_fkey | FOREIGN KEY | `FOREIGN KEY (stop_id) REFERENCES lalamove_stops(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| lalamove_stop_proofs_stop_unique | UNIQUE | `UNIQUE (stop_id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_stop_proofs_delivered_at | btree | pod_delivered_at | não | sim | `(pod_delivered_at IS NOT NULL)` | `CREATE INDEX idx_stop_proofs_delivered_at ON public.lalamove_stop_proofs USING btree (pod_delivered_at DESC) WHERE (pod_delivered_at IS NOT NULL)` |
| idx_stop_proofs_order_id | btree | order_id | não | sim |  | `CREATE INDEX idx_stop_proofs_order_id ON public.lalamove_stop_proofs USING btree (order_id)` |
| idx_stop_proofs_pod_status | btree | pod_status | não | sim | `((pod_status IS NOT NULL) AND (pod_status <> 'NOT_REQUIRED'::text))` | `CREATE INDEX idx_stop_proofs_pod_status ON public.lalamove_stop_proofs USING btree (pod_status) WHERE ((pod_status IS NOT NULL) AND (pod_status <> 'NOT_REQUIRED'::text))` |
| idx_stop_proofs_pop_status | btree | pop_status | não | sim | `((pop_status IS NOT NULL) AND (pop_status <> 'NOT_REQUIRED'::text))` | `CREATE INDEX idx_stop_proofs_pop_status ON public.lalamove_stop_proofs USING btree (pop_status) WHERE ((pop_status IS NOT NULL) AND (pop_status <> 'NOT_REQUIRED'::text))` |
| lalamove_stop_proofs_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_stop_proofs_pkey ON public.lalamove_stop_proofs USING btree (id)` |
| lalamove_stop_proofs_stop_unique | btree | stop_id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_stop_proofs_stop_unique ON public.lalamove_stop_proofs USING btree (stop_id)` |


## Policies (RLS)

### `Admins can delete stop_proofs`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK |  |

### `Admins managers can view stop_proofs`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role))` |
| WITH CHECK |  |

### `Managers can update stop_proofs`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role))` |
| WITH CHECK |  |

### `Operators can insert stop_proofs`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'operator'::app_role))` |

### `Operators can view stop_proofs limited`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'operator'::app_role)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_stop_proofs_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
