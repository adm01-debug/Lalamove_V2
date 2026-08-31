-- Migration: Queue System para processamento assíncrono
-- Criado em: 2025-12-26
-- Objetivo: Implementar sistema de filas resiliente com retry automático

-- ============================================================================
-- 1. TABELA DE FILA DE JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo do job
  type TEXT NOT NULL CHECK (type IN (
    'webhook',          -- Processar webhook Lalamove
    'notification',     -- Enviar notificação
    'evaluation',       -- Avaliar motorista
    'sync_bitrix24',    -- Sincronizar com Bitrix24
    'cleanup'           -- Limpeza de dados
  )),
  
  -- Dados do job
  payload JSONB NOT NULL,
  
  -- Status do job
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',      -- Aguardando processamento
    'PROCESSING',   -- Sendo processado
    'COMPLETED',    -- Concluído com sucesso
    'FAILED'        -- Falhou após todas as tentativas
  )),
  
  -- Controle de retry
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  error_stack TEXT,
  next_retry_at TIMESTAMPTZ,
  
  -- Prioridade (maior = mais prioritário)
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Timestamps
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índice para buscar jobs pendentes
CREATE INDEX idx_job_queue_pending ON job_queue(status, priority DESC, created_at ASC)
WHERE status = 'PENDING';

-- Índice para retry scheduling
CREATE INDEX idx_job_queue_retry ON job_queue(next_retry_at, status)
WHERE status = 'PENDING' AND next_retry_at IS NOT NULL;

-- Índice por tipo
CREATE INDEX idx_job_queue_type ON job_queue(type);

-- Índice por status
CREATE INDEX idx_job_queue_status ON job_queue(status);

-- Índice temporal para cleanup
CREATE INDEX idx_job_queue_created_at ON job_queue(created_at);

-- ============================================================================
-- 3. TRIGGER PARA UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_job_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_job_queue_updated_at
  BEFORE UPDATE ON job_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_job_queue_updated_at();

-- ============================================================================
-- 4. FUNÇÃO PARA ADICIONAR JOB
-- ============================================================================

