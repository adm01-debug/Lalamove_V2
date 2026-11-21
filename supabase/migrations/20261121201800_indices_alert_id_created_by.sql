-- ============================================================================
-- MIGRATION: Índices faltantes em FKs usadas em filtro/JOIN e RLS
-- Descrição: order_geo_events.alert_id (JOIN para notificação do alerta) e
--            job_queue.created_by (comparado em toda policy RLS via auth.uid())
--            não tinham índice — seq scan nessas tabelas a cada consulta.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_order_geo_events_alert_id
  ON public.order_geo_events (alert_id);

CREATE INDEX IF NOT EXISTS idx_job_queue_created_by
  ON public.job_queue (created_by);
