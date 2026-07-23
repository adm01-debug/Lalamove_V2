
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(
  p_auth_retention_days integer DEFAULT 180,
  p_telemetry_retention_days integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_deleted integer;
  v_telemetry_deleted integer;
BEGIN
  DELETE FROM public.auth_logs
   WHERE created_at < now() - (GREATEST(p_auth_retention_days,1) || ' days')::interval;
  GET DIAGNOSTICS v_auth_deleted = ROW_COUNT;

  DELETE FROM public.query_telemetry
   WHERE executed_at < now() - (GREATEST(p_telemetry_retention_days,1) || ' days')::interval;
  GET DIAGNOSTICS v_telemetry_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'executed_at', now(),
    'auth_logs_deleted', v_auth_deleted,
    'query_telemetry_deleted', v_telemetry_deleted,
    'success', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs(integer, integer) TO service_role;

-- Agendar job diário (idempotente): remove agendamento anterior se existir.
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup_audit_logs_daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_audit_logs_daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup_audit_logs_daily',
  '45 3 * * *',
  $$SELECT public.cleanup_old_audit_logs();$$
);
