-- Cache system: materialized views + status + refresh (completa trabalho parcial).
--
-- Contexto: o frontend (src/hooks/useCacheViews.ts, useCachedStats.ts, paginas
-- /cache-status e /cache-monitoring) foi escrito esperando 3 materialized views
-- (driver_stats_cache, delivery_metrics_cache, hourly_metrics_cache) + uma view
-- de status (cache_status) + funcao de refresh (refresh_cache_view). O backend
-- nunca foi aplicado ao banco (migrations de 2025-12-26 ficaram fora do ledger,
-- congelado em 20260902000000) e as versoes originais referenciavam colunas que
-- nao existem no schema real (orders, delivery_value, completed_at, rating em
-- lalamove_orders, is_whitelisted/is_blacklisted, driver_approvals).
--
-- Esta migration recria o sistema adaptado ao schema vivo (drivers, lalamove_orders,
-- driver_incidents, driver_evaluations, driver_approval_queue). Aditiva e
-- idempotente (IF NOT EXISTS / OR REPLACE). Nao altera dados existentes.

-- ============================================================================
-- 1. MATERIALIZED VIEW: DRIVER STATS CACHE
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS driver_stats_cache AS
SELECT
  d.id                                                          AS driver_id,
  d.name                                                        AS driver_name,
  d.lalamove_id                                                 AS lalamove_driver_id,
  d.phone,
  d.vehicle_type,
  d.status                                                      AS driver_status,
  d.risk_score,
  d.risk_level,
  d.whitelisted                                                 AS is_whitelisted,
  d.blacklisted                                                 AS is_blacklisted,
  COALESCE(d.total_deliveries, 0)                               AS total_deliveries,
  COALESCE(d.completed_deliveries, 0)                           AS completed_deliveries,
  COALESCE(d.cancelled_deliveries, 0)                           AS cancelled_deliveries,
  COALESCE(d.failed_deliveries, 0)                              AS failed_deliveries,
  COALESCE(d.rating, 0)                                         AS avg_rating,
  d.last_delivery_at,
  d.last_active_at,
  d.created_at                                                  AS driver_created_at,
  NOW()                                                         AS cached_at
FROM drivers d;

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_stats_cache_driver_id
  ON driver_stats_cache(driver_id);

-- ============================================================================
-- 2. MATERIALIZED VIEW: DELIVERY METRICS CACHE
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS delivery_metrics_cache AS
SELECT
  DATE(lo.created_at)                                          AS delivery_date,
  COUNT(*)                                                     AS total_orders,
  COUNT(*) FILTER (WHERE lo.status = 'COMPLETED')              AS completed_orders,
  COUNT(*) FILTER (WHERE lo.status = 'CANCELLED')              AS cancelled_orders,
  COUNT(*) FILTER (WHERE lo.status IN ('REJECTED','EXPIRED'))  AS failed_orders,
  COUNT(*) FILTER (WHERE lo.status IN ('ON_GOING','PICKED_UP')) AS in_progress_orders,
  COALESCE(AVG(lo.delay_minutes), 0)                           AS avg_delay_minutes,
  COALESCE(SUM(lo.total_cost), 0)                              AS total_value,
  COALESCE(AVG(lo.total_cost), 0)                              AS avg_value,
  COALESCE(MAX(lo.total_cost), 0)                              AS max_value,
  NOW()                                                        AS cached_at
