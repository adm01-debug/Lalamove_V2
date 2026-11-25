# Métricas (voláteis — mudam sem alteração de schema)

Valores aproximados de propósito, para não gerar commits a cada coleta. Fora de `snapshot.json`; o bruto está em `stats.json`.

## Banco

| métrica | valor |
|---|---|
| tamanho | 55.6 MB |
| schema public | 15.3 MB |


## Tabelas (ordenadas por tamanho)

| tabela | linhas (~) | total | heap | índices | linhas mortas (~) | seq scans (~) | idx scans (~) | último autovacuum |
|---|---|---|---|---|---|---|---|---|
| public.geo_cache | ~20 | 3.2 MB | 136.0 KB | 232.0 KB | 0 | ~20 | ~4.7k | 2026-11-25 |
| public.job_queue | ~3k | 2.2 MB | 1.7 MB | 544.0 KB | ~40 | ~130 | ~21.8k | 2026-11-24 |
| public.alerts | ~1.5k | 1.7 MB | 1.0 MB | 608.0 KB | ~30 | ~3k | ~51.4k | 2026-11-24 |
| public.query_telemetry | ~2.2k | 1.2 MB | 288.0 KB | 904.0 KB | 0 | ~110 | ~30 | 2026-11-23 |
| public.job_queue_processing_log | ~4.5k | 984.0 KB | 568.0 KB | 376.0 KB | 0 | 4 | 1 | 2026-11-23 |
| public.active_tracking | ~20 | 424.0 KB | 112.0 KB | 64.0 KB | ~20 | ~5.2k | ~5.5k | 2026-11-23 |
| public.lalamove_uapi_snapshot | ~20 | 312.0 KB | 32.0 KB | 32.0 KB | ~40 | ~30 | ~600 | 2026-11-25 |
| public.lalamove_orders | ~50 | 288.0 KB | 24.0 KB | 232.0 KB | 7 | ~1.8k | ~52.6k |  |
| public.contract_version_usage | ~130 | 240.0 KB | 104.0 KB | 96.0 KB | ~20 | ~20 | ~13.9k | 2026-11-25 |
| public.webhook_events | ~230 | 216.0 KB | 48.0 KB | 136.0 KB | 4 | ~40 | ~20 |  |
| public.cache_refresh_log | ~230 | 160.0 KB | 32.0 KB | 88.0 KB | 0 | ~40 | ~210 | 2026-11-25 |
| public.lalamove_rate_limits | ~130 | 160.0 KB | 56.0 KB | 72.0 KB | 0 | ~20 | 3 |  |
| public.tracking_events_y2026m08 | ~200 | 152.0 KB | 40.0 KB | 80.0 KB | 0 | ~40 | 2 |  |
| public.contacts | ~30 | 144.0 KB | 8.0 KB | 128.0 KB | 2 | ~90 | ~70 |  |
| public.driver_approval_queue | 0 | 144.0 KB | 8.0 KB | 128.0 KB | ~10 | ~380 | ~3.7k |  |
| public.tracking_events_y2026m11 | 0 | 120.0 KB | 0 B | 112.0 KB | 0 | ~10 | 2 |  |
| public.tracking_events_y2026m12 | 0 | 120.0 KB | 0 B | 112.0 KB | 0 | 8 | 2 |  |
| public.tracking_events_y2027m01 | 0 | 120.0 KB | 0 B | 112.0 KB | 0 | 8 | 2 |  |
| public.alert_dedup | 7 | 112.0 KB | 8.0 KB | 64.0 KB | ~30 | ~4.9k | ~110 | 2026-11-24 |
| public.audit_log | 0 | 112.0 KB | 16.0 KB | 64.0 KB | 5 | 5 | 6 |  |
| public.driver_evaluations | 0 | 112.0 KB | 8.0 KB | 96.0 KB | 2 | ~30 | 1 |  |
| public.drivers | ~20 | 112.0 KB | 8.0 KB | 96.0 KB | 2 | ~20k | ~19.3k |  |
| public.driver_incidents | ~20 | 96.0 KB | 8.0 KB | 80.0 KB | 0 | ~640 | ~110 |  |
| public.user_devices | 2 | 96.0 KB | 8.0 KB | 48.0 KB | ~10 | ~60 | ~100 | 2026-11-21 |
| public.alert_configurations | 0 | 88.0 KB | 16.0 KB | 40.0 KB | ~40 | ~28.3k | ~24.3k |  |
| public.auth_logs | 1 | 88.0 KB | 8.0 KB | 72.0 KB | 0 | ~110 | ~20 |  |
| public.lalamove_status_history | ~130 | 88.0 KB | 32.0 KB | 48.0 KB | 1 | ~20 | ~10 |  |
| public.cron_job_logs | 0 | 80.0 KB | 8.0 KB | 48.0 KB | ~40 | ~110 | ~10 | 2026-10-11 |
| public.geo_usage | ~40 | 80.0 KB | 8.0 KB | 32.0 KB | ~10 | ~5.6k | ~4.3k | 2026-11-24 |
| public.message_templates | 0 | 80.0 KB | 8.0 KB | 64.0 KB | 0 | ~10 | ~30 |  |
| public.order_geo_events | 1 | 80.0 KB | 8.0 KB | 64.0 KB | 2 | ~60 | 3 |  |
| public.user_roles | 2 | 80.0 KB | 8.0 KB | 64.0 KB | 3 | ~184.5k | ~197k |  |
| public.alerts_sent | 0 | 72.0 KB | 8.0 KB | 56.0 KB | 3 | ~40 | ~110 |  |
| public.tracking_events_default | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~50 | 2 |  |
| public.tracking_events_y2026m05 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~40 | 2 |  |
| public.tracking_events_y2026m06 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~40 | 2 |  |
| public.tracking_events_y2026m07 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~40 | 2 |  |
| public.tracking_events_y2026m09 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~30 | 2 |  |
| public.tracking_events_y2026m10 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~30 | 2 |  |
| public.new_device_alerts | 1 | 64.0 KB | 8.0 KB | 48.0 KB | 0 | ~20 | 0 |  |
| public.notification_messages | 0 | 64.0 KB | 0 B | 56.0 KB | 0 | ~20 | ~1.1k |  |
| public.runtime_error_logs | 0 | 64.0 KB | 0 B | 56.0 KB | 0 | ~110 | ~20 |  |
| public.lalamove_stop_proofs | 0 | 56.0 KB | 0 B | 48.0 KB | 0 | ~30 | 0 |  |
| public.role_permissions | ~60 | 56.0 KB | 8.0 KB | 48.0 KB | 0 | ~240 | ~160 |  |
| public.feature_flags | 3 | 48.0 KB | 8.0 KB | 32.0 KB | 0 | ~50 | 3 |  |
| public.lalamove_order_replacements | 0 | 48.0 KB | 0 B | 40.0 KB | 0 | ~20 | 2 |  |
| public.lalamove_uapi_sessions | 0 | 48.0 KB | 8.0 KB | 32.0 KB | 1 | ~2.4k | 1 |  |
| public.lalamove_webhook_config | 0 | 48.0 KB | 8.0 KB | 32.0 KB | 0 | 6 | 2 |  |
| public.login_attempts | 0 | 48.0 KB | 0 B | 40.0 KB | 0 | ~110 | ~20 |  |
| public.mcp_diagnostics_grants | 1 | 48.0 KB | 8.0 KB | 32.0 KB | 2 | ~40 | ~20 |  |
| public.notification_routes | 0 | 48.0 KB | 8.0 KB | 32.0 KB | 1 | ~10 | ~580 |  |
| public.permissions | ~30 | 48.0 KB | 8.0 KB | 32.0 KB | 0 | ~190 | ~3.6k |  |
| public.contract_version_usage_monthly | 0 | 40.0 KB | 0 B | 32.0 KB | 0 | ~10 | 2 |  |
| public.geo_blocks | 0 | 40.0 KB | 0 B | 32.0 KB | 0 | ~20 | 0 |  |
| public.lalamove_stops | 0 | 40.0 KB | 0 B | 32.0 KB | 0 | ~2.4k | 1 |  |
| public.password_reset_tokens | 0 | 40.0 KB | 0 B | 32.0 KB | 0 | ~200 | 1 |  |
| public.bitrix24_spa_sync | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | 4 | 1 |  |
| public.blocked_ips | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~100 | ~10 |  |
| public.geo_budget | 0 | 32.0 KB | 8.0 KB | 16.0 KB | 1 | ~1.6k | 8 |  |
| public.geo_defaults | 0 | 32.0 KB | 8.0 KB | 16.0 KB | 0 | 9 | ~20 |  |
| public.geo_price_list | 0 | 32.0 KB | 8.0 KB | 16.0 KB | 2 | ~1.6k | ~2.6k |  |
| public.geo_settings | 0 | 32.0 KB | 8.0 KB | 16.0 KB | ~30 | ~1.6k | ~90 |  |
| public.lalamove_priority_fee_history | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~20 | 0 |  |
| public.messaging_settings | 0 | 32.0 KB | 8.0 KB | 16.0 KB | 0 | ~20 | 3 |  |
| public.rate_limit_logs | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~100 | ~10 |  |
| public.report_presets | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~20 | 5 |  |
| public.user_passkeys | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~20 | 3 |  |
| public.bitrix24_activities | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~20 | 4 |  |
| public.bitrix24_stage_mappings | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 5 |  |
| public.bitrix24_sync | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~20 | 2 |  |
| public.driver_locations | 0 | 24.0 KB | 0 B | 24.0 KB | 0 | ~20 | 3 |  |
| public.email_verifications | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 3 |  |
| public.map_settings_overrides | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~20 | 0 |  |
| public.messaging_usage | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | 4 | 1 |  |
| public.mfa_sessions | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 2 |  |
| public.password_reset_requests | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~20 | 2 |  |
| public.risk_rules | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 2 |  |
| public.webauthn_challenges | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 1 |  |
| public.bitrix24_tokens | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | ~10 | 5 |  |
| public.ip_whitelist | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | ~20 | 3 |  |
| public.notification_optouts | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | 4 | 0 |  |
| public.region_cache | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | ~110 | 3 |  |
| public.security_test_logs | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | ~10 | 2 |  |
| public.tracking_events | ~200 | 0 B | 0 B | 0 B | 0 | 0 | 0 |  |


