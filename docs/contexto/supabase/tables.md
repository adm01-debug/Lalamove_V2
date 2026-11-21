# Tabelas

Um arquivo por tabela em `tables/<schema>/<tabela>.md` (colunas, constraints, índices, RLS/policies, triggers, grants). Métricas de volume em `stats.md`.

| tabela | tipo | RLS | policies | colunas | realtime | comentário |
|---|---|---|---|---|---|---|
| [public.active_tracking](tables/public/active_tracking.md) | table | sim | 5 | 21 | não |  |
| [public.alert_configurations](tables/public/alert_configurations.md) | table | sim | 5 | 33 | não |  |
| [public.alert_dedup](tables/public/alert_dedup.md) | table | sim | 1 | 6 | não |  |
| [public.alerts](tables/public/alerts.md) | table | sim | 5 | 15 | não |  |
| [public.alerts_sent](tables/public/alerts_sent.md) | table | sim | 4 | 11 | não |  |
| [public.auth_logs](tables/public/auth_logs.md) | table | sim | 3 | 9 | não |  |
| [public.bitrix24_activities](tables/public/bitrix24_activities.md) | table | sim | 4 | 7 | não |  |
| [public.bitrix24_stage_mappings](tables/public/bitrix24_stage_mappings.md) | table | sim | 4 | 5 | não |  |
| [public.bitrix24_sync](tables/public/bitrix24_sync.md) | table | sim | 4 | 9 | não |  |
| [public.bitrix24_tokens](tables/public/bitrix24_tokens.md) | table | sim | 4 | 7 | não |  |
| [public.blocked_ips](tables/public/blocked_ips.md) | table | sim | 2 | 11 | não |  |
| [public.contacts](tables/public/contacts.md) | table | sim | 1 | 10 | não |  |
| [public.contract_version_usage](tables/public/contract_version_usage.md) | table | sim | 1 | 8 | não |  |
| [public.contract_version_usage_monthly](tables/public/contract_version_usage_monthly.md) | table | sim | 1 | 9 | não |  |
| [public.cron_job_logs](tables/public/cron_job_logs.md) | table | sim | 1 | 9 | não |  |
| [public.driver_approval_queue](tables/public/driver_approval_queue.md) | table | sim | 5 | 14 | não |  |
| [public.driver_evaluations](tables/public/driver_evaluations.md) | table | sim | 5 | 19 | não |  |
| [public.driver_incidents](tables/public/driver_incidents.md) | table | sim | 5 | 13 | não |  |
| [public.driver_locations](tables/public/driver_locations.md) | table | sim | 5 | 9 | não |  |
| [public.drivers](tables/public/drivers.md) | table | sim | 6 | 32 | não |  |
| [public.email_verifications](tables/public/email_verifications.md) | table | sim | 4 | 7 | não |  |
| [public.feature_flags](tables/public/feature_flags.md) | table | sim | 2 | 7 | não |  |
| [public.geo_blocks](tables/public/geo_blocks.md) | table | sim | 5 | 10 | não |  |
| [public.ip_whitelist](tables/public/ip_whitelist.md) | table | sim | 5 | 8 | não |  |
| [public.lalamove_order_replacements](tables/public/lalamove_order_replacements.md) | table | sim | 2 | 7 | sim |  |
| [public.lalamove_orders](tables/public/lalamove_orders.md) | table | sim | 6 | 49 | não |  |
| [public.lalamove_priority_fee_history](tables/public/lalamove_priority_fee_history.md) | table | sim | 2 | 9 | não |  |
| [public.lalamove_rate_limits](tables/public/lalamove_rate_limits.md) | table | sim | 2 | 12 | não |  |
| [public.lalamove_status_history](tables/public/lalamove_status_history.md) | table | sim | 5 | 9 | não |  |
| [public.lalamove_stop_proofs](tables/public/lalamove_stop_proofs.md) | table | sim | 5 | 14 | sim |  |
| [public.lalamove_stops](tables/public/lalamove_stops.md) | table | sim | 5 | 15 | não |  |
| [public.lalamove_uapi_sessions](tables/public/lalamove_uapi_sessions.md) | table | sim | 1 | 13 | não |  |
| [public.login_attempts](tables/public/login_attempts.md) | table | sim | 4 | 11 | não |  |
| [public.map_settings_overrides](tables/public/map_settings_overrides.md) | table | sim | 1 | 8 | não |  |
| [public.mcp_diagnostics_grants](tables/public/mcp_diagnostics_grants.md) | table | sim | 1 | 7 | não |  |
| [public.mfa_sessions](tables/public/mfa_sessions.md) | table | sim | 5 | 9 | não |  |
| [public.new_device_alerts](tables/public/new_device_alerts.md) | table | sim | 4 | 8 | não |  |
| [public.password_reset_requests](tables/public/password_reset_requests.md) | table | sim | 3 | 11 | não |  |
| [public.password_reset_tokens](tables/public/password_reset_tokens.md) | table | sim | 4 | 7 | não |  |
| [public.permissions](tables/public/permissions.md) | table | sim | 4 | 6 | não |  |
| [public.query_telemetry](tables/public/query_telemetry.md) | table | sim | 3 | 13 | não |  |
| [public.rate_limit_logs](tables/public/rate_limit_logs.md) | table | sim | 2 | 11 | não |  |
| [public.region_cache](tables/public/region_cache.md) | table | sim | 2 | 4 | não |  |
| [public.report_presets](tables/public/report_presets.md) | table | sim | 1 | 6 | sim |  |
| [public.risk_rules](tables/public/risk_rules.md) | table | sim | 5 | 8 | não |  |
| [public.role_permissions](tables/public/role_permissions.md) | table | sim | 5 | 4 | não |  |
| [public.runtime_error_logs](tables/public/runtime_error_logs.md) | table | sim | 4 | 21 | não |  |
| [public.security_test_logs](tables/public/security_test_logs.md) | table | sim | 1 | 8 | não |  |
| [public.tracking_events](tables/public/tracking_events.md) | partitioned | sim | 1 | 10 | não |  |
| [public.tracking_events_default](tables/public/tracking_events_default.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m05](tables/public/tracking_events_y2026m05.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m06](tables/public/tracking_events_y2026m06.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m07](tables/public/tracking_events_y2026m07.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m08](tables/public/tracking_events_y2026m08.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m09](tables/public/tracking_events_y2026m09.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m10](tables/public/tracking_events_y2026m10.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m11](tables/public/tracking_events_y2026m11.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2026m12](tables/public/tracking_events_y2026m12.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.tracking_events_y2027m01](tables/public/tracking_events_y2027m01.md) | table (partição) | sim | 1 | 10 | não |  |
| [public.user_devices](tables/public/user_devices.md) | table | sim | 5 | 14 | não |  |
| [public.user_passkeys](tables/public/user_passkeys.md) | table | sim | 4 | 11 | não |  |
| [public.user_roles](tables/public/user_roles.md) | table | sim | 4 | 10 | não |  |
| [public.webauthn_challenges](tables/public/webauthn_challenges.md) | table | sim | 5 | 6 | não |  |
| [public.webhook_events](tables/public/webhook_events.md) | table | sim | 4 | 9 | não |  |
