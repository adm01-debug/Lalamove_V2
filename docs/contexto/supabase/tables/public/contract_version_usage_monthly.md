# public.contract_version_usage_monthly

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
| 5 | `usage_month` | `date` | não |  |  |  |
| 6 | `request_count` | `bigint` | não | `0` |  |  |
| 7 | `last_seen_at` | `timestamp with time zone` | sim |  |  |  |
| 8 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 9 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| contract_version_usage_monthly_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| contract_version_usage_monthly_unique | UNIQUE | `UNIQUE (contract_name, contract_version, usage_month)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| contract_version_usage_monthly_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX contract_version_usage_monthly_pkey ON public.contract_version_usage_monthly USING btree (id)` |
| contract_version_usage_monthly_unique | btree | contract_name, contract_version, usage_month | sim | sim |  | `CREATE UNIQUE INDEX contract_version_usage_monthly_unique ON public.contract_version_usage_monthly USING btree (contract_name, contract_version, usage_month)` |
| idx_contract_version_usage_monthly_month | btree | usage_month | não | sim |  | `CREATE INDEX idx_contract_version_usage_monthly_month ON public.contract_version_usage_monthly USING btree (usage_month)` |
| idx_contract_version_usage_monthly_month_cover | btree | usage_month, contract_version, request_count | não | sim |  | `CREATE INDEX idx_contract_version_usage_monthly_month_cover ON public.contract_version_usage_monthly USING btree (usage_month) INCLUDE (contract_version, request_count)` |


## Policies (RLS)

### `Admins can view monthly contract usage`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| update_contract_version_usage_monthly_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