## Índices nunca usados (candidatos a remoção; ignore PK/UNIQUE)

| índice | tabela | tamanho |
|---|---|---|
| idx_query_telemetry_operation_created | public.query_telemetry | 184.0 KB |
| idx_query_telemetry_rpc_created | public.query_telemetry | 152.0 KB |
| idx_query_telemetry_severity_created | public.query_telemetry | 144.0 KB |
| idx_query_telemetry_table_created | public.query_telemetry | 184.0 KB |


## Storage

_nenhum_


## Auth (agregados)

| métrica | valor |
|---|---|
| usuários (~) | 4 |
| confirmados (~) | 4 |
| criados últimos 30d (~) | 1 |

| provider | usuários (~) |
|---|---|
| email | 4 |


## Consultas mais custosas (pg_stat_statements, desde o último reset)
| role | chamadas (~) | total ms (~) | média ms | query |
|---|---|---|---|---|
| postgres | ~90 | ~4.5M | 49193.79 | `SELECT table_schema AS schema, table_name AS "table", column_name AS "column", grantee, string_agg(privilege_type, $1 ORDER BY privilege_type) AS privileges FROM information_schema.column_privileges cp WHERE grantee NOT ` |
| postgres | ~29.9k | ~352k | 11.78 | `select net.http_post( url:=$1, headers:=$2::jsonb, body:=concat($3, now(), $4)::jsonb ) as request_id` |
| service_role | ~27.3k | ~224.8k | 8.25 | `WITH pgrst_source AS (SELECT "pgrst_call".* FROM "public"."get_pending_escalations"() pgrst_call) SELECT $3::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $4) ` |
| postgres | ~5k | ~146.1k | 29.07 | `select public.process_job_queue($1)` |
| postgres | ~220 | ~123k | 558.93 | `SELECT e.name, n.nspname AS schema, e.default_version, x.extversion AS installed_version, e.comment, ev.schema AS default_version_schema FROM pg_available_extensions e LEFT JOIN pg_extension x ON e.name = x.extname LEFT ` |
| postgres | ~90 | ~116.9k | 1270.59 | `SELECT jobid, runid, status, start_time, end_time, EXTRACT($2 FROM (end_time - start_time))::numeric(10,2) AS seconds, left(return_message, $3) AS return_message FROM (SELECT *, row_number() OVER (PARTITION BY jobid ORDE` |
| postgres | ~79.6k | ~85.4k | 1.07 | `WITH rows AS ( SELECT ctid FROM net._http_response WHERE created < now() - $1 ORDER BY created LIMIT $2 ) DELETE FROM net._http_response r USING rows WHERE r.ctid = rows.ctid` |
| authenticator | ~120 | ~85.1k | 703.36 | `SELECT name FROM pg_timezone_names` |
| postgres | ~79.6k | ~75.8k | 0.95 | `WITH rows AS ( SELECT id FROM net.http_request_queue ORDER BY id LIMIT $1 ) DELETE FROM net.http_request_queue q USING rows WHERE q.id = rows.id RETURNING q.id, q.method, q.url, timeout_milliseconds, array(select key \|\| ` |
| service_role | ~13.4k | ~40.7k | 3.05 | `WITH pgrst_source AS (SELECT pgrst_call.pgrst_scalar FROM (SELECT $1 AS json_data) pgrst_payload, LATERAL (SELECT "p_contract_name", "p_contract_version", "p_deprecated" FROM json_to_record(pgrst_payload.json_data) AS _(` |
| service_role | ~1.4k | ~39.3k | 27.25 | `WITH pgrst_source AS (INSERT INTO "public"."alerts"("message", "metadata", "severity", "title", "type") SELECT "pgrst_body"."message", "pgrst_body"."metadata", "pgrst_body"."severity", "pgrst_body"."title", "pgrst_body".` |
| postgres | ~20 | ~37.2k | 2327.66 | `with page as ( select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relreplident, nc.nspname as schema, -- Computed once here so the final select can reference it for both the -- raw byte count and pg_size` |
| service_role | ~2.3k | ~36.4k | 16.01 | `WITH pgrst_source AS (SELECT "pgrst_call".* FROM (SELECT $1 AS json_data) pgrst_payload, LATERAL (SELECT "p_dedup_key", "p_alert_type", "p_window_seconds" FROM json_to_record(pgrst_payload.json_data) AS _("p_dedup_key" t` |
| postgres | ~1000 | ~35.2k | 35.20 | `SELECT public.refresh_geo_jobs()` |
| service_role | ~1.4k | ~34.3k | 24.68 | `WITH pgrst_source AS (SELECT pgrst_call.pgrst_scalar FROM (SELECT $1 AS json_data) pgrst_payload, LATERAL (SELECT "p_job_id", "p_error_message", "p_error_stack" FROM json_to_record(pgrst_payload.json_data) AS _("p_job_id` |


## Conexões
| usuário | estado | n |
|---|---|---|
| authenticator | idle | 11 |
| pgbouncer | idle | 1 |
| postgres | active | 1 |
| postgres | idle | 1 |
| supabase_admin | idle | 2 |
| supabase_admin |  | 1 |
