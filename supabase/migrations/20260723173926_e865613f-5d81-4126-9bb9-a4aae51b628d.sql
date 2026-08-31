CREATE INDEX IF NOT EXISTS idx_lalamove_orders_status_created
  ON public.lalamove_orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lalamove_orders_open_status
  ON public.lalamove_orders (created_at DESC)
  WHERE status IN ('PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP');