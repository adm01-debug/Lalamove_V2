# public.messaging_settings

> Configuracao unica da mensageria (etapa 75). shadow_mode=true decide tudo e nao envia nada.

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
| 1 | `id` | `boolean` | não | `true` |  |  |
| 2 | `whatsapp_provider` | `text` | não | `'zapp'::text` |  |  |
| 3 | `sms_provider` | `text` | não | `'none'::text` |  |  |
| 4 | `sms_fallback_after_min` | `integer` | não | `10` |  |  |
| 5 | `monthly_budget_cents` | `integer` | não | `0` |  |  |
| 6 | `quiet_hours_by_role` | `jsonb` | não | `'{}'::jsonb` |  | Horario de silencio por papel. Motorista com pedido ativo e isento (Z9). |
| 7 | `pilot_mode` | `boolean` | não | `false` |  |  |
| 8 | `shadow_mode` | `boolean` | não | `true` |  |  |
| 9 | `updated_by` | `uuid` | sim |  |  |  |
| 10 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| messaging_settings_id_check | CHECK | `CHECK (id)` |  |  | sim |
| messaging_settings_monthly_budget_cents_check | CHECK | `CHECK (monthly_budget_cents >= 0)` |  |  | sim |
| messaging_settings_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |
| messaging_settings_sms_fallback_after_min_check | CHECK | `CHECK (sms_fallback_after_min >= 0 AND sms_fallback_after_min <= 1440)` |  |  | sim |
| messaging_settings_sms_provider_check | CHECK | `CHECK (sms_provider = ANY (ARRAY['none'::text, 'zenvia'::text, 'comtele'::text, 'twilio'::text]))` |  |  | sim |
| messaging_settings_updated_by_fkey | FOREIGN KEY | `FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL` | SET NULL | NO ACTION | sim |
| messaging_settings_whatsapp_provider_check | CHECK | `CHECK (whatsapp_provider = ANY (ARRAY['zapp'::text, 'evolution'::text, 'off'::text]))` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| messaging_settings_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX messaging_settings_pkey ON public.messaging_settings USING btree (id)` |
| messaging_settings_updated_by_idx | btree | updated_by | não | sim |  | `CREATE INDEX messaging_settings_updated_by_idx ON public.messaging_settings USING btree (updated_by)` |


## Policies (RLS)

### `admin edita configuracao de mensageria`

| campo | valor |
|---|---|
| comando | ALL |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |
| WITH CHECK | `has_role(( SELECT auth.uid() AS uid), 'admin'::app_role)` |

### `equipe le configuracao de mensageria`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(( SELECT auth.uid() AS uid), 'operator'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'manager'::app_role) OR has_role(( SELECT auth.uid() AS uid), 'admin'::app_role))` |
| WITH CHECK |  |

### `service role gerencia configuracao de mensageria`

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