FROM lalamove_orders lo
GROUP BY DATE(lo.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_metrics_cache_date
  ON delivery_metrics_cache(delivery_date);

-- ============================================================================
-- 3. MATERIALIZED VIEW: HOURLY METRICS CACHE
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_metrics_cache AS
SELECT
  DATE_TRUNC('hour', lo.created_at)                            AS hour,
  COUNT(*)                                                     AS total_orders,
  COUNT(*) FILTER (WHERE lo.status = 'COMPLETED')              AS completed_orders,
  COALESCE(AVG(lo.total_cost), 0)                              AS avg_value,
  COALESCE(SUM(lo.total_cost), 0)                              AS total_value,
  NOW()                                                        AS cached_at
FROM lalamove_orders lo
GROUP BY DATE_TRUNC('hour', lo.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_metrics_cache_hour
  ON hourly_metrics_cache(hour);

-- ============================================================================
-- 4. VIEW DE STATUS DO CACHE
-- ============================================================================

CREATE OR REPLACE VIEW cache_status AS
SELECT
  view_name,
  row_count,
  last_refresh,
  refresh_duration_ms,
  (last_refresh IS NULL OR last_refresh < NOW() - INTERVAL '1 hour') AS is_stale,
  CASE
    WHEN last_refresh IS NULL THEN 'never_refreshed'
    WHEN last_refresh < NOW() - INTERVAL '1 hour' THEN 'stale'
    ELSE 'success'
  END AS status
FROM (
  SELECT 'driver_stats_cache'    AS view_name, (SELECT COUNT(*) FROM driver_stats_cache)    AS row_count,
         (SELECT MAX(cached_at) FROM driver_stats_cache)    AS last_refresh, NULL::INTEGER AS refresh_duration_ms
  UNION ALL
  SELECT 'delivery_metrics_cache', (SELECT COUNT(*) FROM delivery_metrics_cache),
         (SELECT MAX(cached_at) FROM delivery_metrics_cache), NULL::INTEGER
  UNION ALL
  SELECT 'hourly_metrics_cache',   (SELECT COUNT(*) FROM hourly_metrics_cache),
         (SELECT MAX(cached_at) FROM hourly_metrics_cache), NULL::INTEGER
) s;

-- ============================================================================
-- 5. FUNCAO DE REFRESH (view unica ou todas)
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_cache_view(p_view_name TEXT DEFAULT NULL)
RETURNS TABLE (
  view_refreshed TEXT,
  duration_ms INTEGER,
  row_count BIGINT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_start TIMESTAMPTZ;
  v_dur INTEGER;
  v_count BIGINT;
BEGIN
  IF p_view_name IS NULL THEN
    FOR v_name IN SELECT unnest(ARRAY['driver_stats_cache','delivery_metrics_cache','hourly_metrics_cache'])
    LOOP
      RETURN QUERY SELECT * FROM refresh_cache_view(v_name);
    END LOOP;
    RETURN;
  END IF;

  IF p_view_name NOT IN ('driver_stats_cache','delivery_metrics_cache','hourly_metrics_cache') THEN
    RETURN QUERY SELECT p_view_name, NULL::INTEGER, NULL::BIGINT, 'failed'::TEXT;
    RETURN;
  END IF;

  v_start := clock_timestamp();
  BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', p_view_name);
    v_dur := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER;
    EXECUTE format('SELECT COUNT(*) FROM %I', p_view_name) INTO v_count;
    RETURN QUERY SELECT p_view_name, v_dur, v_count, 'success'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT p_view_name, NULL::INTEGER, NULL::BIGINT, 'failed'::TEXT;
  END;
END;
$$;

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT SELECT ON driver_stats_cache TO authenticated, anon, service_role;
GRANT SELECT ON delivery_metrics_cache TO authenticated, anon, service_role;
GRANT SELECT ON hourly_metrics_cache TO authenticated, anon, service_role;
GRANT SELECT ON cache_status TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION refresh_cache_view(TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION refresh_cache_view(TEXT) FROM PUBLIC;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW driver_stats_cache IS 'Cache de estatisticas consolidadas de motoristas';
COMMENT ON MATERIALIZED VIEW delivery_metrics_cache IS 'Cache de metricas diarias de entregas';
COMMENT ON MATERIALIZED VIEW hourly_metrics_cache IS 'Cache de metricas horarias de entregas';
COMMENT ON VIEW cache_status IS 'Status de cada materialized view de cache (stale/atualizada)';
COMMENT ON FUNCTION refresh_cache_view(TEXT) IS 'Atualiza uma materialized view de cache ou todas';

-- ============================================================================
-- 8. REFRESH INICIAL
-- ============================================================================

REFRESH MATERIALIZED VIEW driver_stats_cache;
REFRESH MATERIALIZED VIEW delivery_metrics_cache;
REFRESH MATERIALIZED VIEW hourly_metrics_cache;
