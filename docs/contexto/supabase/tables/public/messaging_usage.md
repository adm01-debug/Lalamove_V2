# public.messaging_usage

> Consumo diario de mensageria por canal e provedor (etapa 81). Alimenta o teto mensal (Z5).

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
| 1 | `day` | `date` | não |  |  |  |
| 2 | `channel` | `text` | não |  |  |  |
| 3 | `provider` | `text` | não |  |  |  |
| 4 | `messages` | `integer` | não | `0` |  |  |
| 5 | `segments` | `integer` | não | `0` |  |  |
| 6 | `cost_cents` | `integer` | não | `0` |  |  |
| 7 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| messaging_usage_cost_cents_check | CHECK | `CHECK (cost_cents >= 0)` |  |  | sim |
| messaging_usage_messages_check | CHECK | `CHECK (messages >= 0)` |  |  | sim |
| messaging_usage_pkey | PRIMARY KEY | `PRIMARY KEY (day, channel, provider)` |  |  | sim |
| messaging_usage_segments_check | CHECK | `CHECK (segments >= 0)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| messaging_usage_day_idx | btree | day | não | sim |  | `CREATE INDEX messaging_usage_day_idx ON public.messaging_usage USING btree (day)` |
| messaging_usage_pkey | btree | day, channel, provider | sim | sim |  | `CREATE UNIQUE INDEX messaging_usage_pkey ON public.messaging_usage USING btree (day, channel, provider)` |


## Policies (RLS)

### `equipe le uso de mensageria`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))` |
| WITH CHECK |  |

### `service role escreve uso de mensageria`

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
