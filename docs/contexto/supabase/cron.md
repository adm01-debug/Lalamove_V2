# Cron (pg_cron)

Horários em UTC. Execuções recentes em `cron-runs.md`.

| id | nome | schedule | ativo | database | usuário | comando |
|---|---|---|---|---|---|---|
| 1 | provision-tracking-partitions | `5 0 1 * *` | sim | postgres | postgres | `SELECT public.provision_tracking_partitions();` |
| 2 | prune-tracking-partitions | `20 0 2 * *` | sim | postgres | postgres | `SELECT public.prune_tracking_events_partitions(6);` |
| 3 | rollup-contract-version-usage | `30 0 3 * *` | sim | postgres | postgres | `SELECT public.rollup_contract_version_usage(90);` |
| 4 | daily-cleanup-with-logging | `45 3 * * *` | sim | postgres | postgres | ` SELECT public.run_daily_cleanup_with_logging(); ` |
| 5 | cleanup-old-cron-logs | `15 4 * * 0` | sim | postgres | postgres | ` SELECT public.cleanup_old_cron_logs(); ` |
| 6 | cleanup-old-region-cache | `50 3 * * *` | sim | postgres | postgres | `SELECT public.cleanup_old_region_cache(90);` |
| 7 | cleanup_observability_logs_daily | `15 3 * * *` | sim | postgres | postgres | `SELECT public.cleanup_old_observability_logs(30, 14);` |
| 8 | cleanup_audit_logs_daily | `45 3 * * *` | sim | postgres | postgres | `SELECT public.cleanup_old_audit_logs();` |
| 17 | geo-cache-prune | `15 3 * * *` | sim | postgres | postgres | `DELETE FROM public.geo_cache WHERE expires_at < now()` |
| 18 | escalate-unacknowledged-alerts | `*/5 * * * *` | sim | postgres | postgres | `   select net.http_post(     url:='https://iecgydonctmabiijadsf.supabase.co/functions/v1/escalate-alerts',     headers:='{"Content-Type": "application/json", "apikey": "[REDACTED_KEY]"}'::jsonb,     body:=concat('{"time": "', now(), '"}')::jsonb   ) as request_id; ` |
| 19 | lalamove_uapi_token_refresh_hourly | `17 * * * *` | sim | postgres | postgres | `   select net.http_post(     url:='https://iecgydonctmabiijadsf.supabase.co/functions/v1/lalamove-token-refresh',     headers:='{"Content-Type": "application/json", "apikey": "[REDACTED_KEY]"}'::jsonb,     body:=concat('{"time": "', now(), '"}')::jsonb   ) as request_id; ` |
| 20 | process-job-queue | `* * * * *` | sim | postgres | postgres | `   select public.process_job_queue(10); ` |
| 25 | geo-jobs-refresh | `1-59/5 * * * *` | sim | postgres | postgres | `SELECT public.refresh_geo_jobs();` |
