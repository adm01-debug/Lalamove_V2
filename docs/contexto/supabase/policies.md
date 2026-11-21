# Policies (RLS)


Visão consolidada (inclui `storage.objects` e `realtime.messages`); detalhes por tabela em `tables/`.

| tabela | policy | cmd | tipo | roles | USING | WITH CHECK |
|---|---|---|---|---|---|---|
| public.active_tracking | Admins can delete tracking | DELETE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.active_tracking | Authorized roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.active_tracking | Managers can insert tracking | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.active_tracking | Managers can update tracking | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.active_tracking | Viewers can view tracking | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.alert_configurations | Admins can delete alert configs | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.alert_configurations | Admins managers can view alert configs | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.alert_configurations | Managers can insert alert configs | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| public.alert_configurations | Managers can update alert configs | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.alert_configurations | Viewers can view alert configs | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.alert_dedup | Authorized roles can view alert dedup | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.alerts | Authorized roles can view alerts | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.alerts | Managers can delete alerts | DELETE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.alerts | Operators can insert alerts | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.alerts | Operators can update alerts | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.alerts | Viewers can view alerts | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.alerts_sent | Admins can delete alerts sent | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.alerts_sent | Authorized roles can view alerts sent | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.alerts_sent | Managers can update alerts sent | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.alerts_sent | System can insert alerts sent | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.audit_log | audit_log_insert | INSERT | PERMISSIVE | public |  | `true` |
| public.audit_log | audit_log_select | SELECT | PERMISSIVE | public | `(auth.uid() IS NOT NULL)` |  |
| public.auth_logs | Admins can view all auth logs | SELECT | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.auth_logs | Authenticated can insert auth logs | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |
| public.auth_logs | Users can view own auth logs | SELECT | PERMISSIVE | public | `(auth.uid() = user_id)` |  |
| public.bitrix24_activities | Admins can delete activities | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.bitrix24_activities | Authorized roles can view activities | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.bitrix24_activities | Managers can insert activities | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| public.bitrix24_activities | Managers can update activities | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.bitrix24_spa_sync | Admin manager view spa sync | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.bitrix24_stage_mappings | Admins can delete stage mappings | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.bitrix24_stage_mappings | Authorized roles can view stage mappings | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.bitrix24_stage_mappings | Managers can insert stage mappings | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| public.bitrix24_stage_mappings | Managers can update stage mappings | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.bitrix24_sync | Authorized roles can view sync data | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.bitrix24_sync | Managers can delete sync data | DELETE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.bitrix24_sync | Operators can insert sync data | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.bitrix24_sync | Operators can update sync data | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.bitrix24_tokens | Admins can delete tokens | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.bitrix24_tokens | Admins can insert tokens | INSERT | PERMISSIVE | authenticated |  | `has_role(auth.uid(), 'admin'::app_role)` |
| public.bitrix24_tokens | Admins can update tokens | UPDATE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.bitrix24_tokens | Only admins can view tokens | SELECT | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.blocked_ips | Admins can manage blocked IPs | ALL | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.blocked_ips | Managers can view blocked IPs | SELECT | PERMISSIVE | public | `has_role(auth.uid(), 'manager'::app_role)` |  |
| public.contacts | Users manage their own contacts | ALL | PERMISSIVE | public | `(auth.uid() = owner_id)` | `(auth.uid() = owner_id)` |
| public.contract_version_usage | admins read contract usage | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.contract_version_usage_monthly | Admins can view monthly contract usage | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.cron_job_logs | Admins can view cron logs | SELECT | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.driver_approval_queue | Admins can delete approvals | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.driver_approval_queue | Authorized roles can view approvals | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.driver_approval_queue | Managers can insert approvals | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| public.driver_approval_queue | Managers can update approvals | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.driver_approval_queue | Viewers can view approval queue | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.driver_evaluations | Admins can delete evaluations | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.driver_evaluations | Authorized roles can view evaluations | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.driver_evaluations | Managers can update evaluations | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.driver_evaluations | Operators can insert evaluations | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.driver_evaluations | Viewers can view driver evaluations | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.driver_incidents | Admins can delete incidents | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.driver_incidents | Authorized roles can view incidents | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.driver_incidents | Managers can update incidents | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.driver_incidents | Operators can insert incidents | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.driver_incidents | Viewers can view incidents | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.driver_locations | Admins managers can view all locations | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.driver_locations | Managers can delete driver locations | DELETE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.driver_locations | Operators can insert driver locations | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.driver_locations | Operators can update driver locations | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.driver_locations | Operators can view active delivery locations only | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'operator'::app_role) AND (EXISTS ( SELECT 1    FROM active_tracking at   WHERE ((at.id = driver_locations.tracking_id) AND (at.tracking_status = 'ACTIVE'::text)))))` |  |
| public.drivers | Admins can delete drivers | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.drivers | Admins managers can view all drivers | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.drivers | Managers can insert drivers | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| public.drivers | Managers can update drivers | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.drivers | Operators can view drivers limited | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'operator'::app_role)` |  |
| public.drivers | Viewers can view drivers | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.email_verifications | Admins can delete verifications | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.email_verifications | Users can insert own verifications | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() = user_id)` |
| public.email_verifications | Users can update their verifications | UPDATE | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.email_verifications | Users can view own verifications | SELECT | PERMISSIVE | public | `(auth.uid() = user_id)` |  |
| public.feature_flags | Feature flags are viewable by authenticated users | SELECT | PERMISSIVE | authenticated | `true` |  |
| public.feature_flags | Feature flags can only be managed by admins | ALL | PERMISSIVE | public | `(EXISTS ( SELECT 1    FROM user_roles ur   WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::app_role) AND (ur.is_active = true))))` |  |
| public.geo_blocks | Admins can delete geo blocks | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.geo_blocks | Admins can insert geo blocks | INSERT | PERMISSIVE | authenticated |  | `has_role(auth.uid(), 'admin'::app_role)` |
| public.geo_blocks | Admins can manage geo blocks | ALL | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.geo_blocks | Admins can update geo blocks | UPDATE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.geo_blocks | Managers can view geo blocks | SELECT | PERMISSIVE | public | `has_role(auth.uid(), 'manager'::app_role)` |  |
| public.geo_budget | geo_budget_admin_all | ALL | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.geo_budget | geo_budget_read_authenticated | SELECT | PERMISSIVE | public | `(auth.role() = 'authenticated'::text)` |  |
| public.geo_defaults | geo_defaults_admin_all | ALL | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.geo_defaults | geo_defaults_read_authenticated | SELECT | PERMISSIVE | public | `(auth.role() = 'authenticated'::text)` |  |
| public.geo_price_list | geo_price_list_admin_all | ALL | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.geo_price_list | geo_price_list_read_authenticated | SELECT | PERMISSIVE | public | `(auth.role() = 'authenticated'::text)` |  |
| public.geo_settings | geo_settings_admin_all | ALL | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.geo_settings | geo_settings_read_authenticated | SELECT | PERMISSIVE | public | `(auth.role() = 'authenticated'::text)` |  |
| public.geo_usage | geo_usage_read_manager | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.ip_whitelist | Admins can delete whitelist | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.ip_whitelist | Admins can insert whitelist | INSERT | PERMISSIVE | authenticated |  | `has_role(auth.uid(), 'admin'::app_role)` |
| public.ip_whitelist | Admins can manage IP whitelist | ALL | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.ip_whitelist | Admins can update whitelist | UPDATE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.ip_whitelist | Managers can view IP whitelist | SELECT | PERMISSIVE | public | `has_role(auth.uid(), 'manager'::app_role)` |  |
| public.job_queue | Admins view jobs | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.job_queue | Service role full access | ALL | PERMISSIVE | service_role | `true` | `true` |
| public.lalamove_order_replacements | Admins can delete order_replacements | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.lalamove_order_replacements | Admins managers can view order_replacements | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.lalamove_orders | Admins managers can view all orders | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.lalamove_orders | Managers can delete orders | DELETE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.lalamove_orders | Operators can insert orders | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.lalamove_orders | Operators can update orders | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.lalamove_orders | Operators can view orders | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'operator'::app_role)` |  |
| public.lalamove_orders | Viewers can view orders | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.lalamove_priority_fee_history | Admin/manager insert priority fee history | INSERT | PERMISSIVE | public |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| public.lalamove_priority_fee_history | Operational roles view priority fee history | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.lalamove_rate_limits | Admins and managers can view rate limits | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.lalamove_rate_limits | System roles can insert rate limits | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.lalamove_status_history | Admins can delete status history | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.lalamove_status_history | Authorized roles can view status history | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.lalamove_status_history | Managers can update status history | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.lalamove_status_history | Operators can insert status history | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.lalamove_status_history | Viewers can view status history | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.lalamove_stop_proofs | Admins can delete stop_proofs | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.lalamove_stop_proofs | Admins managers can view stop_proofs | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.lalamove_stop_proofs | Managers can update stop_proofs | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.lalamove_stop_proofs | Operators can insert stop_proofs | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.lalamove_stop_proofs | Operators can view stop_proofs limited | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'operator'::app_role)` |  |
| public.lalamove_stops | Admins can delete stops | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.lalamove_stops | Admins managers can view all stops | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.lalamove_stops | Managers can update stops | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.lalamove_stops | Operators can insert stops | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
| public.lalamove_stops | Operators can view stops limited | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'operator'::app_role)` |  |
| public.lalamove_uapi_sessions | Admins can manage UAPI sessions | ALL | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.lalamove_webhook_config | Admins manage webhook config | ALL | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.login_attempts | Admins can delete login attempts | DELETE | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.login_attempts | Admins can insert login attempts | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| public.login_attempts | Admins can update login attempts | UPDATE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.login_attempts | Admins can view login attempts | SELECT | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.map_settings_overrides | Users can manage their own settings overrides | ALL | PERMISSIVE | public | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| public.mcp_diagnostics_grants | Admins manage diagnostics grants | ALL | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.mfa_sessions | Users can delete their MFA sessions | DELETE | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.mfa_sessions | Users can insert their MFA sessions | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() = user_id)` |
| public.mfa_sessions | Users can manage own MFA sessions | ALL | PERMISSIVE | authenticated | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| public.mfa_sessions | Users can update their MFA sessions | UPDATE | PERMISSIVE | authenticated | `(auth.uid() = user_id)` |  |
| public.mfa_sessions | Usuários podem ver suas próprias sessões MFA | SELECT | PERMISSIVE | public | `(auth.uid() = user_id)` |  |
| public.new_device_alerts | Users can delete their device alerts | DELETE | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.new_device_alerts | Users can insert their device alerts | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() = user_id)` |
| public.new_device_alerts | Users can update their device alerts | UPDATE | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.new_device_alerts | Users can view own device alerts | SELECT | PERMISSIVE | authenticated | `(auth.uid() = user_id)` |  |
| public.order_geo_events | order_geo_events_read | SELECT | PERMISSIVE | public | `(auth.role() = 'authenticated'::text)` |  |
| public.password_reset_requests | Admins and managers can view reset requests | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.password_reset_requests | Admins can update reset requests | UPDATE | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.password_reset_requests | Users can request own password reset | INSERT | PERMISSIVE | authenticated |  | `(user_email = (( SELECT users.email    FROM auth.users   WHERE (users.id = auth.uid())))::text)` |
| public.password_reset_tokens | Admins can delete reset tokens | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.password_reset_tokens | Authenticated can insert own reset tokens | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() = user_id)` |
| public.password_reset_tokens | Users can select own reset tokens | SELECT | PERMISSIVE | public | `(auth.uid() = user_id)` |  |
| public.password_reset_tokens | Users can view own reset tokens | SELECT | PERMISSIVE | public | `(auth.uid() = user_id)` |  |
| public.permissions | Admins can delete permissions | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.permissions | Admins can insert permissions | INSERT | PERMISSIVE | authenticated |  | `has_role(auth.uid(), 'admin'::app_role)` |
| public.permissions | Admins can update permissions | UPDATE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.permissions | Authorized roles can view permissions | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.query_telemetry | Admins can manage telemetry | ALL | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` | `has_role(auth.uid(), 'admin'::app_role)` |
| public.query_telemetry | Managers can view telemetry | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'manager'::app_role)` |  |
| public.query_telemetry | System can insert telemetry | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR can_run_db_diagnostics(auth.uid()))` |
| public.rate_limit_logs | Admins can view rate limit logs | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.rate_limit_logs | Authenticated can insert rate limit logs | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |
| public.region_cache | Authenticated users can insert region cache | INSERT | PERMISSIVE | authenticated |  | `((length(btrim(coord_key)) >= 1) AND (length(btrim(coord_key)) <= 100) AND ((length(btrim(region)) >= 1) AND (length(btrim(region)) <= 200)))` |
| public.region_cache | Authenticated users can read region cache | SELECT | PERMISSIVE | authenticated | `true` |  |
| public.report_presets | Users can manage their own report presets | ALL | PERMISSIVE | public | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| public.risk_rules | Admins can delete risk rules | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.risk_rules | Authorized roles can view risk rules | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |  |
| public.risk_rules | Managers can insert risk rules | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |
| public.risk_rules | Managers can update risk rules | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.risk_rules | Viewers can view risk rules | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'viewer'::app_role)` |  |
| public.role_permissions | Admins can delete role permissions | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.role_permissions | Admins can insert role permissions | INSERT | PERMISSIVE | authenticated |  | `has_role(auth.uid(), 'admin'::app_role)` |
| public.role_permissions | Admins can manage role_permissions | ALL | PERMISSIVE | public | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.role_permissions | Admins can update role permissions | UPDATE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.role_permissions | Authorized roles can view role_permissions | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.runtime_error_logs | Admins can delete error logs | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.runtime_error_logs | Admins can update error logs | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.runtime_error_logs | Admins managers can view error logs | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.runtime_error_logs | Authenticated can insert error logs | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() IS NOT NULL)` |
| public.security_test_logs | Admins can view security test logs | SELECT | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.tracking_events | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_default | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2026m05 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2026m06 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2026m07 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2026m08 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2026m09 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2026m10 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2026m11 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2026m12 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.tracking_events_y2027m01 | Operational roles can view tracking | SELECT | PERMISSIVE | public | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.user_devices | Users can delete their devices | DELETE | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.user_devices | Users can insert their devices | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() = user_id)` |
| public.user_devices | Users can manage own devices | ALL | PERMISSIVE | authenticated | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| public.user_devices | Users can update their devices | UPDATE | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.user_devices | Users can view own devices | SELECT | PERMISSIVE | authenticated | `(auth.uid() = user_id)` |  |
| public.user_passkeys | Users can delete own passkeys | DELETE | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.user_passkeys | Users can insert own passkeys | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() = user_id)` |
| public.user_passkeys | Users can update own passkeys | UPDATE | PERMISSIVE | authenticated | `(auth.uid() = user_id)` | `(auth.uid() = user_id)` |
| public.user_passkeys | Users can view own passkeys | SELECT | PERMISSIVE | authenticated | `(auth.uid() = user_id)` |  |
| public.user_roles | MFA admins can delete roles | DELETE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) AND is_aal2())` |  |
| public.user_roles | MFA admins can insert roles | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) AND is_aal2())` |
| public.user_roles | MFA admins can update roles | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) AND is_aal2())` | `(has_role(auth.uid(), 'admin'::app_role) AND is_aal2())` |
| public.user_roles | Users can view own roles | SELECT | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.webauthn_challenges | Authenticated can create challenges | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() = user_id)` |
| public.webauthn_challenges | Authenticated can read own challenges | SELECT | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.webauthn_challenges | Users can delete their challenges | DELETE | PERMISSIVE | authenticated | `((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))` |  |
| public.webauthn_challenges | Users can insert their challenges | INSERT | PERMISSIVE | authenticated |  | `(auth.uid() = user_id)` |
| public.webauthn_challenges | Users can update their challenges | UPDATE | PERMISSIVE | authenticated | `(auth.uid() = user_id)` |  |
| public.webhook_events | Admins can delete events | DELETE | PERMISSIVE | authenticated | `has_role(auth.uid(), 'admin'::app_role)` |  |
| public.webhook_events | Authorized roles can view webhook events | SELECT | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))` |  |
| public.webhook_events | Managers can update events | UPDATE | PERMISSIVE | authenticated | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))` |  |
| public.webhook_events | Operators can insert events | INSERT | PERMISSIVE | authenticated |  | `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))` |
