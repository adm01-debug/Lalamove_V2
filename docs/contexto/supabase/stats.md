# Métricas (voláteis — mudam sem alteração de schema)

Valores aproximados de propósito, para não gerar commits a cada coleta. Fora de `snapshot.json`; o bruto está em `stats.json`.

## Banco

| métrica | valor |
|---|---|
| tamanho | 40.4 MB |
| schema public | 4.7 MB |


## Tabelas (ordenadas por tamanho)

| tabela | linhas (~) | total | heap | índices | linhas mortas (~) | seq scans (~) | idx scans (~) | último autovacuum |
|---|---|---|---|---|---|---|---|---|
| public.alerts | ~1.3k | 872.0 KB | 376.0 KB | 456.0 KB | 0 | ~2.1k | ~1.3k | 2026-11-16 |
| public.lalamove_orders | ~50 | 232.0 KB | 24.0 KB | 176.0 KB | 0 | ~700 | ~17.1k |  |
| public.tracking_events_y2026m08 | ~200 | 152.0 KB | 40.0 KB | 80.0 KB | 0 | ~30 | 0 |  |
| public.contacts | ~30 | 144.0 KB | 8.0 KB | 128.0 KB | 2 | ~90 | ~70 |  |
| public.driver_approval_queue | 0 | 144.0 KB | 8.0 KB | 128.0 KB | ~10 | ~30 | ~3.7k |  |
| public.contract_version_usage | ~80 | 128.0 KB | 8.0 KB | 80.0 KB | 0 | ~20 | ~930 | 2026-11-21 |
| public.query_telemetry | 0 | 128.0 KB | 8.0 KB | 112.0 KB | 2 | ~100 | ~20 |  |
| public.tracking_events_y2026m11 | 0 | 120.0 KB | 0 B | 112.0 KB | 0 | 9 | 0 |  |
| public.tracking_events_y2026m12 | 0 | 120.0 KB | 0 B | 112.0 KB | 0 | 4 | 0 |  |
| public.tracking_events_y2027m01 | 0 | 120.0 KB | 0 B | 112.0 KB | 0 | 4 | 0 |  |
| public.alert_dedup | 1 | 112.0 KB | 8.0 KB | 64.0 KB | ~50 | ~4.3k | ~110 | 2026-11-18 |
| public.drivers | ~20 | 104.0 KB | 8.0 KB | 88.0 KB | 0 | ~410 | ~17.2k |  |
| public.driver_incidents | ~20 | 96.0 KB | 8.0 KB | 80.0 KB | 0 | ~530 | ~100 |  |
| public.lalamove_status_history | ~130 | 96.0 KB | 16.0 KB | 48.0 KB | 0 | ~20 | 4 |  |
| public.auth_logs | 1 | 88.0 KB | 8.0 KB | 72.0 KB | 0 | ~100 | ~20 |  |
| public.lalamove_rate_limits | 0 | 88.0 KB | 8.0 KB | 72.0 KB | 0 | ~10 | 3 |  |
| public.active_tracking | ~20 | 80.0 KB | 8.0 KB | 64.0 KB | ~20 | ~1.8k | ~20 |  |
| public.cron_job_logs | 0 | 80.0 KB | 8.0 KB | 48.0 KB | ~40 | ~110 | ~10 | 2026-10-11 |
| public.user_roles | 2 | 80.0 KB | 8.0 KB | 64.0 KB | 2 | ~60 | ~197k |  |
| public.tracking_events_default | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~40 | 0 |  |
| public.tracking_events_y2026m05 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~30 | 0 |  |
| public.tracking_events_y2026m06 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~30 | 0 |  |
| public.tracking_events_y2026m07 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~30 | 0 |  |
| public.tracking_events_y2026m09 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~30 | 0 |  |
| public.tracking_events_y2026m10 | 0 | 72.0 KB | 0 B | 64.0 KB | 0 | ~30 | 0 |  |
| public.new_device_alerts | 1 | 64.0 KB | 8.0 KB | 48.0 KB | 0 | ~20 | 0 |  |
| public.runtime_error_logs | 0 | 64.0 KB | 0 B | 56.0 KB | 0 | ~100 | ~20 |  |
| public.user_devices | 1 | 64.0 KB | 8.0 KB | 48.0 KB | ~50 | ~20 | ~100 |  |
| public.webhook_events | 0 | 64.0 KB | 0 B | 56.0 KB | 0 | ~20 | 7 |  |
| public.driver_evaluations | 0 | 56.0 KB | 0 B | 48.0 KB | 0 | ~20 | 1 |  |
| public.lalamove_stop_proofs | 0 | 56.0 KB | 0 B | 48.0 KB | 0 | ~20 | 0 |  |
| public.role_permissions | ~60 | 56.0 KB | 8.0 KB | 48.0 KB | 0 | ~180 | ~100 |  |
| public.feature_flags | 3 | 48.0 KB | 8.0 KB | 32.0 KB | 0 | ~20 | 3 |  |
| public.lalamove_order_replacements | 0 | 48.0 KB | 0 B | 40.0 KB | 0 | ~20 | 2 |  |
| public.login_attempts | 0 | 48.0 KB | 0 B | 40.0 KB | 0 | ~100 | ~20 |  |
| public.mcp_diagnostics_grants | 1 | 48.0 KB | 8.0 KB | 32.0 KB | 2 | ~40 | ~20 |  |
| public.permissions | ~30 | 48.0 KB | 8.0 KB | 32.0 KB | 0 | ~120 | ~3.3k |  |
| public.alerts_sent | 0 | 40.0 KB | 0 B | 32.0 KB | 0 | ~20 | ~110 |  |
| public.contract_version_usage_monthly | 0 | 40.0 KB | 0 B | 32.0 KB | 0 | ~10 | 2 |  |
| public.geo_blocks | 0 | 40.0 KB | 0 B | 32.0 KB | 0 | ~20 | 0 |  |
| public.password_reset_tokens | 0 | 40.0 KB | 0 B | 32.0 KB | 0 | ~200 | 1 |  |
| public.alert_configurations | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~25.3k | ~24.2k |  |
| public.blocked_ips | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~100 | ~10 |  |
| public.lalamove_priority_fee_history | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~20 | 0 |  |
| public.lalamove_stops | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~20 | 1 |  |
| public.rate_limit_logs | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~90 | ~10 |  |
| public.report_presets | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~20 | 5 |  |
| public.user_passkeys | 0 | 32.0 KB | 0 B | 24.0 KB | 0 | ~20 | 3 |  |
| public.bitrix24_activities | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 4 |  |
| public.bitrix24_stage_mappings | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 5 |  |
| public.bitrix24_sync | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~20 | 2 |  |
| public.driver_locations | 0 | 24.0 KB | 0 B | 24.0 KB | 0 | ~20 | 3 |  |
| public.email_verifications | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 3 |  |
| public.lalamove_uapi_sessions | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~2.2k | 1 |  |
| public.map_settings_overrides | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~20 | 0 |  |
| public.mfa_sessions | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 2 |  |
| public.password_reset_requests | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~20 | 2 |  |
| public.risk_rules | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 2 |  |
| public.webauthn_challenges | 0 | 24.0 KB | 0 B | 16.0 KB | 0 | ~10 | 1 |  |
| public.bitrix24_tokens | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | ~10 | 5 |  |
| public.ip_whitelist | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | ~20 | 3 |  |
| public.region_cache | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | ~100 | 3 |  |
| public.security_test_logs | 0 | 16.0 KB | 0 B | 8.0 KB | 0 | ~10 | 2 |  |
| public.tracking_events | ~200 | 0 B | 0 B | 0 B | 0 | 0 | 0 |  |


