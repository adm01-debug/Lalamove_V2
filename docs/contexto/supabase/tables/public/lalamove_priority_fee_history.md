# public.lalamove_priority_fee_history

> Historico de taxas de prioridade aplicadas aos pedidos Lalamove.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 2 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `order_id` | `uuid` | não |  |  |  |
| 3 | `lalamove_order_id` | `text` | não |  |  |  |
| 4 | `previous_fee` | `numeric(10,2)` | sim |  |  |  |
| 5 | `new_fee` | `numeric(10,2)` | não |  |  |  |
| 6 | `currency` | `text` | não | `'BRL'::text` |  |  |
| 7 | `reason` | `text` | sim |  |  |  |
| 8 | `changed_by` | `uuid` | sim |  |  |  |
| 9 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_priority_fee_history_changed_by_fkey | FOREIGN KEY | `FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| lalamove_priority_fee_history_new_fee_check | CHECK | `CHECK (new_fee > 0::numeric)` |  |  | sim |
| lalamove_priority_fee_history_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| lalamove_priority_fee_history_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_lalamove_priority_fee_history_changed_by | btree | changed_by | não | sim | `(changed_by IS NOT NULL)` | `CREATE INDEX idx_lalamove_priority_fee_history_changed_by ON public.lalamove_priority_fee_history USING btree (changed_by) WHERE (changed_by IS NOT NULL)` |
| idx_priority_fee_history_order | btree | order_id, created_at | não | sim |  | `CREATE INDEX idx_priority_fee_history_order ON public.lalamove_priority_fee_history USING btree (order_id, created_at DESC)` |
| lalamove_priority_fee_history_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_priority_fee_history_pkey ON public.lalamove_priority_fee_history USING btree (id)` |


## Policies (RLS)

### `Admin/manager insert priority fee history`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | public |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |

### `Operational roles view priority fee history`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
