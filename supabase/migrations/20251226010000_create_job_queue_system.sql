-- ============================================================================
-- MIGRATION: Job Queue System with pg_cron
-- Descrição: Sistema de filas assíncronas para processamento de jobs
-- Versão: 1.0.0
-- Data: 2025-12-26
-- ============================================================================

-- ============================================================================
-- 1. TABELA DE FILA DE JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo do job
  type TEXT NOT NULL CHECK (type IN (
    'webhook',
    'notification',
    'evaluation',
    'bitrix_sync',
    'email',
    'whatsapp',
    'slack'
  )),
  
  -- Payload (dados do job)
  payload JSONB NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  )),
  
  -- Retry logic
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  error_stack TEXT,
  
  -- Timing
  next_retry_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Priority (1-10, maior = mais prioritário)
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índice principal para worker buscar jobs pendentes
CREATE INDEX idx_job_queue_pending ON job_queue(next_retry_at, priority DESC)
  WHERE status = 'PENDING';

-- Índice para buscar por status
CREATE INDEX idx_job_queue_status ON job_queue(status);

-- Índice para buscar por tipo
CREATE INDEX idx_job_queue_type ON job_queue(type);

-- Índice para buscar jobs falhados
CREATE INDEX idx_job_queue_failed ON job_queue(created_at DESC)
  WHERE status = 'FAILED';

-- Índice composto para queries de monitoramento
CREATE INDEX idx_job_queue_monitoring ON job_queue(type, status, created_at DESC);

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

CREATE TRIGGER trigger_update_job_queue_updated_at
  BEFORE UPDATE ON job_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_job_queue_updated_at();

-- ============================================================================
-- 4. FUNÇÃO: ADICIONAR JOB À FILA
-- ============================================================================

