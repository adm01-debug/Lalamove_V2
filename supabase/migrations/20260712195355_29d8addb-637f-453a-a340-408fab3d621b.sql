
CREATE TABLE IF NOT EXISTS public.contract_version_usage_monthly (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_name text NOT NULL,
  contract_version text NOT NULL,
  deprecated boolean NOT NULL DEFAULT false,
  usage_month date NOT NULL,
  request_count bigint NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_version_usage_monthly_unique
    UNIQUE (contract_name, contract_version, usage_month)
);

GRANT SELECT ON public.contract_version_usage_monthly TO authenticated;
GRANT ALL ON public.contract_version_usage_monthly TO service_role;

ALTER TABLE public.contract_version_usage_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view monthly contract usage"
  ON public.contract_version_usage_monthly
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_contract_version_usage_monthly_month
  ON public.contract_version_usage_monthly USING btree (usage_month);

CREATE TRIGGER update_contract_version_usage_monthly_updated_at
  BEFORE UPDATE ON public.contract_version_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rollup + retenção: agrega diário antigo em mensal e remove os diários já arquivados.
CREATE OR REPLACE FUNCTION public.rollup_contract_version_usage(
  p_retention_days integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff date := (current_date - GREATEST(p_retention_days, 1))::date;
  v_archived_rows integer := 0;
  v_deleted_rows integer := 0;
BEGIN
  WITH aggregated AS (
    SELECT
      contract_name,
      contract_version,
      bool_or(deprecated)                    AS deprecated,
      date_trunc('month', usage_date)::date  AS usage_month,
      SUM(request_count)::bigint             AS request_count,
      MAX(last_seen_at)                      AS last_seen_at
    FROM public.contract_version_usage
    WHERE usage_date < v_cutoff
    GROUP BY contract_name, contract_version, date_trunc('month', usage_date)
  ),
  upserted AS (
    INSERT INTO public.contract_version_usage_monthly AS m
      (contract_name, contract_version, deprecated, usage_month, request_count, last_seen_at)
    SELECT contract_name, contract_version, deprecated, usage_month, request_count, last_seen_at
    FROM aggregated
    ON CONFLICT (contract_name, contract_version, usage_month)
    DO UPDATE SET
      request_count = m.request_count + EXCLUDED.request_count,
      last_seen_at  = GREATEST(m.last_seen_at, EXCLUDED.last_seen_at),
      deprecated    = m.deprecated OR EXCLUDED.deprecated,
      updated_at    = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_archived_rows FROM upserted;

  WITH removed AS (
    DELETE FROM public.contract_version_usage
    WHERE usage_date < v_cutoff
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted_rows FROM removed;

  RETURN jsonb_build_object(
    'executed_at', now(),
    'retention_days', p_retention_days,
    'cutoff', v_cutoff,
    'monthly_groups_upserted', v_archived_rows,
    'daily_rows_removed', v_deleted_rows,
    'success', true
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) TO service_role;
