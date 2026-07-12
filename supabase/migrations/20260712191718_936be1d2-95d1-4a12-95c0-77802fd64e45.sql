CREATE TABLE IF NOT EXISTS public.contract_version_usage (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_name    text NOT NULL,
  contract_version text NOT NULL,
  deprecated       boolean NOT NULL DEFAULT false,
  usage_date       date NOT NULL DEFAULT current_date,
  request_count    bigint NOT NULL DEFAULT 0,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_version_usage_unique UNIQUE (contract_name, contract_version, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_contract_version_usage_deprecated
  ON public.contract_version_usage (deprecated, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_contract_version_usage_version
  ON public.contract_version_usage (contract_version, usage_date DESC);

GRANT SELECT ON public.contract_version_usage TO authenticated;
GRANT ALL ON public.contract_version_usage TO service_role;

ALTER TABLE public.contract_version_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read contract usage" ON public.contract_version_usage;
CREATE POLICY "admins read contract usage"
  ON public.contract_version_usage
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.increment_contract_usage(
  p_contract_name    text,
  p_contract_version text,
  p_deprecated       boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.contract_version_usage
    (contract_name, contract_version, deprecated, usage_date, request_count, last_seen_at)
  VALUES
    (p_contract_name, p_contract_version, p_deprecated, current_date, 1, now())
  ON CONFLICT (contract_name, contract_version, usage_date)
  DO UPDATE SET
    request_count = public.contract_version_usage.request_count + 1,
    last_seen_at  = now(),
    deprecated    = EXCLUDED.deprecated;
$$;

REVOKE ALL ON FUNCTION public.increment_contract_usage(text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_contract_usage(text, text, boolean) TO service_role;