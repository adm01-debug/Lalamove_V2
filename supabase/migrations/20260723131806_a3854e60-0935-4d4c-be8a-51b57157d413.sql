
CREATE TABLE public.lalamove_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 1,
  limit_total INTEGER,
  limit_remaining INTEGER,
  limit_reset_at TIMESTAMPTZ,
  usage_ratio NUMERIC(5,2),
  request_id TEXT,
  raw_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lalamove_rate_limits_created ON public.lalamove_rate_limits (created_at DESC);
CREATE INDEX idx_lalamove_rate_limits_endpoint_created ON public.lalamove_rate_limits (endpoint, created_at DESC);
CREATE INDEX idx_lalamove_rate_limits_low_remaining ON public.lalamove_rate_limits (created_at DESC) WHERE limit_remaining IS NOT NULL AND limit_remaining <= 10;
CREATE INDEX idx_lalamove_rate_limits_errors ON public.lalamove_rate_limits (created_at DESC) WHERE status >= 400;

GRANT SELECT, INSERT ON public.lalamove_rate_limits TO authenticated;
GRANT ALL ON public.lalamove_rate_limits TO service_role;

ALTER TABLE public.lalamove_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view rate limits"
  ON public.lalamove_rate_limits FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "System roles can insert rate limits"
  ON public.lalamove_rate_limits FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'operator')
  );
