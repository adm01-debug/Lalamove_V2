-- Migration: Cache System com Materialized Views
-- Criado em: 2025-12-26
-- Objetivo: Otimizar queries com cache SQL nativo

-- ============================================================================
-- 1. MATERIALIZED VIEW: DRIVER STATS CACHE
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS driver_stats_cache AS
SELECT 
  d.id as driver_id,
  d.name as driver_name,
  d.lalamove_driver_id,
  d.phone,
  d.vehicle_type,
  d.status as driver_status,
  d.risk_score,
  d.risk_level,
  d.is_whitelisted,
  d.is_blacklisted,
  
  -- Estatísticas de entregas
  COUNT(DISTINCT lo.id) as total_deliveries,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'COMPLETED') as completed_deliveries,
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
  
  -- Atrasos
  COALESCE(AVG(lo.delay_minutes) FILTER (WHERE lo.delay_minutes IS NOT NULL), 0) as avg_delay_minutes,
  COALESCE(MAX(lo.delay_minutes), 0) as max_delay_minutes,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.delay_minutes > 15) as delays_over_15min,
  
  -- Avaliações
  COALESCE(AVG(lo.rating) FILTER (WHERE lo.rating IS NOT NULL), 0) as avg_rating,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.rating IS NOT NULL) as total_ratings,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.rating <= 3) as low_ratings,
  
  -- Distância e tempos
  COALESCE(SUM(lo.distance_km), 0) as total_distance_km,
  COALESCE(AVG(lo.distance_km), 0) as avg_distance_km,
  COALESCE(AVG(EXTRACT(EPOCH FROM (lo.delivered_at - lo.picked_up_at))/60), 0) as avg_delivery_time_minutes,
  
  -- Incidentes
  COUNT(DISTINCT di.id) as total_incidents,
  COUNT(DISTINCT di.id) FILTER (WHERE di.severity = 'CRITICAL') as critical_incidents,
  COUNT(DISTINCT di.id) FILTER (WHERE di.severity = 'HIGH') as high_incidents,
  COUNT(DISTINCT di.id) FILTER (WHERE di.resolved = false) as active_incidents,
  
  -- Avaliações do sistema
  COUNT(DISTINCT de.id) as total_evaluations,
  COUNT(DISTINCT de.id) FILTER (WHERE de.approved = true) as approved_evaluations,
  COUNT(DISTINCT de.id) FILTER (WHERE de.requires_manual_approval = true) as manual_approval_required,
  COALESCE(AVG(de.risk_score), 0) as avg_evaluation_score,
  
  -- Aprovações pendentes
  COUNT(DISTINCT da.id) FILTER (WHERE da.status = 'PENDING') as pending_approvals,
  COUNT(DISTINCT da.id) FILTER (WHERE da.status = 'APPROVED') as total_approved,
  COUNT(DISTINCT da.id) FILTER (WHERE da.status = 'REJECTED') as total_rejected,
  
  -- Timestamps
  MAX(lo.created_at) as last_delivery_at,
  MIN(lo.created_at) as first_delivery_at,
  COUNT(DISTINCT DATE(lo.created_at)) as active_days,
  
  -- Metadata
  NOW() as cached_at,
  d.created_at as driver_created_at,
  d.updated_at as driver_updated_at

FROM drivers d
LEFT JOIN lalamove_orders lo ON lo.driver_id = d.id
LEFT JOIN driver_incidents di ON di.driver_id = d.id
LEFT JOIN driver_evaluations de ON de.driver_id = d.id
LEFT JOIN driver_approvals da ON da.driver_id = d.id

GROUP BY 
  d.id,
  d.name,
  d.lalamove_driver_id,
  d.phone,
  d.vehicle_type,
  d.status,
  d.risk_score,
  d.risk_level,
  d.is_whitelisted,
  d.is_blacklisted,
  d.created_at,
  d.updated_at;

-- ============================================================================
-- 2. ÍNDICES NA MATERIALIZED VIEW
-- ============================================================================

CREATE UNIQUE INDEX idx_driver_stats_cache_driver_id 
  ON driver_stats_cache(driver_id);

CREATE INDEX idx_driver_stats_cache_risk_level 
  ON driver_stats_cache(risk_level);

CREATE INDEX idx_driver_stats_cache_failure_rate 
  ON driver_stats_cache(failure_rate_percent DESC);

CREATE INDEX idx_driver_stats_cache_whitelisted 
  ON driver_stats_cache(is_whitelisted) 
  WHERE is_whitelisted = true;

CREATE INDEX idx_driver_stats_cache_blacklisted 
  ON driver_stats_cache(is_blacklisted) 
  WHERE is_blacklisted = true;

