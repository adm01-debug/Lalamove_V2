
CREATE INDEX IF NOT EXISTS idx_lalamove_orders_cancelled_by
  ON public.lalamove_orders (cancelled_by)
  WHERE cancelled_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lalamove_priority_fee_history_changed_by
  ON public.lalamove_priority_fee_history (changed_by)
  WHERE changed_by IS NOT NULL;
