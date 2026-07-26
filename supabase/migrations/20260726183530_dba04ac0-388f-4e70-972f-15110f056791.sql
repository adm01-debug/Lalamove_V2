CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(p_auth_retention_days integer DEFAULT 180, p_telemetry_retention_days integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_deleted integer;
  v_telemetry_deleted integer;
BEGIN
  DELETE FROM public.auth_logs
   WHERE created_at < now() - (GREATEST(p_auth_retention_days,1) || ' days')::interval;
  GET DIAGNOSTICS v_auth_deleted = ROW_COUNT;

  -- Correção: a coluna temporal de `query_telemetry` é `created_at`
  -- (`executed_at` nunca existiu e quebrava a rotina em toda execução).
  DELETE FROM public.query_telemetry
   WHERE created_at < now() - (GREATEST(p_telemetry_retention_days,1) || ' days')::interval;
  GET DIAGNOSTICS v_telemetry_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'executed_at', now(),
    'auth_logs_deleted', v_auth_deleted,
    'query_telemetry_deleted', v_telemetry_deleted,
    'success', true
  );
END;
$function$;

-- Índice para os painéis agregados por integração (operation = 'lalamove').
CREATE INDEX IF NOT EXISTS idx_query_telemetry_operation_created
  ON public.query_telemetry USING btree (operation, created_at DESC);