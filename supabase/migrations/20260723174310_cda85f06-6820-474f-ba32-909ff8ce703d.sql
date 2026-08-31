
-- Índice parcial para painel de erros ativos (não resolvidos, ordenados por recência)
CREATE INDEX IF NOT EXISTS idx_runtime_error_logs_unresolved_recent
  ON public.runtime_error_logs (created_at DESC)
  WHERE resolved = false;

-- Índice composto para dedup por fingerprint (busca por assinatura + tempo)
CREATE INDEX IF NOT EXISTS idx_runtime_error_logs_fingerprint_created
  ON public.runtime_error_logs (fingerprint, created_at DESC);

-- Função consolidada de retenção
CREATE OR REPLACE FUNCTION public.cleanup_old_observability_logs(
  p_error_retention_days integer DEFAULT 30,
  p_rate_limit_retention_days integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_observability_logs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_observability_logs(integer, integer) TO service_role;
