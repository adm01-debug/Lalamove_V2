-- ============================================================================
-- MIGRATION: Materialized Views Cache System
-- Descrição: Views materializadas para cache de dados agregados
-- Versão: 1.0.0
-- Data: 2025-12-26
-- ============================================================================

-- ============================================================================
-- 1. DRIVER STATS CACHE VIEW
-- ============================================================================

-- Drop se já existir (para recriar)
DROP MATERIALIZED VIEW IF EXISTS driver_stats_cache CASCADE;

CREATE MATERIALIZED VIEW driver_stats_cache AS
SELECT 
  d.id as driver_id,
  d.name,
  d.lalamove_driver_id,
  d.phone,
  d.vehicle_plate,
  d.vehicle_type,
  d.status,
  d.risk_score,
  d.risk_level,
  d.is_whitelist,
  d.is_blacklist,
  
  -- Stats de entregas
  COUNT(DISTINCT lo.id) as total_deliveries,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'DELIVERED') as successful_deliveries,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'CANCELLED') as cancelled_deliveries,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'FAILED') as failed_deliveries,
  
  -- Taxa de falha
  COALESCE(
    ROUND(
      COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'FAILED')::NUMERIC / 
      NULLIF(COUNT(DISTINCT lo.id), 0) * 100,
      2
    ),
    0
  ) as failure_rate_percent,
  
  -- Atraso médio
  COALESCE(AVG(lo.delay_minutes) FILTER (WHERE lo.delay_minutes > 0), 0) as avg_delay_minutes,
  MAX(lo.delay_minutes) as max_delay_minutes,
  
  -- Avaliação média
  COALESCE(AVG(lo.rating), 0) as avg_rating,
  COUNT(lo.id) FILTER (WHERE lo.rating >= 4) as good_ratings_count,
  COUNT(lo.id) FILTER (WHERE lo.rating < 3) as bad_ratings_count,
  
  -- Incidentes
  COUNT(DISTINCT di.id) as total_incidents,
  COUNT(DISTINCT di.id) FILTER (WHERE di.resolved = false) as active_incidents,
  COUNT(DISTINCT di.id) FILTER (WHERE di.severity = 'CRITICAL') as critical_incidents,
  COUNT(DISTINCT di.id) FILTER (WHERE di.severity = 'HIGH') as high_incidents,
  
  -- Avaliações
  COUNT(DISTINCT de.id) as total_evaluations,
  COUNT(DISTINCT de.id) FILTER (WHERE de.approved = true) as approved_evaluations,
  COUNT(DISTINCT de.id) FILTER (WHERE de.requires_manual_approval = true) as manual_approvals_count,
  
  -- Datas
  MIN(lo.created_at) as first_delivery_at,
  MAX(lo.delivered_at) as last_delivery_at,
  MAX(de.created_at) as last_evaluation_at,
  
  -- Metadata
  NOW() as cached_at,
  d.created_at as driver_created_at,
  d.updated_at as driver_updated_at

FROM drivers d
LEFT JOIN lalamove_orders lo ON lo.driver_id = d.id
LEFT JOIN driver_incidents di ON di.driver_id = d.id
LEFT JOIN driver_evaluations de ON de.driver_id = d.id
GROUP BY d.id, d.name, d.lalamove_driver_id, d.phone, d.vehicle_plate, 
         d.vehicle_type, d.status, d.risk_score, d.risk_level, 
         d.is_whitelist, d.is_blacklist, d.created_at, d.updated_at;

-- ============================================================================
-- 2. ÍNDICES NA MATERIALIZED VIEW
-- ============================================================================

-- Índice único (primary key)
CREATE UNIQUE INDEX idx_driver_stats_cache_driver_id 
  ON driver_stats_cache(driver_id);

-- Índices para queries comuns
CREATE INDEX idx_driver_stats_cache_risk_level 
  ON driver_stats_cache(risk_level);

CREATE INDEX idx_driver_stats_cache_status 
  ON driver_stats_cache(status);

CREATE INDEX idx_driver_stats_cache_failure_rate 
  ON driver_stats_cache(failure_rate_percent DESC);

