
CREATE TABLE public.lalamove_order_replacements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  previous_lalamove_id TEXT NOT NULL,
  new_lalamove_id TEXT NOT NULL,
  reason TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lalamove_order_replacements_pair_unique UNIQUE (previous_lalamove_id, new_lalamove_id),
  CONSTRAINT lalamove_order_replacements_distinct_ids CHECK (previous_lalamove_id <> new_lalamove_id)
);

CREATE INDEX idx_order_replacements_order_id ON public.lalamove_order_replacements(order_id);
CREATE INDEX idx_order_replacements_new_id ON public.lalamove_order_replacements(new_lalamove_id);
CREATE INDEX idx_order_replacements_prev_id ON public.lalamove_order_replacements(previous_lalamove_id);

GRANT SELECT ON public.lalamove_order_replacements TO authenticated;
GRANT ALL ON public.lalamove_order_replacements TO service_role;

ALTER TABLE public.lalamove_order_replacements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins managers can view order_replacements"
  ON public.lalamove_order_replacements
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'operator'::app_role)
  );

CREATE POLICY "Admins can delete order_replacements"
  ON public.lalamove_order_replacements
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.lalamove_order_replacements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lalamove_order_replacements;