CREATE OR REPLACE FUNCTION add_job(
  p_type TEXT,
  p_payload JSONB,
  p_priority INTEGER DEFAULT 5,
  p_max_attempts INTEGER DEFAULT 3,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Validar tipo
  IF p_type NOT IN ('webhook', 'notification', 'evaluation', 'bitrix_sync', 'email', 'whatsapp', 'slack') THEN
    RAISE EXCEPTION 'Invalid job type: %', p_type;
  END IF;
  
  -- Validar prioridade
  IF p_priority < 1 OR p_priority > 10 THEN
    RAISE EXCEPTION 'Priority must be between 1 and 10';
  END IF;
  
  -- Inserir job
  INSERT INTO job_queue (
    type,
    payload,
    priority,
    max_attempts,
    metadata,
    created_by
  )
  VALUES (
    p_type,
    p_payload,
    p_priority,
    p_max_attempts,
    p_metadata,
    auth.uid()
  )
  RETURNING id INTO v_job_id;
  
  -- Log
  RAISE NOTICE 'Job added: % (type: %, priority: %)', v_job_id, p_type, p_priority;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. FUNÇÃO: BUSCAR PRÓXIMOS JOBS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_jobs(
  p_limit INTEGER DEFAULT 10,
  p_types TEXT[] DEFAULT NULL
)
RETURNS SETOF job_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM job_queue
  WHERE status = 'PENDING'
    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    AND (p_types IS NULL OR type = ANY(p_types))
  ORDER BY priority DESC, created_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNÇÃO: MARCAR JOB COMO PROCESSANDO
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_job_processing(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE job_queue
  SET 
    status = 'PROCESSING',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'PENDING'
  RETURNING TRUE INTO v_updated;
  
  RETURN COALESCE(v_updated, FALSE);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNÇÃO: MARCAR JOB COMO COMPLETO
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_job_completed(
  p_job_id UUID,
  p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE job_queue
  SET 
    status = 'COMPLETED',
    completed_at = NOW(),
    metadata = CASE
      WHEN p_result IS NOT NULL THEN metadata || jsonb_build_object('result', p_result)
      ELSE metadata
    END,
    updated_at = NOW()
  WHERE id = p_job_id
    AND status = 'PROCESSING';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. FUNÇÃO: MARCAR JOB COMO FALHADO (COM RETRY)
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_job_failed(
  p_job_id UUID,
  p_error_message TEXT,
  p_error_stack TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_job RECORD;
  v_next_retry TIMESTAMPTZ;
  v_backoff_seconds INTEGER;
BEGIN
  -- Buscar job atual
  SELECT * INTO v_job
  FROM job_queue
  WHERE id = p_job_id
    AND status IN ('PROCESSING', 'PENDING');
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Incrementar attempts
  v_job.attempts := v_job.attempts + 1;
  
  -- Verificar se atingiu max_attempts
  IF v_job.attempts >= v_job.max_attempts THEN
    -- Falhou definitivamente
    UPDATE job_queue
    SET 
      status = 'FAILED',
      attempts = v_job.attempts,
      error_message = p_error_message,
      error_stack = p_error_stack,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_job_id;
    
    RAISE NOTICE 'Job % failed permanently after % attempts', p_job_id, v_job.attempts;
  ELSE
    -- Agendar retry com backoff exponencial
    -- Fórmula: 2^attempts segundos (2s, 4s, 8s, 16s, ...)
    v_backoff_seconds := POWER(2, v_job.attempts)::INTEGER;
    v_next_retry := NOW() + (v_backoff_seconds || ' seconds')::INTERVAL;
    
    UPDATE job_queue
    SET 
      status = 'PENDING',
      attempts = v_job.attempts,
      error_message = p_error_message,
      error_stack = p_error_stack,
      next_retry_at = v_next_retry,
      updated_at = NOW()
    WHERE id = p_job_id;
    
    RAISE NOTICE 'Job % will retry in % seconds (attempt %/%)', 
      p_job_id, v_backoff_seconds, v_job.attempts, v_job.max_attempts;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. FUNÇÃO: CANCELAR JOB
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_job(p_job_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE job_queue
  SET 
    status = 'CANCELLED',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id
    AND status IN ('PENDING', 'PROCESSING');
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. FUNÇÃO: LIMPAR JOBS ANTIGOS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_jobs(
  p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM job_queue
  WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED')
    AND created_at < NOW() - (p_days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % old jobs', v_deleted;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. FUNÇÃO: ESTATÍSTICAS DA FILA
-- ============================================================================

CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE(
  total_jobs BIGINT,
  pending_jobs BIGINT,
  processing_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  cancelled_jobs BIGINT,
  avg_attempts NUMERIC,
  oldest_pending TIMESTAMPTZ,
  jobs_by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_jobs,
    COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing_jobs,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_jobs,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed_jobs,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_jobs,
    ROUND(AVG(attempts), 2) as avg_attempts,
    MIN(created_at) FILTER (WHERE status = 'PENDING') as oldest_pending,
    jsonb_object_agg(
      type,
      jsonb_build_object(
        'total', count,
        'pending', pending_count,
        'failed', failed_count
      )
    ) as jobs_by_type
  FROM (
    SELECT 
      type,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
      COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count
    FROM job_queue
    GROUP BY type
  ) t;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. RLS POLICIES
-- ============================================================================

-- Habilitar RLS
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários autenticados podem ver seus próprios jobs
CREATE POLICY "Users can view their own jobs"
  ON job_queue FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
  ));

-- Policy: Apenas admins podem criar jobs manualmente
CREATE POLICY "Admins can create jobs"
  ON job_queue FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
  ));

-- Policy: Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role full access"
  ON job_queue FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 13. COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE job_queue IS 'Fila de jobs assíncronos para processamento em background';
COMMENT ON COLUMN job_queue.type IS 'Tipo do job: webhook, notification, evaluation, etc';
COMMENT ON COLUMN job_queue.payload IS 'Dados do job em formato JSON';
COMMENT ON COLUMN job_queue.status IS 'Status atual: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED';
COMMENT ON COLUMN job_queue.attempts IS 'Número de tentativas realizadas';
COMMENT ON COLUMN job_queue.max_attempts IS 'Número máximo de tentativas antes de falhar definitivamente';
COMMENT ON COLUMN job_queue.priority IS 'Prioridade (1-10, maior = mais prioritário)';
COMMENT ON COLUMN job_queue.next_retry_at IS 'Timestamp do próximo retry (para jobs que falharam)';

COMMENT ON FUNCTION add_job IS 'Adiciona um novo job à fila';
COMMENT ON FUNCTION get_next_jobs IS 'Busca próximos jobs para processar (com lock)';
COMMENT ON FUNCTION mark_job_processing IS 'Marca job como em processamento';
COMMENT ON FUNCTION mark_job_completed IS 'Marca job como completo';
COMMENT ON FUNCTION mark_job_failed IS 'Marca job como falhado e agenda retry se possível';
COMMENT ON FUNCTION cancel_job IS 'Cancela um job pendente ou em processamento';
COMMENT ON FUNCTION cleanup_old_jobs IS 'Remove jobs antigos já finalizados';
COMMENT ON FUNCTION get_queue_stats IS 'Retorna estatísticas da fila de jobs';

-- ============================================================================
-- 14. CONFIGURAR PG_CRON (se ainda não estiver habilitado)
-- ============================================================================

-- Criar extensão pg_cron (pode falhar se já existir, é normal)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
