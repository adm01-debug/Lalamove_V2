# 07 · REGRAS DE NEGÓCIO

> Gerado automaticamente por AI Context Sync v1.3.2 · commit `f973d92c0e` · branch `main` · 2026-11-22 00:47 UTC
> Não edite à mão — regras humanas vão em `manual/`.

## A. Regras escritas por humanos (`manual/` — prioridade máxima, nunca sobrescrito)

_Nenhum arquivo em `manual/`. Copie `manual/TEMPLATE-regras-de-negocio.md` para `manual/regras.md` e preencha._

## B. Quem pode ver/alterar o quê (RLS — conforme migrations do repo; schema real em `06`)

| Tabela | Política | Comando | Roles | Modo | USING | WITH CHECK |
|---|---|---|---|---|---|---|
| `saved_filters` | Users can insert own filters | INSERT | public | permissive |  | `auth.uid() = user_id` |
| `entity_versions` | Users can view versions | SELECT | public | permissive | `true` |  |
| `entity_versions` | Users can insert versions | INSERT | public | permissive |  | `auth.uid() = changed_by OR changed_by IS NULL` |
| `saved_filters` | Users can view own filters | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `saved_filters` | Users can create own filters | INSERT | public | permissive |  | `auth.uid() = user_id` |
| `saved_filters` | Users can update own filters | UPDATE | public | permissive | `auth.uid() = user_id` |  |
| `saved_filters` | Users can delete own filters | DELETE | public | permissive | `auth.uid() = user_id` |  |
| `system_logs` | system_logs_select | SELECT | public | permissive | `auth.uid() IS NOT NULL` |  |
| `system_logs` | system_logs_insert | INSERT | public | permissive |  | `true` |
| `job_queue` | Admin can view all jobs | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `job_queue` | Service role can manage jobs | ALL | public | permissive | `auth.role() = 'service_role'` |  |
| `job_queue` | Users can view their own jobs | SELECT | public | permissive | `auth.uid() = created_by OR auth.uid() IN ( SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin' )` |  |
| `job_queue` | Admins can create jobs | INSERT | public | permissive |  | `auth.uid() IN ( SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin' )` |
| `role_permissions` | Admins can manage role_permissions | ALL | public | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `rate_limit_logs` | Admins can view rate limit logs | SELECT | public | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `blocked_ips` | Admins can manage blocked IPs | ALL | public | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `blocked_ips` | Managers can view blocked IPs | SELECT | public | permissive | `public.has_role(auth.uid(), 'manager')` |  |
| `ip_whitelist` | Admins can manage IP whitelist | ALL | public | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `ip_whitelist` | Managers can view IP whitelist | SELECT | public | permissive | `public.has_role(auth.uid(), 'manager')` |  |
| `auth_logs` | Users can view own auth logs | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `auth_logs` | Admins can view all auth logs | SELECT | public | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `password_reset_tokens` | Users can view own reset tokens | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `email_verifications` | Users can view own verifications | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `password_reset_requests` | Admins and managers can view reset requests | SELECT | public | permissive | `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')` |  |
| `password_reset_requests` | Admins can update reset requests | UPDATE | public | permissive | `has_role(auth.uid(), 'admin')` | `has_role(auth.uid(), 'admin')` |
| `login_attempts` | Admins can delete login attempts | DELETE | public | permissive | `has_role(auth.uid(), 'admin'::app_role)` |  |
| `active_tracking` | Managers can insert tracking | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `active_tracking` | Managers can update tracking | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |  |
| `active_tracking` | Admins can delete tracking | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `alert_configurations` | Managers can insert alert configs | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |
| `alert_configurations` | Managers can update alert configs | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `alert_configurations` | Admins can delete alert configs | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `alerts` | Operators can insert alerts | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `alerts` | Operators can update alerts | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |  |
| `alerts` | Managers can delete alerts | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `alerts_sent` | System can insert alerts sent | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `alerts_sent` | Managers can update alerts sent | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `alerts_sent` | Admins can delete alerts sent | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `auth_logs` | Authenticated can insert auth logs | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'viewer')` |
| `bitrix24_activities` | Managers can insert activities | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |
| `bitrix24_activities` | Managers can update activities | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `bitrix24_activities` | Admins can delete activities | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `bitrix24_stage_mappings` | Managers can insert stage mappings | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |
| `bitrix24_stage_mappings` | Managers can update stage mappings | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `bitrix24_stage_mappings` | Admins can delete stage mappings | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `bitrix24_sync` | Operators can insert sync data | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `bitrix24_sync` | Operators can update sync data | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |  |
| `bitrix24_sync` | Managers can delete sync data | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `bitrix24_tokens` | Admins can insert tokens | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin')` |
| `bitrix24_tokens` | Admins can update tokens | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `bitrix24_tokens` | Admins can delete tokens | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `driver_approval_queue` | Managers can insert approvals | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |
| `driver_approval_queue` | Managers can update approvals | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `driver_approval_queue` | Admins can delete approvals | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `driver_evaluations` | Operators can insert evaluations | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `driver_evaluations` | Managers can update evaluations | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `driver_evaluations` | Admins can delete evaluations | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `driver_incidents` | Operators can insert incidents | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `driver_incidents` | Managers can update incidents | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `driver_incidents` | Admins can delete incidents | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `driver_locations` | Operators can insert driver locations | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `driver_locations` | Operators can update driver locations | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |  |
| `driver_locations` | Managers can delete driver locations | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `drivers` | Managers can insert drivers | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |
| `drivers` | Managers can update drivers | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `drivers` | Admins can delete drivers | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `geo_blocks` | Admins can insert geo blocks | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin')` |
| `geo_blocks` | Admins can update geo blocks | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `geo_blocks` | Admins can delete geo blocks | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `ip_whitelist` | Admins can insert whitelist | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin')` |
| `ip_whitelist` | Admins can update whitelist | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `ip_whitelist` | Admins can delete whitelist | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `lalamove_orders` | Operators can insert orders | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `lalamove_orders` | Operators can update orders | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |  |
| `lalamove_orders` | Managers can delete orders | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `mfa_sessions` | Users can insert their MFA sessions | INSERT | authenticated | permissive |  | `auth.uid() = user_id` |
| `mfa_sessions` | Users can update their MFA sessions | UPDATE | authenticated | permissive | `auth.uid() = user_id` |  |
| `mfa_sessions` | Users can delete their MFA sessions | DELETE | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `new_device_alerts` | Users can insert their device alerts | INSERT | authenticated | permissive |  | `auth.uid() = user_id` |
| `new_device_alerts` | Users can update their device alerts | UPDATE | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `new_device_alerts` | Users can delete their device alerts | DELETE | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `permissions` | Admins can insert permissions | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin')` |
| `permissions` | Admins can update permissions | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `permissions` | Admins can delete permissions | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `risk_rules` | Managers can insert risk rules | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |
| `risk_rules` | Managers can update risk rules | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `risk_rules` | Admins can delete risk rules | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `role_permissions` | Admins can insert role permissions | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin')` |
| `role_permissions` | Admins can update role permissions | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `role_permissions` | Admins can delete role permissions | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `user_devices` | Users can insert their devices | INSERT | authenticated | permissive |  | `auth.uid() = user_id` |
| `user_devices` | Users can update their devices | UPDATE | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `user_devices` | Users can delete their devices | DELETE | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `webauthn_challenges` | Users can insert their challenges | INSERT | authenticated | permissive |  | `auth.uid() = user_id` |
| `webauthn_challenges` | Users can update their challenges | UPDATE | authenticated | permissive | `auth.uid() = user_id` |  |
| `webauthn_challenges` | Users can delete their challenges | DELETE | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `webhook_events` | Operators can insert events | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `webhook_events` | Managers can update events | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `webhook_events` | Admins can delete events | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `email_verifications` | Users can update their verifications | UPDATE | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `email_verifications` | Admins can delete verifications | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `lalamove_status_history` | Operators can insert status history | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `lalamove_status_history` | Managers can update status history | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `lalamove_status_history` | Admins can delete status history | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `lalamove_stops` | Operators can insert stops | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `lalamove_stops` | Managers can update stops | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `lalamove_stops` | Admins can delete stops | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `tracking_events_old` | Operators can insert tracking events | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `tracking_events_old` | Managers can update tracking events | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `tracking_events_old` | Admins can delete tracking events | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `rate_limit_logs` | Authenticated can insert rate limit logs | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'viewer')` |
| `password_reset_tokens` | Admins can delete reset tokens | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `webauthn_challenges` | Authenticated can create challenges | INSERT | authenticated | permissive |  | `auth.uid() = user_id` |
| `webauthn_challenges` | Authenticated can read own challenges | SELECT | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `login_attempts` | Admins can view login attempts | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role)` |  |
| `password_reset_tokens` | Users can select own reset tokens | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `alerts` | Authorized roles can view alerts | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `active_tracking` | Authorized roles can view tracking | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `alerts_sent` | Authorized roles can view alerts sent | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `bitrix24_activities` | Authorized roles can view activities | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |  |
| `bitrix24_stage_mappings` | Authorized roles can view stage mappings | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `bitrix24_tokens` | Only admins can view tokens | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role)` |  |
| `driver_approval_queue` | Authorized roles can view approvals | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `driver_evaluations` | Authorized roles can view evaluations | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `driver_incidents` | Authorized roles can view incidents | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `lalamove_status_history` | Authorized roles can view status history | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `risk_rules` | Authorized roles can view risk rules | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `tracking_events_old` | Authorized roles can view tracking events | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)` |  |
| `cron_job_logs` | Admins can view cron logs | SELECT | public | permissive | `has_role(auth.uid(), 'admin'::app_role)` |  |
| `password_reset_tokens` | Authenticated can insert own reset tokens | INSERT | authenticated | permissive |  | `auth.uid() = user_id` |
| `drivers` | Admins managers can view all drivers | SELECT | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |  |
| `drivers` | Operators can view drivers limited | SELECT | authenticated | permissive | `has_role(auth.uid(), 'operator'::app_role)` |  |
| `lalamove_orders` | Admins managers can view all orders | SELECT | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |  |
| `lalamove_orders` | Operators can view orders | SELECT | authenticated | permissive | `has_role(auth.uid(), 'operator'::app_role)` |  |
| `alert_configurations` | Admins managers can view alert configs | SELECT | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |  |
| `driver_locations` | Admins managers can view all locations | SELECT | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |  |
| `driver_locations` | Operators can view active delivery locations only | SELECT | authenticated | permissive | `has_role(auth.uid(), 'operator'::app_role) AND EXISTS ( SELECT 1 FROM public.active_tracking at WHERE at.id = driver_locations.tracking_id AND at.tracking_status = 'ACTIVE' )` |  |
| `lalamove_stops` | Admins managers can view all stops | SELECT | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |  |
| `lalamove_stops` | Operators can view stops limited | SELECT | authenticated | permissive | `has_role(auth.uid(), 'operator'::app_role)` |  |
| `runtime_error_logs` | Admins managers can view error logs | SELECT | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |  |
| `runtime_error_logs` | Admins can update error logs | UPDATE | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |  |
| `runtime_error_logs` | Admins can delete error logs | DELETE | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role)` |  |
| `login_attempts` | Admins can update login attempts | UPDATE | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| `runtime_error_logs` | Authenticated can insert error logs | INSERT | authenticated | permissive |  | `auth.uid() IS NOT NULL` |
| `email_verifications` | Users can insert own verifications | INSERT | authenticated | permissive |  | `auth.uid() = user_id` |
| `login_attempts` | Admins can insert login attempts | INSERT | authenticated | permissive |  | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)` |
| `password_reset_requests` | Users can request own password reset | INSERT | authenticated | permissive |  | `user_email = (SELECT email FROM auth.users WHERE id = auth.uid())` |
| `lalamove_uapi_sessions` | Admins can manage UAPI sessions | ALL | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` | `public.has_role(auth.uid(), 'admin'::app_role)` |
| `user_passkeys` | Users can view own passkeys | SELECT | authenticated | permissive | `auth.uid() = user_id` |  |
| `mfa_sessions` | Users can manage own MFA sessions | ALL | authenticated | permissive | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `user_devices` | Users can manage own devices | ALL | authenticated | permissive | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `user_devices` | Users can view own devices | SELECT | authenticated | permissive | `auth.uid() = user_id` |  |
| `new_device_alerts` | Users can view own device alerts | SELECT | authenticated | permissive | `auth.uid() = user_id` |  |
| `lalamove_orders` | Viewers can view orders | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `drivers` | Viewers can view drivers | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `alerts` | Viewers can view alerts | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `driver_evaluations` | Viewers can view driver evaluations | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `driver_approval_queue` | Viewers can view approval queue | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `active_tracking` | Viewers can view tracking | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `lalamove_status_history` | Viewers can view status history | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `risk_rules` | Viewers can view risk rules | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `driver_incidents` | Viewers can view incidents | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `alert_configurations` | Viewers can view alert configs | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'viewer'::app_role)` |  |
| `query_telemetry` | Admins can manage telemetry | ALL | authenticated | permissive | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| `query_telemetry` | Managers can view telemetry | SELECT | authenticated | permissive | `has_role(auth.uid(), 'manager'::app_role)` |  |
| `feature_flags` | Feature flags can only be managed by admins | ALL | public | permissive | `EXISTS ( SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.is_active = true )` |  |
| `tracking_events` | Users can view tracking for their orders | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `tracking_events` | System can insert tracking events | INSERT | public | permissive |  | `auth.role() = 'authenticated'` |
| `mfa_sessions` | Usuários podem ver suas próprias sessões MFA | SELECT | public | permissive | `auth.uid() = user_id` |  |
| `tracking_events` | Allow authenticated users to view tracking | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `map_settings_overrides` | Users can manage their own settings overrides | ALL | public | permissive | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `security_test_logs` | Admins can view security test logs | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `tracking_events_default` | Allow authenticated users to view tracking | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `tracking_events_y2026m05` | Allow authenticated users to view tracking | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `tracking_events_y2026m06` | Allow authenticated users to view tracking | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |
| `contract_version_usage` | admins read contract usage | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `contract_version_usage_monthly` | Admins can view monthly contract usage | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` |  |
| `user_roles` | Users can view own roles | SELECT | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `user_roles` | MFA admins can insert roles | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') AND public.is_aal2()` |
| `user_roles` | MFA admins can update roles | UPDATE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') AND public.is_aal2()` | `public.has_role(auth.uid(), 'admin') AND public.is_aal2()` |
| `user_roles` | MFA admins can delete roles | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin') AND public.is_aal2()` |  |
| `bitrix24_sync` | Authorized roles can view sync data | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `webhook_events` | Authorized roles can view webhook events | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'viewer')` |  |
| `user_passkeys` | Users can insert own passkeys | INSERT | authenticated | permissive |  | `auth.uid() = user_id` |
| `user_passkeys` | Users can update own passkeys | UPDATE | authenticated | permissive | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `user_passkeys` | Users can delete own passkeys | DELETE | authenticated | permissive | `auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')` |  |
| `permissions` | Authorized roles can view permissions | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `role_permissions` | Authorized roles can view role_permissions | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `feature_flags` | Feature flags are viewable by authenticated users | SELECT | authenticated | permissive | `true` |  |
| `alert_dedup` | Authorized roles can view alert dedup | SELECT | public | permissive | `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')` |  |
| `report_presets` | Users can manage their own report presets | ALL | public | permissive | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `region_cache` | Authenticated users can read region cache | SELECT | authenticated | permissive | `true` |  |
| `region_cache` | Authenticated users can insert region cache | INSERT | authenticated | permissive |  | `length(btrim(coord_key)) BETWEEN 1 AND 100 AND length(btrim(region)) BETWEEN 1 AND 200` |
| `lalamove_stop_proofs` | Admins managers can view stop_proofs | SELECT | authenticated | permissive | `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')` |  |
| `lalamove_stop_proofs` | Operators can view stop_proofs limited | SELECT | authenticated | permissive | `has_role(auth.uid(),'operator')` |  |
| `lalamove_stop_proofs` | Operators can insert stop_proofs | INSERT | authenticated | permissive |  | `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'operator')` |
| `lalamove_stop_proofs` | Managers can update stop_proofs | UPDATE | authenticated | permissive | `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')` |  |
| `lalamove_stop_proofs` | Admins can delete stop_proofs | DELETE | authenticated | permissive | `has_role(auth.uid(),'admin')` |  |
| `lalamove_order_replacements` | Admins managers can view order_replacements | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role)` |  |
| `lalamove_order_replacements` | Admins can delete order_replacements | DELETE | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` |  |
| `lalamove_rate_limits` | Admins and managers can view rate limits | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `lalamove_rate_limits` | System roles can insert rate limits | INSERT | authenticated | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |
| `lalamove_priority_fee_history` | Operational roles view priority fee history | SELECT | public | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator')` |  |
| `lalamove_priority_fee_history` | Admin/manager insert priority fee history | INSERT | public | permissive |  | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |
| `contacts` | Users manage their own contacts | ALL | public | permissive | `auth.uid() = owner_id` | `auth.uid() = owner_id` |
| `mcp_diagnostics_grants` | Admins manage diagnostics grants | ALL | authenticated | permissive | `public.has_role(auth.uid(), 'admin')` | `public.has_role(auth.uid(), 'admin')` |
| `user_roles` | Authenticated users can view roles | SELECT | authenticated | permissive | `true` |  |
| `user_roles` | Authenticated users can insert roles | INSERT | authenticated | permissive |  | `true` |
| `user_roles` | Authenticated users can update roles | UPDATE | authenticated | permissive | `true` |  |
| `user_roles` | Service role full access user_roles | ALL | service_role | permissive | `true` | `true` |
| `query_telemetry` | System can insert telemetry | INSERT | authenticated | permissive |  | `has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR public.can_run_db_diagnostics(auth.uid())` |
| `audit_log` | audit_log_select | SELECT | public | permissive | `auth.uid() IS NOT NULL` |  |
| `audit_log` | audit_log_insert | INSERT | public | permissive |  | `true` |
| `lalamove_webhook_config` | Admins manage webhook config | ALL | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` | `public.has_role(auth.uid(), 'admin'::app_role)` |
| `bitrix24_spa_sync` | Admin manager view spa sync | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)` |  |
| `job_queue` | Service role full access | ALL | service_role | permissive | `true` | `true` |
| `job_queue` | Admins view jobs | SELECT | authenticated | permissive | `public.has_role(auth.uid(), 'admin'::app_role)` |  |
| `geo_usage` | geo_usage_read_manager | SELECT | public | permissive | `public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')` |  |
| `order_geo_events` | order_geo_events_read | SELECT | public | permissive | `auth.role() = 'authenticated'` |  |

## C. Restrições de dados (obrigatório / único / default / CHECK / FK / calculada)

