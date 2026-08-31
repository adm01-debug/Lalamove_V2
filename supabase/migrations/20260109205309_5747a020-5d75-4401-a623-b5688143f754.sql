-- =====================================================
-- CRON JOBS PARA LIMPEZA AUTOMÁTICA
-- Execução diária de cleanup_expired_tokens() e cleanup_old_login_attempts()
-- =====================================================

-- Habilitar extensão pg_cron (se não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- 1. FUNÇÃO WRAPPER PARA EXECUTAR TODAS AS LIMPEZAS
-- =====================================================
CREATE OR REPLACE FUNCTION public.run_daily_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tokens_deleted INTEGER;
  v_attempts_deleted INTEGER;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
BEGIN
  v_start_time := now();
  
  -- Executar limpeza de tokens expirados
  v_tokens_deleted := cleanup_expired_tokens();
  
  -- Executar limpeza de tentativas de login antigas
  v_attempts_deleted := cleanup_old_login_attempts();
  
  v_end_time := now();
  
  -- Retornar resumo da execução
  RETURN jsonb_build_object(
    'executed_at', v_start_time,
    'completed_at', v_end_time,
    'duration_ms', EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time)),
    'tokens_deleted', v_tokens_deleted,
    'login_attempts_deleted', v_attempts_deleted,
    'success', TRUE
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'executed_at', v_start_time,
    'completed_at', now(),
    'error', SQLERRM,
    'success', FALSE
  );
END;
$$;

-- =====================================================
-- 2. TABELA PARA LOG DE EXECUÇÕES DOS CRON JOBS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  result JSONB,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por job e data
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name ON public.cron_job_logs(job_name, executed_at DESC);

-- Índice para limpeza de logs antigos
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_created_at ON public.cron_job_logs(created_at);

-- Habilitar RLS
ALTER TABLE public.cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins podem ver logs de cron
CREATE POLICY "Admins can view cron logs"
  ON public.cron_job_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 3. FUNÇÃO QUE EXECUTA E REGISTRA O LOG
-- =====================================================
CREATE OR REPLACE FUNCTION public.run_daily_cleanup_with_logging()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_log_id UUID;
BEGIN
  -- Inserir registro inicial
  INSERT INTO public.cron_job_logs (job_name, executed_at)
  VALUES ('daily_cleanup', now())
  RETURNING id INTO v_log_id;
  
  -- Executar limpeza
  v_result := run_daily_cleanup();
  
  -- Atualizar registro com resultado
  UPDATE public.cron_job_logs
  SET 
    completed_at = now(),
    duration_ms = (v_result->>'duration_ms')::INTEGER,
    result = v_result,
    success = (v_result->>'success')::BOOLEAN,
    error_message = v_result->>'error'
  WHERE id = v_log_id;
  
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro, registrar
  UPDATE public.cron_job_logs
  SET 
    completed_at = now(),
    success = FALSE,
    error_message = SQLERRM
  WHERE id = v_log_id;
END;
$$;

-- =====================================================
-- 4. FUNÇÃO PARA LIMPAR LOGS ANTIGOS (mais de 30 dias)
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_cron_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.cron_job_logs
  WHERE created_at < now() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- =====================================================
-- 5. AGENDAR CRON JOBS
-- =====================================================

-- Remover jobs existentes se houver (para evitar duplicatas)
SELECT cron.unschedule('daily-cleanup-tokens-and-attempts') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-cleanup-tokens-and-attempts');

SELECT cron.unschedule('weekly-cleanup-cron-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-cleanup-cron-logs');

-- Agendar limpeza diária às 03:00 UTC (meia-noite em BRT)
SELECT cron.schedule(
  'daily-cleanup-tokens-and-attempts',    -- nome do job
  '0 3 * * *',                            -- cron expression: 03:00 UTC diariamente
  $$SELECT public.run_daily_cleanup_with_logging()$$
);

-- Agendar limpeza semanal de logs de cron (domingos às 04:00 UTC)
SELECT cron.schedule(
  'weekly-cleanup-cron-logs',
  '0 4 * * 0',                            -- cron expression: 04:00 UTC aos domingos
  $$SELECT public.cleanup_old_cron_logs()$$
);

-- =====================================================
-- 6. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================
COMMENT ON FUNCTION public.run_daily_cleanup() IS 
  'Executa limpeza diária de tokens expirados e tentativas de login antigas. Retorna JSON com estatísticas.';

COMMENT ON FUNCTION public.run_daily_cleanup_with_logging() IS 
  'Wrapper que executa run_daily_cleanup() e registra o resultado em cron_job_logs.';

COMMENT ON FUNCTION public.cleanup_old_cron_logs() IS 
  'Remove logs de cron jobs com mais de 30 dias.';

COMMENT ON TABLE public.cron_job_logs IS 
  'Histórico de execuções dos cron jobs do sistema.';