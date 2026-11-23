# CHANGELOG do snapshot Supabase

Diff semântico gerado a cada coleta em que algo mudou.

## 2026-11-23 21:13 UTC

- **colunas** adicionado (32): `public.notification_messages.alert_id`, `public.notification_messages.attempt`, `public.notification_messages.body_preview`, `public.notification_messages.channel`, `public.notification_messages.client_message_id`, `public.notification_messages.cost_cents`, `public.notification_messages.created_at`, `public.notification_messages.delivered_at`, `public.notification_messages.direction`, `public.notification_messages.driver_id`, `public.notification_messages.error_code`, `public.notification_messages.event`, `public.notification_messages.expires_at`, `public.notification_messages.failed_at`, `public.notification_messages.fallback_of`, `public.notification_messages.id`, `public.notification_messages.metadata`, `public.notification_messages.occurred_at`, `public.notification_messages.order_id`, `public.notification_messages.provider`, `public.notification_messages.provider_message_id`, `public.notification_messages.provider_sequence`, `public.notification_messages.read_at`, `public.notification_messages.recipient_phone`, `public.notification_messages.role`, `public.notification_messages.segments`, `public.notification_messages.sent_at`, `public.notification_messages.status`, `public.notification_messages.stop_id`, `public.notification_messages.template_key`, `public.notification_messages.template_version`, `public.notification_messages.updated_at`
- **constraints** adicionado (7): `public.notification_messages.notification_messages_alert_id_fkey`, `public.notification_messages.notification_messages_channel_check`, `public.notification_messages.notification_messages_direction_check`, `public.notification_messages.notification_messages_fallback_of_fkey`, `public.notification_messages.notification_messages_pkey`, `public.notification_messages.notification_messages_role_check`, `public.notification_messages.notification_messages_status_check`
- **cron jobs** adicionado (1): `30:notification_messages_scrub_bodies`
- **functions** adicionado (3): `public.notification_messages_scrub_bodies(p_keep_days integer)`, `public.notification_messages_touch()`, `public.notification_status_transition_allowed(p_from text, p_to text)`
- **functions** alterado (1): `public.has_role(_user_id uuid, _role app_role)`
- **grants** adicionado (2): `public.notification_messages:authenticated`, `public.notification_messages:service_role`
- **indexes** adicionado (7): `public.notification_messages_client_message_id_key`, `public.notification_messages_driver_created_idx`, `public.notification_messages_order_created_idx`, `public.notification_messages_pending_idx`, `public.notification_messages_pkey`, `public.notification_messages_provider_message_id_key`, `public.notification_messages_recipient_created_idx`
- **lints** adicionado (4): `fk_without_index:public.notification_messages.notification_messages_alert_id_fkey`, `fk_without_index:public.notification_messages.notification_messages_fallback_of_fkey`, `policy_auth_fn_not_wrapped:public.notification_messages.operator le ledger de mensagens`, `rpc_anon_executable:public.notification_messages_scrub_bodies(p_keep_days integer)`
- **migrations** adicionado (1): `20261125120000_notification_ledger`
- **policies (RLS)** adicionado (2): `public.notification_messages.operator le ledger de mensagens`, `public.notification_messages.service role escreve ledger de mensagens`
- **tabelas** adicionado (1): `public.notification_messages`
- **triggers** adicionado (1): `public.notification_messages.notification_messages_touch_trg`

## 2026-11-22 17:12 UTC

- **functions** alterado (1): `public.mark_job_failed(p_job_id uuid, p_error_message text, p_error_stack text)`

## 2026-11-22 14:17 UTC

- **colunas** adicionado (5): `public.geo_defaults.late_tolerance_min`, `public.notification_optouts.created_at`, `public.notification_optouts.created_by`, `public.notification_optouts.phone`, `public.notification_optouts.reason`
- **colunas** alterado (1): `public.permissions.module`
- **constraints** adicionado (2): `public.notification_optouts.notification_optouts_created_by_fkey`, `public.notification_optouts.notification_optouts_pkey`
- **cron jobs** adicionado (1): `29:check-driver-alerts`
- **functions** adicionado (4): `public.end_order_tracking(p_order_id uuid, p_reason text)`, `public.is_phone_opted_out(p_phone text)`, `public.normalize_br_phone(p_phone text)`, `public.trg_close_tracking_on_order_end()`
- **functions** alterado (5): `public.geo_emit_event(p_order_id uuid, p_driver_id uuid, p_event alert_type, p_stop_index integer, p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer, p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)`, `public.geo_evaluate_tracking()`, `public.geo_haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)`, `public.geo_point_to_polyline_m(plat double precision, plng double precision, polyline jsonb)`, `public.has_permission(_user_id uuid, _permission_name text)`
- **grants** adicionado (2): `public.notification_optouts:authenticated`, `public.notification_optouts:service_role`
- **indexes** adicionado (1): `public.notification_optouts_pkey`
- **lints** adicionado (4): `fk_without_index:public.notification_optouts.notification_optouts_created_by_fkey`, `policy_auth_fn_not_wrapped:public.notification_optouts.admin gerencia opt-outs`, `rpc_anon_executable:public.end_order_tracking(p_order_id uuid, p_reason text)`, `rpc_anon_executable:public.is_phone_opted_out(p_phone text)`
- **migrations** adicionado (6): `20261122131000_geo_eta_delay`, `20261123190000_cron_check_driver_alerts`, `20261123190001_revoke_anon_geo_rpcs`, `20261123190002_geo_maps_permissions`, `20261123200000_optout_and_tracking_end`, `20261124120000_internal_alert_channels`
- **policies (RLS)** adicionado (2): `public.notification_optouts.admin gerencia opt-outs`, `public.notification_optouts.service role escreve opt-outs`
- **policies (RLS)** alterado (1): `public.geo_usage.geo_usage_read_manager`
- **tabelas** adicionado (1): `public.notification_optouts`
- **triggers** adicionado (1): `public.lalamove_orders.trg_close_tracking_on_order_end`

## 2026-11-22 12:19 UTC

- **functions** alterado (5): `public.add_job(p_type text, p_payload jsonb, p_priority integer, p_max_attempts integer, p_dedup_key text, p_metadata jsonb)`, `public.geo_budget_status()`, `public.geo_emit_event(p_order_id uuid, p_driver_id uuid, p_event alert_type, p_stop_index integer, p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer, p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)`, `public.has_permission(_user_id uuid, _permission_name text)`, `public.has_role(_user_id uuid, _role app_role)`
- **migrations** adicionado (1): `20261122111505_revoke_anon_geo_rpcs_v2_ledger_parity`

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

