-- ============================================================================
-- MIGRATION: Configure pg_cron Job Worker
-- Descrição: Configura cron job para processar fila automaticamente
-- Versão: 1.0.0
-- Data: 2025-12-26
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÃO: PROCESSAR FILA DE JOBS
-- ============================================================================

CREATE OR REPLACE FUNCTION process_job_queue()
RETURNS TABLE(
  processed INTEGER,
  succeeded INTEGER,
  failed INTEGER,
  skipped INTEGER
) AS $$
DECLARE
  v_job RECORD;
  v_processed INTEGER := 0;
  v_succeeded INTEGER := 0;
  v_failed INTEGER := 0;
  v_skipped INTEGER := 0;
  v_function_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Buscar Edge Function URL e Service Key das secrets
  -- NOTA: Estas variáveis devem ser configuradas em Supabase Vault
  v_function_url := current_setting('app.settings.edge_function_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  -- Se não configurado, usar env (para desenvolvimento)
  IF v_function_url IS NULL THEN
    v_function_url := current_setting('SUPABASE_URL', true) || '/functions/v1/job-worker';
  END IF;
  
  -- Log início
  RAISE NOTICE 'Starting job queue processing at %', NOW();
  
  -- Processar até 10 jobs por execução
  FOR v_job IN
    SELECT * FROM get_next_jobs(10)
  LOOP
    -- Tentar marcar como processando (lock otimista)
    IF NOT mark_job_processing(v_job.id) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    
    -- Log
    RAISE NOTICE 'Processing job % (type: %)', v_job.id, v_job.type;
    
    -- Chamar Edge Function para processar o job
    -- Usando net.http_post (extension pgsql-http)
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
        ),
        body := jsonb_build_object(
          'jobId', v_job.id,
          'type', v_job.type,
          'payload', v_job.payload,
          'metadata', v_job.metadata
        )::text,
        timeout_milliseconds := 25000  -- 25s timeout (antes do timeout da function)
      );
      
      v_processed := v_processed + 1;
      v_succeeded := v_succeeded + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Em caso de erro na chamada HTTP, marcar job como falhado
        PERFORM mark_job_failed(
          v_job.id,
          'HTTP call failed: ' || SQLERRM,
          SQLSTATE
        );
        
        v_processed := v_processed + 1;
        v_failed := v_failed + 1;
        
        RAISE WARNING 'Failed to process job %: %', v_job.id, SQLERRM;
    END;
  END LOOP;
  
  -- Log resultado
  RAISE NOTICE 'Job queue processing finished: processed=%, succeeded=%, failed=%, skipped=%',
    v_processed, v_succeeded, v_failed, v_skipped;
  
  -- Retornar estatísticas
  RETURN QUERY SELECT v_processed, v_succeeded, v_failed, v_skipped;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. AGENDAR CRON JOB
-- ============================================================================

-- Processar fila a cada 1 minuto
SELECT cron.schedule(
  'process-job-queue',
  '* * * * *',  -- A cada minuto
  'SELECT process_job_queue()'
);

-- ============================================================================
-- 3. AGENDAR LIMPEZA DE JOBS ANTIGOS
-- ============================================================================

-- Limpar jobs antigos uma vez por dia às 3h da manhã
SELECT cron.schedule(
  'cleanup-old-jobs',
  '0 3 * * *',  -- Diariamente às 3:00 AM
  'SELECT cleanup_old_jobs(30)'  -- Remover jobs com mais de 30 dias
);

-- ============================================================================
-- 4. FUNÇÃO: VERIFICAR STATUS DOS CRON JOBS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cron_jobs_status()
RETURNS TABLE(
  jobid BIGINT,
  schedule TEXT,
  command TEXT,
  nodename TEXT,
  nodeport INTEGER,
  database TEXT,
  username TEXT,
  active BOOLEAN,
  jobname TEXT
) AS $$
BEGIN
  -- Requer extensão pg_cron
  RETURN QUERY
  SELECT * FROM cron.job;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNÇÃO: PAUSAR/RETOMAR CRON JOB
-- ============================================================================

