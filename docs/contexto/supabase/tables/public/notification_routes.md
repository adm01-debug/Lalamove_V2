# public.notification_routes

> Rota evento x papel (etapa 78): canais em ordem, espera antes do fallback e se exige resposta.

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 3 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `event` | `text` | não |  |  |  |
| 2 | `role` | `text` | não |  |  |  |
| 3 | `channels` | `text[]` | não | `'{}'::text[]` |  |  |
| 4 | `fallback_after_min` | `integer` | não | `0` |  |  |
| 5 | `requires_reply` | `boolean` | não | `false` |  |  |
| 6 | `reply_timeout_min` | `integer` | sim |  |  |  |
| 7 | `is_enabled` | `boolean` | não | `true` |  |  |
| 8 | `updated_by` | `uuid` | sim |  |  |  |
| 9 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| notification_routes_fallback_after_min_check | CHECK | `CHECK (fallback_after_min >= 0 AND fallback_after_min <= 1440)` |  |  | sim |
| notification_routes_pkey | PRIMARY KEY | `PRIMARY KEY (event, role)` |  |  | sim |
| notification_routes_reply_timeout_min_check | CHECK | `CHECK (reply_timeout_min IS NULL OR reply_timeout_min > 0)` |  |  | sim |
| notification_routes_role_check | CHECK | `CHECK (role = ANY (ARRAY['driver'::text, 'supplier'::text, 'customer'::text, 'internal'::text]))` |  |  | sim |
| notification_routes_updated_by_fkey | FOREIGN KEY | `FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| notification_routes_event_idx | btree | event | não | sim | `is_enabled` | `CREATE INDEX notification_routes_event_idx ON public.notification_routes USING btree (event) WHERE is_enabled` |
| notification_routes_pkey | btree | event, role | sim | sim |  | `CREATE UNIQUE INDEX notification_routes_pkey ON public.notification_routes USING btree (event, role)` |
| notification_routes_updated_by_idx | btree | updated_by | não | sim |  | `CREATE INDEX notification_routes_updated_by_idx ON public.notification_routes USING btree (updated_by)` |


## Policies (RLS)

### `admin edita rotas de notificacao`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |

### `equipe le rotas de notificacao`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'operator'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role))` |
| WITH CHECK |  |

### `service role gerencia rotas de notificacao`

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
