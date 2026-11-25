# public.lalamove_order_replacements

> Registro de pedidos de reposicao/reescolha na Lalamove.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 2 |
| realtime (publication) | sim |
| replica identity | full |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `order_id` | `uuid` | não |  |  |  |
| 3 | `previous_lalamove_id` | `text` | não |  |  |  |
| 4 | `new_lalamove_id` | `text` | não |  |  |  |
| 5 | `reason` | `text` | sim |  |  |  |
| 6 | `raw_payload` | `jsonb` | não | `'{}'::jsonb` |  |  |
| 7 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_order_replacements_distinct_ids | CHECK | `CHECK (previous_lalamove_id <> new_lalamove_id)` |  |  | sim |
| lalamove_order_replacements_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| lalamove_order_replacements_pair_unique | UNIQUE | `UNIQUE (previous_lalamove_id, new_lalamove_id)` |  |  | sim |
| lalamove_order_replacements_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_order_replacements_new_id | btree | new_lalamove_id | não | sim |  | `CREATE INDEX idx_order_replacements_new_id ON public.lalamove_order_replacements USING btree (new_lalamove_id)` |
| idx_order_replacements_order_id | btree | order_id | não | sim |  | `CREATE INDEX idx_order_replacements_order_id ON public.lalamove_order_replacements USING btree (order_id)` |
| idx_order_replacements_prev_id | btree | previous_lalamove_id | não | sim |  | `CREATE INDEX idx_order_replacements_prev_id ON public.lalamove_order_replacements USING btree (previous_lalamove_id)` |
| lalamove_order_replacements_pair_unique | btree | previous_lalamove_id, new_lalamove_id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_order_replacements_pair_unique ON public.lalamove_order_replacements USING btree (previous_lalamove_id, new_lalamove_id)` |
| lalamove_order_replacements_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_order_replacements_pkey ON public.lalamove_order_replacements USING btree (id)` |


## Policies (RLS)

### `Admins can delete order_replacements`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK |  |

### `Admins managers can view order_replacements`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'operator'::app_role))` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