CREATE INDEX idx_driver_stats_cache_pending_approvals 
  ON driver_stats_cache(pending_approvals DESC)
  WHERE pending_approvals > 0;

-- ============================================================================
-- 3. MATERIALIZED VIEW: DELIVERY METRICS CACHE
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS delivery_metrics_cache AS
SELECT 
  DATE(lo.created_at) as delivery_date,
  
  -- Contagens
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE lo.status = 'COMPLETED') as completed_orders,
  COUNT(*) FILTER (WHERE lo.status = 'CANCELLED') as cancelled_orders,
  COUNT(*) FILTER (WHERE lo.status = 'FAILED') as failed_orders,
  COUNT(*) FILTER (WHERE lo.status = 'IN_TRANSIT') as in_transit_orders,
  
  -- Taxas
  ROUND(
    COUNT(*) FILTER (WHERE lo.status = 'COMPLETED')::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as completion_rate_percent,
  
  ROUND(
    COUNT(*) FILTER (WHERE lo.status = 'FAILED')::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as failure_rate_percent,
  
  -- Métricas de performance
  AVG(lo.delay_minutes) as avg_delay_minutes,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lo.delay_minutes) as median_delay_minutes,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY lo.delay_minutes) as p95_delay_minutes,
  
  -- Distâncias
  AVG(lo.distance_km) as avg_distance_km,
  SUM(lo.distance_km) as total_distance_km,
  
  -- Avaliações
  AVG(lo.rating) as avg_rating,
  COUNT(*) FILTER (WHERE lo.rating <= 3) as low_ratings_count,
  
  -- Motoristas únicos
  COUNT(DISTINCT lo.driver_id) as unique_drivers,
  
  -- SLA
  COUNT(*) FILTER (WHERE lo.delay_minutes <= 15) as on_time_deliveries,
  ROUND(
    COUNT(*) FILTER (WHERE lo.delay_minutes <= 15)::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as on_time_rate_percent,
  
  -- Metadata
  NOW() as cached_at

FROM lalamove_orders lo
WHERE lo.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(lo.created_at)
ORDER BY delivery_date DESC;

-- ============================================================================
-- 4. ÍNDICES NA DELIVERY METRICS
-- ============================================================================

CREATE UNIQUE INDEX idx_delivery_metrics_cache_date 
  ON delivery_metrics_cache(delivery_date DESC);

CREATE INDEX idx_delivery_metrics_cache_failure_rate 
  ON delivery_metrics_cache(failure_rate_percent DESC);

-- ============================================================================
-- 5. MATERIALIZED VIEW: HOURLY METRICS
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_metrics_cache AS
SELECT 
  DATE_TRUNC('hour', lo.created_at) as hour,
  
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE lo.status = 'COMPLETED') as completed_orders,
  COUNT(*) FILTER (WHERE lo.status = 'FAILED') as failed_orders,
  
  AVG(lo.delay_minutes) as avg_delay_minutes,
  AVG(lo.rating) as avg_rating,
  
  COUNT(DISTINCT lo.driver_id) as active_drivers,
  
  NOW() as cached_at

FROM lalamove_orders lo
WHERE lo.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', lo.created_at)
ORDER BY hour DESC;

-- ============================================================================
-- 6. ÍNDICE HOURLY METRICS
-- ============================================================================

CREATE UNIQUE INDEX idx_hourly_metrics_cache_hour 
  ON hourly_metrics_cache(hour DESC);

-- ============================================================================
-- 7. FUNÇÕES HELPER PARA ACESSAR CACHE
-- ============================================================================

-- Buscar stats de motorista (usa cache)
CREATE OR REPLACE FUNCTION get_driver_stats_cached(p_driver_id UUID)
RETURNS driver_stats_cache AS $$
DECLARE
  v_stats driver_stats_cache;
BEGIN
  SELECT * INTO v_stats
  FROM driver_stats_cache
  WHERE driver_id = p_driver_id;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql STABLE;

