# CHANGELOG do snapshot Supabase

Diff semântico gerado a cada coleta em que algo mudou.

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

