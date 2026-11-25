# public.blocked_ips

> IPs bloqueados por rate limit/seguranca com motivo e expiracao.

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
| 2 | `ip_address` | `inet` | não |  |  |  |
| 3 | `reason` | `text` | não |  |  |  |
| 4 | `blocked_by` | `uuid` | sim |  |  |  |
| 5 | `blocked_at` | `timestamp with time zone` | sim | `now()` |  |  |
| 6 | `expires_at` | `timestamp with time zone` | sim |  |  |  |
| 7 | `is_permanent` | `boolean` | sim | `false` |  |  |
| 8 | `attempts_count` | `integer` | sim | `0` |  |  |
| 9 | `last_attempt_at` | `timestamp with time zone` | sim |  |  |  |
| 10 | `metadata` | `jsonb` | sim | `'{}'::jsonb` |  |  |
| 11 | `created_at` | `timestamp with time zone` | sim | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| blocked_ips_ip_address_key | UNIQUE | `UNIQUE (ip_address)` |  |  | sim |
| blocked_ips_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| blocked_ips_ip_address_key | btree | ip_address | sim | sim |  | `CREATE UNIQUE INDEX blocked_ips_ip_address_key ON public.blocked_ips USING btree (ip_address)` |
| blocked_ips_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX blocked_ips_pkey ON public.blocked_ips USING btree (id)` |
| idx_blocked_ips_expires | btree | expires_at | não | sim |  | `CREATE INDEX idx_blocked_ips_expires ON public.blocked_ips USING btree (expires_at)` |


## Policies (RLS)

### `Admins can manage blocked IPs`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | public |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK |  |

### `Managers can view blocked IPs`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `has_role(( SELECT auth.uid() AS uid), 'manager'::app_role)` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
