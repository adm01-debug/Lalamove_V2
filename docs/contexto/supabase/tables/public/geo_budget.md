# public.geo_budget

> Orcamento mensal por provedor; geo_budget_status() informa bloqueio/aviso.

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
| 1 | `provider` | `text` | não |  |  |  |
| 2 | `monthly_limit_usd` | `numeric(10,2)` | não | `0` |  |  |
| 3 | `hard_stop` | `boolean` | não | `true` |  |  |
| 4 | `alert_at_pct` | `integer` | não | `80` |  |  |
| 5 | `warned_month` | `date` | sim |  |  |  |
| 6 | `updated_by` | `uuid` | sim |  |  |  |
| 7 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |
| 8 | `blocked_warned_month` | `date` | sim |  |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| geo_budget_alert_at_pct_check | CHECK | `CHECK (alert_at_pct >= 1 AND alert_at_pct <= 100)` |  |  | sim |
| geo_budget_pkey | PRIMARY KEY | `PRIMARY KEY (provider)` |  |  | sim |
| geo_budget_provider_check | CHECK | `CHECK (provider = ANY (ARRAY['google'::text, 'mapbox'::text]))` |  |  | sim |
| geo_budget_updated_by_fkey | FOREIGN KEY | `FOREIGN KEY (updated_by) REFERENCES auth.users(id)` | NO ACTION | NO ACTION | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| geo_budget_pkey | btree | provider | sim | sim |  | `CREATE UNIQUE INDEX geo_budget_pkey ON public.geo_budget USING btree (provider)` |


## Policies (RLS)

### `geo_budget_admin_all`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | public |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK | `has_role(auth.uid(), 'admin'::app_role)` |

### `geo_budget_read_authenticated`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(auth.role() = 'authenticated'::text)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| trg_geo_budget_audit | AFTER | INSERT OR DELETE OR UPDATE | ROW | enabled | public.geo_audit_config |
| update_geo_budget_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
