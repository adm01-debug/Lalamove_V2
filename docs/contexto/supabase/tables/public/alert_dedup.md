# public.alert_dedup

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
| 1 | `dedup_key` | `text` | não |  |  |  |
| 2 | `alert_type` | `alert_type` | não |  |  |  |
| 3 | `first_seen_at` | `timestamp with time zone` | não | `now()` |  |  |
| 4 | `last_notified_at` | `timestamp with time zone` | não | `now()` |  |  |
| 5 | `occurrence_count` | `integer` | não | `1` |  |  |
| 6 | `suppressed_count` | `integer` | não | `0` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| alert_dedup_pkey | PRIMARY KEY | `PRIMARY KEY (dedup_key)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| alert_dedup_pkey | btree | dedup_key | sim | sim |  | `CREATE UNIQUE INDEX alert_dedup_pkey ON public.alert_dedup USING btree (dedup_key)` |
| idx_alert_dedup_last_notified | btree | last_notified_at | não | sim |  | `CREATE INDEX idx_alert_dedup_last_notified ON public.alert_dedup USING btree (last_notified_at)` |
| idx_alert_dedup_suppressed | btree | last_notified_at | não | sim | `(suppressed_count > 0)` | `CREATE INDEX idx_alert_dedup_suppressed ON public.alert_dedup USING btree (last_notified_at DESC) WHERE (suppressed_count > 0)` |
| idx_alert_dedup_type_notified | btree | alert_type, last_notified_at | não | sim |  | `CREATE INDEX idx_alert_dedup_type_notified ON public.alert_dedup USING btree (alert_type, last_notified_at DESC)` |


## Policies (RLS)

### `Authorized roles can view alert dedup`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | public |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |


## Triggers

_nenhum_


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
