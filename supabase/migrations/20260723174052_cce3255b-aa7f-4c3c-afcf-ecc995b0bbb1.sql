
CREATE INDEX IF NOT EXISTS idx_lalamove_status_history_order_created
  ON public.lalamove_status_history (order_id, created_at DESC);

DROP INDEX IF EXISTS public.idx_tracking_order;
