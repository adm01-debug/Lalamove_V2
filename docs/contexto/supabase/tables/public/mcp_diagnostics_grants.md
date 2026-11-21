# public.mcp_diagnostics_grants

> Grants de acesso a diagnosticos via MCP (query_telemetry).

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
| 2 | `user_id` | `uuid` | não |  |  |  |
| 3 | `purpose` | `text` | não |  |  |  |
| 4 | `is_active` | `boolean` | não | `true` |  |  |
| 5 | `granted_by` | `uuid` | sim |  |  |  |
| 6 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 7 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| mcp_diagnostics_grants_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| mcp_diagnostics_grants_user_id_key | UNIQUE | `UNIQUE (user_id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| mcp_diagnostics_grants_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX mcp_diagnostics_grants_pkey ON public.mcp_diagnostics_grants USING btree (id)` |
| mcp_diagnostics_grants_user_id_key | btree | user_id | sim | sim |  | `CREATE UNIQUE INDEX mcp_diagnostics_grants_user_id_key ON public.mcp_diagnostics_grants USING btree (user_id)` |


## Policies (RLS)

### `Admins manage diagnostics grants`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK | `has_role(auth.uid(), 'admin'::app_role)` |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_mcp_diagnostics_grants_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
