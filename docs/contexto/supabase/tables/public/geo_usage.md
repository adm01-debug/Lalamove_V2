# public.geo_usage

> Uso diario de APIs de mapa por provedor/funcao/sku com custo estimado (USD).

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
| usada por views | public.geo_usage_month |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `day` | `date` | não |  |  |  |
| 2 | `provider` | `text` | não |  |  |  |
| 3 | `function` | `text` | não |  |  |  |
| 4 | `sku` | `text` | não |  |  |  |
| 5 | `count` | `integer` | não | `0` |  |  |
| 6 | `est_cost_usd` | `numeric(12,4)` | não | `0` |  |  |
| 7 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| geo_usage_pkey | PRIMARY KEY | `PRIMARY KEY (day, provider, function, sku)` |  |  | sim |
| geo_usage_provider_check | CHECK | `CHECK (provider = ANY (ARRAY['google'::text, 'mapbox'::text]))` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| geo_usage_pkey | btree | day, provider, function, sku | sim | sim |  | `CREATE UNIQUE INDEX geo_usage_pkey ON public.geo_usage USING btree (day, provider, function, sku)` |
| idx_geo_usage_month | btree | provider, day | não | sim |  | `CREATE INDEX idx_geo_usage_month ON public.geo_usage USING btree (provider, day)` |


## Policies (RLS)

### `geo_usage_read_manager`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
