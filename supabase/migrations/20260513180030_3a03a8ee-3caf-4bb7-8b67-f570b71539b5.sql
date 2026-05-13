CREATE INDEX IF NOT EXISTS idx_lalamove_orders_driver_status_updated ON public.lalamove_orders (driver_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_order_created ON public.tracking_events (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_not_dismissed ON public.alerts (is_dismissed, created_at DESC) WHERE is_dismissed = false;