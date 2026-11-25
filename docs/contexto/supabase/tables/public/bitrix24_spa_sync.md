# public.bitrix24_spa_sync

> Sincronizacao do pedido com o SPA 1690 do Bitrix24 (crm.item.*). Substitui bitrix24_sync (modelo de deals).

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 1 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `order_id` | `uuid` | não |  |  |  |
| 3 | `spa_id` | `integer` | não |  |  |  |
| 4 | `category_id` | `integer` | sim |  |  |  |
| 5 | `last_stage` | `text` | sim |  |  |  |
| 6 | `last_synced_at` | `timestamp with time zone` | sim |  |  |  |
| 7 | `last_error` | `text` | sim |  |  |  |
| 8 | `sync_status` | `text` | não | `'pending'::text` |  |  |
| 9 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 10 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| bitrix24_spa_sync_order_id_fkey | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES lalamove_orders(id) ON DELETE CASCADE` | CASCADE | NO ACTION | sim |
| bitrix24_spa_sync_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| bitrix24_spa_sync_sync_status_check | CHECK | `CHECK (sync_status = ANY (ARRAY['pending'::text, 'success'::text, 'error'::text]))` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| bitrix24_spa_sync_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX bitrix24_spa_sync_pkey ON public.bitrix24_spa_sync USING btree (id)` |
| idx_bitrix24_spa_sync_spa | btree | spa_id | não | sim |  | `CREATE INDEX idx_bitrix24_spa_sync_spa ON public.bitrix24_spa_sync USING btree (spa_id)` |
| uq_bitrix24_spa_sync_order | btree | order_id | sim | sim |  | `CREATE UNIQUE INDEX uq_bitrix24_spa_sync_order ON public.bitrix24_spa_sync USING btree (order_id)` |


## Policies (RLS)

### `Admin manager view spa sync`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'admin'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role))` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
