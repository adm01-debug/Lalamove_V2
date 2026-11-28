# public.lalamove_uapi_statement_item

> Lançamentos do extrato UAPI deduplicados por conteúdo (item_key). Base da paginação por chave montada na edge.

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
| 1 | `item_key` | `text` | não |  |  | Identidade do lançamento: city_id\|date_time\|amount\|order_display_id\|name\|sub_name\|user_fid\|topup_tx_no. |
| 2 | `city_id` | `integer` | sim |  |  |  |
| 3 | `occurred_at_local` | `timestamp without time zone` | não |  |  | date_time do gateway (hora local da cidade, sem fuso) — usado só para ordenar. |
| 4 | `payload` | `jsonb` | não |  |  |  |
| 5 | `first_seen_at` | `timestamp with time zone` | não | `now()` |  |  |
| 6 | `last_seen_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_uapi_statement_item_pkey | PRIMARY KEY | `PRIMARY KEY (item_key)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| lalamove_uapi_statement_item_paginate_idx | btree | occurred_at_local, item_key | não | sim |  | `CREATE INDEX lalamove_uapi_statement_item_paginate_idx ON public.lalamove_uapi_statement_item USING btree (occurred_at_local DESC, item_key DESC)` |
| lalamove_uapi_statement_item_pkey | btree | item_key | sim | sim |  | `CREATE UNIQUE INDEX lalamove_uapi_statement_item_pkey ON public.lalamove_uapi_statement_item USING btree (item_key)` |


## Policies (RLS)

> ⚠️ RLS habilitado **sem policies**: nenhum acesso via API (anon/authenticated).



## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
