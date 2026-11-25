# public.geo_price_list

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
| 1 | `provider` | `text` | não |  |  |  |
| 2 | `sku` | `text` | não |  |  |  |
| 3 | `free_quota_month` | `integer` | não | `0` |  |  |
| 4 | `unit_cost_per_1000` | `numeric(10,4)` | não |  |  |  |
| 5 | `note` | `text` | sim |  |  |  |
| 6 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| geo_price_list_pkey | PRIMARY KEY | `PRIMARY KEY (provider, sku)` |  |  | sim |
| geo_price_list_provider_check | CHECK | `CHECK (provider = ANY (ARRAY['google'::text, 'mapbox'::text]))` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| geo_price_list_pkey | btree | provider, sku | sim | sim |  | `CREATE UNIQUE INDEX geo_price_list_pkey ON public.geo_price_list USING btree (provider, sku)` |


## Policies (RLS)

### `geo_price_list_admin_all`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | public |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |

### `geo_price_list_read_authenticated`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(( SELECT auth.role() AS role) = 'authenticated'::text)` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
