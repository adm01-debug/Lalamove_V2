# public.alert_configurations

| propriedade | valor |
|---|---|
| tipo | table |
| owner | postgres |
| RLS habilitado | sim |
| RLS forçado (owner) | não |
| policies | 5 |
| realtime (publication) | não |
| replica identity | default |
| vem de extensão | não |


## Colunas

| # | coluna | tipo | nullable | default | identity/generated | comentário |
|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | não | `gen_random_uuid()` |  |  |
| 2 | `alert_type` | `alert_type` | não |  |  |  |
| 3 | `channel` | `text` | não |  |  |  |
| 4 | `is_enabled` | `boolean` | sim | `true` |  |  |
| 5 | `recipients` | `text[]` | sim | `'{}'::text[]` |  |  |
| 6 | `config` | `jsonb` | sim | `'{}'::jsonb` |  |  |
| 7 | `created_at` | `timestamp with time zone` | não | `now()` |  |  |
| 8 | `updated_at` | `timestamp with time zone` | não | `now()` |  |  |
| 9 | `name` | `text` | sim |  |  |  |
| 10 | `message_template` | `text` | sim |  |  |  |
| 11 | `min_interval_seconds` | `integer` | sim | `300` |  |  |
| 12 | `notify_whatsapp` | `boolean` | sim | `false` |  |  |
| 13 | `whatsapp_numbers` | `text[]` | sim |  |  |  |
| 14 | `notify_email` | `boolean` | sim | `false` |  |  |
| 15 | `email_addresses` | `text[]` | sim |  |  |  |
| 16 | `notify_slack` | `boolean` | sim | `false` |  |  |
| 17 | `slack_channels` | `text[]` | sim |  |  |  |
| 18 | `notify_sms` | `boolean` | sim | `false` |  |  |
| 19 | `sms_numbers` | `text[]` | sim |  |  |  |
| 20 | `notify_bitrix24_task` | `boolean` | sim | `false` |  |  |
| 21 | `bitrix24_user_ids` | `integer[]` | sim |  |  |  |
| 22 | `notify_n8n_webhook` | `boolean` | sim | `false` |  |  |
| 23 | `n8n_webhook_url` | `text` | sim |  |  |  |
| 24 | `conditions` | `jsonb` | sim |  |  |  |
| 25 | `created_by` | `text` | sim |  |  |  |
| 26 | `dedup_window_seconds` | `integer` | não | `300` |  |  |
| 27 | `escalation_enabled` | `boolean` | não | `false` |  |  |
| 28 | `escalation_after_seconds` | `integer` | não | `900` |  |  |
| 29 | `escalation_email_addresses` | `text[]` | sim | `'{}'::text[]` |  |  |
| 30 | `escalation_whatsapp_numbers` | `text[]` | sim | `'{}'::text[]` |  |  |
| 31 | `escalation_slack_channels` | `text[]` | sim | `'{}'::text[]` |  |  |
| 32 | `fallback_channel` | `text` | sim |  |  |  |
| 33 | `fallback_recipients` | `text[]` | sim | `'{}'::text[]` |  |  |


## Constraints

| nome | tipo | definição | on delete | on update | validada |
|---|---|---|---|---|---|
| alert_configurations_alert_type_channel_key | UNIQUE | `UNIQUE (alert_type, channel)` |  |  | sim |
| alert_configurations_dedup_window_non_negative | CHECK | `CHECK (dedup_window_seconds >= 0)` |  |  | sim |
| alert_configurations_escalation_after_positive | CHECK | `CHECK (escalation_after_seconds > 0)` |  |  | sim |
| alert_configurations_fallback_channel_valid | CHECK | `CHECK (fallback_channel IS NULL OR (fallback_channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'slack'::text, 'sms'::text, 'bitrix24'::text, 'n8n'::text])))` |  |  | sim |
| alert_configurations_min_interval_non_negative | CHECK | `CHECK (min_interval_seconds IS NULL OR min_interval_seconds >= 0)` |  |  | sim |
| alert_configurations_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |  |  | sim |


## Índices

| nome | método | colunas | único | válido | predicado | definição |
|---|---|---|---|---|---|---|
| alert_configurations_alert_type_channel_key | btree | alert_type, channel | sim | sim |  | `CREATE UNIQUE INDEX alert_configurations_alert_type_channel_key ON public.alert_configurations USING btree (alert_type, channel)` |
| alert_configurations_pkey | btree | id | sim | sim |  | `CREATE UNIQUE INDEX alert_configurations_pkey ON public.alert_configurations USING btree (id)` |
| idx_alert_configurations_escalation_lookup | btree | alert_type, escalation_after_seconds | não | sim | `((is_enabled = true) AND (escalation_enabled = true))` | `CREATE INDEX idx_alert_configurations_escalation_lookup ON public.alert_configurations USING btree (alert_type) INCLUDE (escalation_after_seconds) WHERE ((is_enabled = true) AND (escalation_enabled = true))` |


## Policies (RLS)

### `Admins can delete alert configs`

| campo | valor |
|---|---|
| comando | DELETE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'admin'::app_role)` |
| WITH CHECK |  |

### `Admins managers can view alert configs`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Managers can insert alert configs`

| campo | valor |
|---|---|
| comando | INSERT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING |  |
| WITH CHECK | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |

### `Managers can update alert configs`

| campo | valor |
|---|---|
| comando | UPDATE |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| WITH CHECK |  |

### `Viewers can view alert configs`

| campo | valor |
|---|---|
| comando | SELECT |
| tipo | PERMISSIVE |
| roles | authenticated |
| USING | `has_role(auth.uid(), 'viewer'::app_role)` |
| WITH CHECK |  |


## Triggers

| nome | timing | eventos | nível | status | função |
|---|---|---|---|---|---|
| update_alert_config_updated_at | BEFORE | UPDATE | ROW | enabled | public.update_updated_at_column |


## Grants

| role | privilégios |
|---|---|
| authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