## Índices nunca usados (candidatos a remoção; ignore PK/UNIQUE)

_nenhum_


## Storage

_nenhum_


## Auth (agregados)

| métrica | valor |
|---|---|
| usuários (~) | 3 |
| confirmados (~) | 3 |
| criados últimos 30d (~) | 0 |

| provider | usuários (~) |
|---|---|
| email | 3 |


## Consultas mais custosas (pg_stat_statements, desde o último reset)
| role | chamadas (~) | total ms (~) | média ms | query |
|---|---|---|---|---|
| postgres | ~28.7k | ~333.3k | 11.61 | `select net.http_post( url:=$1, headers:=$2::jsonb, body:=concat($3, now(), $4)::jsonb ) as request_id` |
| service_role | ~26.3k | ~208.8k | 7.95 | `WITH pgrst_source AS (SELECT "pgrst_call".* FROM "public"."get_pending_escalations"() pgrst_call) SELECT $3::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $4) ` |
| postgres | ~220 | ~123k | 558.93 | `SELECT e.name, n.nspname AS schema, e.default_version, x.extversion AS installed_version, e.comment, ev.schema AS default_version_schema FROM pg_available_extensions e LEFT JOIN pg_extension x ON e.name = x.extname LEFT ` |
| postgres | ~71.6k | ~75.2k | 1.05 | `WITH rows AS ( SELECT ctid FROM net._http_response WHERE created < now() - $1 ORDER BY created LIMIT $2 ) DELETE FROM net._http_response r USING rows WHERE r.ctid = rows.ctid` |
| postgres | 2 | ~71.3k | 35627.51 | `SELECT table_schema AS schema, table_name AS "table", column_name AS "column", grantee, string_agg(privilege_type, $1 ORDER BY privilege_type) AS privileges FROM information_schema.column_privileges cp WHERE grantee NOT ` |
| postgres | ~71.6k | ~62.8k | 0.88 | `WITH rows AS ( SELECT id FROM net.http_request_queue ORDER BY id LIMIT $1 ) DELETE FROM net.http_request_queue q USING rows WHERE q.id = rows.id RETURNING q.id, q.method, q.url, timeout_milliseconds, array(select key \|\| ` |
| authenticator | ~80 | ~52.4k | 623.99 | `SELECT name FROM pg_timezone_names` |
| service_role | ~1.4k | ~38.2k | 27.41 | `WITH pgrst_source AS (INSERT INTO "public"."alerts"("message", "metadata", "severity", "title", "type") SELECT "pgrst_body"."message", "pgrst_body"."metadata", "pgrst_body"."severity", "pgrst_body"."title", "pgrst_body".` |
| service_role | ~2.2k | ~35.4k | 16.14 | `WITH pgrst_source AS (SELECT "pgrst_call".* FROM (SELECT $1 AS json_data) pgrst_payload, LATERAL (SELECT "p_dedup_key", "p_alert_type", "p_window_seconds" FROM json_to_record(pgrst_payload.json_data) AS _("p_dedup_key" t` |
| postgres | ~20 | ~33.9k | 2257.99 | `with page as ( select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relreplident, nc.nspname as schema, -- Computed once here so the final select can reference it for both the -- raw byte count and pg_size` |
| postgres | ~28.7k | ~19.8k | 0.69 | `insert into net._http_response(id, status_code, content, headers, content_type, timed_out, error_msg) values ($1, $2, $3, $4, $5, $6, $7)` |
| postgres | ~60 | ~13.5k | 225.35 | `with f as ( -- CTE with sane arg_modes, arg_names, and arg_types. -- All three are always of the same length. -- All three include all args, including OUT and TABLE args. with functions as ( select *, -- proargmodes is n` |
| authenticator | ~80 | ~7.4k | 87.55 | `WITH -- Recursively get the base types of domains base_types AS ( WITH RECURSIVE recurse AS ( SELECT oid, typbasetype, typnamespace AS base_namespace, COALESCE(NULLIF(typbasetype, $2), oid) AS base_type FROM pg_type UNIO` |
| service_role | ~33.3k | ~7.2k | 0.22 | `select set_config('?', $1, true), set_config('?', $2, true), set_config('?', $3, true), set_config('?', $4, true), set_config('?', $5, true), set_config('request.head` |
| authenticated | ~170 | ~6.1k | 36.52 | `WITH pgrst_source AS ( SELECT "public"."alerts"."id" FROM "public"."alerts" WHERE "public"."alerts"."is_dismissed" = $1 LIMIT $2 OFFSET $3 ) , pgrst_source_count AS (SELECT $5 FROM "public"."alerts" WHERE "public"."alert` |


## Conexões
| usuário | estado | n |
|---|---|---|
| authenticator | idle | 8 |
| pgbouncer | idle | 1 |
| postgres | active | 1 |
| postgres | idle | 1 |
| supabase_admin | idle | 2 |
| supabase_admin |  | 1 |