CREATE INDEX idx_driver_stats_cache_total_deliveries 
  ON driver_stats_cache(total_deliveries DESC);

CREATE INDEX idx_driver_stats_cache_whitelist 
  ON driver_stats_cache(is_whitelist) 
  WHERE is_whitelist = true;

CREATE INDEX idx_driver_stats_cache_blacklist 
  ON driver_stats_cache(is_blacklist) 
  WHERE is_blacklist = true;

CREATE INDEX idx_driver_stats_cache_active_incidents 
  ON driver_stats_cache(active_incidents) 
  WHERE active_incidents > 0;

-- ============================================================================
-- 3. DELIVERY HOURLY STATS CACHE
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS delivery_hourly_stats_cache CASCADE;

CREATE MATERIALIZED VIEW delivery_hourly_stats_cache AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE status = 'DELIVERED') as delivered_count,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count,
  COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count,
  COALESCE(AVG(delay_minutes), 0) as avg_delay_minutes,
  COALESCE(AVG(rating), 0) as avg_rating,
  COUNT(DISTINCT driver_id) as unique_drivers,
  NOW() as cached_at
FROM lalamove_orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

CREATE INDEX idx_delivery_hourly_stats_hour 
  ON delivery_hourly_stats_cache(hour DESC);

-- ============================================================================
-- 4. RISK LEVEL DISTRIBUTION CACHE
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS risk_level_distribution_cache CASCADE;

CREATE MATERIALIZED VIEW risk_level_distribution_cache AS
SELECT 
  risk_level,
  COUNT(*) as driver_count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as percentage,
  COALESCE(AVG(risk_score), 0) as avg_risk_score,
  MIN(risk_score) as min_risk_score,
  MAX(risk_score) as max_risk_score,
  NOW() as cached_at
FROM drivers
WHERE status != 'DELETED'
GROUP BY risk_level
ORDER BY 
  CASE risk_level
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
    ELSE 5
  END;

-- ============================================================================
-- 5. FUNÇÕES HELPER PARA USAR CACHE
-- ============================================================================

