# public.contract_version_usage

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
| 2 | `contract_name` | `text` | não |  |  |  |
| 3 | `contract_version` | `text` | não |  |  |  |
| 4 | `deprecated` | `boolean` | não | `false` |  |  |
| 5 | `usage_date` | `date` | não | `CURRENT_DATE` |  |  |
| 6 | `request_count` | `bigint` | não | `0` |  |  |
| 7 | `last_seen_at` | `timestamp with time zone` | não | `now()` |  |  |
| 8 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| contract_version_usage_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| contract_version_usage_unique | UNIQUE | `UNIQUE (contract_name, contract_version, usage_date)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| contract_version_usage_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX contract_version_usage_pkey ON public.contract_version_usage USING btree (id)` |
| contract_version_usage_unique | btree | contract_name, contract_version, usage_date | sim | sim |  | `CREATE UNIQUE INDEX contract_version_usage_unique ON public.contract_version_usage USING btree (contract_name, contract_version, usage_date)` |
| idx_contract_version_usage_date_cover | btree | usage_date, contract_name, contract_version, deprecated, request_count, last_seen_at | não | sim |  | `CREATE INDEX idx_contract_version_usage_date_cover ON public.contract_version_usage USING btree (usage_date) INCLUDE (contract_name, contract_version, deprecated, request_count, last_seen_at)` |
| idx_contract_version_usage_deprecated | btree | deprecated, usage_date | não | sim |  | `CREATE INDEX idx_contract_version_usage_deprecated ON public.contract_version_usage USING btree (deprecated, usage_date DESC)` |
| idx_contract_version_usage_version | btree | contract_version, usage_date | não | sim |  | `CREATE INDEX idx_contract_version_usage_version ON public.contract_version_usage USING btree (contract_version, usage_date DESC)` |


## Policies (RLS)

### `admins read contract usage`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
