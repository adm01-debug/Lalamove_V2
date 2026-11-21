-- Cron de refresh das materialized views de cache.
--
-- Causa: as migrations 20250102000002_cache_system_complete.sql e
-- 20251226020000_create_materialized_views_cache.sql estao no ledger como aplicadas,
-- mas o DDL nunca rodou (drift de sync Lovable) - e na 20250102000002 o bloco do
-- cron esta comentado. Sem cron, as 3 views ficam stale e /cache-monitoring serve
-- dados velhos (observado: ultimo refresh 15:22 UTC, is_stale=true).
--
-- Aditiva e idempotente: unschedule + schedule. Usa a funcao ja existente
-- public.refresh_cache_view(TEXT) (REFRESH ... CONCURRENTLY, indices unicos presentes).

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-cache-views') THEN
    PERFORM cron.unschedule('refresh-cache-views');
  END IF;
END
$do$;

SELECT cron.schedule(
  'refresh-cache-views',
  '3 * * * *',
  $cron$SELECT public.refresh_cache_view();$cron$
);