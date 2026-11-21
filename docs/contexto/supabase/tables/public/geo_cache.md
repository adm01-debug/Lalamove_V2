# public.geo_cache

> Cache de respostas de geocode/rota/static por hash de request (TTL por funcao).

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 0 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `key` | `text` | não |  |  |  |
| 2 | `provider` | `text` | não |  |  |  |
| 3 | `function` | `text` | não |  |  |  |
| 4 | `response` | `jsonb` | não |  |  |  |
| 5 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 6 | `expires_at` | `timestamp with time zone` | não |  |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| geo_cache_pkey | PRIMARY KEY | `PRIMARY KEY (key)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| geo_cache_pkey | btree | key | sim | sim |  | `CREATE UNIQUE INDEX geo_cache_pkey ON public.geo_cache USING btree (key)` |
| idx_geo_cache_expires | btree | expires_at | não | sim |  | `CREATE INDEX idx_geo_cache_expires ON public.geo_cache USING btree (expires_at)` |


## Policies (RLS)

> ⚠️ RLS habilitado **sem policies**: nenhum acesso via API (anon/authenticated).



## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