-- Buscar top motoristas por métrica
CREATE OR REPLACE FUNCTION get_top_drivers_by_metric(
  p_metric TEXT,
  p_limit INTEGER DEFAULT 10,
  p_order TEXT DEFAULT 'DESC'
)
RETURNS TABLE(
  driver_id UUID,
  driver_name TEXT,
  metric_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT 
      driver_id,
      driver_name,
      %I::NUMERIC as metric_value
    FROM driver_stats_cache
    WHERE %I IS NOT NULL
    ORDER BY %I %s
    LIMIT %L',
    p_metric,
    p_metric,
    p_metric,
    CASE WHEN upper(p_order) = 'DESC' THEN 'DESC' ELSE 'ASC' END,
    p_limit
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Buscar métricas de entrega por período
CREATE OR REPLACE FUNCTION get_delivery_metrics_cached(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS SETOF delivery_metrics_cache AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM delivery_metrics_cache
  WHERE delivery_date BETWEEN p_start_date AND p_end_date
  ORDER BY delivery_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Buscar métricas horárias
CREATE OR REPLACE FUNCTION get_hourly_metrics_cached(
  p_hours_ago INTEGER DEFAULT 24
)
RETURNS SETOF hourly_metrics_cache AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM hourly_metrics_cache
  WHERE hour >= NOW() - (p_hours_ago || ' hours')::INTERVAL
  ORDER BY hour DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. FUNÇÃO PARA REFRESH DE TODAS AS VIEWS
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_all_cache_views()
RETURNS TABLE(
  view_name TEXT,
  refresh_duration_ms INTEGER,
  rows_count BIGINT
) AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_duration INTEGER;
  v_count BIGINT;
BEGIN
  -- Refresh driver_stats_cache
  v_start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY driver_stats_cache;
  v_duration := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;
  SELECT COUNT(*) INTO v_count FROM driver_stats_cache;
  
  RETURN QUERY SELECT 'driver_stats_cache'::TEXT, v_duration, v_count;
  
  -- Refresh delivery_metrics_cache
  v_start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY delivery_metrics_cache;
  v_duration := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;
  SELECT COUNT(*) INTO v_count FROM delivery_metrics_cache;
  
  RETURN QUERY SELECT 'delivery_metrics_cache'::TEXT, v_duration, v_count;
  
  -- Refresh hourly_metrics_cache
  v_start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_metrics_cache;
  v_duration := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;
  SELECT COUNT(*) INTO v_count FROM hourly_metrics_cache;
  
  RETURN QUERY SELECT 'hourly_metrics_cache'::TEXT, v_duration, v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. CRON JOB PARA REFRESH AUTOMÁTICO
-- ============================================================================

-- Refresh driver stats a cada 15 minutos
SELECT cron.schedule(
  'refresh-driver-stats-cache',
  '*/15 * * * *',  -- A cada 15 minutos
  'REFRESH MATERIALIZED VIEW CONCURRENTLY driver_stats_cache'
);

-- Refresh delivery metrics a cada 30 minutos
SELECT cron.schedule(
  'refresh-delivery-metrics-cache',
  '*/30 * * * *',  -- A cada 30 minutos
  'REFRESH MATERIALIZED VIEW CONCURRENTLY delivery_metrics_cache'
);

-- Refresh hourly metrics a cada 5 minutos
SELECT cron.schedule(
  'refresh-hourly-metrics-cache',
  '*/5 * * * *',  -- A cada 5 minutos
  'REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_metrics_cache'
);

-- ============================================================================
-- 10. VIEW PARA MONITORAMENTO DE CACHE
-- ============================================================================

CREATE OR REPLACE VIEW cache_status AS
SELECT 
  'driver_stats_cache' as cache_name,
  (SELECT COUNT(*) FROM driver_stats_cache) as rows_count,
  (SELECT MAX(cached_at) FROM driver_stats_cache) as last_refreshed,
  EXTRACT(EPOCH FROM (NOW() - (SELECT MAX(cached_at) FROM driver_stats_cache))) as age_seconds
UNION ALL
SELECT 
  'delivery_metrics_cache',
  (SELECT COUNT(*) FROM delivery_metrics_cache),
  (SELECT MAX(cached_at) FROM delivery_metrics_cache),
  EXTRACT(EPOCH FROM (NOW() - (SELECT MAX(cached_at) FROM delivery_metrics_cache)))
UNION ALL
SELECT 
  'hourly_metrics_cache',
  (SELECT COUNT(*) FROM hourly_metrics_cache),
  (SELECT MAX(cached_at) FROM hourly_metrics_cache),
  EXTRACT(EPOCH FROM (NOW() - (SELECT MAX(cached_at) FROM hourly_metrics_cache)));

-- ============================================================================
-- 11. COMENTÁRIOS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW driver_stats_cache IS 'Cache de estatísticas consolidadas de motoristas - atualizado a cada 15 min';
COMMENT ON MATERIALIZED VIEW delivery_metrics_cache IS 'Cache de métricas diárias de entregas - atualizado a cada 30 min';
COMMENT ON MATERIALIZED VIEW hourly_metrics_cache IS 'Cache de métricas horárias - atualizado a cada 5 min';
COMMENT ON FUNCTION get_driver_stats_cached IS 'Retorna stats de motorista usando cache (muito mais rápido que query direta)';
COMMENT ON FUNCTION refresh_all_cache_views IS 'Atualiza todas as views materializadas e retorna estatísticas do refresh';
