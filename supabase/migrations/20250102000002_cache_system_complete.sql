-- Migration: Complete Cache System with Materialized Views
-- Implementa sistema de cache robusto para performance

-- =============================================================================
-- 1. MATERIALIZED VIEWS PARA CACHE
-- =============================================================================

-- View: Estatísticas de Motoristas (Cacheada)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_driver_stats AS
SELECT 
  d.id,
  d.name,
  d.phone,
  COUNT(DISTINCT o.id) as total_deliveries,
  COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_deliveries,
  COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_deliveries,
  AVG(CASE WHEN o.status = 'completed' THEN o.rating END) as avg_rating,
  SUM(CASE WHEN o.status = 'completed' THEN o.delivery_value ELSE 0 END) as total_revenue,
  MAX(o.completed_at) as last_delivery_at,
  NOW() as cached_at
FROM drivers d
LEFT JOIN orders o ON d.id = o.driver_id
WHERE d.deleted_at IS NULL
GROUP BY d.id, d.name, d.phone;

-- Índices para performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_driver_stats_id ON mv_driver_stats(id);
CREATE INDEX IF NOT EXISTS idx_mv_driver_stats_deliveries ON mv_driver_stats(total_deliveries DESC);
CREATE INDEX IF NOT EXISTS idx_mv_driver_stats_rating ON mv_driver_stats(avg_rating DESC);

-- View: Métricas de Entregas (Cacheada)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_delivery_metrics AS
SELECT
  DATE(o.created_at) as date,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
  COUNT(CASE WHEN o.status = 'in_progress' THEN 1 END) as in_progress_orders,
  COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
  COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
  AVG(o.delivery_value) as avg_value,
  SUM(o.delivery_value) as total_value,
  AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at))/60) as avg_delivery_time_minutes,
  NOW() as cached_at
