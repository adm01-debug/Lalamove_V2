-- Índices de cobertura para foreign keys (otimização de JOINs e cascatas de DELETE)
CREATE INDEX IF NOT EXISTS idx_active_tracking_driver_id ON public.active_tracking (driver_id);
CREATE INDEX IF NOT EXISTS idx_alerts_driver_id ON public.alerts (driver_id);
CREATE INDEX IF NOT EXISTS idx_alerts_order_id ON public.alerts (order_id);
CREATE INDEX IF NOT EXISTS idx_alerts_sent_alert_id ON public.alerts_sent (alert_id);
CREATE INDEX IF NOT EXISTS idx_bitrix24_activities_order_id ON public.bitrix24_activities (order_id);
CREATE INDEX IF NOT EXISTS idx_driver_approval_queue_order_id ON public.driver_approval_queue (order_id);
CREATE INDEX IF NOT EXISTS idx_driver_incidents_order_id ON public.driver_incidents (order_id);
CREATE INDEX IF NOT EXISTS idx_geo_blocks_blocked_by ON public.geo_blocks (blocked_by);
CREATE INDEX IF NOT EXISTS idx_lalamove_status_history_order_id ON public.lalamove_status_history (order_id);
CREATE INDEX IF NOT EXISTS idx_lalamove_stops_order_id ON public.lalamove_stops (order_id);
CREATE INDEX IF NOT EXISTS idx_new_device_alerts_device_id ON public.new_device_alerts (device_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_reviewed_by ON public.password_reset_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions (permission_id);

-- Índice parcial para a fila de aprovação (query recorrente por status + reviewed_at)
CREATE INDEX IF NOT EXISTS idx_driver_approval_queue_status_reviewed
  ON public.driver_approval_queue (status, reviewed_at);