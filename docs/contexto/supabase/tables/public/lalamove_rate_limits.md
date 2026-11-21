# public.lalamove_rate_limits

> Controle de rate limit das chamadas a API Lalamove.

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
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `endpoint` | `text` | não |  |  |  |
| 3 | `method` | `text` | não |  |  |  |
| 4 | `status` | `integer` | não |  |  |  |
| 5 | `attempts` | `smallint` | não | `1` |  |  |
| 6 | `limit_total` | `integer` | sim |  |  |  |
| 7 | `limit_remaining` | `integer` | sim |  |  |  |
| 8 | `limit_reset_at` | `timestamp with time zone` | sim |  |  |  |
| 9 | `usage_ratio` | `numeric(5,2)` | sim |  |  |  |
| 10 | `request_id` | `text` | sim |  |  |  |
| 11 | `raw_headers` | `jsonb` | não | `'{}'::jsonb` |  |  |
| 12 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| lalamove_rate_limits_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| idx_lalamove_rate_limits_created | btree | created_at | não | sim |  | `CREATE INDEX idx_lalamove_rate_limits_created ON public.lalamove_rate_limits USING btree (created_at DESC)` |
| idx_lalamove_rate_limits_endpoint_created | btree | endpoint, created_at | não | sim |  | `CREATE INDEX idx_lalamove_rate_limits_endpoint_created ON public.lalamove_rate_limits USING btree (endpoint, created_at DESC)` |
| idx_lalamove_rate_limits_errors | btree | created_at | não | sim | `(status >= 400)` | `CREATE INDEX idx_lalamove_rate_limits_errors ON public.lalamove_rate_limits USING btree (created_at DESC) WHERE (status >= 400)` |
| idx_lalamove_rate_limits_low_remaining | btree | created_at | não | sim | `((limit_remaining IS NOT NULL) AND (limit_remaining <= 10))` | `CREATE INDEX idx_lalamove_rate_limits_low_remaining ON public.lalamove_rate_limits USING btree (created_at DESC) WHERE ((limit_remaining IS NOT NULL) AND (limit_remaining <= 10))` |
| lalamove_rate_limits_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX lalamove_rate_limits_pkey ON public.lalamove_rate_limits USING btree (id)` |


## Policies (RLS)

### `Admins and managers can view rate limits`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `System roles can insert rate limits`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_notify_lalamove_quota_low | AFTER | INSERT | ROW | enabled | public.notify_lalamove_quota_low |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
