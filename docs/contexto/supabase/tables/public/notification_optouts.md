# public.notification_optouts

> Telefones que pediram para nao receber avisos geo (etapa 60). send-notification consulta antes de enviar.

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
| 1 | `phone` | `text` | não |  |  |  |
| 2 | `reason` | `text` | não |  |  |  |
| 3 | `created_by` | `uuid` | sim |  |  |  |
| 4 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| notification_optouts_created_by_fkey | FOREIGN KEY | `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| notification_optouts_pkey | PRIMARY KEY | `PRIMARY KEY (phone)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| notification_optouts_created_by_idx | btree | created_by | não | sim |  | `CREATE INDEX notification_optouts_created_by_idx ON public.notification_optouts USING btree (created_by)` |
| notification_optouts_pkey | btree | phone | sim | sim |  | `CREATE UNIQUE INDEX notification_optouts_pkey ON public.notification_optouts USING btree (phone)` |


## Policies (RLS)

### `admin gerencia opt-outs`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |

### `service role escreve opt-outs`

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
