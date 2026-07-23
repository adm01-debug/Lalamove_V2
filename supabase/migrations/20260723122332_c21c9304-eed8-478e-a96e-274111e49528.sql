-- Etapa 2: Persistência granular de POD/POP por stop
-- Cria lalamove_stop_proofs (1:1 com lalamove_stops) para armazenar
-- comprovantes de entrega (POD) e coleta (POP) recebidos via webhook.

CREATE TABLE public.lalamove_stop_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id uuid NOT NULL REFERENCES public.lalamove_stops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  -- Proof of Delivery
  pod_status text CHECK (pod_status IS NULL OR pod_status IN ('pending','delivered','failed','NOT_REQUIRED')),
  pod_image_url text,
  pod_delivered_at timestamptz,
  -- Proof of Pickup
  pop_status text CHECK (pop_status IS NULL OR pop_status IN ('pending','picked_up','failed','NOT_REQUIRED')),
  pop_image_url text,
  pop_picked_up_at timestamptz,
  -- Delivery code (per stop)
  delivery_code text,
  delivery_code_status text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lalamove_stop_proofs_stop_unique UNIQUE (stop_id)
);

CREATE INDEX idx_stop_proofs_order_id ON public.lalamove_stop_proofs(order_id);
CREATE INDEX idx_stop_proofs_pod_status ON public.lalamove_stop_proofs(pod_status) WHERE pod_status IS NOT NULL AND pod_status <> 'NOT_REQUIRED';
CREATE INDEX idx_stop_proofs_pop_status ON public.lalamove_stop_proofs(pop_status) WHERE pop_status IS NOT NULL AND pop_status <> 'NOT_REQUIRED';
CREATE INDEX idx_stop_proofs_delivered_at ON public.lalamove_stop_proofs(pod_delivered_at DESC) WHERE pod_delivered_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lalamove_stop_proofs TO authenticated;
GRANT ALL ON public.lalamove_stop_proofs TO service_role;

ALTER TABLE public.lalamove_stop_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins managers can view stop_proofs"
  ON public.lalamove_stop_proofs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE POLICY "Operators can view stop_proofs limited"
  ON public.lalamove_stop_proofs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'operator'));

CREATE POLICY "Operators can insert stop_proofs"
  ON public.lalamove_stop_proofs FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'manager')
    OR has_role(auth.uid(),'operator')
  );

CREATE POLICY "Managers can update stop_proofs"
  ON public.lalamove_stop_proofs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE POLICY "Admins can delete stop_proofs"
  ON public.lalamove_stop_proofs FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Trigger de updated_at
CREATE TRIGGER trg_stop_proofs_updated_at
  BEFORE UPDATE ON public.lalamove_stop_proofs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime publication + REPLICA IDENTITY FULL para diffs completos
ALTER TABLE public.lalamove_stop_proofs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lalamove_stop_proofs;

-- Backfill idempotente a partir de lalamove_stops (POD já existente)
INSERT INTO public.lalamove_stop_proofs (stop_id, order_id, pod_status, pod_image_url, pod_delivered_at)
SELECT s.id, s.order_id,
       CASE
         WHEN s.pod_status IN ('pending','delivered','failed','NOT_REQUIRED') THEN s.pod_status
         ELSE NULL
       END,
       s.pod_image_url,
       s.pod_delivered_at
FROM public.lalamove_stops s
WHERE s.pod_image_url IS NOT NULL OR s.pod_delivered_at IS NOT NULL
ON CONFLICT (stop_id) DO NOTHING;