# public.lalamove_uapi_snapshot

> Ultimo estado conhecido das respostas UAPI capturadas por navegador; fallback da edge lalamove-uapi quando o gateway assinado recusa a chamada direta (ret 10010).

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
| 1 | `resource` | `text` | não |  |  |  |
| 2 | `payload` | `jsonb` | não |  |  |  |
| 3 | `city_id` | `integer` | sim |  |  |  |
| 4 | `collected_at` | `timestamp with time zone` | não | `now()` |  |  |
| 5 | `expires_at` | `timestamp with time zone` | não | `(now() + '06:00:00'::interval)` |  | Apos esta data a linha nao e servida pela edge; o painel recebe o erro do gateway. |
| 6 | `collected_by` | `text` | não | `'browser-collector'::text` |  |  |
| 7 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_uapi_snapshot_pkey | PRIMARY KEY | `PRIMARY KEY (resource)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| lalamove_uapi_snapshot_expires_at_idx | btree | expires_at | não | sim |  | `CREATE INDEX lalamove_uapi_snapshot_expires_at_idx ON public.lalamove_uapi_snapshot USING btree (expires_at)` |
| lalamove_uapi_snapshot_pkey | btree | resource | sim | sim |  | `CREATE UNIQUE INDEX lalamove_uapi_snapshot_pkey ON public.lalamove_uapi_snapshot USING btree (resource)` |


## Policies (RLS)

### `equipe le snapshot uapi`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))` |
| WITH CHECK |  |

### `service role escreve snapshot uapi`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | service_role |
| USING | `true` |
| WITH CHECK | `true` |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
