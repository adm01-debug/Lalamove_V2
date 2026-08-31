
ALTER TABLE public.lalamove_orders
  ADD COLUMN IF NOT EXISTS priority_fee NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS priority_fee_currency TEXT,
  ADD COLUMN IF NOT EXISTS priority_fee_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.lalamove_priority_fee_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  lalamove_order_id TEXT NOT NULL,
  previous_fee NUMERIC(10,2),
  new_fee NUMERIC(10,2) NOT NULL CHECK (new_fee > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_priority_fee_history_order
  ON public.lalamove_priority_fee_history(order_id, created_at DESC);

GRANT SELECT, INSERT ON public.lalamove_priority_fee_history TO authenticated;
GRANT ALL ON public.lalamove_priority_fee_history TO service_role;

ALTER TABLE public.lalamove_priority_fee_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operational roles view priority fee history"
  ON public.lalamove_priority_fee_history FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'operator')
  );

CREATE POLICY "Admin/manager insert priority fee history"
  ON public.lalamove_priority_fee_history FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