CREATE OR REPLACE FUNCTION add_job(
  p_type TEXT,
  p_payload JSONB,
  p_priority INTEGER DEFAULT 5,
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Validar tipo
  IF p_type NOT IN ('webhook', 'notification', 'evaluation', 'sync_bitrix24', 'cleanup') THEN
    RAISE EXCEPTION 'Invalid job type: %', p_type;
  END IF;
  
  -- Validar prioridade
  IF p_priority < 1 OR p_priority > 10 THEN
    RAISE EXCEPTION 'Priority must be between 1 and 10';
  END IF;
  
  -- Inserir job
  INSERT INTO job_queue (type, payload, priority, max_attempts)
  VALUES (p_type, p_payload, p_priority, p_max_attempts)
  RETURNING id INTO v_job_id;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNÇÃO PARA BUSCAR PRÓXIMOS JOBS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_jobs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  type TEXT,
  payload JSONB,
  attempts INTEGER,
  max_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jq.id,
    jq.type,
    jq.payload,
    jq.attempts,
    jq.max_attempts
  FROM job_queue jq
  WHERE jq.status = 'PENDING'
    AND (jq.next_retry_at IS NULL OR jq.next_retry_at <= NOW())
  ORDER BY jq.priority DESC, jq.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNÇÃO PARA MARCAR JOB COMO PROCESSANDO
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_job_processing(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE job_queue
  SET 
    status = 'PROCESSING',
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'PENDING'
  RETURNING TRUE INTO v_updated;
  
  RETURN COALESCE(v_updated, FALSE);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNÇÃO PARA MARCAR JOB COMO COMPLETO
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_job_completed(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE job_queue
  SET 
    status = 'COMPLETED',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'PROCESSING'
  RETURNING TRUE INTO v_updated;
  
  RETURN COALESCE(v_updated, FALSE);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. FUNÇÃO PARA MARCAR JOB COMO FALHO (COM RETRY)
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_job_failed(
  p_job_id UUID,
  p_error_message TEXT,
  p_error_stack TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_job RECORD;
  v_new_attempts INTEGER;
  v_retry_delay INTEGER;
  v_next_retry TIMESTAMPTZ;
BEGIN
  -- Buscar job atual
  SELECT attempts, max_attempts
  INTO v_job
  FROM job_queue
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  v_new_attempts := v_job.attempts + 1;
  
  -- Se ainda tem tentativas, agendar retry
  IF v_new_attempts < v_job.max_attempts THEN
    -- Backoff exponencial: 2^attempts * 2 segundos
    v_retry_delay := POWER(2, v_new_attempts) * 2;
    v_next_retry := NOW() + (v_retry_delay || ' seconds')::INTERVAL;
    
    UPDATE job_queue
    SET 
      status = 'PENDING',
      attempts = v_new_attempts,
      error_message = p_error_message,
      error_stack = p_error_stack,
      next_retry_at = v_next_retry,
      updated_at = NOW()
    WHERE id = p_job_id;
    
  ELSE
    -- Falhou definitivamente
    UPDATE job_queue
    SET 
      status = 'FAILED',
      attempts = v_new_attempts,
      error_message = p_error_message,
      error_stack = p_error_stack,
      updated_at = NOW()
    WHERE id = p_job_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. FUNÇÃO WORKER (CHAMADA POR CRON)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_job_queue()
RETURNS TABLE(
  processed INTEGER,
  errors INTEGER
) AS $$
DECLARE
  v_job RECORD;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Buscar jobs pendentes (até 10 por vez)
  FOR v_job IN
    SELECT * FROM get_next_jobs(10)
  LOOP
    BEGIN
      -- Marcar como processando
      IF mark_job_processing(v_job.id) THEN
        
        -- Chamar Edge Function via HTTP
        PERFORM net.http_post(
          url := current_setting('app.settings.supabase_url') || '/functions/v1/job-worker',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_key')
          ),
          body := jsonb_build_object(
            'jobId', v_job.id,
            'type', v_job.type,
            'payload', v_job.payload,
            'attempts', v_job.attempts
          )::text
        );
        
        v_processed := v_processed + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error mas continua processando
      v_errors := v_errors + 1;
      
      PERFORM mark_job_failed(
        v_job.id,
        SQLERRM,
        SQLSTATE
      );
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_errors;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. FUNÇÃO DE LIMPEZA (REMOVER JOBS ANTIGOS)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Deletar jobs completados com mais de 30 dias
  DELETE FROM job_queue
  WHERE status = 'COMPLETED'
    AND completed_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Deletar jobs falhados com mais de 90 dias
  DELETE FROM job_queue
  WHERE status = 'FAILED'
    AND updated_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_deleted = v_deleted + ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. CONFIGURAR CRON JOBS
-- ============================================================================

-- Processar fila a cada minuto
SELECT cron.schedule(
  'process-job-queue',
  '* * * * *',  -- A cada minuto
  'SELECT process_job_queue()'
);

-- Limpeza diária às 3h da manhã
SELECT cron.schedule(
  'cleanup-old-jobs',
  '0 3 * * *',  -- Todo dia às 3h
  'SELECT cleanup_old_jobs()'
);

-- ============================================================================
-- 12. VIEW PARA MONITORAMENTO
-- ============================================================================

CREATE OR REPLACE VIEW job_queue_stats AS
SELECT 
  type,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))) as avg_duration_seconds,
  MAX(created_at) as last_created_at
FROM job_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type, status;

-- ============================================================================
-- 13. FUNCTION PARA ESTATÍSTICAS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_queue_statistics()
RETURNS TABLE(
  total_pending BIGINT,
  total_processing BIGINT,
  total_completed_last_hour BIGINT,
  total_failed_last_hour BIGINT,
  avg_processing_time_seconds NUMERIC,
  oldest_pending_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'PENDING') as total_pending,
    COUNT(*) FILTER (WHERE status = 'PROCESSING') as total_processing,
    COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at > NOW() - INTERVAL '1 hour') as total_completed_last_hour,
    COUNT(*) FILTER (WHERE status = 'FAILED' AND updated_at > NOW() - INTERVAL '1 hour') as total_failed_last_hour,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE status = 'COMPLETED' AND completed_at > NOW() - INTERVAL '1 hour') as avg_processing_time_seconds,
    EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'PENDING'))) / 60 as oldest_pending_minutes
  FROM job_queue;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 14. RLS POLICIES
-- ============================================================================

ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Admin pode ver tudo
CREATE POLICY "Admin can view all jobs"
  ON job_queue FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role pode fazer tudo
CREATE POLICY "Service role can manage jobs"
  ON job_queue FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 15. COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE job_queue IS 'Fila de jobs assíncronos com retry automático e backoff exponencial';
COMMENT ON FUNCTION add_job IS 'Adiciona um novo job à fila';
COMMENT ON FUNCTION process_job_queue IS 'Worker principal - processa jobs pendentes (chamado por cron)';
COMMENT ON FUNCTION cleanup_old_jobs IS 'Remove jobs antigos (completados >30d, falhados >90d)';
COMMENT ON FUNCTION get_queue_statistics IS 'Retorna estatísticas da fila em tempo real';
