CREATE OR REPLACE FUNCTION public.rollup_contract_version_usage(p_retention_days integer DEFAULT 90)
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
$function$
