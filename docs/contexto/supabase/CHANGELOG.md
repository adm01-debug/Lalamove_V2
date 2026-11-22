# CHANGELOG do snapshot Supabase

Diff semântico gerado a cada coleta em que algo mudou.

## 2026-11-22 11:12 UTC

- **functions** alterado (5): `public.geo_audit_config()`, `public.geo_budget_status()`, `public.geo_emit_event(p_order_id uuid, p_driver_id uuid, p_event alert_type, p_stop_index integer, p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer, p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)`, `public.geo_evaluate_tracking()`, `public.geo_usage_increment(p_provider text, p_function text, p_sku text, p_count integer)`
- **lints** removido (3): `rpc_anon_executable:public.geo_budget_status()`, `rpc_anon_executable:public.geo_emit_event(p_order_id uuid, p_driver_id uuid, p_event alert_type, p_stop_index integer, p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer, p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)`, `rpc_anon_executable:public.geo_usage_increment(p_provider text, p_function text, p_sku text, p_count integer)`
- **migrations** adicionado (1): `20261122110913_revoke_anon_geo_rpcs`

## 2026-11-22 05:13 UTC

- **functions** alterado (1): `public.geo_emit_event(p_order_id uuid, p_driver_id uuid, p_event alert_type, p_stop_index integer, p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer, p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)`

## 2026-11-22 02:19 UTC

- **colunas** adicionado (19): `public.cache_refresh_log.error_message`, `public.cache_refresh_log.id`, `public.cache_refresh_log.refresh_completed_at`, `public.cache_refresh_log.refresh_duration_ms`, `public.cache_refresh_log.refresh_started_at`, `public.cache_refresh_log.row_count`, `public.cache_refresh_log.status`, `public.cache_refresh_log.triggered_by`, `public.cache_refresh_log.view_name`, `public.job_queue_processing_log.duration_ms`, `public.job_queue_processing_log.failed`, `public.job_queue_processing_log.id`, `public.job_queue_processing_log.metadata`, `public.job_queue_processing_log.processed`, `public.job_queue_processing_log.run_at`, `public.job_queue_processing_log.skipped`, `public.job_queue_processing_log.succeeded`, `public.lalamove_orders.geocode_match_confidence`, `public.lalamove_stops.geocode_match_confidence`
- **constraints** adicionado (6): `public.cache_refresh_log.cache_refresh_log_pkey`, `public.cache_refresh_log.cache_refresh_log_status_check`, `public.job_queue_processing_log.job_queue_processing_log_pkey`, `public.lalamove_orders.lalamove_orders_delivery_place_id_prefix_chk`, `public.lalamove_orders.lalamove_orders_pickup_place_id_prefix_chk`, `public.lalamove_stops.lalamove_stops_place_id_prefix_chk`
- **functions** adicionado (3): `public.cache_view_count(p_view text)`, `public.cleanup_processing_logs()`, `public.refresh_cache_view(p_view_name text, p_triggered_by text)`
- **functions** removido (1): `public.refresh_cache_view(p_view_name text)`
- **functions** alterado (4): `public.get_next_jobs(p_limit integer, p_types text[])`, `public.has_role(_user_id uuid, _role app_role)`, `public.mark_job_processing(p_job_id uuid)`, `public.process_job_queue(p_limit integer)`
- **grants** adicionado (4): `public.cache_refresh_log:authenticated`, `public.cache_refresh_log:service_role`, `public.job_queue_processing_log:authenticated`, `public.job_queue_processing_log:service_role`
- **indexes** adicionado (8): `public.cache_refresh_log_pkey`, `public.idx_cache_refresh_log_running`, `public.idx_cache_refresh_log_status`, `public.idx_cache_refresh_log_view`, `public.idx_job_queue_created_by`, `public.idx_job_queue_processing_log_run_at`, `public.idx_order_geo_events_alert_id`, `public.job_queue_processing_log_pkey`
- **lints** adicionado (5): `policy_auth_fn_not_wrapped:public.cache_refresh_log.Admins read cache refresh log`, `policy_auth_fn_not_wrapped:public.job_queue_processing_log.Admins read job queue processing log`, `rpc_anon_executable:public.cache_view_count(p_view text)`, `rpc_anon_executable:public.cleanup_processing_logs()`, `rpc_anon_executable:public.refresh_cache_view(p_view_name text, p_triggered_by text)`
- **lints** removido (3): `fk_without_index:public.job_queue.job_queue_created_by_fkey`, `fk_without_index:public.order_geo_events.order_geo_events_alert_id_fkey`, `rpc_anon_executable:public.refresh_cache_view(p_view_name text)`
- **migrations** adicionado (6): `20261123130000_geo_price_list_skus_faltantes`, `20261123140000_geo_place_id_prefix_check`, `20261123150000_cache_refresh_log_restaurado`, `20261123160000_job_queue_processing_log`, `20261123170000_indices_fk_faltantes`, `20261123180000_geocode_match_confidence`
- **policies (RLS)** adicionado (2): `public.cache_refresh_log.Admins read cache refresh log`, `public.job_queue_processing_log.Admins read job queue processing log`
- **roles** adicionado (1): `cli_login_postgres`
- **tabelas** adicionado (2): `public.cache_refresh_log`, `public.job_queue_processing_log`
- **views** alterado (1): `public.cache_status`

## 2026-11-22 01:14 UTC

- **migrations** adicionado (3): `20261122005314_fix_alert_configs_anon_insert`, `20261122005320_fix_public_rls_bypass`, `20261122130200_alert_type_driver_assigned`

## 2026-11-22 00:36 UTC

- **colunas** alterado (1): `public.geo_settings.provider`
- **constraints** alterado (3): `public.geo_settings.geo_settings_fallback_provider_check`, `public.geo_settings.geo_settings_function_check`, `public.geo_settings.geo_settings_provider_check`
- **cron jobs** adicionado (1): `26:refresh-cache-views`
- **functions** alterado (7): `public.add_job(p_type text, p_payload jsonb, p_priority integer, p_max_attempts integer, p_dedup_key text, p_metadata jsonb)`, `public.geo_budget_status()`, `public.geo_emit_event(p_order_id uuid, p_driver_id uuid, p_event alert_type, p_stop_index integer, p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer, p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)`, `public.get_next_jobs(p_limit integer, p_types text[])`, `public.mark_job_processing(p_job_id uuid)`, `public.process_job_queue(p_limit integer)`, `public.refresh_cache_view(p_view_name text)`
- **realtime** removido (7): `supabase_realtime_messages_publication:realtime.messages_2026_08_28`, `supabase_realtime_messages_publication:realtime.messages_2026_08_29`, `supabase_realtime_messages_publication:realtime.messages_2026_08_30`, `supabase_realtime_messages_publication:realtime.messages_2026_08_31`, `supabase_realtime_messages_publication:realtime.messages_2026_09_01`, `supabase_realtime_messages_publication:realtime.messages_2026_09_02`, `supabase_realtime_messages_publication:realtime.messages_2026_09_03`

## 2026-11-21 23:12 UTC

- Snapshot inicial.

