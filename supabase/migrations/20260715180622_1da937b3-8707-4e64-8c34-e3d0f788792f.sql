-- 1) Fila de escalonamento (get_pending_escalations): índice ultra-seletivo
CREATE INDEX IF NOT EXISTS idx_alerts_pending_escalation
  ON public.alerts (created_at, severity)
  WHERE acknowledged_at IS NULL
    AND escalated_at IS NULL
    AND is_dismissed = false;

-- 2) Alertas por motorista (modal de perfil, timeline)
CREATE INDEX IF NOT EXISTS idx_alerts_driver_active
  ON public.alerts (driver_id, created_at DESC)
  WHERE is_dismissed = false AND driver_id IS NOT NULL;

-- 3) Alertas por pedido (detalhe do pedido)
CREATE INDEX IF NOT EXISTS idx_alerts_order_active
  ON public.alerts (order_id, created_at DESC)
  WHERE is_dismissed = false AND order_id IS NOT NULL;

-- 4) Badge de não lidos (topo da UI)
CREATE INDEX IF NOT EXISTS idx_alerts_unread
  ON public.alerts (created_at DESC)
  WHERE is_dismissed = false AND is_read = false;