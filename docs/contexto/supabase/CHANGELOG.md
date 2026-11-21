# CHANGELOG do snapshot Supabase

Diff semântico gerado a cada coleta em que algo mudou.

## 2026-11-21 15:12 UTC

- **functions** alterado (1): `public.refresh_cache_view(p_view_name text)`
- **migrations** adicionado (4): `20261109004100_add_security_tables_to_realtime`, `20261120180500_fix_telemetria_grant_only`, `20261121100000_add_table_comments`, `20261122090000_cache_system_backend`
- **realtime** adicionado (4): `supabase_realtime:public.auth_logs`, `supabase_realtime:public.blocked_ips`, `supabase_realtime:public.mfa_sessions`, `supabase_realtime:public.new_device_alerts`
- **tabelas** alterado (4): `public.auth_logs`, `public.blocked_ips`, `public.mfa_sessions`, `public.new_device_alerts`

## 2026-11-21 14:44 UTC

- **colunas** adicionado (42): `public.cache_status.is_stale`, `public.cache_status.last_refresh`, `public.cache_status.refresh_duration_ms`, `public.cache_status.row_count`, `public.cache_status.status`, `public.cache_status.view_name`, `public.delivery_metrics_cache.avg_delay_minutes`, `public.delivery_metrics_cache.avg_value`, `public.delivery_metrics_cache.cached_at`, `public.delivery_metrics_cache.cancelled_orders`, `public.delivery_metrics_cache.completed_orders`, `public.delivery_metrics_cache.delivery_date`, `public.delivery_metrics_cache.failed_orders`, `public.delivery_metrics_cache.in_progress_orders`, `public.delivery_metrics_cache.max_value`, `public.delivery_metrics_cache.total_orders`, `public.delivery_metrics_cache.total_value`, `public.driver_stats_cache.avg_rating`, `public.driver_stats_cache.cached_at`, `public.driver_stats_cache.cancelled_deliveries`, `public.driver_stats_cache.completed_deliveries`, `public.driver_stats_cache.driver_created_at`, `public.driver_stats_cache.driver_id`, `public.driver_stats_cache.driver_name`, `public.driver_stats_cache.driver_status`, `public.driver_stats_cache.failed_deliveries`, `public.driver_stats_cache.is_blacklisted`, `public.driver_stats_cache.is_whitelisted`, `public.driver_stats_cache.lalamove_driver_id`, `public.driver_stats_cache.last_active_at`, `public.driver_stats_cache.last_delivery_at`, `public.driver_stats_cache.phone`, `public.driver_stats_cache.risk_level`, `public.driver_stats_cache.risk_score`, `public.driver_stats_cache.total_deliveries`, `public.driver_stats_cache.vehicle_type`, `public.hourly_metrics_cache.avg_value`, `public.hourly_metrics_cache.cached_at`, `public.hourly_metrics_cache.completed_orders`, `public.hourly_metrics_cache.hour` … (+2)
- **constraints** alterado (1): `public.driver_evaluations.driver_evaluations_completed_lte_total`
- **functions** adicionado (1): `public.refresh_cache_view(p_view_name text)`
- **grants** adicionado (3): `public.cache_status:anon`, `public.cache_status:authenticated`, `public.cache_status:service_role`
- **indexes** adicionado (3): `public.idx_delivery_metrics_cache_date`, `public.idx_driver_stats_cache_driver_id`, `public.idx_hourly_metrics_cache_hour`
- **lints** adicionado (2): `rpc_anon_executable:public.refresh_cache_view(p_view_name text)`, `view_security_definer:public.cache_status`
- **views** adicionado (4): `public.cache_status`, `public.delivery_metrics_cache`, `public.driver_stats_cache`, `public.hourly_metrics_cache`

## 2026-11-21 14:01 UTC

- **tabelas** alterado (55): `public.active_tracking`, `public.alert_configurations`, `public.alert_dedup`, `public.alerts`, `public.alerts_sent`, `public.auth_logs`, `public.bitrix24_activities`, `public.bitrix24_stage_mappings`, `public.bitrix24_sync`, `public.bitrix24_tokens`, `public.blocked_ips`, `public.contacts`, `public.contract_version_usage`, `public.contract_version_usage_monthly`, `public.cron_job_logs`, `public.driver_approval_queue`, `public.driver_evaluations`, `public.driver_incidents`, `public.driver_locations`, `public.drivers`, `public.email_verifications`, `public.feature_flags`, `public.geo_blocks`, `public.ip_whitelist`, `public.lalamove_order_replacements`, `public.lalamove_orders`, `public.lalamove_priority_fee_history`, `public.lalamove_rate_limits`, `public.lalamove_status_history`, `public.lalamove_stop_proofs`, `public.lalamove_stops`, `public.lalamove_uapi_sessions`, `public.login_attempts`, `public.map_settings_overrides`, `public.mcp_diagnostics_grants`, `public.mfa_sessions`, `public.new_device_alerts`, `public.password_reset_requests`, `public.password_reset_tokens`, `public.permissions` … (+15)

## 2026-11-21 12:45 UTC

- Snapshot inicial.