-- Função: Buscar stats de um motorista (usa cache)
CREATE OR REPLACE FUNCTION get_driver_stats(p_driver_id UUID)
RETURNS TABLE(
  driver_id UUID,
  name TEXT,
  lalamove_driver_id TEXT,
  phone TEXT,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  status TEXT,
  risk_score NUMERIC,
  risk_level TEXT,
  is_whitelist BOOLEAN,
  is_blacklist BOOLEAN,
  total_deliveries BIGINT,
  successful_deliveries BIGINT,
  cancelled_deliveries BIGINT,
  failed_deliveries BIGINT,
  failure_rate_percent NUMERIC,
  avg_delay_minutes NUMERIC,
  max_delay_minutes INTEGER,
  avg_rating NUMERIC,
  good_ratings_count BIGINT,
  bad_ratings_count BIGINT,
  total_incidents BIGINT,
  active_incidents BIGINT,
  critical_incidents BIGINT,
  high_incidents BIGINT,
  total_evaluations BIGINT,
  approved_evaluations BIGINT,
  manual_approvals_count BIGINT,
  first_delivery_at TIMESTAMPTZ,
  last_delivery_at TIMESTAMPTZ,
  last_evaluation_at TIMESTAMPTZ,
  cached_at TIMESTAMPTZ,
  driver_created_at TIMESTAMPTZ,
  driver_updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dsc.driver_id,
    dsc.name,
    dsc.lalamove_driver_id,
    dsc.phone,
    dsc.vehicle_plate,
    dsc.vehicle_type,
    dsc.status,
    dsc.risk_score,
    dsc.risk_level,
    dsc.is_whitelist,
    dsc.is_blacklist,
    dsc.total_deliveries,
    dsc.successful_deliveries,
    dsc.cancelled_deliveries,
    dsc.failed_deliveries,
    dsc.failure_rate_percent,
    dsc.avg_delay_minutes,
    dsc.max_delay_minutes,
    dsc.avg_rating,
    dsc.good_ratings_count,
    dsc.bad_ratings_count,
    dsc.total_incidents,
    dsc.active_incidents,
    dsc.critical_incidents,
    dsc.high_incidents,
    dsc.total_evaluations,
    dsc.approved_evaluations,
    dsc.manual_approvals_count,
    dsc.first_delivery_at,
    dsc.last_delivery_at,
    dsc.last_evaluation_at,
    dsc.cached_at,
    dsc.driver_created_at,
    dsc.driver_updated_at
  FROM driver_stats_cache dsc
  WHERE dsc.driver_id = p_driver_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Buscar top motoristas (usa cache)
CREATE OR REPLACE FUNCTION get_top_drivers(
  p_limit INTEGER DEFAULT 10,
  p_order_by TEXT DEFAULT 'total_deliveries'
)
RETURNS TABLE(
  driver_id UUID,
  name TEXT,
  total_deliveries BIGINT,
  avg_rating NUMERIC,
  failure_rate_percent NUMERIC,
  risk_level TEXT
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT 
      driver_id,
      name,
      total_deliveries,
      avg_rating,
      failure_rate_percent,
      risk_level
    FROM driver_stats_cache
    WHERE status != ''DELETED''
    ORDER BY %I DESC
    LIMIT %L
  ', p_order_by, p_limit);
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Buscar stats horárias
CREATE OR REPLACE FUNCTION get_hourly_stats(
  p_hours_ago INTEGER DEFAULT 24
)
RETURNS TABLE(
  hour TIMESTAMPTZ,
  total_orders BIGINT,
  delivered_count BIGINT,
  cancelled_count BIGINT,
  failed_count BIGINT,
  avg_delay_minutes NUMERIC,
  avg_rating NUMERIC,
  unique_drivers BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dhsc.hour,
    dhsc.total_orders,
    dhsc.delivered_count,
    dhsc.cancelled_count,
    dhsc.failed_count,
    dhsc.avg_delay_minutes,
    dhsc.avg_rating,
    dhsc.unique_drivers
  FROM delivery_hourly_stats_cache dhsc
  WHERE dhsc.hour >= NOW() - (p_hours_ago || ' hours')::INTERVAL
  ORDER BY dhsc.hour DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: Distribuição de risco
CREATE OR REPLACE FUNCTION get_risk_distribution()
RETURNS TABLE(
  risk_level TEXT,
  driver_count BIGINT,
  percentage NUMERIC,
  avg_risk_score NUMERIC,
  min_risk_score NUMERIC,
  max_risk_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rldc.risk_level,
    rldc.driver_count,
    rldc.percentage,
    rldc.avg_risk_score,
    rldc.min_risk_score,
    rldc.max_risk_score
  FROM risk_level_distribution_cache rldc
  ORDER BY 
    CASE rldc.risk_level
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 4
      ELSE 5
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 6. CONFIGURAR REFRESH AUTOMÁTICO (pg_cron)
-- ============================================================================

-- Refresh driver stats a cada 15 minutos
SELECT cron.schedule(
  'refresh-driver-stats-cache',
  '*/15 * * * *',  -- A cada 15 minutos
  'REFRESH MATERIALIZED VIEW CONCURRENTLY driver_stats_cache'
);

-- Refresh hourly stats a cada hora (no minuto 5)
SELECT cron.schedule(
  'refresh-delivery-hourly-stats',
  '5 * * * *',  -- A cada hora, no minuto 5
  'REFRESH MATERIALIZED VIEW CONCURRENTLY delivery_hourly_stats_cache'
);

-- Refresh risk distribution a cada 30 minutos
SELECT cron.schedule(
  'refresh-risk-distribution',
  '*/30 * * * *',  -- A cada 30 minutos
  'REFRESH MATERIALIZED VIEW CONCURRENTLY risk_level_distribution_cache'
);

-- ============================================================================
-- 7. FUNÇÃO MANUAL DE REFRESH
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_all_caches()
RETURNS TABLE(
  cache_name TEXT,
  refresh_started TIMESTAMPTZ,
  refresh_completed TIMESTAMPTZ,
  duration_seconds NUMERIC
) AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  -- Driver stats
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY driver_stats_cache;
  v_end := clock_timestamp();
  
  cache_name := 'driver_stats_cache';
  refresh_started := v_start;
  refresh_completed := v_end;
  duration_seconds := EXTRACT(EPOCH FROM (v_end - v_start));
  RETURN NEXT;
  
  -- Hourly stats
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY delivery_hourly_stats_cache;
  v_end := clock_timestamp();
  
  cache_name := 'delivery_hourly_stats_cache';
  refresh_started := v_start;
  refresh_completed := v_end;
  duration_seconds := EXTRACT(EPOCH FROM (v_end - v_start));
  RETURN NEXT;
  
  -- Risk distribution
  v_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY risk_level_distribution_cache;
  v_end := clock_timestamp();
  
  cache_name := 'risk_level_distribution_cache';
  refresh_started := v_start;
  refresh_completed := v_end;
  duration_seconds := EXTRACT(EPOCH FROM (v_end - v_start));
  RETURN NEXT;
  
  RAISE NOTICE 'All caches refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. VIEW: CACHE STATUS
-- ============================================================================

CREATE OR REPLACE VIEW cache_status AS
SELECT 
  'driver_stats_cache' as cache_name,
  (SELECT cached_at FROM driver_stats_cache ORDER BY cached_at DESC LIMIT 1) as last_refresh,
  (SELECT COUNT(*) FROM driver_stats_cache) as row_count,
  pg_size_pretty(pg_total_relation_size('driver_stats_cache')) as size
UNION ALL
SELECT 
  'delivery_hourly_stats_cache',
  (SELECT cached_at FROM delivery_hourly_stats_cache ORDER BY cached_at DESC LIMIT 1),
  (SELECT COUNT(*) FROM delivery_hourly_stats_cache),
  pg_size_pretty(pg_total_relation_size('delivery_hourly_stats_cache'))
UNION ALL
SELECT 
  'risk_level_distribution_cache',
  (SELECT cached_at FROM risk_level_distribution_cache ORDER BY cached_at DESC LIMIT 1),
  (SELECT COUNT(*) FROM risk_level_distribution_cache),
  pg_size_pretty(pg_total_relation_size('risk_level_distribution_cache'));

-- ============================================================================
-- 9. COMENTÁRIOS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW driver_stats_cache IS 'Cache de estatísticas agregadas por motorista';
COMMENT ON MATERIALIZED VIEW delivery_hourly_stats_cache IS 'Cache de estatísticas de entregas por hora';
COMMENT ON MATERIALIZED VIEW risk_level_distribution_cache IS 'Cache de distribuição de níveis de risco';

COMMENT ON FUNCTION get_driver_stats IS 'Busca stats de um motorista (usa cache)';
COMMENT ON FUNCTION get_top_drivers IS 'Busca top motoristas ordenados (usa cache)';
COMMENT ON FUNCTION get_hourly_stats IS 'Busca estatísticas horárias (usa cache)';
COMMENT ON FUNCTION get_risk_distribution IS 'Busca distribuição de riscos (usa cache)';
COMMENT ON FUNCTION refresh_all_caches IS 'Atualiza todos os caches manualmente';

-- ============================================================================
-- 10. GRANTS
-- ============================================================================

GRANT SELECT ON driver_stats_cache TO authenticated, service_role;
GRANT SELECT ON delivery_hourly_stats_cache TO authenticated, service_role;
GRANT SELECT ON risk_level_distribution_cache TO authenticated, service_role;
GRANT SELECT ON cache_status TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION get_driver_stats TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_top_drivers TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_hourly_stats TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_risk_distribution TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_all_caches TO service_role;

-- ============================================================================
-- 11. INITIAL REFRESH
-- ============================================================================

-- Fazer primeiro refresh
REFRESH MATERIALIZED VIEW driver_stats_cache;
REFRESH MATERIALIZED VIEW delivery_hourly_stats_cache;
REFRESH MATERIALIZED VIEW risk_level_distribution_cache;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
