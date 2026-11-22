-- Cria `job_queue_processing_log` + `cleanup_processing_logs()`.
--
-- Contexto: a 20251226010001_configure_pg_cron.sql declara a tabela, o indice e a
-- funcao de limpeza, mas essa migration ficou FORA do ledger (congelado em
-- 20260902000000) e so a parte de cron foi aplicada em producao por outro caminho.
-- Resultado: `job_queue_processing_log` nunca existiu (confirmado por
-- information_schema) e nao havia historico de rodadas do processador de fila —
-- o cron `process-job-queue` roda a cada minuto e nao deixa trilha nenhuma.
--
-- Idempotente: pode rodar em producao (onde falta) e em `supabase db reset` local
-- (onde a 20251226010001 ja cria tudo).

CREATE TABLE IF NOT EXISTS public.job_queue_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed INTEGER NOT NULL,
  succeeded INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  duration_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
)

CREATE INDEX IF NOT EXISTS idx_job_queue_processing_log_run_at
  ON public.job_queue_processing_log (run_at DESC)

CREATE OR REPLACE FUNCTION public.cleanup_processing_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.job_queue_processing_log
   WHERE run_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$

ALTER TABLE public.job_queue_processing_log ENABLE ROW LEVEL SECURITY

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'job_queue_processing_log'
       AND policyname = 'Admins read job queue processing log'
  ) THEN
    CREATE POLICY "Admins read job queue processing log" ON public.job_queue_processing_log
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$

GRANT SELECT ON public.job_queue_processing_log TO authenticated

GRANT ALL ON public.job_queue_processing_log TO service_role

GRANT EXECUTE ON FUNCTION public.cleanup_processing_logs() TO service_role

COMMENT ON TABLE public.job_queue_processing_log IS 'Historico das rodadas do processador de fila (processados, sucesso, falha, duracao).'

-- Fecha o gap de observabilidade: process_job_queue passa a registrar cada rodada.
-- Corpo identico ao que ja roda em producao; so acrescenta o INSERT no fim.
CREATE OR REPLACE FUNCTION public.process_job_queue(p_limit integer DEFAULT 10)
RETURNS TABLE(processed integer, requeued integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job       RECORD;
  v_processed integer := 0;
  v_requeued  integer := 0;
  v_failed    integer := 0;
  v_skipped   integer := 0;
  v_key       text;
  v_start     TIMESTAMPTZ := clock_timestamp();
  v_url       text := 'https://iecgydonctmabiijadsf.supabase.co/functions/v1';
BEGIN
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'dispatcher_key' LIMIT 1;

  WITH stale AS (
    UPDATE job_queue
       SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED' ELSE 'PENDING' END,
           next_retry_at = now(),
           error_message = COALESCE(error_message,
             'Requeued by process_job_queue: stuck in PROCESSING > 10 min'),
           completed_at = CASE WHEN attempts >= max_attempts THEN now() ELSE completed_at END,
           updated_at = now()
     WHERE status = 'PROCESSING'
       AND started_at < now() - interval '10 minutes'
    RETURNING 1
  )
  SELECT count(*) INTO v_requeued FROM stale;

  FOR v_job IN SELECT * FROM get_next_jobs(p_limit) LOOP
    IF NOT mark_job_processing(v_job.id) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_key IS NULL THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'process_job_queue: vault.dispatcher_key ausente; job % ficou em PROCESSING', v_job.id;
      CONTINUE;
    END IF;

    PERFORM net.http_post(
      url := v_url || '/job-worker',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', v_key,
        'Authorization','Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'jobId',   v_job.id,
        'type',    v_job.type,
        'payload', v_job.payload,
        'metadata',v_job.metadata
      ),
      timeout_milliseconds := 25000
    );

    v_processed := v_processed + 1;
  END LOOP;

  INSERT INTO public.job_queue_processing_log
    (processed, succeeded, failed, skipped, duration_ms, metadata)
  VALUES (
    v_processed + v_skipped + v_failed,
    v_processed,
    v_failed,
    v_skipped,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER,
    jsonb_build_object('requeued', v_requeued, 'limit', p_limit)
  );

  RETURN QUERY SELECT v_processed, v_requeued;
END;
$function$
