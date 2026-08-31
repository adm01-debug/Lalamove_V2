
CREATE OR REPLACE FUNCTION public.get_contract_v1_sunset_readiness(
  p_days integer DEFAULT 30,
  p_threshold numeric DEFAULT 1.0
)
RETURNS TABLE(
  window_days integer,
  total_requests bigint,
  total_v1 bigint,
  v1_ratio numeric,
  last_v1_seen timestamptz,
  contracts_using_v1 text[],
  safe_to_remove boolean,
  threshold numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_since date := (current_date - GREATEST(p_days, 1))::date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT * FROM public.contract_version_usage
    WHERE usage_date >= v_since
  ),
  agg AS (
    SELECT
      COALESCE(SUM(request_count), 0)::bigint AS total_requests,
      COALESCE(SUM(request_count) FILTER (WHERE contract_version = 'v1'), 0)::bigint AS total_v1,
      MAX(last_seen_at) FILTER (WHERE contract_version = 'v1') AS last_v1_seen,
      COALESCE(
        array_agg(DISTINCT contract_name)
          FILTER (WHERE contract_version = 'v1'),
        ARRAY[]::text[]
      ) AS contracts_using_v1
    FROM scoped
  )
  SELECT
    GREATEST(p_days, 1),
    a.total_requests,
    a.total_v1,
    CASE WHEN a.total_requests > 0
         THEN round(a.total_v1::numeric / a.total_requests * 100, 1)
         ELSE 0 END,
    a.last_v1_seen,
    a.contracts_using_v1,
    CASE WHEN a.total_requests > 0
         THEN round(a.total_v1::numeric / a.total_requests * 100, 1) <= p_threshold
         ELSE true END,
    p_threshold
  FROM agg a;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_contract_v1_sunset_readiness(integer, numeric) TO authenticated;