CREATE OR REPLACE FUNCTION pause_cron_job(p_job_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  PERFORM cron.unschedule(p_job_name);
  RAISE NOTICE 'Cron job % paused', p_job_name;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to pause cron job %: %', p_job_name, SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION resume_cron_job(
  p_job_name TEXT,
  p_schedule TEXT,
  p_command TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  PERFORM cron.schedule(p_job_name, p_schedule, p_command);
  RAISE NOTICE 'Cron job % resumed', p_job_name;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to resume cron job %: %', p_job_name, SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. VIEW: HISTÓRICO DE EXECUÇÕES DO CRON
-- ============================================================================

CREATE OR REPLACE VIEW cron_job_run_history AS
SELECT 
  jr.jobid,
  j.jobname,
  jr.runid,
  jr.job_pid,
  jr.database,
  jr.username,
  jr.command,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time,
  EXTRACT(EPOCH FROM (jr.end_time - jr.start_time)) as duration_seconds
FROM cron.job_run_details jr
LEFT JOIN cron.job j ON j.jobid = jr.jobid
ORDER BY jr.start_time DESC
LIMIT 100;

-- ============================================================================
-- 7. FUNÇÃO: MONITORAR SAÚDE DA FILA
-- ============================================================================

CREATE OR REPLACE FUNCTION monitor_queue_health()
RETURNS TABLE(
  metric TEXT,
  value NUMERIC,
  threshold NUMERIC,
  status TEXT,
  message TEXT
) AS $$
DECLARE
  v_pending BIGINT;
  v_processing BIGINT;
  v_failed BIGINT;
  v_oldest_pending TIMESTAMPTZ;
  v_age_minutes INTEGER;
BEGIN
  -- Buscar estatísticas atuais
  SELECT 
    COUNT(*) FILTER (WHERE status = 'PENDING'),
    COUNT(*) FILTER (WHERE status = 'PROCESSING'),
    COUNT(*) FILTER (WHERE status = 'FAILED' AND created_at > NOW() - INTERVAL '1 hour'),
    MIN(created_at) FILTER (WHERE status = 'PENDING')
  INTO v_pending, v_processing, v_failed, v_oldest_pending
  FROM job_queue;
  
  -- Calcular idade do job mais antigo
  IF v_oldest_pending IS NOT NULL THEN
    v_age_minutes := EXTRACT(EPOCH FROM (NOW() - v_oldest_pending)) / 60;
  ELSE
    v_age_minutes := 0;
  END IF;
  
  -- Retornar métricas com status
  RETURN QUERY
  -- Métrica 1: Jobs pendentes
  SELECT 
    'pending_jobs'::TEXT,
    v_pending::NUMERIC,
    100::NUMERIC,
    CASE 
      WHEN v_pending > 100 THEN 'CRITICAL'
      WHEN v_pending > 50 THEN 'WARNING'
      ELSE 'OK'
    END,
    'Total de jobs aguardando processamento'::TEXT
  
  UNION ALL
  
  -- Métrica 2: Jobs em processamento
  SELECT 
    'processing_jobs'::TEXT,
    v_processing::NUMERIC,
    20::NUMERIC,
    CASE 
      WHEN v_processing > 20 THEN 'WARNING'
      ELSE 'OK'
    END,
    'Jobs atualmente sendo processados'::TEXT
  
  UNION ALL
  
  -- Métrica 3: Jobs falhados na última hora
  SELECT 
    'failed_jobs_1h'::TEXT,
    v_failed::NUMERIC,
    10::NUMERIC,
    CASE 
      WHEN v_failed > 10 THEN 'CRITICAL'
      WHEN v_failed > 5 THEN 'WARNING'
      ELSE 'OK'
    END,
    'Jobs que falharam na última hora'::TEXT
  
  UNION ALL
  
  -- Métrica 4: Idade do job mais antigo (minutos)
  SELECT 
    'oldest_pending_age_min'::TEXT,
    v_age_minutes::NUMERIC,
    30::NUMERIC,
    CASE 
      WHEN v_age_minutes > 30 THEN 'CRITICAL'
      WHEN v_age_minutes > 15 THEN 'WARNING'
      ELSE 'OK'
    END,
    'Tempo que o job mais antigo está aguardando (minutos)'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. TABELA: HISTÓRICO DE PROCESSAMENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_queue_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ DEFAULT NOW(),
  processed INTEGER NOT NULL,
  succeeded INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_job_queue_processing_log_run_at ON job_queue_processing_log(run_at DESC);

-- Limpar logs antigos (manter últimos 7 dias)
CREATE OR REPLACE FUNCTION cleanup_processing_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM job_queue_processing_log
  WHERE run_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Agendar limpeza de logs
SELECT cron.schedule(
  'cleanup-processing-logs',
  '0 4 * * *',  -- Diariamente às 4:00 AM
  'SELECT cleanup_processing_logs()'
);

-- ============================================================================
-- 9. COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION process_job_queue IS 'Processa fila de jobs chamando Edge Function worker';
COMMENT ON FUNCTION get_cron_jobs_status IS 'Retorna status de todos os cron jobs ativos';
COMMENT ON FUNCTION monitor_queue_health IS 'Monitora saúde da fila e retorna alertas';
COMMENT ON FUNCTION pause_cron_job IS 'Pausa um cron job específico';
COMMENT ON FUNCTION resume_cron_job IS 'Retoma um cron job pausado';

-- ============================================================================
-- 10. GRANTS
-- ============================================================================

-- Permitir que service role execute as funções
GRANT EXECUTE ON FUNCTION process_job_queue TO service_role;
GRANT EXECUTE ON FUNCTION get_cron_jobs_status TO service_role;
GRANT EXECUTE ON FUNCTION monitor_queue_health TO service_role;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
