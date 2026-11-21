CREATE OR REPLACE FUNCTION public.cleanup_old_observability_logs(p_error_retention_days integer DEFAULT 30, p_rate_limit_retention_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_errors_deleted integer;
  v_rate_deleted integer;
BEGIN
  DELETE FROM public.runtime_error_logs
   WHERE resolved = true
     AND created_at < now() - (GREATEST(p_error_retention_days,1) || ' days')::interval;
  GET DIAGNOSTICS v_errors_deleted = ROW_COUNT;

  DELETE FROM public.rate_limit_logs
   WHERE created_at < now() - (GREATEST(p_rate_limit_retention_days,1) || ' days')::interval;
  GET DIAGNOSTICS v_rate_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'executed_at', now(),
    'runtime_errors_deleted', v_errors_deleted,
    'rate_limit_logs_deleted', v_rate_deleted,
    'success', true
  );
END;
$function$