FROM orders o
WHERE o.deleted_at IS NULL
  AND o.created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(o.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_delivery_metrics_date ON mv_delivery_metrics(date DESC);

-- View: Métricas por Hora (Cacheada)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_metrics AS
SELECT
  DATE_TRUNC('hour', o.created_at) as hour,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
  AVG(o.delivery_value) as avg_value,
  NOW() as cached_at
FROM orders o
WHERE o.deleted_at IS NULL
  AND o.created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', o.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hourly_metrics_hour ON mv_hourly_metrics(hour DESC);

-- =============================================================================
-- 2. TABELA DE CONTROLE DE CACHE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cache_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_name TEXT NOT NULL,
  refresh_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refresh_completed_at TIMESTAMPTZ,
  refresh_duration_ms INTEGER,
  row_count INTEGER,
  status TEXT CHECK (status IN ('running', 'success', 'failed')) DEFAULT 'running',
  error_message TEXT,
  triggered_by TEXT DEFAULT 'system',
  CONSTRAINT unique_running_refresh UNIQUE (view_name, status) 
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_cache_refresh_log_view ON cache_refresh_log(view_name, refresh_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_refresh_log_status ON cache_refresh_log(status);

-- =============================================================================
-- 3. FUNÇÕES RPC PARA CACHE
-- =============================================================================

-- Função: Obter estatísticas cacheadas de motoristas
CREATE OR REPLACE FUNCTION get_driver_stats_cached()
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  total_deliveries BIGINT,
  completed_deliveries BIGINT,
  cancelled_deliveries BIGINT,
  avg_rating NUMERIC,
  total_revenue NUMERIC,
  last_delivery_at TIMESTAMPTZ,
  cached_at TIMESTAMPTZ
) 
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    id,
    name,
    phone,
    total_deliveries,
    completed_deliveries,
    cancelled_deliveries,
    avg_rating,
    total_revenue,
    last_delivery_at,
    cached_at
  FROM mv_driver_stats
  ORDER BY total_deliveries DESC;
$$;

-- Função: Obter métricas de entregas cacheadas
CREATE OR REPLACE FUNCTION get_delivery_metrics_cached(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  total_orders BIGINT,
  completed_orders BIGINT,
  in_progress_orders BIGINT,
  pending_orders BIGINT,
  cancelled_orders BIGINT,
  avg_value NUMERIC,
  total_value NUMERIC,
  avg_delivery_time_minutes NUMERIC,
  cached_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    date,
    total_orders,
    completed_orders,
    in_progress_orders,
    pending_orders,
    cancelled_orders,
    avg_value,
    total_value,
    avg_delivery_time_minutes,
    cached_at
  FROM mv_delivery_metrics
  WHERE date >= CURRENT_DATE - days_back
  ORDER BY date DESC;
$$;

-- Função: Obter métricas por hora cacheadas
CREATE OR REPLACE FUNCTION get_hourly_metrics_cached(hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
  hour TIMESTAMPTZ,
  total_orders BIGINT,
  completed_orders BIGINT,
  avg_value NUMERIC,
  cached_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    hour,
    total_orders,
    completed_orders,
    avg_value,
    cached_at
  FROM mv_hourly_metrics
  WHERE hour >= NOW() - (hours_back || ' hours')::INTERVAL
  ORDER BY hour DESC;
$$;

-- Função: Top drivers por métrica
CREATE OR REPLACE FUNCTION get_top_drivers_by_metric(
  metric TEXT DEFAULT 'total_deliveries',
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  metric_value NUMERIC
)
LANGUAGE PLPGSQL
STABLE
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT id, name, %I::NUMERIC as metric_value 
     FROM mv_driver_stats 
     ORDER BY %I DESC NULLS LAST 
     LIMIT $1',
    metric, metric
  ) USING limit_count;
END;
$$;

-- Função: Status do cache
CREATE OR REPLACE FUNCTION cache_status()
RETURNS TABLE (
  view_name TEXT,
  last_refresh TIMESTAMPTZ,
  refresh_duration_ms INTEGER,
  row_count INTEGER,
  is_stale BOOLEAN,
  status TEXT
)
LANGUAGE SQL
STABLE
AS $$
  WITH latest_refreshes AS (
    SELECT DISTINCT ON (view_name)
      view_name,
      refresh_completed_at as last_refresh,
      refresh_duration_ms,
      row_count,
      status
    FROM cache_refresh_log
    WHERE status = 'success'
    ORDER BY view_name, refresh_completed_at DESC
  )
  SELECT 
    view_name,
    last_refresh,
    refresh_duration_ms,
    row_count,
    (last_refresh < NOW() - INTERVAL '1 hour') as is_stale,
    status
  FROM latest_refreshes
  
  UNION ALL
  
  -- Adicionar views que nunca foram atualizadas
  SELECT 
    view_name,
    NULL as last_refresh,
    NULL as refresh_duration_ms,
    NULL as row_count,
    TRUE as is_stale,
    'never_refreshed' as status
  FROM (VALUES 
    ('mv_driver_stats'),
    ('mv_delivery_metrics'),
    ('mv_hourly_metrics')
  ) as v(view_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM latest_refreshes lr WHERE lr.view_name = v.view_name
  );
$$;

-- Função: Refresh de view específica ou todas
CREATE OR REPLACE FUNCTION refresh_cache_view(view_name TEXT DEFAULT NULL)
RETURNS TABLE (
  view_refreshed TEXT,
  duration_ms INTEGER,
  row_count INTEGER,
  status TEXT
)
LANGUAGE PLPGSQL
AS $$
DECLARE
  v_view_name TEXT;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration INTEGER;
  v_row_count INTEGER;
  v_log_id UUID;
BEGIN
  -- Se view_name é NULL, refresh todas
  IF view_name IS NULL THEN
    FOR v_view_name IN 
      SELECT unnest(ARRAY['mv_driver_stats', 'mv_delivery_metrics', 'mv_hourly_metrics'])
    LOOP
      PERFORM refresh_cache_view(v_view_name);
    END LOOP;
    
    RETURN QUERY 
    SELECT 'all'::TEXT, NULL::INTEGER, NULL::INTEGER, 'success'::TEXT;
    RETURN;
  END IF;
  
  -- Registrar início do refresh
  INSERT INTO cache_refresh_log (view_name, status)
  VALUES (view_name, 'running')
  RETURNING id INTO v_log_id;
  
  v_start_time := clock_timestamp();
  
  BEGIN
    -- Executar refresh da view
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);
    
    v_end_time := clock_timestamp();
    v_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
    
    -- Contar linhas
    EXECUTE format('SELECT COUNT(*) FROM %I', view_name) INTO v_row_count;
    
    -- Atualizar log de sucesso
    UPDATE cache_refresh_log
    SET 
      refresh_completed_at = v_end_time,
      refresh_duration_ms = v_duration,
      row_count = v_row_count,
      status = 'success'
    WHERE id = v_log_id;
    
    RETURN QUERY 
    SELECT view_name, v_duration, v_row_count, 'success'::TEXT;
    
  EXCEPTION WHEN OTHERS THEN
    -- Registrar erro
    UPDATE cache_refresh_log
    SET 
      refresh_completed_at = clock_timestamp(),
      status = 'failed',
      error_message = SQLERRM
    WHERE id = v_log_id;
    
    RETURN QUERY 
    SELECT view_name, NULL::INTEGER, NULL::INTEGER, 'failed'::TEXT;
  END;
END;
$$;

-- =============================================================================
-- 4. JOB AUTOMÁTICO DE REFRESH (via pg_cron se disponível)
-- =============================================================================

-- Comentado por padrão - habilitar se pg_cron estiver disponível
/*
SELECT cron.schedule(
  'refresh-cache-views',
  '0 * * * *', -- A cada hora
  $$SELECT refresh_cache_view();$$
);
*/

-- =============================================================================
-- 5. REFRESH INICIAL
-- =============================================================================

-- Executar primeiro refresh
SELECT refresh_cache_view();

-- =============================================================================
-- 6. PERMISSÕES RLS
-- =============================================================================

-- Permitir acesso público às views (somente leitura)
GRANT SELECT ON mv_driver_stats TO authenticated, anon;
GRANT SELECT ON mv_delivery_metrics TO authenticated, anon;
GRANT SELECT ON mv_hourly_metrics TO authenticated, anon;

-- Permitir execução das funções
GRANT EXECUTE ON FUNCTION get_driver_stats_cached() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_delivery_metrics_cached(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_hourly_metrics_cached(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_top_drivers_by_metric(TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cache_status() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION refresh_cache_view(TEXT) TO authenticated;

-- Comentários
COMMENT ON MATERIALIZED VIEW mv_driver_stats IS 'Estatísticas agregadas de motoristas com cache';
COMMENT ON MATERIALIZED VIEW mv_delivery_metrics IS 'Métricas diárias de entregas com cache';
COMMENT ON MATERIALIZED VIEW mv_hourly_metrics IS 'Métricas horárias de entregas com cache';
COMMENT ON FUNCTION refresh_cache_view(TEXT) IS 'Atualiza views materializadas de cache';
COMMENT ON FUNCTION cache_status() IS 'Retorna status atual do sistema de cache';