| Tabela | Coluna | Regra |
|---|---|---|
| `saved_filters` | `id` | PK; default gen_random_uuid() |
| `saved_filters` | `user_id` | FK → users.id ON DELETE CASCADE |
| `saved_filters` | `entity_type` | obrigatório |
| `saved_filters` | `name` | obrigatório |
| `saved_filters` | `filters` | obrigatório |
| `saved_filters` | `is_default` | default false |
| `saved_filters` | `created_at` | default NOW() |
| `saved_filters` | `updated_at` | default NOW() |
| `saved_filters` | `(tabela)` | CONSTRAINT unique_filter_name_per_user UNIQUE (user_id, entity_type, name) |
| `entity_versions` | `id` | PK; default gen_random_uuid() |
| `entity_versions` | `entity_type` | obrigatório |
| `entity_versions` | `entity_id` | obrigatório |
| `entity_versions` | `version_number` | obrigatório |
| `entity_versions` | `data` | default '{}'::jsonb |
| `entity_versions` | `changed_by` | FK → users.id |
| `entity_versions` | `changed_at` | default NOW() |
| `entity_versions` | `(tabela)` | CONSTRAINT unique_entity_version UNIQUE (entity_type, entity_id, version_number) |
| `cache_refresh_log` | `id` | PK; default gen_random_uuid() |
| `cache_refresh_log` | `view_name` | obrigatório |
| `cache_refresh_log` | `refresh_started_at` | default NOW() |
| `cache_refresh_log` | `status` | default 'running'; CHECK status IN ('running', 'success', 'failed') |
| `cache_refresh_log` | `triggered_by` | default 'system' |
| `cache_refresh_log` | `(tabela)` | CONSTRAINT unique_running_refresh UNIQUE (view_name, status) DEFERRABLE INITIALLY DEFERRED |
| `drivers` | `id` | PK; default gen_random_uuid() |
| `drivers` | `lalamove_id` | único |
| `drivers` | `name` | obrigatório |
| `drivers` | `vehicle_type` | default 'MOTORCYCLE' |
| `drivers` | `risk_score` | default 5.0; CHECK risk_score >= 0 AND risk_score <= 10 |
| `drivers` | `status` | default 'PENDING_APPROVAL' |
| `drivers` | `total_deliveries` | default 0 |
| `drivers` | `completed_deliveries` | default 0 |
| `drivers` | `rating` | default 5.0; CHECK rating >= 0 AND rating <= 5 |
| `drivers` | `created_at` | default now() |
| `drivers` | `updated_at` | default now() |
| `drivers` | `failed_deliveries` | default 0 |
| `lalamove_orders` | `id` | PK; default gen_random_uuid() |
| `lalamove_orders` | `lalamove_id` | obrigatório; único |
| `lalamove_orders` | `status` | default 'PENDING' |
| `lalamove_orders` | `pickup_address` | obrigatório |
| `lalamove_orders` | `delivery_address` | obrigatório |
| `lalamove_orders` | `customer_name` | obrigatório |
| `lalamove_orders` | `scheduled_at` | default now() |
| `lalamove_orders` | `driver_id` | FK → drivers.id ON DELETE SET NULL |
| `lalamove_orders` | `vehicle_type` | default 'MOTORCYCLE' |
| `lalamove_orders` | `total_cost` | default 0 |
| `lalamove_orders` | `currency` | default 'BRL' |
| `lalamove_orders` | `tags` | default '{}' |
| `lalamove_orders` | `metadata` | default '{}' |
| `lalamove_orders` | `created_at` | default now() |
| `lalamove_orders` | `updated_at` | default now() |
| `lalamove_orders` | `requires_address_review` | obrigatório |
| `lalamove_orders` | `(tabela)` | constraint lalamove_orders_total_cost_nonneg CHECK (total_cost >= 0), ADD CONSTRAINT lalamove_orders_distance_nonneg CHECK (distance_meters IS NULL OR distance_meters >= 0), ADD CONSTRAINT lalamove_orders_delay_nonneg CHECK (delay_minutes IS NULL OR delay_minutes >= 0), ADD CONSTRAINT lalamove_order … |
| `lalamove_orders` | `(tabela)` | constraint lalamove_orders_cancellation_reason_check CHECK ( cancellation_reason IS NULL OR cancellation_reason IN ( 'USER_REQUESTED', 'DRIVER_UNRESPONSIVE', 'DRIVER_LATE', 'DRIVER_ASKED_CHANGE', 'DRIVER_ASKED_CANCEL', 'DRIVER_RUDE', 'DRIVER_ASKED_FOR_MORE_MONEY', 'DELIVERY_ETA_TOO_LONG', 'PRICE_TOO … |
| `lalamove_stops` | `id` | PK; default gen_random_uuid() |
| `lalamove_stops` | `order_id` | obrigatório; FK → lalamove_orders.id ON DELETE CASCADE |
| `lalamove_stops` | `stop_index` | obrigatório |
| `lalamove_stops` | `address` | obrigatório |
| `lalamove_stops` | `created_at` | default now() |
| `lalamove_stops` | `pod_status` | default 'NOT_REQUIRED' |
| `lalamove_stops` | `(tabela)` | constraint lalamove_stops_stop_index_non_negative CHECK (stop_index >= 0), ADD CONSTRAINT lalamove_stops_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)), ADD CONSTRAINT lalamove_stops_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180) … |
| `lalamove_status_history` | `id` | PK; default gen_random_uuid() |
| `lalamove_status_history` | `order_id` | obrigatório; FK → lalamove_orders.id ON DELETE CASCADE |
| `lalamove_status_history` | `status` | obrigatório |
| `lalamove_status_history` | `metadata` | default '{}' |
| `lalamove_status_history` | `created_at` | default now() |
| `driver_incidents` | `id` | PK; default gen_random_uuid() |
| `driver_incidents` | `driver_id` | obrigatório; FK → drivers.id ON DELETE CASCADE |
| `driver_incidents` | `order_id` | FK → lalamove_orders.id ON DELETE SET NULL |
| `driver_incidents` | `type` | obrigatório |
| `driver_incidents` | `severity` | default 'LOW' |
| `driver_incidents` | `description` | obrigatório |
| `driver_incidents` | `metadata` | default '{}' |
| `driver_incidents` | `created_at` | default now() |
| `driver_incidents` | `(tabela)` | constraint driver_incidents_resolution_consistency CHECK ( (resolved IS NOT TRUE AND resolved_at IS NULL) OR (resolved IS TRUE) ) |
| `driver_approval_queue` | `id` | PK; default gen_random_uuid() |
| `driver_approval_queue` | `driver_id` | obrigatório; FK → drivers.id ON DELETE CASCADE |
| `driver_approval_queue` | `order_id` | obrigatório; FK → lalamove_orders.id ON DELETE CASCADE |
| `driver_approval_queue` | `status` | default 'PENDING' |
| `driver_approval_queue` | `risk_score` | obrigatório |
| `driver_approval_queue` | `risk_factors` | default '{}' |
| `driver_approval_queue` | `requested_at` | default now() |
| `driver_approval_queue` | `approval_priority` | default 'MEDIUM' |
| `driver_approval_queue` | `(tabela)` | constraint driver_approval_queue_risk_score_range CHECK (risk_score >= 0 AND risk_score <= 100), ADD CONSTRAINT driver_approval_queue_priority_non_negative CHECK (priority IS NULL OR priority >= 0) |
| `active_tracking` | `id` | PK; default gen_random_uuid() |
| `active_tracking` | `order_id` | obrigatório; único; FK → lalamove_orders.id ON DELETE CASCADE |
| `active_tracking` | `driver_id` | obrigatório; FK → drivers.id ON DELETE CASCADE |
| `active_tracking` | `current_latitude` | obrigatório |
| `active_tracking` | `current_longitude` | obrigatório |
| `active_tracking` | `heading` | default 0 |
| `active_tracking` | `speed` | default 0 |
| `active_tracking` | `is_on_route` | default true |
| `active_tracking` | `is_stopped` | default false |
| `active_tracking` | `last_updated` | default now() |
| `active_tracking` | `near_stop_cycles` | obrigatório |
| `active_tracking` | `next_stop_index` | obrigatório |
| `active_tracking` | `off_route_cycles` | obrigatório |
| `active_tracking` | `(tabela)` | constraint active_tracking_curlat_check CHECK (current_latitude >= -90 AND current_latitude <= 90), ADD CONSTRAINT active_tracking_curlon_check CHECK (current_longitude >= -180 AND current_longitude <= 180), ADD CONSTRAINT active_tracking_orglat_check CHECK (origin_lat IS NULL OR (origin_lat >= -90 … |
| `active_tracking` | `(tabela)` | constraint active_tracking_eta_non_negative CHECK (eta_minutes IS NULL OR eta_minutes >= 0) |
| `alerts` | `id` | PK; default gen_random_uuid() |
| `alerts` | `type` | obrigatório |
| `alerts` | `severity` | default 'INFO' |
| `alerts` | `title` | obrigatório |
| `alerts` | `message` | obrigatório |
| `alerts` | `order_id` | FK → lalamove_orders.id ON DELETE SET NULL |
| `alerts` | `driver_id` | FK → drivers.id ON DELETE SET NULL |
| `alerts` | `is_read` | default false |
| `alerts` | `is_dismissed` | default false |
| `alerts` | `metadata` | default '{}' |
| `alerts` | `created_at` | default now() |
| `alerts` | `escalation_level` | obrigatório |
| `alerts_sent` | `id` | PK; default gen_random_uuid() |
| `alerts_sent` | `alert_id` | obrigatório; FK → alerts.id ON DELETE CASCADE |
| `alerts_sent` | `channel` | obrigatório |
| `alerts_sent` | `recipient` | obrigatório |
| `alerts_sent` | `status` | default 'pending' |
| `alerts_sent` | `metadata` | default '{}' |
| `alerts_sent` | `created_at` | default now() |
| `alert_configurations` | `id` | PK; default gen_random_uuid() |
| `alert_configurations` | `alert_type` | obrigatório |
| `alert_configurations` | `channel` | obrigatório |
| `alert_configurations` | `is_enabled` | default true |
| `alert_configurations` | `recipients` | default '{}' |
| `alert_configurations` | `config` | default '{}' |
| `alert_configurations` | `created_at` | default now() |
| `alert_configurations` | `updated_at` | default now() |
| `alert_configurations` | `dedup_window_seconds` | default 300 |
| `alert_configurations` | `escalation_after_seconds` | obrigatório |
| `alert_configurations` | `escalation_enabled` | obrigatório |
| `alert_configurations` | `(tabela)` | UNIQUE(alert_type, channel) |
| `alert_configurations` | `(tabela)` | constraint alert_configurations_min_interval_non_negative CHECK (min_interval_seconds IS NULL OR min_interval_seconds >= 0) |
| `alert_configurations` | `(tabela)` | constraint alert_configurations_dedup_window_non_negative CHECK (dedup_window_seconds >= 0) |
| `alert_configurations` | `(tabela)` | constraint alert_configurations_escalation_after_positive CHECK (escalation_after_seconds > 0) |
| `alert_configurations` | `(tabela)` | constraint alert_configurations_fallback_channel_valid CHECK (fallback_channel IS NULL OR fallback_channel IN ('whatsapp','email','slack','sms','bitrix24','n8n')) |
| `webhook_events` | `id` | PK; default gen_random_uuid() |
| `webhook_events` | `event_type` | obrigatório |
| `webhook_events` | `raw_payload` | obrigatório |
| `webhook_events` | `processed` | default FALSE |
| `webhook_events` | `received_at` | default NOW() |
| `risk_rules` | `id` | PK; default gen_random_uuid() |
| `risk_rules` | `name` | obrigatório |
| `risk_rules` | `condition` | obrigatório |
| `risk_rules` | `score_impact` | obrigatório |
| `risk_rules` | `is_active` | default TRUE |
| `risk_rules` | `created_at` | default NOW() |
| `risk_rules` | `updated_at` | default NOW() |
| `driver_locations` | `id` | PK |
| `driver_locations` | `tracking_id` | obrigatório; FK → active_tracking.id ON DELETE CASCADE |
| `driver_locations` | `latitude` | obrigatório |
| `driver_locations` | `longitude` | obrigatório |
| `driver_locations` | `is_moving` | default TRUE |
| `driver_locations` | `recorded_at` | default NOW() |
| `driver_locations` | `(tabela)` | constraint driver_locations_latitude_check CHECK (latitude >= -90 AND latitude <= 90), ADD CONSTRAINT driver_locations_longitude_check CHECK (longitude >= -180 AND longitude <= 180), ADD CONSTRAINT driver_locations_speed_check CHECK (speed_kmh IS NULL OR speed_kmh >= 0), ADD CONSTRAINT driver_locati … |
| `bitrix24_sync` | `id` | PK; default gen_random_uuid() |
| `bitrix24_sync` | `order_id` | FK → lalamove_orders.id ON DELETE CASCADE |
| `bitrix24_sync` | `deal_id` | obrigatório |
| `bitrix24_sync` | `last_synced_at` | default now() |
| `bitrix24_sync` | `sync_status` | default 'pending' |
| `bitrix24_sync` | `created_at` | default now() |
| `bitrix24_sync` | `updated_at` | default now() |
| `bitrix24_sync` | `(tabela)` | constraint bitrix24_sync_order_id_key UNIQUE (order_id) |
| `bitrix24_activities` | `id` | PK; default gen_random_uuid() |
| `bitrix24_activities` | `order_id` | FK → lalamove_orders.id ON DELETE CASCADE |
| `bitrix24_activities` | `deal_id` | obrigatório |
| `bitrix24_activities` | `activity_id` | obrigatório |
| `bitrix24_activities` | `activity_type` | obrigatório |
| `bitrix24_activities` | `subject` | obrigatório |
| `bitrix24_activities` | `created_at` | default now() |
| `bitrix24_tokens` | `id` | PK; default gen_random_uuid() |
| `bitrix24_tokens` | `access_token` | obrigatório |
| `bitrix24_tokens` | `refresh_token` | obrigatório |
| `bitrix24_tokens` | `expires_at` | obrigatório |
| `bitrix24_tokens` | `domain` | obrigatório |
| `bitrix24_tokens` | `created_at` | default now() |
| `bitrix24_tokens` | `updated_at` | default now() |
| `bitrix24_stage_mappings` | `id` | PK; default gen_random_uuid() |
| `bitrix24_stage_mappings` | `lalamove_status` | obrigatório; único |
| `bitrix24_stage_mappings` | `bitrix_stage_id` | obrigatório |
| `bitrix24_stage_mappings` | `created_at` | default now() |
| `driver_evaluations` | `id` | PK; default gen_random_uuid() |
| `driver_evaluations` | `driver_id` | obrigatório; FK → drivers.id ON DELETE CASCADE |
| `driver_evaluations` | `order_id` | FK → lalamove_orders.id ON DELETE SET NULL |
| `driver_evaluations` | `triggered_by` | default 'SYSTEM' |
| `driver_evaluations` | `approved` | default false |
| `driver_evaluations` | `requires_manual` | default false |
| `driver_evaluations` | `auto_blocked` | default false |
| `driver_evaluations` | `risk_score` | default 0 |
| `driver_evaluations` | `risk_level` | default 'LOW' |
| `driver_evaluations` | `risk_factors` | default '[]'::jsonb |
| `driver_evaluations` | `risk_reasons` | default '{}'::text[] |
| `driver_evaluations` | `total_deliveries` | default 0 |
| `driver_evaluations` | `completed_deliveries` | default 0 |
| `driver_evaluations` | `failure_rate` | default 0 |
| `driver_evaluations` | `incident_count` | default 0 |
| `driver_evaluations` | `evaluated_at` | default now() |
| `driver_evaluations` | `created_at` | default now() |
| `driver_evaluations` | `(tabela)` | constraint driver_evaluations_risk_score_range CHECK (risk_score >= 0 AND risk_score <= 100), ADD CONSTRAINT driver_evaluations_failure_rate_range CHECK (failure_rate IS NULL OR (failure_rate >= 0 AND failure_rate <= 1)), ADD CONSTRAINT driver_evaluations_total_deliveries_non_negative CHECK (total_d … |
| `system_logs` | `id` | PK; default gen_random_uuid() |
| `system_logs` | `level` | obrigatório; CHECK level IN ('debug', 'info', 'warn', 'error', 'critical') |
| `system_logs` | `source` | obrigatório |
| `system_logs` | `message` | obrigatório |
| `system_logs` | `user_id` | FK → users.id |
| `system_logs` | `created_at` | default now() |
| `audit_log` | `id` | PK; default gen_random_uuid() |
| `audit_log` | `user_id` | FK → users.id ON DELETE SET NULL |
| `audit_log` | `action` | obrigatório |
| `audit_log` | `resource_type` | obrigatório |
| `audit_log` | `resource_id` | obrigatório |
| `audit_log` | `created_at` | default now() |
| `job_queue` | `id` | PK; default gen_random_uuid() |
| `job_queue` | `type` | obrigatório; CHECK type IN ('webhook','notification','evaluation','bitrix_sync','email','whatsapp','slack','lalamove_sync','pod_fetch') |
| `job_queue` | `payload` | obrigatório |
| `job_queue` | `status` | default 'PENDING'; CHECK status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED') |
| `job_queue` | `attempts` | default 0 |
| `job_queue` | `max_attempts` | default 3 |
| `job_queue` | `priority` | default 5; CHECK priority BETWEEN 1 AND 10 |
| `job_queue` | `metadata` | default '{}'::jsonb |
| `job_queue` | `created_at` | default now() |
| `job_queue` | `updated_at` | default now() |
| `job_queue` | `created_by` | FK → users.id |
| `job_queue` | `(tabela)` | constraint job_queue_status_check CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')) |
| `job_queue` | `(tabela)` | constraint job_queue_type_check CHECK (type IN ('webhook','notification','evaluation','bitrix_sync','email','whatsapp','slack','lalamove_sync','pod_fetch', 'geo_backfill','route_plan','eta_refresh')) |
| `job_queue_processing_log` | `id` | PK; default gen_random_uuid() |
| `job_queue_processing_log` | `run_at` | default NOW() |
| `job_queue_processing_log` | `processed` | obrigatório |
| `job_queue_processing_log` | `succeeded` | obrigatório |
| `job_queue_processing_log` | `failed` | obrigatório |
| `job_queue_processing_log` | `skipped` | obrigatório |
| `job_queue_processing_log` | `metadata` | default '{}'::jsonb |
| `user_roles` | `id` | PK; default gen_random_uuid() |
| `user_roles` | `user_id` | obrigatório |
| `user_roles` | `role` | default 'viewer' |
| `user_roles` | `assigned_at` | default now() |
| `user_roles` | `is_active` | default true |
| `user_roles` | `created_at` | default now() |
| `user_roles` | `updated_at` | default now() |
| `user_roles` | `(tabela)` | UNIQUE (user_id, role) |
| `permissions` | `id` | PK; default gen_random_uuid() |
| `permissions` | `name` | obrigatório; único |
| `permissions` | `module` | obrigatório |
| `permissions` | `action` | obrigatório |
| `permissions` | `created_at` | default now() |
| `role_permissions` | `id` | PK; default gen_random_uuid() |
| `role_permissions` | `role` | obrigatório |
| `role_permissions` | `permission_id` | FK → permissions.id ON DELETE CASCADE |
| `role_permissions` | `created_at` | default now() |
| `role_permissions` | `(tabela)` | UNIQUE (role, permission_id) |
| `rate_limit_logs` | `id` | PK; default gen_random_uuid() |
| `rate_limit_logs` | `ip_address` | obrigatório |
| `rate_limit_logs` | `endpoint` | obrigatório |
| `rate_limit_logs` | `request_count` | default 1 |
| `rate_limit_logs` | `window_start` | default now() |
| `rate_limit_logs` | `blocked` | default false |
| `rate_limit_logs` | `created_at` | default now() |
| `rate_limit_logs` | `(tabela)` | constraint rate_limit_logs_request_count_non_negative CHECK (request_count IS NULL OR request_count >= 0) |
| `blocked_ips` | `id` | PK; default gen_random_uuid() |
| `blocked_ips` | `ip_address` | obrigatório; único |
| `blocked_ips` | `reason` | obrigatório |
| `blocked_ips` | `blocked_at` | default now() |
| `blocked_ips` | `is_permanent` | default false |
| `blocked_ips` | `attempts_count` | default 0 |
| `blocked_ips` | `metadata` | default '{}'::jsonb |
| `blocked_ips` | `created_at` | default now() |
| `ip_whitelist` | `id` | PK; default gen_random_uuid() |
| `ip_whitelist` | `ip_address` | obrigatório |
| `ip_whitelist` | `description` | obrigatório |
| `ip_whitelist` | `is_active` | default true |
| `ip_whitelist` | `created_at` | default now() |
| `ip_whitelist` | `updated_at` | default now() |
| `mfa_sessions` | `id` | PK; default gen_random_uuid() |
| `mfa_sessions` | `user_id` | obrigatório; FK → users.id ON DELETE CASCADE |
| `mfa_sessions` | `aal_level` | obrigatório |
| `mfa_sessions` | `created_at` | default now() |
| `mfa_sessions` | `expires_at` | obrigatório |
| `auth_logs` | `id` | PK; default gen_random_uuid() |
| `auth_logs` | `event_type` | obrigatório |
| `auth_logs` | `success` | default true |
| `auth_logs` | `metadata` | default '{}'::jsonb |
| `auth_logs` | `created_at` | default now() |
| `password_reset_tokens` | `id` | PK; default gen_random_uuid() |
| `password_reset_tokens` | `user_id` | obrigatório |
| `password_reset_tokens` | `token_hash` | obrigatório; único |
| `password_reset_tokens` | `expires_at` | obrigatório |
| `password_reset_tokens` | `created_at` | default now() |
| `email_verifications` | `id` | PK; default gen_random_uuid() |
| `email_verifications` | `user_id` | obrigatório |
| `email_verifications` | `email` | obrigatório |
| `email_verifications` | `token_hash` | obrigatório; único |
| `email_verifications` | `expires_at` | obrigatório |
| `email_verifications` | `created_at` | default now() |
| `user_devices` | `id` | PK; default gen_random_uuid() |
| `user_devices` | `user_id` | obrigatório |
| `user_devices` | `device_fingerprint` | obrigatório |
| `user_devices` | `is_trusted` | default false |
| `user_devices` | `first_seen_at` | default now() |
| `user_devices` | `last_seen_at` | default now() |
| `user_devices` | `created_at` | default now() |
| `user_devices` | `(tabela)` | UNIQUE(user_id, device_fingerprint) |
| `new_device_alerts` | `id` | PK; default gen_random_uuid() |
| `new_device_alerts` | `user_id` | obrigatório |
| `new_device_alerts` | `device_id` | FK → user_devices.id ON DELETE CASCADE |
| … +285 linhas — lista completa em `context.json` | | |

## D. Automações no banco (triggers e funções — regras que rodam sozinhas)

| Trigger | Quando | Tabela | Executa | Condição |
|---|---|---|---|---|
| trigger_saved_filters_updated_at | BEFORE UPDATE | `saved_filters` | `update_saved_filters_updated_at` |  |
| trigger_single_default_filter | BEFORE INSERT OR UPDATE OF IS_DEFAULT | `saved_filters` | `ensure_single_default_filter` | `NEW.is_default = true` |
| update_saved_filters_updated_at | BEFORE UPDATE | `saved_filters` | `update_updated_at_column` |  |
| update_drivers_updated_at | BEFORE UPDATE | `drivers` | `update_updated_at_column` |  |
| update_orders_updated_at | BEFORE UPDATE | `lalamove_orders` | `update_updated_at_column` |  |
| update_alert_config_updated_at | BEFORE UPDATE | `alert_configurations` | `update_updated_at_column` |  |
| update_risk_rules_updated_at | BEFORE UPDATE | `risk_rules` | `update_updated_at_column` |  |
| update_bitrix24_sync_updated_at | BEFORE UPDATE | `bitrix24_sync` | `update_updated_at_column` |  |
| update_bitrix24_tokens_updated_at | BEFORE UPDATE | `bitrix24_tokens` | `update_updated_at_column` |  |
| on_order_status_change_sync_bitrix24 | AFTER UPDATE OF STATUS | `lalamove_orders` | `trigger_bitrix24_sync` |  |
| audit_drivers_trigger | AFTER UPDATE | `drivers` | `audit_driver_changes` |  |
| trigger_job_queue_updated_at | BEFORE UPDATE | `job_queue` | `update_job_queue_updated_at` |  |
| update_user_roles_updated_at | BEFORE UPDATE | `user_roles` | `update_updated_at_column` |  |
| update_ip_whitelist_updated_at | BEFORE UPDATE | `ip_whitelist` | `update_updated_at_column` |  |
| trg_set_token_expiration | BEFORE INSERT | `password_reset_tokens` | `set_token_expiration` |  |
| trg_invalidate_old_tokens | AFTER INSERT | `password_reset_tokens` | `invalidate_old_tokens` |  |
| sanitize_auth_log_metadata_trigger | BEFORE INSERT | `auth_logs` | `sanitize_auth_log_metadata` |  |
| update_feature_flags_updated_at | BEFORE UPDATE | `feature_flags` | `update_updated_at_column` |  |
| update_map_settings_overrides_updated_at | BEFORE UPDATE | `map_settings_overrides` | `update_updated_at_column` |  |
| update_contract_version_usage_monthly_updated_at | BEFORE UPDATE | `contract_version_usage_monthly` | `update_updated_at_column` |  |
| update_report_presets_updated_at | BEFORE UPDATE | `report_presets` | `update_updated_at_column` |  |
| update_region_cache_updated_at | BEFORE UPDATE | `region_cache` | `update_updated_at_column` |  |
| trg_stop_proofs_updated_at | BEFORE UPDATE | `lalamove_stop_proofs` | `update_updated_at_column` |  |
| trg_notify_lalamove_quota_low | AFTER INSERT | `lalamove_rate_limits` | `notify_lalamove_quota_low` |  |
| trg_contacts_updated_at | BEFORE UPDATE | `contacts` | `update_updated_at_column` |  |
| trg_notify_webhook_security_event | AFTER INSERT | `webhook_events` | `notify_webhook_security_event` |  |
| trg_mcp_diagnostics_grants_updated_at | BEFORE UPDATE | `mcp_diagnostics_grants` | `update_updated_at_column` |  |
| trigger_update_job_queue_updated_at | BEFORE UPDATE | `job_queue` | `update_job_queue_updated_at` |  |
| update_geo_settings_updated_at | BEFORE UPDATE | `geo_settings` | `update_updated_at_column` |  |
| update_geo_budget_updated_at | BEFORE UPDATE | `geo_budget` | `update_updated_at_column` |  |
| update_geo_defaults_updated_at | BEFORE UPDATE | `geo_defaults` | `update_updated_at_column` |  |
| trg_geo_settings_audit | AFTER INSERT OR UPDATE OR DELETE | `geo_settings` | `geo_audit_config` |  |
| trg_geo_budget_audit | AFTER INSERT OR UPDATE OR DELETE | `geo_budget` | `geo_audit_config` |  |
| trg_geo_defaults_audit | AFTER UPDATE | `geo_defaults` | `geo_audit_config` |  |

Erros lançados por funções SQL (`RAISE EXCEPTION` = regra de negócio no banco):

| Função | Mensagem | Origem |
|---|---|---|
| `get_cron_jobs_health` | Acesso negado: requer papel de administrador | `supabase/migrations/20260711194632_e6def1eb-1b3c-487f-978f-b0774a8201af.sql` |
| `get_contract_v1_sunset_readiness` | Acesso negado: requer papel de administrador | `supabase/migrations/20260712194831_1bd67c8e-482f-4a15-abfc-6f3986b33611.sql` |
| `acknowledge_alert` | Acesso negado | `supabase/migrations/20260712221144_f9eda2dc-4805-4cce-b99b-e3d2826ca6cb.sql` |
| `mcp_introspect` | Acesso negado: requer papel admin ou concessão de diagnóstico | `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql` |
| `mcp_introspect` | Schema não permitido: % | `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql` |
| `mcp_introspect` | Parâmetro "table" obrigatório | `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql` |
| `mcp_introspect` | Parâmetro "table" obrigatório | `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql` |
| `mcp_introspect` | Parâmetros "table" e "column" obrigatórios | `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql` |
| `mcp_introspect` | Operação não permitida: % | `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql` |

## E. Estados, máquinas de estado e transições

### E.1 Colunas de status no banco

| Tabela | Coluna | Valores permitidos (enum/CHECK) | Default |
|---|---|---|---|
| `cache_refresh_log` | `status` | `failed`, `running`, `success` | `running` |
| `drivers` | `status` | `APPROVED`, `PENDING_APPROVAL`, `BLOCKED`, `WHITELIST`, `BLACKLIST` | `PENDING_APPROVAL` |
| `lalamove_orders` | `status` | `PENDING`, `MATCHED`, `ON_GOING`, `PICKED_UP`, `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`, `QUOTED`, `ASSIGNING_DRIVER`, `DELIVERING` | `PENDING` |
| `lalamove_orders` | `internal_status` | **livre (sem enum/CHECK)** |  |
| `lalamove_orders` | `lalamove_status` | **livre (sem enum/CHECK)** |  |
| `lalamove_stops` | `pod_status` | **livre (sem enum/CHECK)** | `NOT_REQUIRED` |
| `lalamove_status_history` | `status` | `PENDING`, `MATCHED`, `ON_GOING`, `PICKED_UP`, `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`, `QUOTED`, `ASSIGNING_DRIVER`, `DELIVERING` |  |
| `lalamove_status_history` | `old_status` | **livre (sem enum/CHECK)** |  |
| `driver_approval_queue` | `status` | `PENDING`, `APPROVED`, `REJECTED` | `PENDING` |
| `active_tracking` | `tracking_status` | **livre (sem enum/CHECK)** |  |
| `alerts_sent` | `status` | **livre (sem enum/CHECK)** | `pending` |
| `bitrix24_sync` | `sync_status` | **livre (sem enum/CHECK)** | `pending` |
| `bitrix24_stage_mappings` | `lalamove_status` | **livre (sem enum/CHECK)** |  |
| `bitrix24_stage_mappings` | `bitrix_stage_name` | **livre (sem enum/CHECK)** |  |
| `job_queue` | `status` | `CANCELLED`, `COMPLETED`, `FAILED`, `PENDING`, `PROCESSING` | `PENDING` |
| `password_reset_requests` | `status` | `approved`, `pending`, `rejected` | `pending` |
| `lalamove_stop_proofs` | `pod_status` | `NOT_REQUIRED`, `delivered`, `failed`, `pending` |  |
| `lalamove_stop_proofs` | `pop_status` | `NOT_REQUIRED`, `failed`, `pending`, `picked_up` |  |
| `lalamove_stop_proofs` | `delivery_code_status` | **livre (sem enum/CHECK)** |  |
| `lalamove_rate_limits` | `status` | **livre (sem enum/CHECK)** |  |
| `bitrix24_spa_sync` | `last_stage` | **livre (sem enum/CHECK)** |  |
| `bitrix24_spa_sync` | `sync_status` | `error`, `pending`, `success` | `pending` |
| `order_geo_events` | `notification_status` | `cancelled`, `deferred`, `failed`, `no_recipient`, `queued`, `sent`, `skipped` | `queued` |
| `cache_status` | `status` | **livre (sem enum/CHECK)** |  |
| `driver_stats_cache` | `driver_status` | `APPROVED`, `PENDING_APPROVAL`, `BLOCKED`, `WHITELIST`, `BLACKLIST` |  |
| `drivers_safe_view` | `status` | `APPROVED`, `PENDING_APPROVAL`, `BLOCKED`, `WHITELIST`, `BLACKLIST` |  |
| `orders_operator_view` | `internal_status` | **livre (sem enum/CHECK)** |  |
| `orders_operator_view` | `status` | `PENDING`, `MATCHED`, `ON_GOING`, `PICKED_UP`, `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`, `QUOTED`, `ASSIGNING_DRIVER`, `DELIVERING` |  |
| `orders_safe_view` | `internal_status` | **livre (sem enum/CHECK)** |  |
| `orders_safe_view` | `status` | `PENDING`, `MATCHED`, `ON_GOING`, `PICKED_UP`, `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`, `QUOTED`, `ASSIGNING_DRIVER`, `DELIVERING` |  |

### E.2 Mapas de transição declarados no código

_nenhum mapa explícito encontrado — transições só existem implicitamente nos `if`s (veja E.3)_

### E.3 Valores de status usados no código (escreve / compara / filtra)

| Campo | Valor | Uso | Onde |
|---|---|---|---|
| `type` | `APPROVAL_REQUIRED` | escreve | `supabase/functions/evaluate-driver/index.ts` |
| `type` | `CAR` | compara | `src/components/map/MapLegend.tsx` |
| `type` | `CLEAR_CACHE` | compara, escreve | `public/sw.js`<br>`src/hooks/useServiceWorker.ts` |
| `type` | `Caminhão` | compara | `src/pages/reports/ReportDistributionTab.tsx` |
| `type` | `Carro` | compara | `src/pages/reports/ReportDistributionTab.tsx` |
| `type` | `DRIVER_BLOCKED` | escreve | `supabase/functions/evaluate-driver/index.ts` |
| `type` | `DRIVER_STOPPED` | escreve, filtra | `supabase/functions/check-driver-alerts/index.ts` |
| `type` | `Feature` | escreve | `src/components/map/LiveMap.tsx`<br>`src/components/map/OrderTrackingMap.tsx`<br>`src/components/map/hooks/useMapMarkers.ts`<br>`src/components/map/mapLayers.ts`<br>`src/components/reports/GeoHeatmap.tsx`<br>… +2 |
| `type` | `FeatureCollection` | escreve | `src/components/map/OrderTrackingMap.tsx`<br>`src/components/map/mapLayers.ts`<br>`src/components/reports/GeoHeatmap.tsx`<br>`src/hooks/useMapbox.ts`<br>`src/pages/HeatmapPage.tsx` |
| `type` | `GEO_BUDGET_WARNING` | escreve | `supabase/functions/geo-gateway/index.ts` |
| `type` | `GET_VERSION` | compara, escreve | `public/sw.js`<br>`src/hooks/useServiceWorker.ts` |
| `type` | `INTEGRATION_FAILURE` | escreve | `supabase/functions/lalamove-gateway/index.ts`<br>`supabase/functions/lalamove-token-refresh/index.ts`<br>`supabase/functions/rotate-tokens/index.ts` |
| `type` | `LineString` | escreve | `src/components/map/hooks/useMapMarkers.ts`<br>`src/components/map/mapLayers.ts`<br>`src/hooks/useMapbox.ts` |
| `type` | `MISSING_POD` | escreve, filtra | `supabase/functions/check-driver-alerts/index.ts` |
| `type` | `MOTORCYCLE` | compara | `src/components/map/MapLegend.tsx` |
| `type` | `Moto` | compara | `src/pages/reports/ReportDistributionTab.tsx` |
| `type` | `Point` | compara, escreve | `src/components/map/OrderTrackingMap.tsx`<br>`src/components/orders/AddressAutocomplete.tsx`<br>`src/components/reports/GeoHeatmap.tsx`<br>`src/hooks/useMapbox.ts`<br>`src/pages/HeatmapPage.tsx` |
| `type` | `Polygon` | escreve | `src/components/map/LiveMap.tsx`<br>`src/components/map/mapLayers.ts`<br>`src/hooks/useMapbox.ts` |
| `type` | `ROUTE_DEVIATION` | escreve, filtra | `supabase/functions/check-driver-alerts/index.ts` |
| `type` | `SKIP_WAITING` | compara, escreve | `public/sw.js`<br>`src/hooks/useServiceWorker.ts` |
| `type` | `SUPPLIER_DELAY_NOTICE` | escreve | `supabase/functions/check-driver-alerts/index.ts` |
| `type` | `TEST` | escreve | `supabase/functions/test-notification/index.ts` |
| `type` | `TRUCK` | compara | `src/components/map/MapLegend.tsx` |
| `type` | `VAN` | compara | `src/components/map/MapLegend.tsx` |
| `type` | `Van` | compara | `src/pages/reports/ReportDistributionTab.tsx` |
| `type` | `alert` | compara, escreve | `src/components/CommandPaletteEnhanced.tsx`<br>`src/components/ui/activity-timeline.tsx`<br>`src/hooks/useCommandPaletteSearch.ts`<br>`src/hooks/useGlobalSearch.ts`<br>`src/hooks/usePushNotifications.ts`<br>… +3 |
| `type` | `all` | compara | `src/components/ui/activity-timeline.tsx` |
| `type` | `approval` | compara, escreve | `src/components/CommandPaletteEnhanced.tsx`<br>`src/components/ui/activity-timeline.tsx`<br>`src/hooks/useCommandPaletteSearch.ts`<br>`src/hooks/useGlobalSearch.ts`<br>`src/hooks/usePushNotifications.ts`<br>… +1 |
| `type` | `approve` | escreve | `src/hooks/useOfflineStorage.ts` |
| `type` | `area_hotspot` | escreve | `src/hooks/usePredictiveAnalysis.ts` |
| `type` | `authentication` | escreve | `src/hooks/useWebAuthn.ts` |
| `type` | `beep` | escreve | `src/hooks/useSoundSettings.ts` |
| `type` | `bitrix_sync` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `block` | escreve | `src/components/drivers/BulkActions.tsx` |
| `type` | `blocked_ip` | compara, escreve | `src/hooks/useSecurityPushNotifications.ts` |
| `type` | `capacity_issue` | escreve | `src/hooks/usePredictiveAnalysis.ts` |
| `type` | `chime` | escreve | `src/hooks/useSoundSettings.ts` |
| `type` | `circle` | escreve | `src/components/map/OrderTrackingMap.tsx`<br>`src/components/reports/GeoHeatmap.tsx` |
| `type` | `delivery` | compara, escreve | `src/components/ui/activity-timeline.tsx`<br>`src/components/ui/timeline-item.tsx`<br>`src/pages/DashboardRedesigned.tsx` |
| `type` | `delivery_delay` | escreve | `src/hooks/usePredictiveAnalysis.ts` |
| `type` | `driver` | compara, escreve | `src/components/CommandPaletteEnhanced.tsx`<br>`src/hooks/useCommandPaletteSearch.ts`<br>`src/hooks/useGlobalSearch.ts`<br>`src/hooks/usePushNotifications.ts` |
| `type` | `driver_risk` | escreve | `src/hooks/usePredictiveAnalysis.ts` |
| `type` | `driver_stopped` | escreve | `src/hooks/usePredictiveAnalysis.ts` |
| `type` | `email` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `eta_refresh` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `evaluation` | compara, escreve | `src/hooks/useJobQueue.ts`<br>`supabase/functions/job-worker/index.ts` |
| `type` | `failed_login` | compara, escreve | `src/hooks/useSecurityPushNotifications.ts` |
| `type` | `fill` | escreve | `src/components/map/mapLayers.ts` |
| `type` | `geo_backfill` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `geojson` | escreve | `src/components/map/OrderTrackingMap.tsx`<br>`src/components/map/hooks/useMapMarkers.ts`<br>`src/components/map/mapLayers.ts`<br>`src/components/reports/GeoHeatmap.tsx`<br>`src/pages/HeatmapPage.tsx` |
| `type` | `heatmap` | escreve | `src/components/map/mapLayers.ts`<br>`src/components/reports/GeoHeatmap.tsx`<br>`src/pages/HeatmapPage.tsx` |
| `type` | `incident` | compara | `src/components/ui/activity-timeline.tsx` |
| `type` | `lalamove_sync` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `line` | escreve | `src/components/map/OrderTrackingMap.tsx`<br>`src/components/map/hooks/useMapMarkers.ts`<br>`src/components/map/mapLayers.ts` |
| `type` | `mfa_session` | escreve | `src/hooks/useSecurityPushNotifications.ts` |
| `type` | `neighborhood` | escreve | `src/hooks/useMapbox.ts` |
| `type` | `new_device` | compara, escreve | `src/hooks/useSecurityPushNotifications.ts` |
| `type` | `notification` | compara, escreve | `src/hooks/useSoundSettings.ts`<br>`supabase/functions/job-worker/index.ts` |
| `type` | `order` | compara, escreve | `src/components/CommandPaletteEnhanced.tsx`<br>`src/hooks/useCommandPaletteSearch.ts`<br>`src/hooks/useGlobalSearch.ts`<br>`src/hooks/usePushNotifications.ts`<br>`supabase/functions/lalamove-uapi/index.ts` |
| `type` | `page` | escreve | `src/hooks/useGlobalSearch.ts` |
| `type` | `ping` | escreve | `src/hooks/useSoundSettings.ts` |
| `type` | `place` | escreve | `src/hooks/useMapbox.ts` |
| `type` | `pod_fetch` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `postcode` | escreve | `src/hooks/useMapbox.ts` |
| `type` | `public-key` | escreve | `src/hooks/useWebAuthn.ts` |
| `type` | `raster` | escreve | `src/components/map/mapLayers.ts` |
| `type` | `region` | escreve | `src/hooks/useMapbox.ts` |
| `type` | `registration` | escreve | `src/hooks/useWebAuthn.ts` |
| `type` | `route_deviation` | escreve | `src/hooks/usePredictiveAnalysis.ts` |
| `type` | `route_plan` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `silent` | escreve | `src/hooks/useSoundSettings.ts` |
| `type` | `sla_breach` | escreve | `src/hooks/usePredictiveAnalysis.ts` |
| `type` | `slack` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `spring` | escreve | `src/components/layout/MobileBottomNav.tsx`<br>`src/components/layout/MobileSidebar.tsx`<br>`src/components/layout/Sidebar.tsx`<br>`src/components/ui/contextual-hints.tsx`<br>`src/components/ui/data-refresh-indicator.tsx`<br>… +21 |
| `type` | `symbol` | escreve | `src/components/reports/GeoHeatmap.tsx` |
| `type` | `sync_bitrix24` | compara, escreve | `src/hooks/useJobQueue.ts` |
| `type` | `test` | escreve | `src/hooks/usePushNotifications.ts` |
| `type` | `vector` | escreve | `src/components/map/mapLayers.ts` |
| `type` | `web-vitals` | escreve | `src/utils/webVitals.ts` |
| `type` | `webhook` | compara, escreve | `src/hooks/useJobQueue.ts`<br>`supabase/functions/job-worker/index.ts` |
| `type` | `whatsapp` | compara | `supabase/functions/job-worker/index.ts` |
| `type` | `whitelist` | escreve | `src/pages/DriversPage.tsx`<br>`src/pages/drivers/DriverCard.tsx` |
| `type` | `window` | escreve | `public/sw.js` |
| `step` | `creating` | compara | `src/components/orders/NewOrderDialog.tsx` |
| `step` | `done` | compara | `src/components/orders/NewOrderDialog.tsx` |
| `step` | `form` | compara | `src/components/orders/NewOrderDialog.tsx` |
| `step` | `quoted` | compara | `src/components/orders/NewOrderDialog.tsx` |
| `step` | `quoting` | compara | `src/components/orders/NewOrderDialog.tsx` |
| `step` | `scan` | compara | `src/components/auth/MFAEnroll.tsx` |
| `step` | `start` | compara | `src/components/auth/MFAEnroll.tsx` |
| `status` | `ALL` | compara | `src/hooks/useNotificationHistory.ts`<br>`src/hooks/useRecentOrders.ts`<br>`src/pages/DriversPage.tsx`<br>`src/pages/IncidentsPage.tsx`<br>`src/pages/OrdersPage.tsx` |
| `status` | `APPROVED` | compara, escreve, filtra | `src/components/drivers/DriverProfileModal.tsx`<br>`src/hooks/useApprovalActions.ts`<br>`src/hooks/useCommandPaletteSearch.ts`<br>`src/hooks/useDrivers.ts`<br>`src/hooks/useMetrics.ts`<br>… +6 |
| `status` | `ASSIGNING_DRIVER` | compara, escreve, filtra | `src/lib/lalamoveOrderEdit.ts`<br>`supabase/functions/lalamove-api/index.ts`<br>`supabase/functions/lalamove-webhook/index.ts` |
| `status` | `BLACKLIST` | compara, escreve | `src/components/drivers/DriverProfileModal.tsx`<br>`src/components/drivers/DriverProfileTabs.tsx`<br>`src/hooks/useApprovalActions.ts`<br>`src/hooks/useDrivers.ts`<br>`src/hooks/useMetrics.ts`<br>… +3 |
| `status` | `BLOCKED` | compara, escreve | `src/components/drivers/DriverProfileModal.tsx`<br>`src/hooks/useApprovalActions.ts`<br>`src/hooks/useCommandPaletteSearch.ts`<br>`src/hooks/useDrivers.ts`<br>`src/hooks/useMetrics.ts`<br>… +3 |
| `status` | `CANCELED` | escreve | `supabase/functions/lalamove-api/index.ts` |
| `status` | `CANCELLED` | compara | `src/hooks/useCommandPaletteSearch.ts`<br>`src/hooks/useDeliveryMetrics.ts`<br>`src/pages/reports/useReportData.ts`<br>`supabase/functions/evaluate-driver/index.ts` |
| `status` | `COMPLETED` | compara, escreve, filtra | `src/components/dashboard/OrdersTable.tsx`<br>`src/hooks/useAnalyticsData.ts`<br>`src/hooks/useCommandPaletteSearch.ts`<br>`src/hooks/useDashboardStats.ts`<br>`src/hooks/useDeliveryHeatmapData.ts`<br>… +8 |
| `status` | `DELETED` | compara | `supabase/migrations/20251226020000_create_materialized_views_cache.sql` |
| `status` | `DELIVERING` | compara | `src/lib/lalamoveOrderEdit.ts` |
| `status` | `DRIVER_CHANGED` | escreve | `supabase/functions/lalamove-api/index.ts` |
| `status` | `Disponível` | compara | `src/components/ui/hover-preview.tsx` |
| `status` | `Entregue` | compara | `src/components/ui/hover-preview.tsx` |
| `status` | `FAILED` | compara | `src/hooks/useJobQueue.ts`<br>`src/pages/JobQueuePage.tsx` |
| `status` | `MATCHED` | escreve | `supabase/functions/lalamove-webhook/index.ts` |
| `status` | `ON_GOING` | compara, escreve, filtra | `src/components/dashboard/OrdersTable.tsx`<br>`src/components/orders/OrderDetailModal.tsx`<br>`src/hooks/useDashboardStats.ts`<br>`src/hooks/usePredictiveAnalysis.ts`<br>`src/pages/orders/OrderCard.tsx`<br>… +3 |
| `status` | `OPEN` | compara | `src/pages/IncidentsPage.tsx` |
| `status` | `PENDING` | compara, escreve, filtra | `src/components/layout/MobileSidebar.tsx`<br>`src/components/layout/Sidebar.tsx`<br>`src/hooks/useAnalyticsData.ts`<br>`src/hooks/useApprovalActions.ts`<br>`src/hooks/useCommandPaletteSearch.ts`<br>… +9 |
| `status` | `PENDING_APPROVAL` | compara, escreve | `src/components/drivers/DriverProfileModal.tsx`<br>`src/hooks/useApprovalActions.ts`<br>`src/hooks/useDrivers.ts`<br>`src/hooks/useMetrics.ts`<br>`src/pages/DriversPage.tsx`<br>… +3 |
| `status` | `PICKED_UP` | compara, escreve | `src/components/dashboard/OrdersTable.tsx`<br>`src/lib/lalamoveOrderEdit.ts`<br>`supabase/functions/lalamove-webhook/index.ts` |
| `status` | `PROCESSING` | compara | `src/pages/JobQueuePage.tsx` |
| `status` | `REJECTED` | compara, escreve, filtra | `src/hooks/useApprovalActions.ts`<br>`src/hooks/useDeliveryMetrics.ts`<br>`src/hooks/useMetrics.ts`<br>`src/hooks/usePendingApprovals.ts`<br>`src/hooks/useRealtimeSubscriptions.ts` |
| `status` | `WHITELIST` | compara, escreve | `src/components/drivers/DriverProfileModal.tsx`<br>`src/hooks/useApprovalActions.ts`<br>`src/hooks/useDrivers.ts`<br>`src/hooks/useMetrics.ts`<br>`src/pages/DriversPage.tsx`<br>… +2 |
| `status` | `all` | compara, escreve | `src/hooks/useAdvancedReports.ts`<br>`src/pages/AdvancedReportsPage.tsx` |
| `status` | `approved` | compara, escreve | `src/hooks/usePasswordResetActions.ts`<br>`src/pages/PasswordResetApprovalsPage.tsx` |
| `status` | `at_risk` | compara | `src/pages/SLODashboardPage.tsx` |
| `status` | `breached` | compara | `src/pages/SLODashboardPage.tsx` |
| `status` | `completed` | compara | `src/components/ui/timeline-item.tsx` |
| `status` | `degraded` | compara, escreve | `src/hooks/healthChecks.ts`<br>`src/pages/SystemHealthExpandedPage.tsx`<br>`supabase/functions/check-external-api/index.ts` |
| `status` | `delivered` | compara | `src/hooks/useNotificationHistory.ts` |
| `status` | `down` | compara, escreve | `src/hooks/healthChecks.ts`<br>`src/pages/SystemHealthExpandedPage.tsx`<br>`supabase/functions/check-external-api/index.ts` |
| `status` | `failed` | compara | `src/components/ui/timeline-item.tsx`<br>`src/hooks/useCacheViews.ts`<br>`src/hooks/useNotificationHistory.ts`<br>`src/pages/CacheMonitoringPage.tsx`<br>`src/pages/CacheStatusPage.tsx` |
| `status` | `geocoded` | compara | `supabase/functions/job-worker/index.ts` |
| `status` | `healthy` | compara | `src/pages/SLODashboardPage.tsx` |
| `status` | `in_progress` | compara | `src/components/ui/timeline-item.tsx` |
| `status` | `invalid` | escreve | `supabase/functions/job-worker/index.ts` |
| `status` | `not_found` | compara | `supabase/functions/job-worker/index.ts` |
| `status` | `number` | compara | `src/lib/geo-gateway.ts` |
| `status` | `ok` | compara, escreve | `src/hooks/useGeoAdmin.ts`<br>`src/hooks/useSystemHealthExpanded.ts`<br>`src/pages/MapsSettingsPage.tsx`<br>`src/pages/SystemHealthExpandedPage.tsx`<br>`supabase/functions/check-external-api/index.ts` |
| `status` | `pending` | compara, filtra | `src/components/ui/timeline-item.tsx`<br>`src/hooks/useNotificationHistory.ts`<br>`src/hooks/usePasswordResetActions.ts`<br>`src/pages/PasswordResetApprovalsPage.tsx` |
| `status` | `planned` | escreve | `supabase/functions/job-worker/index.ts` |
| `status` | `refreshed` | escreve | `supabase/functions/job-worker/index.ts` |
| `status` | `rejected` | compara, escreve | `src/hooks/usePasswordResetActions.ts`<br>`src/pages/PasswordResetApprovalsPage.tsx` |
| `status` | `sent` | compara | `src/hooks/useNotificationHistory.ts` |
| `status` | `skipped` | escreve | `supabase/functions/job-worker/index.ts` |
| `status` | `stale` | compara | `src/pages/CacheMonitoringPage.tsx` |
| `status` | `string` | compara | `supabase/functions/lalamove-api/index.ts` |
| `status` | `success` | compara, escreve | `src/hooks/useCacheViews.ts`<br>`src/pages/CacheMonitoringPage.tsx`<br>`src/pages/CacheStatusPage.tsx` |
| `status` | `synced` | escreve | `src/components/ui/data-refresh-indicator.tsx` |
| `status` | `syncing` | compara, escreve | `src/components/ui/data-refresh-indicator.tsx`<br>`src/hooks/useOfflineStorage.ts` |
| `status` | `unknown` | compara, escreve | `src/hooks/healthChecks.ts`<br>`src/pages/MapsSettingsPage.tsx`<br>`supabase/functions/check-external-api/index.ts` |
| `status` | `verified` | compara, escreve | `src/components/auth/MFASettings.tsx`<br>`src/hooks/useMFA.ts` |
| `role` | `admin` | compara, filtra | `src/components/layout/sidebar-config.ts`<br>`src/pages/PermissionsPage.tsx`<br>`src/pages/ProfilePage.tsx`<br>`supabase/functions/lalamove-uapi/index.ts`<br>`supabase/functions/simulate-driver-movement/index.ts` |
| `role` | `assistant` | compara, escreve | `src/components/dashboard/AIRouteChatbot.tsx` |
| `role` | `manager` | compara | `src/components/layout/sidebar-config.ts`<br>`src/pages/PermissionsPage.tsx` |
| `role` | `operator` | compara | `src/components/layout/sidebar-config.ts`<br>`src/pages/PermissionsPage.tsx` |
| `role` | `option` | compara | `src/components/ui/accessible-card.tsx` |
| `role` | `service_role` | compara | `supabase/functions/send-notification/index.ts`<br>`supabase/functions/simulate-driver-movement/index.ts` |
| `role` | `supplier` | escreve | `supabase/functions/check-driver-alerts/index.ts`<br>`supabase/functions/lalamove-webhook/index.ts` |
| `role` | `system` | escreve | `supabase/functions/route-analyzer/index.ts` |
| `role` | `user` | compara, escreve | `src/components/dashboard/AIRouteChatbot.tsx`<br>`supabase/functions/route-analyzer/index.ts` |
| `role` | `viewer` | compara, escreve | `src/components/layout/sidebar-config.ts`<br>`src/pages/RolesPage.tsx` |
| `last_status` | `succeeded` | compara | `src/components/health/CronJobsHealthPanel.tsx` |
| `state` | `CLOSED` | escreve | `src/utils/circuitBreaker.ts` |
| `state` | `OPEN` | compara | `src/utils/circuitBreaker.ts` |
| `state` | `current` | compara | `src/components/orders/StatusTimeline.tsx` |
| `state` | `done` | compara | `src/components/orders/StatusTimeline.tsx` |
| `state` | `installed` | compara | `src/hooks/useServiceWorker.ts` |
| `state` | `suspended` | compara | `src/utils/alertSounds.ts` |
| `sync_status` | `error` | compara, escreve, filtra | `src/hooks/useJobQueue.ts`<br>`supabase/functions/bitrix24-process-queue/index.ts` |
| `sync_status` | `pending` | escreve, filtra | `src/hooks/healthChecks.ts`<br>`src/hooks/useBitrix24.ts`<br>`src/hooks/useJobQueue.ts`<br>`supabase/functions/bitrix24-process-queue/index.ts` |
| `sync_status` | `success` | compara | `src/pages/Bitrix24Page.tsx` |
| `sync_status` | `synced` | compara, filtra | `src/hooks/useJobQueue.ts` |
| `refresh_status` | `success` | escreve | `src/hooks/useCacheViews.ts` |
| `approval_status` | `PENDING` | escreve | `src/integrations/supabase/types.ts` |
| `tracking_status` | `ACTIVE` | filtra | `supabase/functions/job-worker/index.ts` |
| `pop_status` | `picked_up` | escreve | `supabase/functions/lalamove-webhook/index.ts` |
| `notification_status` | `queued` | filtra | `supabase/functions/send-notification/index.ts` |
| `pod_status` | `NOT_REQUIRED` | compara | `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql` |

### E.4 Enums e listas de valores

| Nome | Valores | Onde |
|---|---|---|
| order_status | `PENDING`, `MATCHED`, `ON_GOING`, `PICKED_UP`, `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`, `QUOTED`, `ASSIGNING_DRIVER`, `DELIVERING` | banco |
| vehicle_type | `MOTORCYCLE`, `CAR`, `VAN`, `TRUCK` | banco |
| driver_status | `APPROVED`, `PENDING_APPROVAL`, `BLOCKED`, `WHITELIST`, `BLACKLIST` | banco |
| incident_type | `ROUTE_DEVIATION`, `LONG_STOP`, `LATE_DELIVERY`, `CUSTOMER_COMPLAINT`, `DAMAGE`, `OTHER` | banco |
| incident_severity | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | banco |
| alert_type | `DRIVER_BLOCKED`, `ROUTE_DEVIATION`, `DRIVER_STOPPED`, `LATE_DELIVERY`, `APPROVAL_REQUIRED`, `ORDER_CANCELLED`, `INTEGRATION_FAILURE`, `DRIVER_APPROACHING_PICKUP`, `DRIVER_ARRIVED_PICKUP`, `DRIVER_APPROACHING_DELIVERY`, `DRIVER_ARRIVED_DELIVERY`, `ETA_DELAY`, `SUPPLIER_DELAY_NOTICE`, `MISSING_POD`, `GEO_BUDGET_WARNING`, `DRIVER_ASSIGNED` | banco |
| alert_severity | `INFO`, `WARNING`, `CRITICAL` | banco |
| approval_status | `PENDING`, `APPROVED`, `REJECTED` | banco |
| delivery_outcome | `SUCCESS`, `FAILED`, `DAMAGED`, `STOLEN`, `LATE`, `WRONG_ADDRESS`, `CUSTOMER_UNAVAILABLE` | banco |
| approval_priority | `LOW`, `MEDIUM`, `HIGH`, `URGENT`, `CRITICAL` | banco |
| app_role | `admin`, `manager`, `operator`, `viewer` | banco |
| RasterProvider | osm \| esri-sat | `src/components/map/mapLayers.ts` |
| MarkerDensity | comfortable \| compact | `src/components/map/markerFactories.ts` |
| VehicleFilter | ALL \| MOTORCYCLE \| CAR \| VAN \| TRUCK | `src/components/map/types.ts` |
| StatusFilter | ALL \| IN_TRANSIT \| STOPPED \| OFF_ROUTE | `src/components/map/types.ts` |
| EtaTrend | improving \| worsening \| stable | `src/components/map/hooks/useMapAlerts.ts` |
| HeatmapMetric | volume \| cost \| delay | `src/components/reports/GeoHeatmap.tsx` |
| HealthStatus | ok \| degraded \| down \| unknown | `src/hooks/healthChecks.ts` |
| AchievementId | first_approval \| speed_demon \| streak_5 \| streak_10 \| risk_master \| zero_alerts \| bulk_approver \| perfect_day \| early_bird \| night_owl | `src/hooks/useAchievementsSystem.tsx` |
| AchievementRarity | common \| uncommon \| rare \| epic \| legendary | `src/hooks/useAchievementsSystem.tsx` |
| GroupBy | none \| severity \| type \| time | `src/hooks/useAlertGrouping.ts` |
| SortBy | newest \| oldest \| severity | `src/hooks/useAlertGrouping.ts` |
| ViewMode | list \| compact | `src/hooks/useAlertGrouping.ts` |
| ExternalTable | companies \| customers \| suppliers \| carriers \| contacts | `src/hooks/useExternalData.ts` |
| FusePreset | strict \| balanced \| fuzzy | `src/hooks/useFuseSearch.ts` |
| GeoProviderName | mapbox \| google | `src/hooks/useGeoAdmin.ts` |
| GeoFunction | tiles \| autocomplete \| geocode \| reverse \| route \| matrix \| static \| snap \| validate \| isochrone \| optimization \| tilequery | `src/hooks/useGeoAdmin.ts` |
| FleetKind | favorites \| blocked | `src/hooks/useLalamoveUapi.ts` |
| TilesProvider | mapbox \| google \| off | `src/hooks/useMapProviderPolicy.ts` |
| MarkerDensity | comfortable \| compact | `src/hooks/useMapSettings.ts` |
| MapProvider | mapbox-dark \| mapbox-sat \| osm \| esri-sat \| google-roadmap \| google-hybrid \| google-3d | `src/hooks/useMapSettings.ts` |
| AppRole | admin \| manager \| operator \| viewer | `src/hooks/usePermissions.ts` |
| NotificationPermission | default \| granted \| denied | `src/hooks/usePushNotifications.ts` |
| AlertSeverity | CRITICAL \| WARNING \| INFO | `src/hooks/usePushNotifications.ts` |
| SLOWindow | 1h \| 24h \| 7d \| 30d | `src/hooks/useSLOMetrics.ts` |
| SLOStatus | healthy \| at_risk \| breached | `src/hooks/useSLOMetrics.ts` |
| ThemeMode | light \| dark \| auto \| scheduled | `src/hooks/useScheduledTheme.ts` |
| AlertPriority | CRITICAL \| URGENT \| HIGH \| MEDIUM \| LOW | `src/hooks/useSoundSettings.ts` |
| ToneType | beep \| chime \| alert \| notification \| ping \| silent | `src/hooks/useSoundSettings.ts` |
| ThemeMode | light \| dark \| auto | `src/hooks/useTheme.ts` |
| OrderOperation | edit \| cancel \| priorityFee \| changeDriver | `src/lib/lalamoveOrderEdit.ts` |
| CHANGE_DRIVER_REASONS | 'DRIVER_UNRESPONSIVE', 'DRIVER_LATE', 'DRIVER_ASKED_CHANGE', 'DRIVER_RUDE', 'DRIVER_ASKED_FOR_MORE_MONEY', | `src/lib/lalamoveReasons.ts` |
| CANCEL_ORDER_REASONS | 'USER_REQUESTED', 'INCORRECT_ORDER_DETAILS', 'WRONG_ADDRESS', 'MISTAKEN_ORDER', 'PRICE_TOO_HIGH', 'DELIVERY_ETA_TOO_LONG', 'DRIVER_UNRESPONSIVE', 'DRIVER_LATE', 'DRIVER_ASKED_CANCEL', 'DRIVER_ASKED_FOR_MORE_MONEY', 'NO_CAPACITY', 'OTHER', | `src/lib/lalamoveReasons.ts` |
| StageState | done \| current \| pending \| skipped \| aborted | `src/lib/lalamoveTimeline.ts` |
| OrderErrorField | senderPhone \| recipientPhone \| schedule \| address | `src/lib/orderErrors.ts` |
| StatusLevel | operational \| attention \| critical \| info | `src/lib/statusPalette.ts` |
| DriverStatus | ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE', SUSPENDED = 'SUSPENDED', BANNED = 'BANNED', // Compatibilidade com sistema atual APPROVED = 'APPROVED', PENDING_APPROVAL = 'PENDING_APPROVAL', BLOCKED = 'BLOCKED', WHITELIST = 'WHITELIST', BLACKLIST = 'BLACKLIST' | `src/types/driver.ts` |
| RiskLevel | LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', CRITICAL = 'CRITICAL' | `src/types/driver.ts` |
| DeliveryOutcome | SUCCESS = 'SUCCESS', FAILED = 'FAILED', DAMAGED = 'DAMAGED', STOLEN = 'STOLEN', LATE = 'LATE', WRONG_ADDRESS = 'WRONG_ADDRESS', CUSTOMER_UNAVAILABLE = 'CUSTOMER_UNAVAILABLE' | `src/types/driver.ts` |
| ApprovalPriority | LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', URGENT = 'URGENT', CRITICAL = 'CRITICAL' | `src/types/driver.ts` |
| IncidentType | DELAY = 'DELAY', DAMAGE = 'DAMAGE', THEFT = 'THEFT', RUDE_BEHAVIOR = 'RUDE_BEHAVIOR', WRONG_DELIVERY = 'WRONG_DELIVERY', NO_SHOW = 'NO_SHOW', UNSAFE_DRIVING = 'UNSAFE_DRIVING', // Compatibilidade com sistema atual ROUTE_DEVIATION = 'ROUTE_DEVIATION', LONG_STOP = 'LONG_STOP', LATE_DELIVERY = 'LATE_DE … | `src/types/driver.ts` |
| IncidentSeverity | LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', CRITICAL = 'CRITICAL' | `src/types/driver.ts` |
| OrderStatus | PENDING \| MATCHED \| ON_GOING \| PICKED_UP \| COMPLETED \| CANCELLED \| REJECTED \| EXPIRED \| QUOTED \| ASSIGNING_DRIVER \| DELIVERING | `src/types/index.ts` |
| VehicleType | MOTORCYCLE \| CAR \| VAN \| TRUCK | `src/types/index.ts` |
| DriverStatus | APPROVED \| PENDING_APPROVAL \| BLOCKED \| WHITELIST \| BLACKLIST | `src/types/index.ts` |
| IncidentType | ROUTE_DEVIATION \| LONG_STOP \| LATE_DELIVERY \| CUSTOMER_COMPLAINT \| DAMAGE \| OTHER | `src/types/index.ts` |
| ApprovalPriority | LOW \| MEDIUM \| HIGH \| URGENT \| CRITICAL | `src/types/index.ts` |
| AlertType | DRIVER_BLOCKED \| ROUTE_DEVIATION \| DRIVER_STOPPED \| LATE_DELIVERY \| APPROVAL_REQUIRED \| ORDER_CANCELLED \| INTEGRATION_FAILURE | `src/types/index.ts` |
| SERVICE_TYPES | 'LALAGO', 'LALAPRO', 'LALAGOFOUR', 'CAR', 'CARFOURH', 'HATCHBACK', 'HATCHFOURH', 'UV_FIORINO', 'UV_4H', 'VAN', 'VANFOURH', 'TRUCK330', 'TRUCK3_5T', 'TRUCK_6H', | `src/types/lalamove.ts` |
| CITY_CODES | 'BR AJU', 'BR BEL', 'BR BHZ', 'BR BSB', 'BR CWB', 'BR FLN', 'BR FOR', 'BR GYN', 'BR MAO', 'BR POA', 'BR RAO', 'BR REC', 'BR RIO', 'BR SAO', 'BR SLZ', 'BR SSA', | `src/types/lalamove.ts` |
| ORDER_STATUSES | 'ASSIGNING_DRIVER', 'ON_GOING', 'PICKED_UP', 'DELIVERING', 'COMPLETED', 'CANCELED', 'REJECTED', 'EXPIRED', | `src/types/lalamove.ts` |
| ITEM_CATEGORIES | 'FOOD_PRODUCTS_OR_GROCERY', 'CONSTRUCTION_MATERIALS_OR_PARTS', 'RETAIL_AND_WHOLESALE_', 'FURNITURE_OR_HOME_APPLIANCES', 'FRAGILE_ITEMS', | `src/types/lalamove.ts` |
| HANDLING_INSTRUCTIONS | 'FRAGILE_OR_HANDLE_WITH_CARE', 'DO_NOT_STACK', 'KEEP_UPRIGHT', 'KEEP_DRY', 'NO_BENDING', | `src/types/lalamove.ts` |
| UAPI_POD_STATUS | 'PENDING', 'SIGNED', 'DELIVERED', 'FAILED', 'NOT_APPLICABLE' | `src/types/lalamove.ts` |
| ContractVersion | v1 \| v2 | `supabase/functions/_shared/contract.ts` |
| ContractName | lalamove-webhook \| evaluate-driver \| send-notification \| new-device-alert \| route-analyzer \| check-external-api \| test-notification \| geo-gateway | `supabase/functions/_shared/schemas.ts` |
| ProviderName | google \| mapbox | `supabase/functions/geo-gateway/providers/types.ts` |
| GeoFunction | tiles \| autocomplete \| geocode \| reverse \| route \| matrix \| static \| snap \| validate \| isochrone \| optimization \| tilequery | `supabase/functions/geo-gateway/providers/types.ts` |
| GeoPrecision | exact \| high \| medium \| low \| unknown | `supabase/functions/geo-gateway/providers/types.ts` |
| CHANGE_DRIVER_REASONS | 'DRIVER_UNRESPONSIVE', 'DRIVER_LATE', 'DRIVER_ASKED_CHANGE', 'DRIVER_RUDE', 'DRIVER_ASKED_FOR_MORE_MONEY', | `supabase/functions/lalamove-api/index.ts` |
| GatewayTarget | unified \| uapi | `supabase/functions/lalamove-gateway/route.ts` |

## F. Validações de entrada

### F.1 Schemas Zod

- **loginSchema** (`src/pages/AuthPage.tsx`, z.object):
  ```ts
  { email: z.string().email('Email inválido'), password: z.string().min(1, 'Senha é obrigatória'), }
  ```
- **signupSchema** (`src/pages/AuthPage.tsx`, z.object):
  ```ts
  { email: z.string().email('Email inválido'), password: z.string() .min(8, 'A senha deve ter pelo menos 8 caracteres') .regex(/[^A-Za-z0-9]/, 'A senha deve ter pelo menos um caractere especial'), }
  ```
- **emailSchema** (`src/pages/ForgotPasswordPage.tsx`, z.string):
  ```ts
  
  ```
- **ipSchema** (`src/pages/IPWhitelistPage.tsx`, z.object):
  ```ts
  { ip_address: z.string().min(7).max(45).regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Formato de IP inválido'), description: z.string().min(1, 'Descrição obrigatória').max(255), cidr_range: z.string().optional(), }
  ```
- **passwordSchema** (`src/pages/ResetPasswordPage.tsx`, z.string):
  ```ts
  
  ```
- **lalamoveWebhookV1** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { event: z.string().min(1, "event é obrigatório"), orderId: z.string().optional().nullable(), timestamp: z.string().optional().nullable(), data: z.unknown().optional(), }
  ```
- **evaluateDriverV1** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { driverId: z.string().min(1, "driverId é obrigatório"), orderId: z.string().uuid().optional().nullable(), triggeredBy: z.enum(["WEBHOOK", "MANUAL", "SYSTEM"]).default("WEBHOOK"), driverName: z.string().optional().nullable(), totalDeliveries: z.number().nonnegative().optional().nullable(), completedDeliveries: z.number().nonnegative().optional().nullable(), failedDeliveries: z.number().nonnegative().optional().nullable(), cancelledDeliveries: z.number().nonnegative().optional().nullable(), avgDelayMinutes: z.number().optional().nullable(), rating: z.number().min(0).max(5).optional().nullable(), }
  ```
- **sendNotificationV1** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { alert_id: z.string().min(1, "alert_id é obrigatório"), type: z.string().min(1, "type é obrigatório"), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), title: z.string().min(1, "title é obrigatório"), message: z.string().min(1, "message é obrigatório"), order_id: z.string().optional().nullable(), driver_id: z.string().optional().nullable(), metadata: z.record(z.unknown()).optional().nullable(), // Deduplication & escalation controls (multi-channel alerting) dedup_key: z.string().optional().nullable(), skip_dedup: z.boolean().optional().nullable(), is_escalation: z.boolean().optional().nullable(), }
  ```
- **newDeviceAlertV1** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { userId: z.string().min(1, "userId é obrigatório"), userEmail: z.string().email("userEmail inválido"), deviceFingerprint: z.string().min(1, "deviceFingerprint é obrigatório"), ipAddress: z.string().min(1, "ipAddress é obrigatório"), userAgent: z.string().min(1, "userAgent é obrigatório"), browser: z.string().optional().nullable(), os: z.string().optional().nullable(), locationCity: z.string().optional().nullable(), locationCountry: z.string().optional().nullable(), }
  ```
- **routeAnalyzerV1** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { action: z.enum([ "analyze-routes", "analyze-order", "analyze-drivers", "analyze-alerts", ]), message: z.string().optional(), orderId: z.string().uuid().optional(), }
  ```
- **checkExternalApiV1** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { service: z.string().min(1, "service é obrigatório"), }
  ```
- **testNotificationV1** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { channel: z.enum(["whatsapp", "email", "slack", "bitrix24", "n8n"]), alertType: z.string().min(1, "alertType é obrigatório"), recipients: z.array(z.string()).optional(), webhookUrl: z.string().url().optional(), }
  ```
- **geoPoint** (`supabase/functions/_shared/schemas.ts`, z.object):
  ```ts
  { lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), }
  ```
- **geoProvider** (`supabase/functions/_shared/schemas.ts`, z.enum, encadeia optional):
  ```ts
  ["google", "mapbox"]
  ```
- **geoGatewayV1** (`supabase/functions/_shared/schemas.ts`, z.discriminatedUnion):
  ```ts
  "action", [ z.object({ action: z.literal("provider-status"), provider: geoProvider }), z.object({ action: z.literal("count-map-load"), provider: z.enum(["google", "mapbox"]) }), z.object({ action: z.literal("autocomplete"), input: z.string().min(1).max(256), session_token: z.string().min(8).max(64).optional(), bias: geoBias, country: z.string().length(2).optional(), language: z.string().min(2).max(5).optional(), limit: z.number().int().min(1).max(10).optional(), provider: geoProvider, }), z.object({ action: z.literal("place-details"), // Os `mapbox_id` do Search Box/Geocoding v6 são base64url opacos e variam com o // tamanho do endereço: 70 chars em SP (rodovia/POI) e até 574 em Curitiba/Goiânia // (endereço completo com distrito e CEP), medido em produção em 2026-11-22. Com // max(200) o …
  ```

### F.2 react-hook-form (register/rules)

_nenhum item encontrado_

### F.3 Restrições em inputs HTML (required/min/max/pattern)

| Campo | Restrições | Arquivo |
|---|---|---|
| `login-email` | type=email | `src/pages/AuthPage.tsx` |
| `signup-email` | type=email | `src/pages/AuthPage.tsx` |
| `edit-phone` | disabled, readOnly | `src/pages/ContactsPage.tsx` |
| `email` | type=email | `src/pages/ForgotPasswordPage.tsx` |
| `score_impact` | type=number | `src/pages/RiskRulesPage.dialogs.tsx` |

## G. Fórmulas e derivações (como valores são calculados)

### G.1 Colunas calculadas no banco

_nenhum item encontrado_

### G.2 Views (consultas derivadas)

| View | SELECT |
|---|---|
| `job_queue_stats` | `SELECT type, status, COUNT(*) as count, AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))) as avg_duration_seconds, MAX(created_at) as last_created_at FROM job_queue WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY type, status` |
| `cache_status` | `SELECT view_name, row_count, last_refresh, refresh_duration_ms, (last_refresh IS NULL OR last_refresh < NOW() - INTERVAL '1 hour') AS is_stale, CASE WHEN last_refresh IS NULL THEN 'never_refreshed' WHEN last_refresh < NOW() - INTERVAL '1 hour' THEN 'stale' ELSE 'success' END AS status FROM ( SELECT …` |
| `cron_job_run_history` | `SELECT jr.jobid, j.jobname, jr.runid, jr.job_pid, jr.database, jr.username, jr.command, jr.status, jr.return_message, jr.start_time, jr.end_time, EXTRACT(EPOCH FROM (jr.end_time - jr.start_time)) as duration_seconds FROM cron.job_run_details jr LEFT JOIN cron.job j ON j.jobid = jr.jobid ORDER BY jr. …` |
| `driver_stats_cache` | `SELECT d.id as driver_id, d.name, d.lalamove_driver_id, d.phone, d.vehicle_plate, d.vehicle_type, d.status, d.risk_score, d.risk_level, d.is_whitelist, d.is_blacklist, COUNT(DISTINCT lo.id) as total_deliveries, COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'DELIVERED') as successful_deliveries, CO …` |
| `delivery_hourly_stats_cache` | `SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*) as total_orders, COUNT(*) FILTER (WHERE status = 'DELIVERED') as delivered_count, COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count, COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count, COALESCE(AVG(delay_minutes), 0) as avg …` |
| `risk_level_distribution_cache` | `SELECT risk_level, COUNT(*) as driver_count, ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as percentage, COALESCE(AVG(risk_score), 0) as avg_risk_score, MIN(risk_score) as min_risk_score, MAX(risk_score) as max_risk_score, NOW() as cached_at FROM drivers WHERE status != 'DELETED' GROUP …` |
| `orders_operator_view` | `SELECT id, lalamove_id, status, pickup_address, delivery_address, CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) THEN customer_phone ELSE '***RESTRITO***'::text END AS customer_phone, customer_name, vehicle_type, total_cost, currency, scheduled_at, e …` |
| `drivers_safe_view` | `SELECT id, name, vehicle_type, status, rating, risk_score, risk_level, total_deliveries, completed_deliveries, failed_deliveries, cancelled_deliveries, success_rate, failure_rate, avg_delay_minutes, lalamove_id, vehicle_plate, photo_url, blacklisted, blacklist_reason, whitelisted, notes, last_active …` |
| `orders_safe_view` | `SELECT id, lalamove_id, status, vehicle_type, customer_name, CASE WHEN (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) THEN customer_phone ELSE '***RESTRITO***'::text END AS customer_phone, pickup_address, delivery_address, total_cost, currency, scheduled_at, e …` |
| `geo_usage_month` | `SELECT provider, function, sku, SUM(count) AS count, SUM(est_cost_usd) AS est_cost_usd FROM public.geo_usage WHERE day >= date_trunc('month', CURRENT_DATE)::date GROUP BY provider, function, sku` |

### G.3 Funções de cálculo/decisão no código

- **shouldBypassRequest(request, url)** — `public/sw.js`
  ```
  if (request.method !== 'GET') return true; return ( url.pathname === '/auth' || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/~oauth') || url.pathname.startsWith('/api/auth') || url.pathname.includes('/auth/v1/') || url.searchParams.has('__lovable_token') || request.headers.has('authorization') );
  ```
- **calculatePasswordStrength(password: string)** — `src/components/auth/PasswordStrengthIndicator.tsx`
  ```
  let strength = 0; if (password.length >= 8) strength += 25; if (password.length >= 12) strength += 10; if (/[A-Z]/.test(password)) strength += 20; if (/[a-z]/.test(password)) strength += 15; if (/[0-9]/.test(password)) strength += 15; if (/[^A-Za-z0-9]/.test(password)) strength += 15; return Math.min(strength, 100);
  ```
- **generateSparklineData(currentValue: number, variance: number = 0.2, points: number = 12)** — `src/components/dashboard/DashboardHeroSection.tsx`
  ```
  const data: number[] = []; let value = currentValue * (1 - variance); for (let i = 0; i < points - 1; i++) { const change = (Math.random() - 0.5) * currentValue * variance * 0.5; value = Math.max(0, value + change); data.push(Math.round(value)); } data.push(currentValue); return data;
  ```
- **calculateTrend(data: number[])** — `src/components/dashboard/DashboardHeroSection.tsx`
  ```
  direction: 'up' | 'down' | 'neutral'; percentage: number
  ```
- **formatCurrency(value: number, currency: string)** — `src/components/dashboard/OrdersTable.tsx`
  ```
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  ```
- **generatePDF()** — `src/components/debug/AuditReportGenerator.tsx`
  ```
  { setIsGenerating(true); try { // Logic to generate PDF from markdown or current view logger.log("Generating PDF from audit_report.md..."); // In this environment, we can't easily generate a real PDF and save it back to the filesystem // but we could use a library if it were installed. alert("PDF generation triggered. In a CI environment, this would use a tool like 'md-to-pdf'."); } finally { setIs
  ```
- **generatePerformanceData(base: number)** — `src/components/drivers/DriverProfileModal.tsx`
  ```
  
  ```
- **apply()** — `src/components/map/LiveMap.tsx`
  ```
  if (map.current) applyRasterOverlay(map.current, rasterProvider);
  ```
- **apply()** — `src/components/map/LiveMap.tsx`
  ```
  if (map.current) setExpectedRoute(map.current, points);
  ```
- **apply()** — `src/components/map/LiveMap.tsx`
  ```
  if (map.current) setDriverTrail(map.current, trail);
  ```
- **valid(lat?: number | null, lng?: number | null)** — `src/components/map/OrderTrackingMap.tsx`
  ```
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
  ```
- **apply()** — `src/components/map/OrderTrackingMap.tsx`
  ```
  const m = map.current; if (!m || !ready.current) return; const set = (id: string, data: GeoJSON.FeatureCollection) => { const src = m.getSource(id) as mapboxgl.GeoJSONSource | undefined; src?.setData(data); }; set('pickup-point', valid(pickup?.lat, pickup?.lng) ? pointFeature(pickup!.lng!, pickup!.lat!, '#22c55e') : EMPTY); set('delivery-point', valid(delivery?.lat, delivery?.lng) ? pointFeature(delivery!.lng!, delivery!.lat!, '#f97316') : EMPTY); set('driver-point', driver && valid(driver.lat, …
  ```
- **applyRasterOverlay(map: mapboxgl.Map, provider: RasterProvider)** — `src/components/map/mapLayers.ts`
  ```
  // Remove existing overlay first (idempotente) if (map.getLayer(RASTER_LAYER_ID)) map.removeLayer(RASTER_LAYER_ID); if (map.getSource(RASTER_SOURCE_ID)) map.removeSource(RASTER_SOURCE_ID); if (!provider) return; const config = RASTER_TILES[provider]; map.addSource(RASTER_SOURCE_ID, { type: 'raster', tiles: config.tiles, tileSize: 256, maxzoom: config.maxzoom, attribution: config.attribution, }); // Insere acima do basemap mas abaixo dos overlays personalizados quando existirem. const beforeId = …
  ```
- **applyContact(which: 'sender' | 'recipient', contact: Contact)** — `src/components/orders/NewOrderDialog.tsx`
  ```
  // Reaproveita telefone já validado (E.164) mascarado para o input BR. const localDigits = contact.phone_e164.replace(/^\+55/, ''); const maskedPhone = maskBrazilianPhone(localDigits); if (which === 'sender') { setForm(prev => ({ ...prev, senderName: contact.name, senderPhone: maskedPhone, ...(contact.address ? { pickupAddress: contact.address } : {}), })); } else { setForm(prev => ({ ...prev, recipientName: contact.name, recipientPhone: maskedPhone, ...(contact.address ? { deliveryAddress: cont …
  ```
- **scheduleValidation(()** — `src/components/orders/NewOrderDialog.tsx`
  ```
  if (!form.scheduleAt) return { valid: true as const, iso: '' as string, error: '' }; const dt = new Date(form.scheduleAt); if (Number.isNaN(dt.getTime())) return { valid: false as const, iso: '', error: 'Data/hora inválida' }; // eslint-disable-next-line react-hooks/purity const diffMin = (dt.getTime() - Date.now()) / 60000; if (diffMin < 30) return { valid: false as const, iso: '', error: 'Agendamento mínimo: 30 minutos à frente' }; if (diffMin > 30 * 24 * 60) return { valid: false as const, is …
  ```
- **formatCurrency(value: number, currency: string)** — `src/components/orders/OrderDetailModal.tsx`
  ```
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  ```
- **round(n: number, d = 0)** — `src/hooks/useAdvancedReports.ts`
  ```
  const f = 10 ** d; return Math.round(n * f) / f;
  ```
- **calcChange(curr: number, prev: number)** — `src/hooks/useAnalyticsData.ts`
  ```
  prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
  ```
- **invalidateAll()** — `src/hooks/useApprovalActions.ts`
  ```
  queryClient.invalidateQueries({ queryKey: ['pending-approvals'] }); queryClient.invalidateQueries({ queryKey: ['approval-history'] }); queryClient.invalidateQueries({ queryKey: ['approval-stats'] }); queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }); queryClient.invalidateQueries({ queryKey: ['drivers'] });
  ```
- **formatCurrency(value: number)** — `src/hooks/useCachedStats.ts`
  ```
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', }).format(value);
  ```
- **round1(n: number)** — `src/hooks/useContractVersionUsage.ts`
  ```
  return Math.round(n * 10) / 10;
  ```
- **generateFingerprint()** — `src/hooks/useDeviceDetection.ts`
  ```
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (ctx) { ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillText('fingerprint', 2, 2); } const components = [ navigator.userAgent, navigator.language, screen.width + 'x' + screen.height, screen.colorDepth, new Date().getTimezoneOffset(), navigator.hardwareConcurrency || 'unknown', canvas.toDataURL(), ]; // Simple hash function const str = components.join('|'); let hash = 0; for (let i = 0; i < str.len …
  ```
- **calculateRiskLevel(score: number)** — `src/hooks/useDriverEvaluations.ts`
  ```
  if (score >= 8) return RiskLevel.CRITICAL; if (score >= 6) return RiskLevel.HIGH; if (score >= 4) return RiskLevel.MEDIUM; return RiskLevel.LOW;
  ```
- **recalculateDriverRiskScore(driverId: string)** — `src/hooks/useIncidents.ts`
  ```
  // Get unresolved incidents const { data: incidents, error: incError } = await supabase .from('driver_incidents') .select('severity') .eq('driver_id', driverId) .eq('resolved', false); if (incError) { logger.error('Error fetching incidents for recalc:', incError); return; } // Calculate score impact based on severity const severityScores: Record<IncidentSeverity, number> = { LOW: 0.5, MEDIUM: 1, HIGH: 2, CRITICAL: 3, }; let incidentImpact = 0; for (const inc of (incidents || [])) { incidentImpac …
  ```
- **canAccess(module: string, action: string)** — `src/hooks/usePermissions.ts`
  ```
  if (!userPermissions) return false; return userPermissions.some(p => p.module === module && p.action === action);
  ```
- **generatePredictions(data: AnalysisData)** — `src/hooks/usePredictiveAnalysis.ts`
  ```
  const alerts: PredictiveAlert[] = []; if (data.driversAtRisk > 3) { alerts.push({ id: "pred-driver-risk", type: "driver_risk", title: "Alto Risco de Problemas com Motoristas", description: `${data.driversAtRisk} motoristas estão em categorias de risco elevado.`, probability: Math.min(65 + data.driversAtRisk * 5, 95), impact: data.driversAtRisk > 10 ? "critical" : "high", timeframe: "Próximas 24h", recommendation: "Revise os motoristas de alto risco e considere suspensões preventivas.", affectedE …
  ```
- **shouldDisableAppServiceWorker()** — `src/hooks/useServiceWorker.ts`
  ```
  if (!('serviceWorker' in navigator)) return true; if (!import.meta.env.PROD) return true; const { hostname, search } = window.location; const isEmbeddedPreview = window.self !== window.top; return ( search.includes('__lovable_[REDACTED]sw=off') || isEmbeddedPreview || hostname.startsWith('id-preview--') || hostname.startsWith('preview--') || hostname === 'lovableproject.com' || hostname.endsWith('.lovableproject.com') || hostname === 'lovableproject-dev.com' || hostname.endsWi …
  ```
- **generateChallenge()** — `src/hooks/useWebAuthn.ts`
  ```
  const array = new Uint8Array(32); crypto.getRandomValues(array); return bufferToBase64URL(array.buffer);
  ```
- **validateCep(raw: string)** — `src/lib/cep.ts`
  ```
  const digits = sanitizeCep(raw); const masked = maskCep(digits); if (digits.length === 0) { return { valid: false, digits, masked, error: 'CEP obrigatório' }; } if (!CEP_DIGITS.test(digits)) { return { valid: false, digits, masked, error: 'CEP deve conter 8 dígitos' }; } if (SEQUENTIAL_CEP.test(digits)) { return { valid: false, digits, masked, error: 'CEP inválido' }; } return { valid: true, digits, masked, error: '' };
  ```
- **validateSpecialRequest(code: string, serviceType: LalamoveServiceType, city?: LalamoveCityCode,)** — `src/lib/lalamoveCatalog.ts`
  ```
  if (!SPECIAL_REQUESTS_BY_SERVICE[serviceType].includes(code)) { return `"${code}" não é aceito pelo serviço ${serviceType}.`; } const cities = SPECIAL_REQUEST_CITY_RESTRICTIONS[code]; if (city && cities && !cities.includes(city)) { return `"${code}" está disponível apenas em ${cities.join(', ')}.`; } return null;
  ```
- **filterValidSpecialRequests(specialRequests: readonly string[], serviceType: LalamoveServiceType, city: LalamoveCityCode,)** — `src/lib/lalamoveCatalog.ts`
  ```
  return specialRequests.filter(code => validateSpecialRequest(code, serviceType, city) === null);
  ```
- **validateItemWeight(serviceType: LalamoveServiceType, weight: string)** — `src/lib/lalamoveCatalog.ts`
  ```
  const ranges = ITEM_WEIGHT_RANGES[serviceType]; if (!ranges) return `O serviço ${serviceType} ignora a especificação de item.`; return ranges.includes(weight) ? null : `Peso "${weight}" inválido para ${serviceType}. Use: ${ranges.join(', ')}.`;
  ```
- **shouldApplyStatusTransition(current: string, incoming: string)** — `src/lib/lalamoveGuards.ts`
  ```
  if (current === incoming) return false; if (isTerminalStatus(current)) return false; const currentRank = ORDER_STATUS_RANK[current as LalamoveOrderStatus]; const incomingRank = ORDER_STATUS_RANK[incoming as LalamoveOrderStatus]; if (currentRank === undefined || incomingRank === undefined) return true; return incomingRank > currentRank;
  ```
- **validatePriorityFee(raw: string, currentFee = 0)** — `src/lib/lalamoveOrderEdit.ts`
  ```
  const normalized = raw.replace(',', '.').trim(); const amount = Number.parseFloat(normalized); if (!normalized || !Number.isFinite(amount)) { return { valid: false, amount: null, error: 'Informe um valor numérico para o bônus.' }; } if (amount <= 0) { return { valid: false, amount: null, error: 'O bônus deve ser maior que zero.' }; } if (amount <= currentFee) { return { valid: false, amount: null, error: `O bônus só pode ser aumentado. Valor atual: R$ ${currentFee.toFixed(2)}.`, }; } if (amount …
  ```
- **rankOf(status: LalamoveOrderStatus | null)** — `src/lib/lalamoveTimeline.ts`
  ```
  return status === null ? -1 : ORDER_STATUS_RANK[status];
  ```
- **validateSpecialRequests(vehicleType: string, requests: readonly string[],)** — `src/lib/lalamoveValidation.ts`
  ```
  const allowed = SPECIAL_REQUESTS_BY_VEHICLE[vehicleType]; if (!allowed) { return { valid: false, allowed: [], invalid: [...requests], duplicates: [], error: `Tipo de veículo desconhecido: ${vehicleType}`, }; } const seen = new Set<string>(); const duplicates: string[] = []; const invalid: string[] = []; for (const r of requests) { if (seen.has(r)) { duplicates.push(r); continue; } seen.add(r); if (!allowed.includes(r)) invalid.push(r); } if (invalid.length > 0) { return { valid: false, allowed, …
  ```
- **validateBrazilianPhone(input: string)** — `src/lib/phone.ts`
  ```
  const raw = (input ?? '').trim(); if (!raw) { return { valid: false, error: 'Telefone é obrigatório', e164: null }; } // Extrai apenas dígitos, preservando o + inicial se existir. const digits = raw.replace(/\D/g, ''); if (digits.length === 0) { return { valid: false, error: 'Formato inválido — informe apenas números', e164: null }; } // Normaliza para dígitos nacionais brasileiros (sem o 55). let national = digits; if (digits.startsWith('55') && digits.length >= 12) { national = digits.slice(2) …
  ```
- **validateLoginForm()** — `src/pages/AuthPage.tsx`
  ```
  const result = loginSchema.safeParse({ email, password }); if (!result.success) { const firstError = result.error.issues[0]; toast.error(firstError.message); return false; } return true;
  ```
- **validateSignupForm()** — `src/pages/AuthPage.tsx`
  ```
  const result = signupSchema.safeParse({ email, password }); if (!result.success) { const firstError = result.error.issues[0]; toast.error(firstError.message); return false; } if (isPasswordBreached) { toast.error('Esta senha foi exposta em vazamentos. Escolha outra senha.'); return false; } return true;
  ```
- **validatePassword()** — `src/pages/ResetPasswordPage.tsx`
  ```
  const result = passwordSchema.safeParse(password); if (!result.success) { setErrors(result.error.issues.map(e => e.message)); return false; } if (password !== confirmPassword) { setErrors(['As senhas não coincidem']); return false; } setErrors([]); return true;
  ```
- **calculateSecurityScore()** — `src/pages/SecurityDashboardPage.tsx`
  ```
  const checks = { mfaEnabled: isMFAEnabled ? 20 : 0, hasPasskeys: hasPasskeys ? 15 : 0, hasRole: (userRoles?.length || 0) > 0 ? 15 : 0, noBlockedActivity: rateLimitStats.blockedRequests === 0 ? 20 : 10, recentLoginSuccess: authStats.successful > authStats.failed ? 15 : 5, // Monitoring counts only when auth events are actually being recorded. activeMonitoring: authStats.total > 0 ? 15 : 0, }; return Object.values(checks).reduce((a, b) => a + b, 0);
  ```
- **formatCurrency(value: number, currency: string)** — `src/pages/orders/OrderCard.tsx`
  ```
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  ```
- **generateFingerprint(name: string, message: string, stack?: string)** — `src/services/errorMonitoring.ts`
  ```
  const significantStack = stack?.split('\n').slice(0, 3).join('') ?? ''; const raw = `${name}::${message}::${significantStack}`; let hash = 0; for (let i = 0; i < raw.length; i++) { const char = raw.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash |= 0; } return `fp_${Math.abs(hash).toString(36)}`;
  ```
- **generateErrorId()** — `src/services/errorMonitoring.ts`
  ```
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  ```
- **calculatePerformanceScore(metrics: Record<string, Metric>)** — `src/utils/webVitals.ts`
  ```
  const weights = { LCP: 0.25, INP: 0.30, // INP is now a Core Web Vital CLS: 0.25, FCP: 0.10, TTFB: 0.10, }; let score = 0; let totalWeight = 0; for (const [name, weight] of Object.entries(weights)) { const metric = metrics[name]; if (metric) { const metricRating = metric.rating; const metricScore = metricRating === 'good' ? 100 : metricRating === 'needs-improvement' ? 50 : 0; score += metricScore * weight; totalWeight += weight; } } return totalWeight > 0 ? Math.round(score / totalWeight * 100) …
  ```
- **calculateRiskAnalysis(stats: DriverStats, incidentCount: number, hasCriticalIncidents: boolean, driverRating: number)** — `supabase/functions/evaluate-driver/index.ts`
  ```
  const factors: RiskFactor[] = []; let totalScore = 0; // Factor 1: Experiência (entregas totais) if (stats.totalDeliveries === 0) { factors.push({ factor: 'FIRST_DELIVERY', score: 5.0, weight: WEIGHTS.FIRST_DELIVERY, description: 'Primeira entrega com este motorista' }); totalScore += 5.0 * WEIGHTS.FIRST_DELIVERY; } else if (stats.totalDeliveries < 10) { const score = 3.0; factors.push({ factor: 'LOW_DELIVERIES', score, weight: WEIGHTS.LOW_DELIVERIES, description: `Apenas ${stats.totalDeliveries …
  ```
- **calculateStatsFromOrders(orders: any[])** — `supabase/functions/evaluate-driver/index.ts`
  ```
  const total = orders.length; const completed = orders.filter((o: any) => o.outcome === 'SUCCESS').length; const failed = orders.filter((o: any) => o.outcome === 'FAILED' || o.outcome === 'DAMAGED' || o.outcome === 'STOLEN' ).length; const cancelled = orders.filter((o: any) => o.status === 'CANCELLED').length; const delays = orders .filter((o: any) => o.delay_minutes != null) .map((o: any) => o.delay_minutes as number); const avgDelay = delays.length > 0 ? delays.reduce((a: number, b: number) => …
  ```
- **calculateStatsFromDriver(driver: Driver)** — `supabase/functions/evaluate-driver/index.ts`
  ```
  const total = driver.total_deliveries || 0; const completed = driver.completed_deliveries || 0; const failed = driver.failed_deliveries || 0; const cancelled = driver.cancelled_deliveries || 0; return { totalDeliveries: total, completedDeliveries: completed, failedDeliveries: failed, cancelledDeliveries: cancelled, successRate: driver.success_rate || (total > 0 ? (completed / total) * 100 : 0), failureRate: driver.failure_rate || (total > 0 ? (failed / total) * 100 : 0), incidentCount: 0, avgDel …
  ```
- **generateSignature(method: string, path: string, timestamp: string, body: string)** — `supabase/functions/lalamove-api/index.ts`
  ```
  const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`; const encoder = new TextEncoder(); const key = await crypto.subtle.importKey( 'raw', encoder.encode(LALAMOVE_API_SECRET!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'] ); const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawSignature)); return Array.from(new Uint8Array(signatureBuffer)) .map(b => b.toString(16).padStart(2, '0')) .join('');
  ```
- **generateSu()** — `supabase/functions/lalamove-uapi/index.ts`
  ```
  return `${Date.now()}ehll${Math.floor(Math.random() * 1e10)}`;
  ```
- **generateDeviceId()** — `supabase/functions/lalamove-uapi/index.ts`
  ```
  return crypto.randomUUID();
  ```
- **validateTimestampFreshness(timestamp: string | null | undefined)** — `supabase/functions/lalamove-webhook/index.ts`
  ```
  valid: boolean; reason?: string
  ```
- **computeIdempotencyKey(body: string)** — `supabase/functions/lalamove-webhook/index.ts`
  ```
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)); return new TextDecoder().decode(encode(new Uint8Array(hash)));
  ```
- **validateHmacSignature(body: string, signature: string | null, secret: string)** — `supabase/functions/lalamove-webhook/security.ts`
  ```
  valid: boolean; reason?: string
  ```
- **validateLalamoveV3Signature(payload: { timestamp?: unknown; signature?: unknown; data?: unknown }, paths: string[], secret: string,)** — `supabase/functions/lalamove-webhook/security.ts`
  ```
  valid: boolean; reason?: string
  ```

### G.4 Percentuais e multiplicadores no código

| Trecho | Arquivo |
|---|---|
| `transition={{ delay: index * 0.05 }}` | `src/components/auth/PasskeySettings.tsx` |
| `transition={{ delay: index * 0.03 }}` | `src/components/dashboard/AlertsPanel.tsx` |
| `transition={{ delay: index * 0.05 }}` | `src/components/dashboard/ApprovalQueue.tsx` |
| `const change = (Math.random() - 0.5) * currentValue * variance * 0.5;` | `src/components/dashboard/DashboardHeroSection.tsx` |
| `transition={{ delay: index * 0.1 }}` | `src/components/dashboard/DashboardHeroSection.tsx` |
| `transition={{ delay: index * 0.05 }}` | `src/components/layout/Header.tsx` |
| `const arrowLength = Math.min(speed * 0.8, 60);` | `src/components/map/markerFactories.ts` |
| `// 40 % dos endereços BR medidos (etapa 36) caem em `interpolated`; sem isto o operador` | `src/components/orders/AddressAutocomplete.tsx` |
| `const angle = ((index / actions.length) * Math.PI * 0.75) + Math.PI * 0.625;` | `src/components/ui/fab-variants.tsx` |
| `transition={{ delay: index * 0.02 }}` | `src/components/ui/keyboard-shortcuts-help.tsx` |
| `delay: index * 0.1,` | `src/components/ui/motion.tsx` |
| `delay: i * 0.2,` | `src/components/ui/page-loader.tsx` |
| `const resistance = Math.min(diff * 0.5, threshold * 1.5);` | `src/components/ui/pull-to-refresh.tsx` |
| `transition={{ delay: index * 0.05, duration: 0.2 }}` | `src/components/ui/sparkline.tsx` |
| `const randomDelay = Math.random() * 0.3;` | `src/hooks/useAchievementsSystem.tsx` |
| `avgPickupTime: Math.round(avgDeliveryTime * 0.3), // Estimate` | `src/hooks/useSLAMetrics.ts` |
| `* - Disponibilidade: 99.9% (razão de requisições bem-sucedidas)` | `src/hooks/useSLOMetrics.ts` |
| `* - Taxa de falhas: 1% (proporção de requisições com erro)` | `src/hooks/useSLOMetrics.ts` |
| `// Dentro de 0,1% do alvo ainda é "em risco"` | `src/hooks/useSLOMetrics.ts` |
| `const availBudget = 100 - SLO_TARGETS.availability; // ex.: 0.1%` | `src/hooks/useSLOMetrics.ts` |
| `transition={{ delay: index * 0.05 }}` | `src/pages/MetricsPage.panels.tsx` |
| `transition={{ delay: 0.2 + index * 0.1 }}` | `src/pages/MetricsPage.tsx` |
| `transition={{ delay: index * 0.1 }}` | `src/pages/RolesPage.tsx` |
| `transition={{ delay: index * 0.05 }}` | `src/pages/SecurityDashboardPage.tsx` |
| `transition={{ delay: index * 0.1 }}` | `src/pages/SecurityDashboardPage.tsx` |
| `transition={{ delay: index * 0.05 }}` | `src/pages/orders/OrderCard.tsx` |
| `// ficavam NULL em 100% dos pedidos e o /map não desenhava coleta nem entrega.` | `supabase/functions/lalamove-api/coordinates.ts` |
| `// Randomly toggle off-route status (3% chance to go off, 20% to return)` | `supabase/functions/simulate-driver-movement/index.ts` |
| `// Randomly toggle stopped status (5% chance)` | `supabase/functions/simulate-driver-movement/index.ts` |
| `// Simulate movement - move 5-15% towards destination with some randomness` | `supabase/functions/simulate-driver-movement/index.ts` |
| `const movePercent = 0.05 + Math.random() * 0.1;` | `supabase/functions/simulate-driver-movement/index.ts` |
| `const randomOffset = () => (Math.random() - 0.5) * 0.0005; // Small random deviation` | `supabase/functions/simulate-driver-movement/index.ts` |

## H. Parâmetros de negócio (constantes, prazos, limites)

### H.1 Constantes

| Constante | Valor | Arquivo |
|---|---|---|
| `RUNTIME_CACHE` | `'runtime-cache-v3'` | `public/sw.js` |
| `SAFE_REMOVAL_THRESHOLD` | `1` | `src/components/admin/telemetry/ContractVersionUsagePanel.tsx` |
| `SWIPE_THRESHOLD` | `100` | `src/components/approvals/SwipeableApprovalCard.tsx` |
| `DEFAULT_ZOOM` | `12` | `src/components/map/LiveMap.tsx` |
| `FAR_ZOOM_THRESHOLD` | `11.5` | `src/components/map/LiveMap.tsx` |
| `VERY_FAR_ZOOM_THRESHOLD` | `9.5` | `src/components/map/LiveMap.tsx` |
| `QUOTE_SAFETY_MARGIN_MS` | `45` | `src/components/orders/NewOrderDialog.tsx` |
| `HEATMAP_LAYER` | `'deliveries-heat'` | `src/components/reports/GeoHeatmap.tsx` |
| `CLUSTER_SOURCE` | `'deliveries-clustered'` | `src/components/reports/GeoHeatmap.tsx` |
| `CLUSTER_LAYER` | `'deliveries-clusters'` | `src/components/reports/GeoHeatmap.tsx` |
| `CLUSTER_COUNT_LAYER` | `'deliveries-cluster-count'` | `src/components/reports/GeoHeatmap.tsx` |
| `POINT_LAYER` | `'deliveries-point'` | `src/components/reports/GeoHeatmap.tsx` |
| `MAX_RECENT_PAGES` | `5` | `src/components/ui/breadcrumb-config.ts` |
| `MOBILE_BREAKPOINT` | `768` | `src/hooks/use-mobile.tsx` |
| `MAX_RECENT_SEARCHES` | `5` | `src/hooks/useCommandPaletteSearch.ts` |
| `TREND_RISE_THRESHOLD` | `0.5` | `src/hooks/useContractVersionUsage.ts` |
| `SUSTAINED_MIN_DAYS` | `3` | `src/hooks/useContractVersionUsage.ts` |
| `MAX_RECENT` | `10` | `src/hooks/useGlobalSearch.ts` |
| `HOURS_LOOKBACK` | `24` | `src/hooks/useLalamoveQuota.ts` |
| `PAGE_SIZE` | `20` | `src/hooks/useLalamoveUapi.ts` |
| `ATTRIBUTION` | `'© Mapbox © OpenStreetMap'` | `src/hooks/useMapbox.ts` |
| `DB_VERSION` | `1` | `src/hooks/useOfflineStorage.ts` |
| `PAGE_SIZE` | `20` | `src/hooks/useRecentOrders.ts` |
| `PRECISION` | `3` | `src/hooks/useRegionResolver.ts` |
| `MAX_PER_RUN` | `60` | `src/hooks/useRegionResolver.ts` |
| `CONCURRENCY` | `5` | `src/hooks/useRegionResolver.ts` |
| `BACKEND_CHUNK` | `100` | `src/hooks/useRegionResolver.ts` |
| `RESULT` | `'lovable-preview-auth:result'` | `src/integrations/supabase/previewAuthStorage.ts` |
| `TIMEOUT` | `2000` | `src/integrations/supabase/previewAuthStorage.ts` |
| `RETRY_DELAY` | `250` | `src/integrations/supabase/previewAuthStorage.ts` |
| `MAX_PRIORITY_FEE_BRL` | `500` | `src/lib/lalamoveOrderEdit.ts` |
| `PAGE_SIZE` | `25` | `src/pages/ExternalDataPage.tsx` |
| `OPTIMIZATION_THRESHOLD_PCT` | `5` | `src/pages/map-tools/OptimizationTab.tsx` |
| `DEDUP_WINDOW_MS` | `30` | `src/services/errorMonitoring.ts` |
| `DEFAULT_VERSION` | `"v1"` | `supabase/functions/_shared/contract.ts` |
| `RECOMMENDED_VERSION` | `"v2"` | `supabase/functions/_shared/contract.ts` |
| `DEFAULT_STOPPED_WARNING_MINUTES` | `5` | `supabase/functions/check-driver-alerts/index.ts` |
| `DEFAULT_STOPPED_CRITICAL_MINUTES` | `10` | `supabase/functions/check-driver-alerts/index.ts` |
| `DEFAULT_POD_DEADLINE_MINUTES` | `30` | `supabase/functions/check-driver-alerts/index.ts` |
| `HEALTH_ADDRESS` | `'Avenida Paulista 1578, São Paulo'` | `supabase/functions/check-external-api/index.ts` |
| `BASE` | `"https://api.mapbox.com"` | `supabase/functions/geo-gateway/providers/mapbox.ts` |
| `LALAMOVE_MARKET` | `'BR'` | `supabase/functions/lalamove-api/index.ts` |
| `TIMEOUT_MS` | `25` | `supabase/functions/lalamove-gateway/index.ts` |
| `REFRESH_AFTER_HOURS` | `20` | `supabase/functions/lalamove-token-refresh/index.ts` |
| `EXPIRY_HOURS` | `24` | `supabase/functions/lalamove-token-refresh/index.ts` |
| `CLAIM_WINDOW_SECONDS` | `1` | `supabase/functions/lalamove-token-refresh/index.ts` |
| `TIMEOUT_MS` | `25` | `supabase/functions/lalamove-token-refresh/index.ts` |
| `HCOUNTRY` | `'20000'` | `supabase/functions/lalamove-uapi/index.ts` |
| `HLANG` | `'pt_BR'` | `supabase/functions/lalamove-uapi/index.ts` |
| `APP_VERSION` | `'5.37.0'` | `supabase/functions/lalamove-uapi/index.ts` |
| `APP_REVISION` | `'53700'` | `supabase/functions/lalamove-uapi/index.ts` |
| `RATE_LIMIT_WINDOW_MS` | `60000` | `supabase/functions/lalamove-webhook/index.ts` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | `supabase/functions/lalamove-webhook/index.ts` |
| `RATE_LIMIT_BLOCK_DURATION_MS` | `300000` | `supabase/functions/lalamove-webhook/index.ts` |
| `WEBHOOK_MAX_AGE_MS` | `5` | `supabase/functions/lalamove-webhook/index.ts` |
| `SLOW_MS` | `3000` | `supabase/functions/mcp-query/index.ts` |
| `VERY_SLOW_MS` | `8000` | `supabase/functions/mcp-query/index.ts` |

### H.2 Prazos, expirações e janelas de tempo

| Trecho | Arquivo |
|---|---|
| `PLAYWRIGHT_TIMEOUT = 90 # segundos` | `lalamove_token_manager.py` |
| `REFRESH_TIMEOUT = 15 # segundos` | `lalamove_token_manager.py` |
| `expect: { timeout: 10_000 },` | `playwright.config.ts` |
| `timeout: 120_000,` | `playwright.config.ts` |
| `timeout: 30_000,` | `playwright.config.ts` |
| `gcTime: 5 * 60 * 1000,` | `src/App.tsx` |
| `setTimeout(() => this.setState({ copied: false }), 2000);` | `src/components/ErrorBoundary.tsx` |
| `case "1h": return 5 * 60 * 1000; // 5 min` | `src/components/admin/telemetry/TelemetryCharts.tsx` |
| `case "24h": return 60 * 60 * 1000; // 1 hour` | `src/components/admin/telemetry/TelemetryCharts.tsx` |
| `case "6h": return 30 * 60 * 1000; // 30 min` | `src/components/admin/telemetry/TelemetryCharts.tsx` |
| `case "7d": return 6 * 60 * 60 * 1000; // 6 hours` | `src/components/admin/telemetry/TelemetryCharts.tsx` |
| `default: return 60 * 60 * 1000;` | `src/components/admin/telemetry/TelemetryCharts.tsx` |
| `setTimeout(() => setCopied(false), 2000);` | `src/components/auth/MFAEnroll.tsx` |
| `gKeyTimeoutRef.current = setTimeout(() => { setGKeyPressed(false); }, 1500);` | `src/components/layout/AppLayout.tsx` |
| `setTimeout(() => setIsTestingSound(false), 1000);` | `src/components/notifications/SoundSettingsPanel.tsx` |
| `max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}` | `src/components/orders/NewOrderDialog.tsx` |
| `setTimeout(() => { resetForm(); onOpenChange(false); onSuccess(); }, 1500);` | `src/components/orders/NewOrderDialog.tsx` |
| `const timer = setTimeout(() => setIsActive(true), 2000);` | `src/components/ui/contextual-hints.tsx` |
| `if (event.relatedId) { navigator.clipboard.writeText(event.relatedId); setCopied(true); setTimeout(() => setCopied(false), 2000); }` | `src/components/ui/timeline-item.tsx` |
| `const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);` | `src/hooks/healthChecks.ts` |
| `timeoutRef.current = setTimeout(() => { announcer.textContent = ''; }, 1000);` | `src/hooks/useAccessibility.tsx` |
| `const timer = setTimeout(onDismiss, 5000);` | `src/hooks/useAchievementsSystem.tsx` |
| `setTimeout(() => setShowConfetti(false), 3000);` | `src/hooks/useAchievementsSystem.tsx` |
| `const dayMs = 24 * 60 * 60 * 1000;` | `src/hooks/useAdvancedReports.ts` |
| `staleTime: 60 * 60 * 1000, // 1 hour` | `src/hooks/useAlertConfigurations.ts` |
| `const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);` | `src/hooks/useAlertGrouping.ts` |
| `refetchInterval: 10 * 60 * 1000,` | `src/hooks/useCachedStats.ts` |
| `refetchInterval: 10 * 60 * 1000, // Refetch a cada 10 minutos` | `src/hooks/useCachedStats.ts` |
| `staleTime: 5 * 60 * 1000,` | `src/hooks/useCachedStats.ts` |
| `staleTime: 5 * 60 * 1000, // Cache por 5 minutos no client` | `src/hooks/useCachedStats.ts` |
| `.gte('last_active_at', subDays(new Date(), 1).toISOString()),` | `src/hooks/useDashboardStats.ts` |
| `const thirtyDaysAgo = subDays(new Date(), 30).toISOString();` | `src/hooks/useDashboardStats.ts` |
| `staleTime: 5 * 60 * 1000, // 5 minutes` | `src/hooks/useDeliveryHeatmapData.ts` |
| `const timer = setTimeout(() => { checkDevice(); }, 2000); // Small delay to ensure auth is complete` | `src/hooks/useDeviceDetection.ts` |
| `const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);` | `src/hooks/useErrorLogs.ts` |
| `const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);` | `src/hooks/useErrorLogs.ts` |
| `const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);` | `src/hooks/useJobQueue.ts` |
| `staleTime: 24 * 60 * 60_000,` | `src/hooks/useLalamove.ts` |
| `staleTime: 24 * 60 * 60_000, // 24h` | `src/hooks/useLalamove.ts` |
| `const interval = setInterval(() => runAnalysis(true), 5 * 60 * 1000);` | `src/hooks/usePredictiveAnalysis.ts` |
| `supabase.from("driver_incidents").select("id, severity, created_at").eq("resolved", false).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toIS …` | `src/hooks/usePredictiveAnalysis.ts` |
| `}, { timeout: 2000 });` | `src/hooks/usePrefetch.ts` |
| `setTimeout(() => notification.close(), 10000);` | `src/hooks/usePushNotifications.ts` |
| `staleTime: 60 * 60 * 1000, // 1 hour` | `src/hooks/useRiskRules.ts` |
| `const buffer = 10 * 60 * 1000; // 10 minutes` | `src/hooks/useSLAMetrics.ts` |
| `'1h': 60 * 60 * 1000,` | `src/hooks/useSLOMetrics.ts` |
| `'24h': 24 * 60 * 60 * 1000,` | `src/hooks/useSLOMetrics.ts` |
| `'30d': 30 * 24 * 60 * 60 * 1000,` | `src/hooks/useSLOMetrics.ts` |
| `'7d': 7 * 24 * 60 * 60 * 1000,` | `src/hooks/useSLOMetrics.ts` |
| `const hour = 60 * 60 * 1000;` | `src/hooks/useSLOMetrics.ts` |
| `setTimeout(() => notif.close(), 10000);` | `src/hooks/useSecurityPushNotifications.ts` |
| `const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();` | `src/hooks/useWebAuthn.ts` |
| `const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes` | `src/hooks/useWebAuthn.ts` |
| `timeout: 60000,` | `src/hooks/useWebAuthn.ts` |
| `const TIMEOUT = 2000;` | `src/integrations/supabase/previewAuthStorage.ts` |
| `const timeout = setTimeout(() => controller.abort(), 4000);` | `src/lib/cep.ts` |
| `"1h": 60 * 60 * 1000,` | `src/pages/AdminTelemetriaPage.tsx` |
| `"24h": 24 * 60 * 60 * 1000,` | `src/pages/AdminTelemetriaPage.tsx` |
| `"6h": 6 * 60 * 60 * 1000,` | `src/pages/AdminTelemetriaPage.tsx` |
| `"7d": 7 * 24 * 60 * 60 * 1000,` | `src/pages/AdminTelemetriaPage.tsx` |
| `const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();` | `src/pages/AdminTelemetriaPage.tsx` |
| `return remaining > 0 && remaining < 30 * 60 * 1000; // within 30 min` | `src/pages/DashboardRedesigned.tsx` |
| `setTimeout(() => { navigate('/'); }, 3000);` | `src/pages/ResetPasswordPage.tsx` |
| `ORDER_TIMEOUT: 5,` | `src/types/lalamove.ts` |
| `token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),` | `supabase/functions/lalamove-uapi/index.ts` |
| `const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes` | `supabase/functions/lalamove-webhook/index.ts` |
| `expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours'),` | `supabase/migrations/20251231131206_017e19aa-c6cc-438f-a6ac-b3ec6f486172.sql` |
| `IF v_lockout_duration > interval '15 minutes' THEN` | `supabase/migrations/20251231132341_0338fc6c-b0df-47d7-8654-d5a5f4795c13.sql` |
| `IF v_record IS NOT NULL AND v_record.first_attempt_at < now() - interval '24 hours' THEN` | `supabase/migrations/20251231132341_0338fc6c-b0df-47d7-8654-d5a5f4795c13.sql` |
| `IF v_record.first_attempt_at < now() - interval '24 hours' THEN` | `supabase/migrations/20251231132341_0338fc6c-b0df-47d7-8654-d5a5f4795c13.sql` |
| `v_lockout_duration := (30 * power(2, LEAST(v_new_count - 5, 5)))::integer * interval '1 second';` | `supabase/migrations/20251231132341_0338fc6c-b0df-47d7-8654-d5a5f4795c13.sql` |
| `v_lockout_duration := interval '15 minutes';` | `supabase/migrations/20251231132341_0338fc6c-b0df-47d7-8654-d5a5f4795c13.sql` |
| `AND last_attempt_at > now() - interval '1 hour';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `AND last_attempt_at > now() - interval '10 minutes';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `IF v_record IS NOT NULL AND v_record.first_attempt_at < now() - interval '24 hours' THEN` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `IF v_record.first_attempt_at < now() - interval '24 hours' THEN` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `VALUES (p_ip_address, 'Excesso de tentativas de login', now() + interval '1 hour')` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `WHERE is_permanent = false AND expires_at < now() - interval '1 day';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `WHERE last_attempt_at < now() - interval '7 days';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `expires_at = now() + interval '1 hour',` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `v_lockout_duration := interval '1 hour';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `v_lockout_duration := interval '1 minute';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `v_lockout_duration := interval '15 minutes';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `v_lockout_duration := interval '2 hours';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `v_lockout_duration := interval '30 minutes';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `v_lockout_duration := interval '5 minutes';` | `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql` |
| `AND used_at < now() - interval '7 days';` | `supabase/migrations/20260109204611_493af21a-d985-4611-8287-e6f6b7d27b20.sql` |
| `IF NEW.expires_at > now() + interval '24 hours' THEN` | `supabase/migrations/20260109204611_493af21a-d985-4611-8287-e6f6b7d27b20.sql` |
| `NEW.expires_at := now() + interval '24 hours';` | `supabase/migrations/20260109204611_493af21a-d985-4611-8287-e6f6b7d27b20.sql` |
| `SET expires_at = now() - interval '1 second'` | `supabase/migrations/20260109204611_493af21a-d985-4611-8287-e6f6b7d27b20.sql` |
| `token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),` | `supabase/migrations/20260315165451_86aebbac-da62-421e-b90c-59196d72b2da.sql` |
| `v_end date := (date_trunc('month', p_month) + interval '1 month')::date;` | `supabase/migrations/20260711192431_6df39da5-eab7-41bd-8d4e-f6f7ad4e777e.sql` |
| `v_end date := (date_trunc('month', p_month) + interval '1 month')::date;` | `supabase/migrations/20260712200453_da8e70b1-bf6a-4701-bb64-4a4c09f9c849.sql` |
| `v_end date := (date_trunc('month', p_month) + interval '1 month')::date;` | `supabase/migrations/20260715175652_9eec973e-6015-436e-aa33-91be0a504eb6.sql` |
| `AND a.created_at > now() - interval '24 hours'` | `supabase/migrations/20261121193000_fix_escalation_pipeline.sql` |
| `AND (t.route_computed_at IS NULL OR t.route_computed_at < now() - interval '5 minutes')` | `supabase/migrations/20261121194500_geo_jobs_scheduler.sql` |
| `AND t.last_updated > now() - interval '2 hours'` | `supabase/migrations/20261121194500_geo_jobs_scheduler.sql` |
| `OR t.route_computed_at < now() - interval '30 minutes'` | `supabase/migrations/20261121194500_geo_jobs_scheduler.sql` |
| `AND started_at < now() - interval '10 minutes'` | `supabase/migrations/20261122140000_fix_crons_dispatcher.sql` |

### H.3 Limites de paginação

| Limite | Arquivo |
|---|---|
| 1 | `src/components/orders/OrderDetailModal.tsx` |
| 5000 | `src/components/webhooks/WebhookSecurityPanel.tsx` |
| 1 | `src/hooks/healthChecks.ts` |
| 20 | `src/hooks/useActiveAlerts.ts` |
| 10 | `src/hooks/useAnalyticsData.ts` |
| 100 | `src/hooks/useBitrix24.ts` |
| 50 | `src/hooks/useBitrix24.ts` |
| 100 | `src/hooks/useCachedStats.ts` |
| 3 | `src/hooks/useCommandPaletteSearch.ts` |
| 5 | `src/hooks/useCommandPaletteSearch.ts` |
| 500 | `src/hooks/useContacts.ts` |
| 100 | `src/hooks/useDashboardStats.ts` |
| 1 | `src/hooks/useDriverEvaluations.ts` |
| 100 | `src/hooks/useDriverEvaluations.ts` |
| 10 | `src/hooks/useGeoAdmin.ts` |
| 10 | `src/hooks/useGlobalSearch.ts` |
| 1 | `src/hooks/useJobQueue.ts` |
| 2000 | `src/hooks/useLalamoveQuota.ts` |
| 200 | `src/hooks/useNotificationHistory.ts` |
| 50 | `src/hooks/usePendingApprovals.ts` |
| 100 | `src/hooks/usePredictiveAnalysis.ts` |
| 50 | `src/hooks/usePredictiveAnalysis.ts` |
| 500 | `src/hooks/useRateLimiting.ts` |
| 10000 | `src/hooks/useSLOMetrics.ts` |
| 1 | `src/hooks/useSystemHealth.ts` |
| 100 | `src/hooks/useWebhookEvents.ts` |
| 5000 | `src/hooks/useWebhookSecurityMetrics.ts` |
| 500 | `src/pages/EvaluationsPage.tsx` |
| 1 | `supabase/functions/bitrix24-process-queue/index.ts` |
| 10 | `supabase/functions/bitrix24-process-queue/index.ts` |
| 1 | `supabase/functions/check-driver-alerts/index.ts` |
| 50 | `supabase/functions/evaluate-driver/index.ts` |
| 3 | `supabase/functions/external-companies/index.ts` |
| 1 | `supabase/functions/lalamove-token-refresh/index.ts` |
| 20 | `supabase/functions/route-analyzer/index.ts` |
| 1 | `supabase/functions/send-notification/index.ts` |
| 1 | `supabase/functions/test-notification/index.ts` |

## I. Regras implícitas em mensagens de erro/validação

| Mensagem | Arquivo |
|---|---|
| Não foi possível obter um token válido | `lalamove_token_manager.py` |
| ${msg}: esperado ${JSON.stringify(b)} obtido ${JSON.stringify(a)} | `scripts/ai-context/cenarios.mjs` |
| Argumento desconhecido: ${arg} | `scripts/ci/a11y-button-name-ratchet.mjs` |
| Valor ausente para ${arg}. | `scripts/ci/a11y-button-name-ratchet.mjs` |
| ${metodo} ${caminho} -> ${r.status} | `scripts/ci/actions-kpi.mjs` |
| PR sem headRefName | `scripts/ci/branch-podaveis.mjs` |
| a lista de PRs abertas não é um array | `scripts/ci/branch-podaveis.mjs` |
| a lista de PRs abertas veio cheia (${dados.length} >= limite ${limite}); pode haver PR que não veio | `scripts/ci/branch-podaveis.mjs` |
| argumento inválido: ${chave} | `scripts/ci/branch-podaveis.mjs` |
| falta --${obrigatorio} | `scripts/ci/branch-podaveis.mjs` |
| getaddrinfo EAI_AGAIN | `scripts/ci/bump-toolchain.unit.mjs` |
| Argumento desconhecido: ${argv[index]} | `scripts/ci/bundle-budget.mjs` |
| asset referenciado no index.html nao existe: ${href} | `scripts/ci/bundle-budget.mjs` |
| Argumento desconhecido: ${argv[i]} | `scripts/ci/check-bundle-secrets.mjs` |
| baseline invalido ou com schema diferente de ${SCHEMA_BASELINE}: ${caminho} | `scripts/ci/check-edge-error-exposure.mjs` |
| ), { recursive: true });   mkdirSync(path.join(raiz,  | `scripts/ci/check-edge-error-exposure.unit.mjs` |
| comando nao encontrado no PATH: ${comando} | `scripts/ci/check-test-inventory.mjs` |
| comando nao encontrado no PATH: ${comando} | `scripts/ci/check-workflow-pins-resolvem.mjs` |
| não deveria consultar a rede | `scripts/ci/check-workflow-pins-resolvem.unit.mjs` |
| rede fora | `scripts/ci/check-workflow-pins-resolvem.unit.mjs` |
| fonte única de versões ausente ou ilegível em ${TOOLCHAIN_PATH}: ${error.message} | `scripts/ci/check-workflow-pins.mjs` |
| fonte única de versões incompleta em ${TOOLCHAIN_PATH}: falta a versão de  | `scripts/ci/check-workflow-pins.mjs` |
| fonte única de versões inválida em ${TOOLCHAIN_PATH}: precisa ser um objeto JSON | `scripts/ci/check-workflow-pins.mjs` |
| comando nao encontrado no PATH: ${comando} | `scripts/ci/fila-merge.mjs` |
| sem rede | `scripts/ci/fila-merge.unit.mjs` |
| Argumento desconhecido: ${argv[i]} | `scripts/ci/github-settings-guard.mjs` |
| GitHub API GET ${caminho} -> ${res.status}: ${await res.text()} | `scripts/ci/github-settings-guard.mjs` |
| TypeScript local nao encontrado em ${tscEntry}.  | `scripts/ci/implicit-any-ratchet.mjs` |
| tsc saiu com exit ${status} (falha de CLI, nao lista de diagnosticos): ${snippet(output)} | `scripts/ci/implicit-any-ratchet.mjs` |
| tsc saiu com exit ${status} com diagnostico GLOBAL (config/CLI quebrada), que nao e uma  | `scripts/ci/implicit-any-ratchet.mjs` |
| tsc saiu com exit ${status} sem nenhum diagnostico TypeScript reconhecivel  | `scripts/ci/implicit-any-ratchet.mjs` |
| ${label} falhou com exit ${result.status}: ${normalizeWhitespace(result.stderr)} | `scripts/ci/lint-ratchet.mjs` |
| --base nao combina com --staged. | `scripts/ci/lint-ratchet.mjs` |
| --base nao combina com --update-baseline. | `scripts/ci/lint-ratchet.mjs` |
| --staged nao combina com --update-baseline. | `scripts/ci/lint-ratchet.mjs` |
| Argumento desconhecido: ${argument} | `scripts/ci/lint-ratchet.mjs` |
| Baseline ESLint invalido ou com schema diferente de ${SCHEMA_VERSION}. | `scripts/ci/lint-ratchet.mjs` |
| ESLint falhou com exit ${result.status}: ${normalizeWhitespace(result.stderr)} | `scripts/ci/lint-ratchet.mjs` |
| ESLint local nao encontrado. Execute a instalacao das dependencias primeiro. | `scripts/ci/lint-ratchet.mjs` |
| ESLint nao produziu JSON valido: ${error.message} | `scripts/ci/lint-ratchet.mjs` |
| Entrada invalida no relatorio JSON do ESLint. | `scripts/ci/lint-ratchet.mjs` |
| Nao foi possivel ler ${description} em ${filePath}: ${error.message} | `scripts/ci/lint-ratchet.mjs` |
| O ESLint ou eslint.config.js mudou desde a geracao do baseline. Revise a mudanca e regenere o baseline. | `scripts/ci/lint-ratchet.mjs` |
| O relatorio do ESLint deve ser um array JSON. | `scripts/ci/lint-ratchet.mjs` |
| Valor ausente para ${argument}. | `scripts/ci/lint-ratchet.mjs` |
| comando nao encontrado no PATH: ${comando} | `scripts/ci/lint-ratchet.mjs` |
| comando nao encontrado no PATH: ${comando} | `scripts/ci/lint-ratchet.unit.mjs` |
| central directory corrompido | `scripts/ci/redigir-relatorio.mjs` |
| local header corrompido | `scripts/ci/redigir-relatorio.mjs` |
| metodo de compressao ${metodo} nao suportado | `scripts/ci/redigir-relatorio.mjs` |
| zip criptografado nao suportado | `scripts/ci/redigir-relatorio.mjs` |
| zip sem end of central directory | `scripts/ci/redigir-relatorio.mjs` |
| zip64 nao suportado | `scripts/ci/redigir-relatorio.mjs` |
| Argumento desconhecido: ${argument} | `scripts/ci/typecheck-ratchet.mjs` |
| Baseline de typecheck invalido ou com schema diferente de ${SCHEMA_VERSION}. | `scripts/ci/typecheck-ratchet.mjs` |
| Nao foi possivel ler ${description} em ${filePath}: ${error.message} | `scripts/ci/typecheck-ratchet.mjs` |
| TypeScript local nao encontrado. Execute a instalacao das dependencias primeiro. | `scripts/ci/typecheck-ratchet.mjs` |
| Valor ausente para ${argument}. | `scripts/ci/typecheck-ratchet.mjs` |
| tsc -b falhou com exit ${status}: ${normalizeWhitespace(output)} | `scripts/ci/typecheck-ratchet.mjs` |
| tsc -b saiu com exit ${status} sem nenhum diagnostico TypeScript parseavel  | `scripts/ci/typecheck-ratchet.mjs` |
| Target  | `scripts/ci/vercel-env-baseline.mjs` |
| nenhuma tabela reconhecida em  | `scripts/db-audit/catalog-from-types.mjs` |
| types.ts ausente ou ilegivel ( | `scripts/db-audit/catalog-from-types.mjs` |
| falha ao consultar schema_migrations via psql: ${lastStderr \|\|  | `scripts/db-audit/check-migration-drift.mjs` |
| falha ao consultar schema_migrations via psql: ${safe} | `scripts/db-audit/check-migration-drift.mjs` |
| diretorio inexistente:  | `scripts/db-audit/check-screen-permission-db-guards.mjs` |
| identidade versionada invalida ( | `scripts/db-audit/database-identity.mjs` |
| Invalid or unsupported PostgreSQL connection parameters (details omitted) | `scripts/db-audit/psql-environment.mjs` |
| Nenhum statement real encontrado no arquivo (so comentarios/vazio). | `scripts/db-audit/register-migration.mjs` |
| Nome de arquivo invalido (esperado NNNNNNNNNNNNNN_nome.sql): ${base} | `scripts/db-audit/register-migration.mjs` |
| psql falhou (exit ${err.status ??  | `scripts/db-audit/register-migration.mjs` |
| caminho de  | `scripts/db-audit/seguranca-processo.mjs` |
| comando nao encontrado no PATH:  | `scripts/db-audit/seguranca-processo.mjs` |
| --entrada exige o caminho do arquivo com a resposta do banco.sql | `scripts/inventario/gerar-banco.mjs` |
| Management API ${caminho} respondeu HTTP ${res.status} | `scripts/inventario/gerar-banco.mjs` |
| SUPABASE_PROJECT_REF=${ref} nao e o banco oficial (${PROJETO_OFICIAL}). | `scripts/inventario/gerar-banco.mjs` |
| a resposta nao parece ser do banco oficial (${PROJETO_OFICIAL}): ledger com ${registros} registros e maior versao ${max};  | `scripts/inventario/gerar-banco.mjs` |
| a resposta nao traz resumo.ledger_versao_max/ledger_registros; rode o banco.sql atual. | `scripts/inventario/gerar-banco.mjs` |
| a saida tem algo com cara de credencial; nada foi gravado. Revise banco.sql. | `scripts/inventario/gerar-banco.mjs` |
| entrada sem as chaves: ${faltando.join( | `scripts/inventario/gerar-banco.mjs` |
| entrada sem tabelas | `scripts/inventario/gerar-banco.mjs` |
| format_version ${dado.format_version} desconhecido (esperado 1) | `scripts/inventario/gerar-banco.mjs` |
| sem --entrada e sem SUPABASE_ACCESS_TOKEN: nada para ler (veja o cabecalho do script). | `scripts/inventario/gerar-banco.mjs` |
| supabase/migrations/ sem arquivo .sql: nao da para conferir a origem da resposta. | `scripts/inventario/gerar-banco.mjs` |
| ripgrep (rg) falhou com exit ${status}; o inventário não foi gerado. | `scripts/inventario/gerar-repo.mjs` |
| ripgrep (rg) não encontrado; o inventário não pode ser gerado com segurança. | `scripts/inventario/gerar-repo.mjs` |
| caminho de  | `scripts/lib/seguranca-processo.mjs` |
| comando nao encontrado no PATH:  | `scripts/lib/seguranca-processo.mjs` |
| --${t} ausente (${tema}) | `scripts/qa/contraste-busca.mjs` |
| highlightClassName padrão não encontrado em highlight-match.tsx | `scripts/qa/contraste-busca.mjs` |
| opacidade inválida no destaque: ${fundo[2]} | `scripts/qa/contraste-busca.mjs` |
| receita do destaque sem text-/bg- reconhecível:  | `scripts/qa/contraste-busca.mjs` |
| ${arquivo}/${nome}: opacidade inválida | `scripts/qa/contraste-tokens.mjs` |
| --${t} ausente (${theme}) | `scripts/qa/contraste-tokens.mjs` |
| --${t} ausente (${theme}, ${r.arquivo}/${r.nome}) | `scripts/qa/contraste-tokens.mjs` |
| bloco ${seletor} ausente | `scripts/qa/contraste-tokens.mjs` |
| bloco ${seletor} sem fechamento | `scripts/qa/contraste-tokens.mjs` |
| bloco variant não encontrado em ${arquivo} | `scripts/qa/contraste-tokens.mjs` |
| nenhuma variante lida em ${arquivo} | `scripts/qa/contraste-tokens.mjs` |
| O teste offline não permite consultas ao banco | `scripts/supabase_snapshot/test_snapshot.py` |
| banco indisponível na fixture | `scripts/supabase_snapshot/test_snapshot.py` |
| catálogo indisponível na fixture | `scripts/supabase_snapshot/test_snapshot.py` |
| permission denied for schema auth | `scripts/supabase_snapshot/test_snapshot.py` |
| relation  | `scripts/supabase_snapshot/test_snapshot.py` |
| statement timeout simulado | `scripts/supabase_snapshot/test_snapshot.py` |
| view removida depois da consulta ao catálogo | `scripts/supabase_snapshot/test_snapshot.py` |
| view sem permissão na fixture | `scripts/supabase_snapshot/test_snapshot.py` |
| bloco <Route element={<AppLayout />}> nao encontrado em src/App.tsx | `scripts/ui-audit/layout-guard.mjs` |
| nenhuma pagina do AppLayout resolvida — auditoria incompleta | `scripts/ui-audit/layout-guard.mjs` |
| redirecionado para /auth — STORAGE_STATE expirado ou invalido | `scripts/ui-audit/width-regression.mjs` |
| ${kind} HTTP ${res.status} | `scripts/vercel/verify-release-targets.mjs` |
| ${kind} respondeu ${res.status} com a protecao de acesso do Vercel — use --bypass-token | `scripts/vercel/verify-release-targets.mjs` |
| ${kind} sem resposta | `scripts/vercel/verify-release-targets.mjs` |
| ${name} deve ser inteiro entre ${min} e ${max} | `scripts/vercel/verify-release-targets.mjs` |
| --from-dist fora do repositorio | `scripts/vercel/verify-release-targets.mjs` |
| --from-dist: ${rel} nao existe (rode o build antes) | `scripts/vercel/verify-release-targets.mjs` |
| --target deve ser um de: ${Object.keys(TARGETS).join( | `scripts/vercel/verify-release-targets.mjs` |
| SPA content-type inesperado: ${ct \|\|  | `scripts/vercel/verify-release-targets.mjs` |
| argumento desconhecido: --${match[1]} | `scripts/vercel/verify-release-targets.mjs` |
| argumento invalido: ${item} | `scripts/vercel/verify-release-targets.mjs` |
| argumento repetido: --${match[1]} | `scripts/vercel/verify-release-targets.mjs` |
| entry invalido em ${origem}:  | `scripts/vercel/verify-release-targets.mjs` |
| nenhum /assets/*.js encontrado em ${origem} | `scripts/vercel/verify-release-targets.mjs` |
| no ar ainda esta ${servido}; esperado ${expectedEntry} | `scripts/vercel/verify-release-targets.mjs` |
| use --expected-entry OU --from-dist, nao os dois | `scripts/vercel/verify-release-targets.mjs` |
| fetch failed | `scripts/vercel/verify-release-targets.unit.mjs` |
| : return  | `src/components/CommandPaletteEnhanced.tsx` |
| : return Bell;     case  | `src/components/CommandPaletteEnhanced.tsx` |
|  className= | `src/components/GlobalSearchAdvanced.tsx` |
|                  className= | `src/components/admin/telemetry/ContractVersionUsagePanel.tsx` |
| Nenhum pedido selecionado possui contato de fornecedor/cliente. | `src/components/dashboard/BatchActionsToolbar.tsx` |
| PDF generation triggered. In a CI environment, this would use a tool like  | `src/components/debug/AuditReportGenerator.tsx` |
| Falha ao resgatar o cupom. | `src/components/lalamove/UapiCouponsPanel.tsx` |
| Informe o código do cupom. | `src/components/lalamove/UapiCouponsPanel.tsx` |
| Erro ao Carregar | `src/components/map/MapSettingsPanel.tsx` |
| Erro ao Salvar | `src/components/map/MapSettingsPanel.tsx` |
| ,     label:  | `src/components/notifications/NotificationPreferences.tsx` |
| Não foi possível enviar a notificação | `src/components/notifications/SoundSettingsPanel.tsx` |
| Endereço encontrado sem coordenada — selecione outro resultado ou marque o ponto no mapa. | `src/components/orders/AddressAutocomplete.tsx` |
| Endereço localizado com precisão aproximada — confira o ponto no mapa antes de salvar. | `src/components/orders/AddressAutocomplete.tsx` |
| Não foi possível buscar os detalhes deste endereço. Tente novamente. | `src/components/orders/AddressAutocomplete.tsx` |
| Erro ao buscar corrida | `src/components/orders/FetchOrderDialog.tsx` |
| Erro ao ler CSV | `src/components/orders/ImportCSVDialog.tsx` |
| Nenhuma coluna de ID encontrada no CSV | `src/components/orders/ImportCSVDialog.tsx` |
| O preço da cotação mudou | `src/components/orders/NewOrderDialog.tsx` |
| Resposta inválida da cotação | `src/components/orders/NewOrderDialog.tsx` |
| Erro ao adicionar bônus | `src/components/orders/OrderDetailModal.tsx` |
| Erro ao cancelar | `src/components/orders/OrderDetailModal.tsx` |
| Erro ao trocar motorista | `src/components/orders/OrderDetailModal.tsx` |
| Não foi possível copiar | `src/components/orders/OrderDetailModal.tsx` |
| Não foi possível copiar o link | `src/components/orders/OrderDetailModal.tsx` |
|  className={cn(alertVariants({ variant }), className)} {...props} /> )); Alert.displayName =  | `src/components/ui/alert.tsx` |
| useChart must be used within a <ChartContainer /> | `src/components/ui/chart.tsx` |
| useHints must be used within a HintProvider | `src/components/ui/contextual-hints.tsx` |
| Erro ao desfazer | `src/components/ui/undo-toast.tsx` |
| Erro ao desfazer ação | `src/components/ui/undo-toast.tsx` |
| Erro ao executar ação | `src/components/ui/undo-toast.tsx` |
| Falha ao exportar rejeições | `src/components/webhooks/WebhookSecurityPanel.tsx` |
| useAchievementsSystem must be used within AchievementsProvider | `src/hooks/useAchievementsSystem.tsx` |
| Falha ao dispensar alerta. | `src/hooks/useActiveAlerts.ts` |
| Falha ao marcar alertas como lidos. | `src/hooks/useActiveAlerts.ts` |
| Falha ao reconhecer alerta. | `src/hooks/useActiveAlerts.ts` |
| Erro ao atualizar | `src/hooks/useAlertConfigurations.ts` |
| Erro ao criar | `src/hooks/useAlertConfigurations.ts` |
| Erro ao excluir | `src/hooks/useAlertConfigurations.ts` |
| Erro ao carregar configurações | `src/hooks/useAlertSettings.ts` |
| Erro ao salvar configurações | `src/hooks/useAlertSettings.ts` |
| Falha ao adicionar à blacklist. | `src/hooks/useApprovalActions.ts` |
| Falha ao adicionar à whitelist. | `src/hooks/useApprovalActions.ts` |
| Motorista na Blacklist | `src/hooks/useApprovalActions.ts` |
| useAuth must be used within an AuthProvider | `src/hooks/useAuth.tsx` |
| Erro ao conectar | `src/hooks/useBitrix24.ts` |
| Erro ao sincronizar | `src/hooks/useBitrix24.ts` |
| Erro ao vincular | `src/hooks/useBitrix24.ts` |
| Erro ao atualizar cache | `src/hooks/useCacheViews.ts` |
| , title: alert.title, subtitle: alert.message?.substring(0, 50), badge: { label: alert.severity, variant: alert.severity ===  | `src/hooks/useCommandPaletteSearch.ts` |
| Usuário não autenticado | `src/hooks/useContacts.ts` |
| Falha ao registrar avaliação. | `src/hooks/useDriverEvaluations.ts` |
| Falha ao adicionar à blacklist. | `src/hooks/useDrivers.ts` |
| Falha ao adicionar à whitelist. | `src/hooks/useDrivers.ts` |
| Falha ao aprovar motorista. | `src/hooks/useDrivers.ts` |
| Falha ao atualizar motorista. | `src/hooks/useDrivers.ts` |
| Falha ao bloquear motorista. | `src/hooks/useDrivers.ts` |
| Falha ao remover da blacklist. | `src/hooks/useDrivers.ts` |
| Falha ao remover da whitelist. | `src/hooks/useDrivers.ts` |
| Failed to fetch stats | `src/hooks/useErrorLogs.ts` |
| Aprovação Manual Necessária | `src/hooks/useEvaluateDriver.ts` |
| Erro na Avaliação | `src/hooks/useEvaluateDriver.ts` |
| Motorista Bloqueado | `src/hooks/useEvaluateDriver.ts` |
| ) {         const { data: alerts } = await supabase.from( | `src/hooks/useGlobalSearch.ts` |
| , title: alert.title, subtitle: alert.message, meta: alert.severity, path:  | `src/hooks/useGlobalSearch.ts` |
| Erro ao desfazer ação | `src/hooks/useGlobalUndo.tsx` |
| Falha ao atualizar incidente. | `src/hooks/useIncidents.ts` |
| Falha ao excluir incidente. | `src/hooks/useIncidents.ts` |
| Falha ao registrar incidente. | `src/hooks/useIncidents.ts` |
| Falha ao resolver incidente. | `src/hooks/useIncidents.ts` |
| Challenge não iniciado | `src/hooks/useMFA.ts` |
| Código inválido: ${error.message} | `src/hooks/useMFA.ts` |
| Erro ao criar challenge: ${error.message} | `src/hooks/useMFA.ts` |
| Erro ao desabilitar MFA: ${error.message} | `src/hooks/useMFA.ts` |
| Erro ao iniciar MFA: ${error.message} | `src/hooks/useMFA.ts` |
| Factor ID não encontrado | `src/hooks/useMFA.ts` |
| Nenhum fator MFA verificado | `src/hooks/useMFA.ts` |
| User not authenticated | `src/hooks/useMapSettings.ts` |
| Rota precisa de pelo menos 2 coordenadas | `src/hooks/useMapbox.ts` |
| Erro ao aprovar:  | `src/hooks/usePasswordResetActions.ts` |
| Erro ao rejeitar:  | `src/hooks/usePasswordResetActions.ts` |
| Esta solicitação expirou e não pode mais ser aprovada. | `src/hooks/usePasswordResetActions.ts` |
| Esta solicitação já foi revisada. | `src/hooks/usePasswordResetActions.ts` |
| Erro ao atribuir role: ${error.message} | `src/hooks/usePermissions.ts` |
| Erro ao revogar role: ${error.message} | `src/hooks/usePermissions.ts` |
| ) {         window.location.href =  | `src/hooks/usePushNotifications.ts` |
| ,         ...data,       },     });   }, []);    return {     isSupported,     permission,     settings,     isEnabled: settings.enabled && permission ===  | `src/hooks/usePushNotifications.ts` |
| ,         priority: config.priority,         severity,         notificationType:  | `src/hooks/usePushNotifications.ts` |
| Erro ao bloquear IP: ${error.message} | `src/hooks/useRateLimiting.ts` |
| Erro ao desbloquear IP: ${error.message} | `src/hooks/useRateLimiting.ts` |
| Erro: ${error.message} | `src/hooks/useRateLimiting.ts` |
| ${icon} ${alert.title} | `src/hooks/useRealtimeSubscriptions.ts` |
| );           const pushSettings = getPushSettings();           const hasPermission = getNotificationPermission() ===  | `src/hooks/useRealtimeSubscriptions.ts` |
| ,                   alertId: alert.id,                   priority: alert.severity ===  | `src/hooks/useRealtimeSubscriptions.ts` |
| ,                 },               });             }           }            queryClient.invalidateQueries({ queryKey: [ | `src/hooks/useRealtimeSubscriptions.ts` |
| ⚠️ Nova Aprovação: ${driverName} | `src/hooks/useRealtimeSubscriptions.ts` |
| 🚨 Aprovação Urgente: ${driverName} | `src/hooks/useRealtimeSubscriptions.ts` |
| Erro: ${error.message} | `src/hooks/useRole.ts` |
| Erro ao solicitar permissão de notificação | `src/hooks/useSecurityPushNotifications.ts` |
| Permissão de notificação negada. Ative nas configurações do navegador. | `src/hooks/useSecurityPushNotifications.ts` |
| Seu navegador não suporta notificações push | `src/hooks/useSecurityPushNotifications.ts` |
| Sem conexão | `src/hooks/useServiceWorker.ts` |
| ,   HIGH:  | `src/hooks/useSoundSettings.ts` |
| ,   URGENT:  | `src/hooks/useSoundSettings.ts` |
| , label:  | `src/hooks/useSoundSettings.ts` |
| Erro ao testar notificação | `src/hooks/useTestNotification.ts` |
| Teste executado | `src/hooks/useTestNotification.ts` |
| Erro: ${error.message} | `src/hooks/useUserDevices.ts` |
| Autenticação cancelada pelo usuário | `src/hooks/useWebAuthn.ts` |
| Erro ao registrar passkey: ${error.message} | `src/hooks/useWebAuthn.ts` |
| Erro ao remover passkey: ${error.message} | `src/hooks/useWebAuthn.ts` |
| Erro ao renomear: ${error.message} | `src/hooks/useWebAuthn.ts` |
| Erro na autenticação: ${error.message} | `src/hooks/useWebAuthn.ts` |
| Este dispositivo já está registrado | `src/hooks/useWebAuthn.ts` |
| Falha ao criar credencial | `src/hooks/useWebAuthn.ts` |
| Falha ao obter chave pública | `src/hooks/useWebAuthn.ts` |
| Falha na autenticação | `src/hooks/useWebAuthn.ts` |
| Passkey não encontrada | `src/hooks/useWebAuthn.ts` |
| Registro cancelado pelo usuário | `src/hooks/useWebAuthn.ts` |
| Usuário não autenticado | `src/hooks/useWebAuthn.ts` |
| WebAuthn não é suportado neste navegador | `src/hooks/useWebAuthn.ts` |
| CEP incompleto na base pública | `src/lib/cep.ts` |
| CEP não encontrado | `src/lib/cep.ts` |
| Falha ao consultar CEP (${res.status}) | `src/lib/cep.ts` |
| Tempo esgotado ao consultar CEP | `src/lib/cep.ts` |
| Resposta vazia do gateway Lalamove | `src/lib/lalamove-api.ts` |
| Erro ao gerar PDF | `src/pages/AdminTelemetriaPage.tsx` |
| Erro ao limpar dados antigos | `src/pages/AdminTelemetriaPage.tsx` |
| Nenhum dado para exportar | `src/pages/AdminTelemetriaPage.tsx` |
| Telemetry fetch failed: ${res.status} | `src/pages/AdminTelemetriaPage.tsx` |
| Conta bloqueada por ${formatRemainingTime(lockResult.remainingSeconds)} após ${lockResult.attemptCount} tentativas falhadas. | `src/pages/AuthPage.tsx` |
| Conta temporariamente bloqueada. Tente novamente em ${formatRemainingTime(status.remainingSeconds)}. | `src/pages/AuthPage.tsx` |
| Email ou senha incorretos. | `src/pages/AuthPage.tsx` |
| Email ou senha incorretos. ${attemptsLeft} tentativa${attemptsLeft !== 1 ?  | `src/pages/AuthPage.tsx` |
| Erro ao criar conta:  | `src/pages/AuthPage.tsx` |
| Erro ao entrar com Google:  | `src/pages/AuthPage.tsx` |
| Erro ao fazer login:  | `src/pages/AuthPage.tsx` |
| Esta senha foi exposta em vazamentos. Escolha outra senha. | `src/pages/AuthPage.tsx` |
| Este email já está cadastrado | `src/pages/AuthPage.tsx` |
| Erro ao processar fila | `src/pages/Bitrix24Page.tsx` |
| ; import { Badge } from  | `src/pages/CacheStatusPage.tsx` |
| Falha ao atualizar | `src/pages/ContactsPage.tsx` |
| Falha ao remover | `src/pages/ContactsPage.tsx` |
| Erro ao enviar email de recuperação. Tente novamente. | `src/pages/ForgotPasswordPage.tsx` |
| Erro ao adicionar país:  | `src/pages/GeoBlockingPage.tsx` |
| Erro ao remover país:  | `src/pages/GeoBlockingPage.tsx` |
| Erro: ${error.message} | `src/pages/IPWhitelistPage.tsx` |
| Erro ao deletar job | `src/pages/JobQueuePage.tsx` |
| Erro ao fazer retry do job | `src/pages/JobQueuePage.tsx` |
| Erro ao processar fila | `src/pages/JobQueuePage.tsx` |
| API Key e Secret são obrigatórios | `src/pages/LalamoveSettingsPage.tsx` |
| Credenciais inválidas. | `src/pages/LalamoveSettingsPage.tsx` |
| Erro ao atualizar credenciais V3 | `src/pages/LalamoveSettingsPage.tsx` |
| Erro ao atualizar token | `src/pages/LalamoveSettingsPage.tsx` |
| Erro ao renovar token | `src/pages/LalamoveSettingsPage.tsx` |
| Não foi possível renovar. Cole um novo token manualmente. | `src/pages/LalamoveSettingsPage.tsx` |
| Token inválido ou expirado. | `src/pages/LalamoveSettingsPage.tsx` |
| Token não pode ser vazio | `src/pages/LalamoveSettingsPage.tsx` |
| ${providerLabel(provider)}: ${result.message} | `src/pages/MapsSettingsPage.tsx` |
| Falha ao salvar teto: ${(err as Error).message} | `src/pages/MapsSettingsPage.tsx` |
| Falha ao trocar provedor: ${(err as Error).message} | `src/pages/MapsSettingsPage.tsx` |
| Falha no teste: ${(err as Error).message} | `src/pages/MapsSettingsPage.tsx` |
| Erro ao salvar: ${error instanceof Error ? error.message :  | `src/pages/PermissionsPage.tsx` |
| Erro ao atualizar nome: ${error.message} | `src/pages/ProfilePage.tsx` |
| O nome não pode estar vazio | `src/pages/ProfilePage.tsx` |
| Erro ao alterar senha. Tente novamente. | `src/pages/ResetPasswordPage.tsx` |
| Falha ao atualizar regra | `src/pages/RiskRulesPage.tsx` |
| Falha ao remover regra | `src/pages/RiskRulesPage.tsx` |
| Falha ao salvar regra | `src/pages/RiskRulesPage.tsx` |
| Nome é obrigatório | `src/pages/RiskRulesPage.tsx` |
| Erro ao atualizar token | `src/pages/UAPISettingsPage.tsx` |
| Token inválido ou expirado. Tente novamente. | `src/pages/UAPISettingsPage.tsx` |
| Token não pode ser vazio | `src/pages/UAPISettingsPage.tsx` |
| Falha ao marcar webhook | `src/pages/WebhooksPage.tsx` |
| … +90 linhas — lista completa em `context.json` | |

## J. Controle de acesso no código (checagens de perfil/permissão)

| Valor comparado | Arquivo |
|---|---|
| `assistant` | `src/components/dashboard/AIRouteChatbot.tsx` |
| `user` | `src/components/dashboard/AIRouteChatbot.tsx` |
| `granted` | `src/components/notifications/NotificationPreferences.tsx` |
| `denied` | `src/components/notifications/PushNotificationSettings.tsx` |
| `option` | `src/components/ui/accessible-card.tsx` |
| `role` | `src/hooks/useContextualHints.ts` |
| `admin` | `src/hooks/usePermissions.ts` |
| `manager` | `src/hooks/usePermissions.ts` |
| `permissionName` | `src/hooks/usePermissions.ts` |
| `role` | `src/hooks/usePermissions.ts` |
| `granted` | `src/hooks/usePushNotifications.ts` |
| `role` | `src/hooks/useRole.ts` |
| `granted` | `src/hooks/useSecurityPushNotifications.ts` |
| `admin` | `src/pages/PermissionsPage.tsx` |
| `manager` | `src/pages/PermissionsPage.tsx` |
| `operator` | `src/pages/PermissionsPage.tsx` |
| `permission` | `src/pages/PermissionsPage.tsx` |
| `role` | `src/pages/PermissionsPage.tsx` |
| `admin` | `src/pages/ProfilePage.tsx` |
| `selectedRole` | `src/pages/RolesPage.tsx` |
| `granted` | `src/pages/UserPreferencesPage.tsx` |
| `admin` | `supabase/functions/lalamove-uapi/index.ts` |
| `true` | `supabase/functions/mcp-query/index.ts` |
| `service_role` | `supabase/functions/send-notification/index.ts` |
| `service_role` | `supabase/functions/simulate-driver-movement/index.ts` |
| `admin` | `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql` |

## K. Testes como especificação (908 testes em 77 arquivos — nomes completos em `context.json`)

| Arquivo | Testes | Exemplos do que o sistema DEVE fazer |
|---|---|---|
| `scripts/db-audit/check-migration-drift.test.mjs` | 76 | aceita migration com nome e SQL equivalentes no ledger · aceita registro legado sem name/statements, sem inventar evidencia · fixa arquivo legado por hash sem chamar seus bytes de conteudo historico · name-and-file-pinned falha para arquivo/nome alterado ou SQL recuperado no ledger … |
| `src/__tests__/improvements-validation.test.tsx` | 48 | App QueryClient Stability · getQueryClient pattern ensures singleton behavior · Sidebar Role Filtering Logic · admin can access all items … |
| `src/types/__tests__/types.test.ts` | 29 | Type Contracts - Order · deve aceitar todas as propriedades obrigatórias · deve aceitar propriedades opcionais · deve validar todos os OrderStatus … |
| `supabase/functions/_shared/contract.test.ts` | 27 | formato único de erro: estrutura consistente · [${name}] payload válido é aceito (v1) · [${name}] campo ausente retorna 422 no formato único · [evaluate-driver] tipo incorreto (rating string) retorna 422 … |
| `src/lib/__tests__/lalamoveOrderEdit.test.ts` | 24 | normalizeOrderStatus · mapeia aliases legados para o enum canônico · devolve null para valores desconhecidos · isTerminalStatus … |
| `supabase/functions/external-db-bridge/index.test.ts` | 24 | classifySeverity: error takes priority · classifySeverity: very_slow threshold at 8000ms · classifySeverity: slow threshold at 3000ms · classifySeverity: normal for fast queries … |
| `src/components/admin/telemetry/__tests__/AdminTelemetriaPage.test.tsx` | 23 | AdminTelemetriaPage · renders page header · renders stat cards · renders filter controls … |
| `src/utils/__tests__/exportUtils.test.ts` | 23 | exportToCSV · não deve fazer nada com array vazio · deve gerar CSV com headers corretos · deve escapar valores com vírgula … |
| `src/utils/__tests__/timeUtils.test.ts` | 20 | getElapsedTime · deve calcular segundos corretamente · deve calcular minutos corretamente · deve calcular horas corretamente … |
| `src/components/admin/telemetry/__tests__/TelemetryCharts.test.tsx` | 18 | TelemetryCharts · renders nothing when rows are empty · renders charts when rows have data · groups by table correctly … |
| `src/lib/lalamoveValidation.test.ts` | 18 | validateScheduleAt · aceita string vazia como imediato · rejeita data inválida · rejeita %s minutos à frente (< 30) … |
| `src/lib/__tests__/lalamoveCanonical.test.ts` | 18 | lalamoveCatalog · cobre os 14 serviceTypes oficiais · valida type guards · respeita disponibilidade por cidade … |
| `src/components/map/__tests__/markerFactories.test.ts` | 17 | markerFactories · createClusterMarkerElement · escala tamanho logaritmicamente e usa cor crítica quando há criticos · renderiza badges por tipo de veículo ordenados por volume … |
| `supabase/functions/lalamove-webhook/security.test.ts` | 17 | [HMAC] FAIL-CLOSED: secret ausente rejeita mesmo com assinatura válida presente · [HMAC] assinatura correta é aceita · [HMAC] assinatura incorreta é rejeitada · [HMAC] prefixo sha256= e caixa alta são normalizados … |
| `scripts/db-audit/register-migration.test.mjs` | 16 | splitStatements respects dollar-quoted function bodies (does not split on internal semicolons) · splitStatements strips line comments but preserves them inside dollar-quoted bodies · buildInsertSql picks a dollar-quote tag that does not collide with the statement body · parseMigrationFile rejects a filename that does not match the version_name.sql convention … |
| `src/lib/__tests__/lalamoveCatalogCities.test.ts` | 16 | matriz servico x cidade (conferida com a API real) · Curitiba oferece exatamente os 6 servicos que a API lista · Sao Paulo oferece os 14 servicos · LALAGOFOUR existe so em RIO e SAO (nao em BHZ/CWB) … |
| `scripts/db-audit/check-grants-fresh.test.mjs` | 15 | aceita baselines identicas · ignora mudanca so em metadados (generated_at/note/how_to_regenerate) · falha quando um grant novo aparece no banco (anon_execute) · falha quando um grant e removido do banco (anon_table_select) … |
| `scripts/db-audit/check-manifest-fresh.test.mjs` | 15 | aceita manifesto identico apesar da ordem e do generated_at · detecta objeto novo na secao  · detecta alteracao de default pelo hash · detecta constraint removida do banco … |
| `src/hooks/__tests__/useContractVersionUsage.trend.test.ts` | 15 | detectTrend — alerta de reversão de uso v1 · marca amostra insuficiente com menos de 4 pontos válidos · não alerta quando a proporção está descendo · não alerta quando a proporção é estável em zero … |
| `src/lib/utils.test.ts` | 15 | deve combinar classes simples · deve lidar com valores undefined · deve lidar com valores null · deve lidar com condicionais … |
| `supabase/functions/geo-gateway/resolver.test.ts` | 15 | primário configurado é escolhido; Google sem chave cai para fallback Mapbox · orçamento estourado: fallback usável assume; sem fallback → 429 · off → 503 com mensagem clara; validate só existe no Google · auto: escolhe quem tem cota grátis; empate → mapbox; sem cota → o primeiro usável … |
| `src/lib/__tests__/lalamoveTimeline.test.ts` | 14 | normalizeOrderStatus · mapeia aliases legados e UAPI · retorna null para valores inválidos · buildOrderTimeline … |
| `scripts/db-audit/check-realtime-subscriptions.test.mjs` | 13 | extracts direct channel and shared-hook subscriptions from TypeScript · fails closed for dynamic schemas and object spreads · resolves const event aliases and bracket/bound on calls · resolves imported wrapper aliases and namespaces … |
| `scripts/db-audit/database-identity.test.mjs` | 13 | fingerprint versionado corresponde ao projeto oficial documentado · extrai project-ref do host direto sem depender de senha · extrai project-ref do usuario do pooler · rejeita host parecido que nao e Supabase Cloud … |
| `src/lib/__tests__/lalamoveReasons.test.ts` | 13 | motivos canônicos Lalamove · todo motivo tem rótulo PT-BR (nenhum fallback para o código) · não há códigos duplicados dentro de cada lista · as opções de UI espelham exatamente o contrato … |
| `supabase/functions/geo-gateway/mapbox.test.ts` | 13 | autocomplete: Search Box suggest normalizado, sessão exigida, units=0 (sessão conta no gateway) · placeDetails: retrieve → endereço com componentes, precisão exact, routable_point, não retível · geocode: temporário vs permanent decide sku e retainable; structured input vira parâmetros v6 · route: Directions driving-traffic, polyline6 decodificada, legs … |
| `supabase/functions/lalamove-gateway/route.test.ts` | 12 | nenhuma ação do cliente cai em 400 por ser desconhecida · uapi.getOrders ( · uapi.call ( · uapi.updateToken ( … |
| `scripts/db-audit/psql-environment.test.mjs` | 11 | separates URI parameters, preserves TLS and hides credentials in private temporary passfile · cleans the exact temporary password file on child failure · IPv6, escaped usernames/databases and empty password preserve libpq semantics · rejects URI overrides/ambiguous options: ${query.split( … |
| `src/lib/geo-gateway.test.ts` | 11 | countMapLoad · chama geo-gateway com a action count-map-load e o provider informado · nunca lança quando invoke retorna error (telemetria best-effort) · nunca lança quando invoke rejeita (ex.: rede fora) … |
| `scripts/db-audit/seguranca-processo.test.mjs` | 10 | resolverExecutavel devolve caminho absoluto existente igual ao do shell · resolverExecutavel lanca para comando inexistente · estaDentro aceita a raiz e subpastas · estaDentro recusa  … |
| `scripts/lib/seguranca-processo.test.mjs` | 10 | resolverExecutavel devolve caminho absoluto existente igual ao do shell · resolverExecutavel lanca para comando inexistente · estaDentro aceita a raiz e subpastas · estaDentro recusa  … |
| `src/components/map/__tests__/mapLayers.test.ts` | 10 | setupMapLayers · adiciona sources e layers de zonas de risco, heatmap e geofence · adiciona a camada de tráfego somente quando showTraffic=true · é idempotente: não recria sources já existentes … |
| `src/hooks/__tests__/useRegionResolver.test.ts` | 10 | coordKey · arredonda para 3 casas decimais (~110m) · agrupa coordenadas muito próximas na mesma chave · gera chaves distintas para pontos distantes … |
| `scripts/db-audit/check-screen-permission-db-guards.test.mjs` | 9 | cruza permissao e papel da tela com a trava no banco e marca TRAVADA / SEM TRAVA · ignora papel ARIA, papel de mensagem e permissao que so aparece em teste da tela · declara o vocabulario de papeis lido do enum app_role · resume a contagem e lista a trava do banco que a tela ainda nao usa … |
| `src/components/map/__tests__/MapSettingsPanel.test.tsx` | 9 | MapSettingsPanel Integration · renders correctly when shown · updates sliders correctly · handles save action with loading state … |
| `src/hooks/useGeoSearch.test.tsx` | 9 | useAddressSearchBox · busca sugestÃµes com action autocomplete e session_token · isError fica true quando a busca de sugestÃµes falha (ex.: 429) · retrieve manda o mesmo session_token do autocomplete e depois renova para a prÃ³xima sessÃ£o … |
| `src/hooks/__tests__/useActiveAlerts.test.ts` | 9 | useActiveAlerts · deve buscar alertas ativos corretamente · deve mapear null order_id/driver_id para undefined · deve lidar com is_read null defaulting para false … |
| `src/hooks/__tests__/useGeo.test.ts` | 9 | useGeo · geocode converte GeoAddress[] em features no formato v5 (picker e autocomplete) · geocode 404 vira lista vazia (estado vazio da UI, não erro) · directions monta origin/destination/waypoints e preserva perfil explícito … |
| `src/hooks/__tests__/useMapSettings.test.ts` | 9 | useMapSettings Persistence · should load default values initially · should update state when setters are called · should load settings from supabase for a specific context (driver/delivery) … |
| `src/hooks/__tests__/usePendingApprovals.test.ts` | 9 | usePendingApprovals · deve buscar e mapear aprovações pendentes · deve lidar com driver e order null · deve propagar erro do supabase … |
| `src/hooks/__tests__/useRecentOrders.test.ts` | 9 | useRecentOrders · deve buscar e mapear pedidos corretamente · deve calcular paginação corretamente · deve lidar com driver null … |
| `src/hooks/__tests__/useWebhookEvents.test.ts` | 9 | useWebhookEvents · deve buscar eventos sem filtros · deve retornar lista vazia · deve propagar erro … |
| `src/lib/orderErrors.test.ts` | 9 | parseOrderError · identifica telefone do remetente (guard server) · identifica telefone do destinatário e captura o índice · mapeia INVALID_PHONE_NUMBER da API Lalamove … |
| `src/lib/__tests__/lalamoveContract.test.ts` | 9 | contrato Lalamove — fixtures reais · parseia a resposta de cotação preservando o TTL de 5 minutos · trata driverId vazio na criação como  · normaliza o status do webhook para o enum canônico … |
| `src/components/map/hooks/__tests__/useMapMarkers.test.ts` | 8 | useMapMarkers · cria um marker por veículo quando o mapa está vivo · não cria markers enquanto o loading do mapa é true · não toca em mapa destruído (regressão do appendChild no StrictMode) … |
| `src/hooks/__tests__/useDeliveryMetrics.test.ts` | 8 | useDeliveryMetrics · deve calcular métricas de entrega corretamente · deve retornar zeros sem dados · deve propagar erro do supabase … |
| `src/hooks/__tests__/useLoginLockout.test.ts` | 8 | useLoginLockout · deve mapear checkLockout corretamente · deve retornar fallback no erro de checkLockout · deve mapear recordFailedAttempt corretamente … |
| `src/lib/phone.test.ts` | 8 | validateBrazilianPhone — casos válidos · aceita %s (nacional cru) · aceita 55 sem + como código do país · validateBrazilianPhone — rejeições … |
| `scripts/db-audit/catalog-from-types.test.mjs` | 7 | catalogoDeTypes le tabelas, views, funcoes e enums do schema public · catalogoDeTypes para no export const Constants (nao reabre Enums) · catalogoDeTypes ignora campos internos (Row/Args/Returns) como objetos · catalogoDeTypes devolve a forma esperada pelo supabase-usage-guard … |
| `scripts/db-audit/psql-safe.test.mjs` | 7 | forwards flags/args to psql without the connection string in argv · propagates psql stdin (heredoc), stdout and stderr, and its exit code · propagates a non-zero psql exit code unchanged · derives PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSFILE from DESTINO_URL and never leaks DESTINO_URL to the child … |
| `src/components/map/hooks/__tests__/useTrackingData.test.ts` | 7 | useTrackingData · faz o fetch inicial e popula trackingData/allTrackingData · filtra por tipo de veículo · filtra por status STOPPED … |
| `src/hooks/__tests__/useContractVersionUsageMonthly.test.ts` | 7 | aggregateMonthly — consolidação da série mensal de versões · retorna vazio para entrada vazia · soma múltiplos contratos por mês e versão · ordena os meses cronologicamente (ascendente) … |
| `src/hooks/__tests__/useRiskRules.test.ts` | 7 | useRiskRules · deve buscar e mapear regras de risco · deve retornar lista vazia sem regras · deve propagar erro … |
| `src/components/map/hooks/__tests__/useGoogleMapsLoader.test.ts` | 6 | useGoogleMapsLoader · reporta não configurado quando falta a chave do conector · respeita a chave injetada via env do conector · resolve imediatamente quando window.google já existe … |
| `src/components/map/hooks/__tests__/useMapboxToken.test.ts` | 6 | useMapboxToken · retorna o token quando a edge function responde com sucesso · falha silenciosamente (mapbox é opcional) quando a edge function retorna erro · define erro específico quando o token está ausente na resposta … |
| `src/hooks/__tests__/useGeoAdmin.latency.test.ts` | 6 | aggregateGeoLatency (etapa 80) · agrupa por provedor e função e calcula p50/p95 · separa provedores e funções diferentes · descarta linhas sem duração e operações que não são do geo-gateway … |
| `src/hooks/__tests__/usePermissions.test.ts` | 6 | usePermissions · deve carregar roles e permissões do usuário · deve retornar false para permissões inexistentes · deve suportar usuário não autenticado sem quebrar … |
| `src/hooks/__tests__/useTrackingHistory.test.ts` | 6 | useTrackingHistory · deve buscar histórico de tracking · deve lidar com erro graciosamente · deve limpar histórico … |
| `src/lib/__tests__/filterValidSpecialRequests.test.ts` | 6 | filterValidSpecialRequests · remove special request restrito a outra cidade quando o serviço continua válido na nova praça · mantém o special request quando a cidade nova ainda está na lista de restrição · mantém special requests sem restrição de cidade … |
| `supabase/functions/_shared/contract.integration.test.ts` | 6 | [I/O][${c.fn}] campo ausente → 422 formato único · [I/O][${c.fn}] tipo incorreto → 422 no campo ${c.wrongTypeField} · [I/O][${c.fn}] compat: v1 e v2 rejeitam o inválido identicamente · [I/O][${c.fn}] compat: payload v1 válido é aceito sob header v2 (não-422) … |
| `supabase/functions/geo-gateway/failover.test.ts` | 6 | primário OK: nenhum fallback é consultado e o provedor é o primário · primário 5xx → fallback responde em UMA chamada e o header aponta o fallback · primário 5xx sem alternativo usável → erro ORIGINAL sobe · entrada inválida NÃO troca de provedor (a falha se repetiria no outro) … |
| `supabase/functions/lalamove-api/coordinates.test.ts` | 6 | stopsCoords converte as coordenadas string da Lalamove em numero · stopsCoords preserva a ordem das paradas (indice = stop_index) · stopsCoords anula 0,0 — placeholder que a Lalamove rejeita · stopsCoords anula coordenada invalida em vez de gravar NaN … |
| `src/components/map/hooks/__tests__/useMapAlerts.test.ts` | 5 | useMapAlerts · detecta fora de rota via is_on_route=false · registra timestamp de parada e o preserva enquanto continua parado · calcula tendência de ETA (improving / worsening / stable) … |
| `src/hooks/__tests__/useSLAMetrics.test.ts` | 5 | useSLAMetrics · deve calcular métricas SLA com pedidos completos · deve retornar onTimeRate 100 sem pedidos completos · deve simular 200 pedidos para stress test de statusBreakdown … |
| `src/lib/__tests__/statusPalette.test.ts` | 5 | statusColorCss · emite hsl legado com vírgulas para o Mapbox · não emite var() — o Mapbox não resolve variáveis CSS · aplica alfa com hsla … |
| `src/lib/__tests__/uapiErrors.test.ts` | 5 | uapiErrors · traduz os códigos da família de cupons (qp) · marca 10007 e 10001 como falhas críticas de autenticação · faz fallback seguro para códigos desconhecidos … |
| `src/components/map/__tests__/OrderTrackingMap.test.tsx` | 4 | OrderTrackingMap (etapa 58) · mostra aviso quando o token do Mapbox não está disponível · expõe a região com rótulo acessível quando há token · não quebra sem coordenadas nem rota |
| `src/hooks/__tests__/useDashboardStats.test.ts` | 4 | useDashboardStats · deve retornar stats padrão quando supabase retorna zeros · deve calcular onTimeRate corretamente com dados de entrega · deve consultar 7 queries do supabase |
| `src/hooks/__tests__/useFeatureFlags.test.ts` | 4 | useFeatureFlag · expõe isEnabled=true quando a flag existe e está habilitada · expõe isEnabled=false quando a flag existe mas está desligada · cai para false quando a flag não existe (kill-switch seguro) |
| `src/hooks/__tests__/useIncidents.test.ts` | 4 | useIncidents · deve buscar e mapear incidentes corretamente · deve lidar com erro na busca · deve retornar lista vazia quando sem dados |
| `src/hooks/__tests__/useMapProviderPolicy.test.ts` | 4 | allowedProvidersFor · libera tudo quando a política é off (fail-open) · restrito a mapbox mantém raster gratuito e tira Google · restrito a google mantém raster gratuito e tira Mapbox |
| `src/hooks/__tests__/useRateLimiting.test.ts` | 4 | useRateLimiting · deve calcular estatísticas básicas corretamente · deve simular stress com 780 cenários agregados sem quebrar · deve executar blockIP com sucesso |
| `scripts/db-audit/diff.test.mjs` | 3 | aceita estruturas identicas de bancos com identidades diferentes · retorna 1 e identifica objeto divergente · retorna 2 para manifesto invalido |
| `src/components/map/hooks/__tests__/parseExpectedRoute.test.ts` | 3 | parseExpectedRoute · aceita array de {lat,lng} com 2+ pontos · devolve null para valores que não são polyline válida |
| `src/hooks/__tests__/useCronJobsHealth.test.ts` | 3 | useCronJobsHealth · deve retornar a saúde dos jobs de cron · deve propagar erro quando a RPC falha (ex.: sem permissão de admin) |
| `src/hooks/__tests__/useDrivers.test.ts` | 3 | useDrivers · deve buscar e mapear motoristas corretamente · deve lidar com erro do supabase |
| `supabase/functions/geo-gateway/polyline.test.ts` | 3 | polyline: exemplo oficial do Google (precisão 5) · polyline6: ida e volta preserva 6 casas · simplify: remove pontos colineares, mantém extremos e curvas |

## L. Eventos de webhook tratados (contratos com sistemas externos)

| Evento | Arquivo |
|---|---|
| `dismiss` | `public/sw.js` |
| `string` | `supabase/functions/lalamove-gateway/index.ts` |

## M. Efeitos colaterais (e-mail, SMS, cobrança, fila — não são idempotentes por padrão)

| Chamada | Arquivo |
|---|---|
| `invoke(` | `src/components/dashboard/AIRouteChatbot.tsx` |
| `sendWhatsApp` | `src/components/map/MapHUD.tsx` |
| `.add('deviated-marker'` | `src/components/map/hooks/useMapMarkers.ts` |
| `invoke(` | `src/components/map/hooks/useMapboxToken.ts` |
| `invoke(` | `src/components/orders/FetchOrderDialog.tsx` |
| `invoke(` | `src/components/orders/ImportCSVDialog.tsx` |
| `invoke(` | `src/components/orders/NewOrderDialog.tsx` |
| `invoke(` | `src/components/orders/OrderDetailModal.tsx` |
| `invoke(` | `src/hooks/healthChecks.ts` |
| `.add('keyboard-user'` | `src/hooks/useAccessibility.tsx` |
| `.add('mouse-user'` | `src/hooks/useAccessibility.tsx` |
| `notifying` | `src/hooks/useActiveAlerts.ts` |
| `notify_bitrix24_task` | `src/hooks/useAlertConfigurations.ts` |
| `notify_email` | `src/hooks/useAlertConfigurations.ts` |
| `notify_n8n_webhook` | `src/hooks/useAlertConfigurations.ts` |
| `notify_slack` | `src/hooks/useAlertConfigurations.ts` |
| `notify_whatsapp` | `src/hooks/useAlertConfigurations.ts` |
| `invoke(` | `src/hooks/useBitrix24.ts` |
| `invoke(` | `src/hooks/useDeviceDetection.ts` |
| `invoke(` | `src/hooks/useEvaluateDriver.ts` |
| `invoke(` | `src/hooks/useExternalData.ts` |
| `invoke(` | `src/hooks/useGeoAdmin.ts` |
| `invoke(` | `src/hooks/useGeoSearch.ts` |
| `invoke(` | `src/hooks/useLalamoveUapi.ts` |
| `notify` | `src/hooks/useOfflineStorage.ts` |
| `invoke(` | `src/hooks/useRegionResolver.ts` |
| `.add('dark'` | `src/hooks/useScheduledTheme.ts` |
| `.add('theme-transition'` | `src/hooks/useScheduledTheme.ts` |
| `invoke(` | `src/hooks/useSystemHealth.ts` |
| `invoke(` | `src/hooks/useTestNotification.ts` |
| `.add('dark'` | `src/hooks/useTheme.ts` |
| `.add('theme-transition'` | `src/hooks/useTheme.ts` |
| `notify_bitrix24_task` | `src/integrations/supabase/types.ts` |
| `notify_delivery_contact` | `src/integrations/supabase/types.ts` |
| `notify_email` | `src/integrations/supabase/types.ts` |
| `notify_n8n_webhook` | `src/integrations/supabase/types.ts` |
| `notify_slack` | `src/integrations/supabase/types.ts` |
| `notify_sms` | `src/integrations/supabase/types.ts` |
| `notify_whatsapp` | `src/integrations/supabase/types.ts` |
| `invoke(` | `src/lib/geo-gateway.ts` |
| `invoke(` | `src/lib/lalamove-api.ts` |
| `notify_bitrix24_task` | `src/pages/AlertConfigurationsPage.tsx` |
| `notify_email` | `src/pages/AlertConfigurationsPage.tsx` |
| `notify_n8n_webhook` | `src/pages/AlertConfigurationsPage.tsx` |
| `notify_slack` | `src/pages/AlertConfigurationsPage.tsx` |
| `notify_whatsapp` | `src/pages/AlertConfigurationsPage.tsx` |
| `invoke(` | `src/pages/Bitrix24Page.tsx` |
| `invoke(` | `src/pages/LiveMapPage.tsx` |
| `notify_bitrix24_task` | `src/pages/alert-configurations/AlertConfigCard.tsx` |
| `notify_email` | `src/pages/alert-configurations/AlertConfigCard.tsx` |
| `notify_n8n_webhook` | `src/pages/alert-configurations/AlertConfigCard.tsx` |
| `notify_slack` | `src/pages/alert-configurations/AlertConfigCard.tsx` |
| `notify_whatsapp` | `src/pages/alert-configurations/AlertConfigCard.tsx` |
| `sendNotification` | `supabase/functions/_shared/schemas.ts` |
| `invoke(` | `supabase/functions/check-driver-alerts/index.ts` |
| `notify` | `supabase/functions/check-driver-alerts/index.ts` |
| `notifying` | `supabase/functions/check-driver-alerts/index.ts` |
| `invoke(` | `supabase/functions/escalate-alerts/index.ts` |
| `invoke(` | `supabase/functions/job-worker/index.ts` |
| `notify` | `supabase/functions/lalamove-webhook/index.ts` |
| `notifyError` | `supabase/functions/lalamove-webhook/index.ts` |
| `sendNotification` | `supabase/functions/lalamove-webhook/index.ts` |
| `resend.emails.send` | `supabase/functions/new-device-alert/index.ts` |
| `notifyFieldByChannel` | `supabase/functions/send-notification/index.ts` |
| `notify_bitrix24_task` | `supabase/functions/send-notification/index.ts` |
| `notify_email` | `supabase/functions/send-notification/index.ts` |
| `notify_n8n_webhook` | `supabase/functions/send-notification/index.ts` |
| `notify_slack` | `supabase/functions/send-notification/index.ts` |
| `notify_whatsapp` | `supabase/functions/send-notification/index.ts` |
| `notifying` | `supabase/functions/send-notification/index.ts` |
| `sendEmail` | `supabase/functions/send-notification/index.ts` |
| `sendWhatsApp` | `supabase/functions/send-notification/index.ts` |
| `notify_bitrix24_task` | `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql` |
| `notify_email` | `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql` |
| `notify_n8n_webhook` | `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql` |
| `notify_slack` | `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql` |
| `notify_sms` | `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql` |
| `notify_whatsapp` | `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql` |
| `notify_lalamove_quota_low` | `supabase/migrations/20260723132258_bb348d49-2f3a-458f-885a-327cabee5179.sql` |
| `notify_lalamove_quota_low` | `supabase/migrations/20260723132318_3ef097ec-4ee1-4dec-b0b1-56d2743719f5.sql` |
| `notify_webhook_security_event` | `supabase/migrations/20260723173506_f797adca-6a56-4477-b962-b1a865de6238.sql` |
| `notify_webhook_security_event` | `supabase/migrations/20260723173528_9eed08aa-a74f-46d2-a75e-c0ec25a4c3d7.sql` |
| `notify_bitrix24_task` | `supabase/migrations/20261121193000_fix_escalation_pipeline.sql` |
| `notify_email` | `supabase/migrations/20261121193000_fix_escalation_pipeline.sql` |
| `notify_n8n_webhook` | `supabase/migrations/20261121193000_fix_escalation_pipeline.sql` |
| `notify_slack` | `supabase/migrations/20261121193000_fix_escalation_pipeline.sql` |
| `notify_whatsapp` | `supabase/migrations/20261121193000_fix_escalation_pipeline.sql` |
| `notify_delivery_contact` | `supabase/migrations/20261122130100_geo_foundation.sql` |
| `notify_whatsapp` | `supabase/migrations/20261122130100_geo_foundation.sql` |
| `notify_whatsapp` | `supabase/migrations/20261122150000_fix_alert_configs_anon_insert.sql` |

## N. Regras citadas em comentários do código

| Comentário | Arquivo |
|---|---|
| failures that must never break the UI flow. | `eslint.config.js` |
| Background sync is best-effort; failures must not surface as console noise. | `public/sw.js` |
| * Gráfico de tendência de longo prazo (série mensal agregada) da proporção de | `src/components/admin/telemetry/ContractVersionMonthlyTrend.tsx` |
| Tendência de longo prazo (série mensal consolidada) */} | `src/components/admin/telemetry/ContractVersionUsagePanel.tsx` |
| Check permission | `src/components/auth/PermissionGate.tsx` |
| MFA required but not verified | `src/components/auth/ProtectedRoute.tsx` |
| Permission check | `src/components/auth/ProtectedRoute.tsx` |
| Enable audio on first user interaction (required by browsers) | `src/components/layout/AppLayout.tsx` |
| Densidade adaptativa: atualiza a banda de zoom apenas quando cruza o limiar, | `src/components/map/LiveMap.tsx` |
| Estatísticas: considera apenas leituras de velocidade válidas (não-nulas), | `src/components/map/MapHistoryPanel.tsx` |
| * Deve ser chamada dentro do handler `style.load` do Mapbox, pois camadas só | `src/components/map/mapLayers.ts` |
| Lista completa de veículos no tooltip (sem limite de 3). | `src/components/map/markerFactories.ts` |
| * Destroi todos os markers e limpa refs internas. Deve ser invocada no | `src/components/map/hooks/useMapMarkers.ts` |
| Auto-fit apenas quando não há seleção ativa. | `src/components/map/hooks/useMapMarkers.ts` |
| * Campo de CEP com máscara, validação e busca ViaCEP. Após localizar | `src/components/orders/CepQuickFill.tsx` |
| 24 * 60) return { valid: false as const, iso: '', error: 'Agendamento máximo: 30 dias' }; | `src/components/orders/NewOrderDialog.tsx` |
| Validação E.164 dos telefones (Lalamove v3 exige celular BR válido). | `src/components/orders/NewOrderDialog.tsx` |
| geocodificacao no formulario, enviamos apenas o endereco — a API | `src/components/orders/NewOrderDialog.tsx` |
| silencioso: não deve bloquear o fluxo do pedido */}); | `src/components/orders/NewOrderDialog.tsx` |
| Item Information (Lalamove v3) — apenas serviços que aceitam `item` */} | `src/components/orders/NewOrderDialog.tsx` |
| 22c55e">No prazo</span>'; | `src/components/reports/GeoHeatmap.tsx` |
| * Custo mínimo (string vazia = sem filtro). */ | `src/hooks/useAdvancedReports.ts` |
| * Custo máximo (string vazia = sem filtro). */ | `src/hooks/useAdvancedReports.ts` |
| Falha na janela anterior não deve quebrar o relatório principal. | `src/hooks/useAdvancedReports.ts` |
| sem argumento refresca as 3 views; com argumento, apenas a informada. | `src/hooks/useCacheViews.ts` |
| @param limit - Quantidade de drivers (padrão: 10) | `src/hooks/useCachedStats.ts` |
| permissões — evitando orientar o usuário para ações que ele não pode executar. | `src/hooks/useContextualHints.ts` |
| SECURITY DEFINER). Centraliza a regra de negócio no banco e reduz o payload | `src/hooks/useContractV1SunsetReadiness.ts` |
| * `true` quando a proporção de `v1` já está no/abaixo do limite seguro. */ | `src/hooks/useContractV1SunsetReadiness.ts` |
| * Limite (p.p.) usado para decidir a remoção segura. */ | `src/hooks/useContractV1SunsetReadiness.ts` |
| * Tendência de longo prazo do uso de versões de contrato, lida da tabela | `src/hooks/useContractVersionUsageMonthly.ts` |
| - =term     : Exact match (items must include "term" exactly) | `src/hooks/useFuseSearch.ts` |
| - ^term     : Prefix match (items must start with "term") | `src/hooks/useFuseSearch.ts` |
| - term$     : Suffix match (items must end with "term") | `src/hooks/useFuseSearch.ts` |
| - !term     : Negation (items must NOT include "term") | `src/hooks/useFuseSearch.ts` |
| - 'term     : Include match (items must include "term") | `src/hooks/useFuseSearch.ts` |
| How close the match must be to the location | `src/hooks/useFuseSearch.ts` |
| * Geocoda um endereço fixo no provedor e devolve latência, SKU e rate limit. */ | `src/hooks/useGeoAdmin.ts` |
| retrieve (regra de cobrança por sessão do Search Box, ToS etapa 8). | `src/hooks/useGeoSearch.ts` |
| v2: além do lockout por e-mail, considera bloqueio/rate-limit por IP. | `src/hooks/useLoginLockout.ts` |
| v2: rate-limit progressivo + detecção de atividade suspeita por IP. | `src/hooks/useLoginLockout.ts` |
| Verificar se usuário tem uma permissão específica | `src/hooks/usePermissions.ts` |
| ").in("status", ["ON_GOING", "PICKED_UP", "MATCHED"]).limit(100), | `src/hooks/usePredictiveAnalysis.ts` |
| 24 * 60 * 60 * 1000).toISOString()).limit(50), | `src/hooks/usePredictiveAnalysis.ts` |
| Get current permission status | `src/hooks/usePushNotifications.ts` |
| Request notification permission | `src/hooks/usePushNotifications.ts` |
| Buscar logs de rate limit | `src/hooks/useRateLimiting.ts` |
| `permanent` (Geocoding v6) — resultado temporário não pode ser retido | `src/hooks/useRegionResolver.ts` |
| * Máximo de coordenadas novas resolvidas por execução (proteção de custo). */ | `src/hooks/useRegionResolver.ts` |
| * Máximo de chaves por consulta ao backend (evita URLs longas no filtro `in`). */ | `src/hooks/useRegionResolver.ts` |
| ignoreDuplicates: gravamos apenas inserts. Regiões são determinísticas | `src/hooks/useRegionResolver.ts` |
| Fetch all required data in parallel | `src/hooks/useSLAMetrics.ts` |
| Latência (apenas operações com duração medida) | `src/hooks/useSLOMetrics.ts` |
| Request notification permission | `src/hooks/useSecurityPushNotifications.ts` |
| - Validação de formato (8 dígitos, não sequencial) | `src/lib/cep.ts` |
| Silently fail - métrica de uso não pode travar o mapa | `src/lib/geo-gateway.ts` |
| cidade de coleta nao ofereca — ex.: Curitiba aceita apenas CAR, HATCHBACK, | `src/lib/lalamoveCatalog.ts` |
| * `true` somente quando há motorista real atribuído. */ | `src/lib/lalamoveGuards.ts` |
| * Decide se um evento de webhook deve ser aplicado. Webhooks podem chegar | `src/lib/lalamoveGuards.ts` |
| * Regra: os **códigos** vivem em `lalamoveCatalog.ts` / `types/lalamove.ts`. | `src/lib/lalamoveLabels.ts` |
| Este módulo contém apenas apresentação — nunca lógica de negócio. | `src/lib/lalamoveLabels.ts` |
| ação quando ela é legítima — o erro remoto vira apenas rede de segurança. | `src/lib/lalamoveOrderEdit.ts` |
| - `edit`: apenas após atribuição do motorista e antes da coleta. Durante | `src/lib/lalamoveOrderEdit.ts` |
| 24 * 60) return { valid: false, iso: '', error: 'Agendamento máximo: 30 dias' }; | `src/lib/lalamoveValidation.ts` |
| * Validação e normalização de telefones no padrão E.164 (Lalamove v3). | `src/lib/phone.ts` |
| - `phone` deve estar em E.164 (`+` seguido de 8–15 dígitos). | `src/lib/phone.ts` |
| Extrai apenas dígitos, preservando o + inicial se existir. | `src/lib/phone.ts` |
| Não altera o valor armazenado — apenas o texto visível ao usuário. | `src/lib/phone.ts` |
| * `statusColor()` devolve `hsl(var(--token))`, que apenas o CSS resolve; passar | `src/lib/statusPalette.ts` |
| * Garante que a informação de status NÃO dependa apenas da cor: cada nível | `src/lib/statusPalette.ts` |
| ── Rate limit ─────────────────────────────────────────────────────────── | `src/lib/uapiErrors.ts` |
| * `true` quando o erro indica falha de autenticação e deve gerar alerta. */ | `src/lib/uapiErrors.ts` |
| Se houver apenas uma palavra, retorna as 2 primeiras letras. | `src/lib/user-display.ts` |
| existiam apenas no backend: histórico por cursor, extrato/comprovantes, | `src/pages/LalamoveOperationsPage.tsx` |
| * Rótulo de negócio para cada função geo (a chave é o CHECK do banco). */ | `src/pages/MapsSettingsPage.tsx` |
| Action Required */} | `src/pages/evaluations/EvaluationDetails.tsx` |
| * Presente somente quando o cliente habilita POD. */ | `src/types/lalamove.ts` |
| * JSON pointer — presente apenas em `ERR_INVALID_FIELD`. */ | `src/types/lalamove.ts` |
| Resume audio context if suspended (required by browsers) | `src/utils/alertSounds.ts` |
| Check if user has interacted with the page (required for audio) | `src/utils/alertSounds.ts` |
| Contract Layer — Validação de schema + formato único de erro para todas as | `supabase/functions/_shared/contract.ts` |
| * Versão para a qual o integrador deve migrar. */ | `supabase/functions/_shared/contract.ts` |
| * Presente somente quando a versão usada está descontinuada. */ | `supabase/functions/_shared/contract.ts` |
| ── Resultado de validação (puro, testável) ────────────────────────────────── | `supabase/functions/_shared/contract.ts` |
| Falhas de validação usam SEMPRE status 422 e o formato único de erro. | `supabase/functions/_shared/contract.ts` |
| - Fire-and-forget: NUNCA deve quebrar ou atrasar o fluxo principal. | `supabase/functions/_shared/telemetry.ts` |
| Ambiente sem credenciais (ex.: testes): apenas log. | `supabase/functions/_shared/telemetry.ts` |
| If order is COMPLETED but no POD received after deadline | `supabase/functions/check-driver-alerts/index.ts` |
| Geocoda um endereço fixo e devolve latência, SKU e o saldo de rate limit do | `supabase/functions/check-external-api/index.ts` |
| ============= RULE EVALUATOR ============= | `supabase/functions/evaluate-driver/index.ts` |
| Add rule bonus to score | `supabase/functions/evaluate-driver/index.ts` |
| Add rule factors to reasons | `supabase/functions/evaluate-driver/index.ts` |
| timeout, credencial revogada, rate limit), a requisição morria em 502. Este módulo faz a segunda | `supabase/functions/geo-gateway/failover.ts` |
| * Vale tentar outro provedor? Falha do provedor (5xx), credencial, rate limit e rede/timeout sim. */ | `supabase/functions/geo-gateway/failover.ts` |
| * Função geo → chave de rate limit do Mapbox (`MAPBOX_RATE_LIMITS`). */ | `supabase/functions/geo-gateway/index.ts` |
| Rate limit por usuário (uid do JWT): autocomplete 60/min, demais 20/min — em memória por instância. | `supabase/functions/geo-gateway/index.ts` |
| Nunca lança: falha de alerta não pode derrubar a requisição de mapa. | `supabase/functions/geo-gateway/index.ts` |
| ── rate limit do provedor (espera a virada da janela) ───────────────── | `supabase/functions/geo-gateway/index.ts` |
| Etapa 76: se a janela de rate limit do provedor está cheia, aguarda a virada | `supabase/functions/geo-gateway/index.ts` |
| * TTL por (provider, função). 0 = não cacheia. Mapbox temporário não pode ser retido (termos) → 0. */ | `supabase/functions/geo-gateway/metering.ts` |
| Um lote maior que o limite do minuto nunca cabe: recusa sem gravar o bucket. | `supabase/functions/geo-gateway/resolver.ts` |
| (até `maxWaitMs`). Retorna `true` quando há folga; `false` se o limite continuar | `supabase/functions/geo-gateway/resolver.ts` |
| * HTTP com o token do provedor. `consume` diz quantos slots do rate limit esta chamada | `supabase/functions/geo-gateway/providers/mapbox.ts` |
| 1 slot de rate limit por consulta, não por requisição | `supabase/functions/geo-gateway/providers/mapbox.ts` |
| Provedor desligado / orçamento estourado / rate limit: não é falha do job. | `supabase/functions/job-worker/index.ts` |
| Mapbox Matrix recusa 1x1 (mínimo 2 elementos) — usar route com tráfego. | `supabase/functions/job-worker/index.ts` |
| Verificar autenticação (apenas service role ou autenticado) | `supabase/functions/job-worker/index.ts` |
| Conflito ausente na tabela não pode derrubar o pedido: o pedido já existe na Lalamove. | `supabase/functions/lalamove-api/coordinates.ts` |
| * Persist Lalamove rate-limit headers for proactive observability. | `supabase/functions/lalamove-api/index.ts` |
| Headers follow the IETF `ratelimits-*` family (limit / remaining / reset). | `supabase/functions/lalamove-api/index.ts` |
| BODY_JSON = "" for GET/DELETE (but \r\n\r\n must be present) | `supabase/functions/lalamove-api/index.ts` |
| Other 4xx are client errors and must not be retried (would just burn quota). | `supabase/functions/lalamove-api/index.ts` |
| Re-sign each attempt: timestamp must be fresh (Lalamove rejects stale HMAC). | `supabase/functions/lalamove-api/index.ts` |
| Extract rate limit headers | `supabase/functions/lalamove-api/index.ts` |
| Guarda server-side: mesmo com validação de UI, nunca confie no cliente. | `supabase/functions/lalamove-api/index.ts` |
| body ja passou pelo zod (z.record(z.any())); a validacao de forma | `supabase/functions/lalamove-api/index.ts` |
| Validação numérica: > 0, até 2 casas decimais, teto de segurança R$500. | `supabase/functions/lalamove-api/index.ts` |
| `ratelimits-limit-{endpoint}` / `-remaining-` / `-reset-` (Unix seconds). | `supabase/functions/lalamove-gateway/index.ts` |
| * Persistência best-effort da telemetria de rate limit. Nunca deve derrubar a | `supabase/functions/lalamove-gateway/index.ts` |
| requisição principal — falhas são apenas logadas. | `supabase/functions/lalamove-gateway/index.ts` |
| Best-effort: nunca deve derrubar a requisição principal. | `supabase/functions/lalamove-gateway/index.ts` |
| ── 2. Validação de entrada ──────────────────────────────────────────── | `supabase/functions/lalamove-gateway/index.ts` |
| ── 4. Chamada com deadline ──────────────────────────────────────────── | `supabase/functions/lalamove-gateway/index.ts` |
| ── 5. Telemetria de rate limit (Etapa 14) ───────────────────────────── | `supabase/functions/lalamove-gateway/index.ts` |
| * Ação conhecida mas que não pode ser atendida sem o proxy externo. */ | `supabase/functions/lalamove-gateway/route.ts` |
| Anti-WAF headers required for UAPI | `supabase/functions/lalamove-uapi/index.ts` |
| Rate limit respect | `supabase/functions/lalamove-uapi/index.ts` |
| HMAC validation. | `supabase/functions/lalamove-webhook/index.ts` |
| Atualiza lalamove_id somente se ainda estiver no ID antigo (evita sobrescrever migrações posteriores). | `supabase/functions/lalamove-webhook/index.ts` |
| ── HMAC Validation (FAIL-CLOSED) ── | `supabase/functions/lalamove-webhook/security.ts` |
| ── Lalamove v3 body-signature validation ── | `supabase/functions/lalamove-webhook/security.ts` |
| 3. NÃO existe SQL cru, NÃO existe leitura de tabelas de negócio e NÃO existe | `supabase/functions/mcp-query/index.ts` |
| `mcp_introspect`, que aceita apenas operações de uma allowlist fixa. | `supabase/functions/mcp-query/index.ts` |
| * Normaliza os parâmetros: apenas campos conhecidos, tipos coagidos e | `supabase/functions/mcp-query/index.ts` |
| ── 3. Validação de entrada ────────────────────────────────────────────── | `supabase/functions/mcp-query/index.ts` |
| Deve ser chamada periodicamente (ex: a cada hora via cron job externo) | `supabase/functions/rotate-tokens/index.ts` |
| verify_jwt=true so a valid JWT is required, but that includes ordinary | `supabase/functions/send-notification/index.ts` |
| lets the caller pick an arbitrary destination, so it must be restricted to | `supabase/functions/send-notification/index.ts` |
| INTO sync_record FROM bitrix24_sync WHERE order_id = NEW.id LIMIT 1; | `supabase/migrations/20251224183135_7bee6f7f-f6a0-4c50-8a8e-e08a57ff2b25.sql` |
| ) > 1 LIMIT 50) t; | `supabase/migrations/20260813124905_c5b09dca-c763-4783-a303-91433b536b1c.sql` |
| ) > 1 LIMIT 50) t; | `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql` |
