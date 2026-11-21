-- ============================================================================
-- Baseline Lalamove V2 — parte 3/3: job_queue real (idempotente)
-- ----------------------------------------------------------------------------
-- DRIFT: a migration 20251226010000_create_job_queue_system.sql esta no ledger
-- (schema_migrations) como aplicada, MAS a tabela job_queue e suas funcoes NAO
-- existem na producao (iecgydonctmabiijadsf). O mesmo vale para system_logs,
-- audit_log, cache_views, saved_filters, entity_versions: DDL marcado aplicado
-- sem rodar (sync Lovable). Ver docs/MIGRATION_RECONCILIATION_2026-11.md.
--
-- Esta migration recria job_queue de forma 100% idempotente, para valer tanto
-- em producao (onde nunca existiu) quanto em `supabase db reset` local (onde a
-- migration antiga ja a cria). Mantido o contrato esperado por job-worker:
-- mark_job_completed(uuid, jsonb), mark_job_failed(uuid, text, text),
-- get_next_jobs(int, text[]), mark_job_processing(uuid), add_job(...).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_queue (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           text NOT NULL CHECK (type IN ('webhook','notification','evaluation','bitrix_sync','email','whatsapp','slack','lalamove_sync','pod_fetch')),
  payload        jsonb NOT NULL,
  status         text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  attempts       integer NOT NULL DEFAULT 0,
  max_attempts   integer NOT NULL DEFAULT 3,
  error_message  text,
  error_stack    text,
  next_retry_at  timestamptz,
  started_at     timestamptz,
  completed_at   timestamptz,
  priority       integer NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  dedup_key      text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_job_queue_pending    ON public.job_queue (next_retry_at, priority DESC) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_job_queue_status     ON public.job_queue (status);
CREATE INDEX IF NOT EXISTS idx_job_queue_type       ON public.job_queue (type);
CREATE INDEX IF NOT EXISTS idx_job_queue_monitoring ON public.job_queue (type, status, created_at DESC);
-- dedup opcional de jobs ainda nao finalizados (evita enfileirar o mesmo evento 2x)
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_queue_dedup_open
  ON public.job_queue (dedup_key) WHERE dedup_key IS NOT NULL AND status IN ('PENDING','PROCESSING');

-- updated_at
CREATE OR REPLACE FUNCTION public.update_job_queue_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trigger_update_job_queue_updated_at ON public.job_queue;
CREATE TRIGGER trigger_update_job_queue_updated_at
  BEFORE UPDATE ON public.job_queue FOR EACH ROW EXECUTE FUNCTION public.update_job_queue_updated_at();

-- enfileirar (dedup opcional)
CREATE OR REPLACE FUNCTION public.add_job(
  p_type text, p_payload jsonb, p_priority integer DEFAULT 5,
  p_max_attempts integer DEFAULT 3, p_dedup_key text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job_id uuid;
BEGIN
  IF p_dedup_key IS NOT NULL THEN
    SELECT id INTO v_job_id FROM job_queue
      WHERE dedup_key = p_dedup_key AND status IN ('PENDING','PROCESSING') LIMIT 1;
    IF v_job_id IS NOT NULL THEN RETURN v_job_id; END IF;
  END IF;
  INSERT INTO job_queue (type, payload, priority, max_attempts, dedup_key, metadata, created_by)
    VALUES (p_type, p_payload, p_priority, p_max_attempts, p_dedup_key, p_metadata, auth.uid())
    RETURNING id INTO v_job_id;
  RETURN v_job_id;
END; $$;

-- buscar proximos (lock)
CREATE OR REPLACE FUNCTION public.get_next_jobs(p_limit integer DEFAULT 10, p_types text[] DEFAULT NULL)
RETURNS SETOF public.job_queue LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM job_queue
  WHERE status = 'PENDING'
    AND (next_retry_at IS NULL OR next_retry_at <= now())
    AND (p_types IS NULL OR type = ANY(p_types))
  ORDER BY priority DESC, created_at ASC
  LIMIT p_limit FOR UPDATE SKIP LOCKED;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_job_processing(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v boolean;
BEGIN
  UPDATE job_queue SET status='PROCESSING', started_at=now(), updated_at=now()
    WHERE id=p_job_id AND status='PENDING' RETURNING true INTO v;
  RETURN COALESCE(v,false);
END; $$;

CREATE OR REPLACE FUNCTION public.mark_job_completed(p_job_id uuid, p_result jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE job_queue SET status='COMPLETED', completed_at=now(),
    metadata = CASE WHEN p_result IS NOT NULL THEN metadata || jsonb_build_object('result',p_result) ELSE metadata END,
    updated_at=now()
    WHERE id=p_job_id AND status='PROCESSING';
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_job_failed(p_job_id uuid, p_error_message text, p_error_stack text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_job record; v_backoff integer;
BEGIN
  SELECT * INTO v_job FROM job_queue WHERE id=p_job_id AND status IN ('PROCESSING','PENDING');
  IF NOT FOUND THEN RETURN false; END IF;
  v_job.attempts := v_job.attempts + 1;
  IF v_job.attempts >= v_job.max_attempts THEN
    UPDATE job_queue SET status='FAILED', attempts=v_job.attempts, error_message=p_error_message,
      error_stack=p_error_stack, completed_at=now(), updated_at=now() WHERE id=p_job_id;
  ELSE
    v_backoff := POWER(2, v_job.attempts)::integer;
    UPDATE job_queue SET status='PENDING', attempts=v_job.attempts, error_message=p_error_message,
      error_stack=p_error_stack, next_retry_at = now() + (v_backoff || ' seconds')::interval, updated_at=now()
      WHERE id=p_job_id;
  END IF;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_job(p_job_id uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE job_queue SET status='CANCELLED', completed_at=now(), updated_at=now()
    WHERE id=p_job_id AND status IN ('PENDING','PROCESSING');
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_old_jobs(p_days_old integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v integer;
BEGIN
  DELETE FROM job_queue WHERE status IN ('COMPLETED','FAILED','CANCELLED')
    AND created_at < now() - (p_days_old || ' days')::interval;
  GET DIAGNOSTICS v = ROW_COUNT; RETURN v;
END; $$;

-- RLS: service_role (edges) faz tudo; admin le; demais nao acessam direto
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.job_queue;
CREATE POLICY "Service role full access" ON public.job_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins view jobs" ON public.job_queue;
CREATE POLICY "Admins view jobs" ON public.job_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- EXECUTE apenas para service_role (as RPCs sao chamadas pelas edges)
REVOKE ALL ON FUNCTION public.add_job(text,jsonb,integer,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_next_jobs(integer,text[])            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_job_processing(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_job_completed(uuid,jsonb)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_job_failed(uuid,text,text)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_job(uuid)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_jobs(integer)              FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.job_queue IS 'Fila assincrona (webhook, notificacao, POD, sync). Recriada no baseline 2026-11 por drift: estava no ledger mas ausente na producao.';
