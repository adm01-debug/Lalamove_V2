-- 20261122140000_fix_crons_dispatcher.sql
--
-- Incidentes corrigidos em producao (2026-11-21, ~18:40 UTC):
--
--  1) Crons pg_net retornando 401 desde 12:40
--     cron.job 18 (escalate-unacknowledged-alerts) e 19 (lalamove_uapi_token_refresh_hourly)
--     embutiam a chave anon JWT legacy, desabilitada em 2026-11-20. net.http_post apenas
--     enfileira, entao cron.job_run_details reportava 'succeeded' com 78/78 respostas 401
--     em net._http_response. Passam a usar a publishable key.
--
--  2) job_queue sem dispatcher
--     geo_emit_event() e demais produtores chamam add_job(), mas process_job_queue() nunca
--     foi criada em producao (a migration 20251226010001_configure_pg_cron.sql estava no
--     ledger sem ter sido aplicada) e nao havia cron de fila. Toda notificacao morria em
--     status PENDING. Esta migration cria a funcao e o cron de 1 minuto.
--
--  3) Mojibake em alert_configurations
--     O seed da migration 20261122130100_geo_foundation gravou U+FFFD no lugar de letras
--     acentuadas (1 name + 4 message_template). Corrigido sem depender do encoding do
--     cliente: chr(225)=a-agudo, chr(227)=a-til, chr(231)=c-cedilha, chr(243)=o-agudo.
--
-- A chave do dispatcher NAO e hardcoded: fica em vault (name='dispatcher_key') e e lida
-- via vault.decrypted_secrets. O secret precisa existir antes de a funcao rodar de fato;
-- sem ele a funcao apenas emite WARNING e devolve a linha para PENDING pelo requeue.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Dispatcher da job_queue
-- ---------------------------------------------------------------------------
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
  v_key       text;
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
      CONTINUE;
    END IF;

    IF v_key IS NULL THEN
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

  RETURN QUERY SELECT v_processed, v_requeued;
END;
$function$;

COMMENT ON FUNCTION public.process_job_queue(integer) IS
  'Drena job_queue para a edge function job-worker via pg_net. Idempotente; requeue de PROCESSING travado >10min.';

REVOKE ALL ON FUNCTION public.process_job_queue(integer) FROM PUBLIC, anon, authenticated;

DO $d1$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-job-queue') THEN
    PERFORM cron.unschedule('process-job-queue');
  END IF;
  PERFORM cron.schedule('process-job-queue', '* * * * *',
    'select public.process_job_queue(10);');
END $d1$;

-- ---------------------------------------------------------------------------
-- 2) Crons com chave legacy -> publishable key
-- ---------------------------------------------------------------------------
DO $d2$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escalate-unacknowledged-alerts') THEN
    PERFORM cron.unschedule('escalate-unacknowledged-alerts');
  END IF;
  PERFORM cron.schedule('escalate-unacknowledged-alerts', '*/5 * * * *', $cmd1$
    select net.http_post(
      url:='https://iecgydonctmabiijadsf.supabase.co/functions/v1/escalate-alerts',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'apikey', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dispatcher_key' LIMIT 1), '')
      ),
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $cmd1$);
END $d2$;

DO $d3$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lalamove_uapi_token_refresh_hourly') THEN
    PERFORM cron.unschedule('lalamove_uapi_token_refresh_hourly');
  END IF;
  PERFORM cron.schedule('lalamove_uapi_token_refresh_hourly', '17 * * * *', $cmd2$
    select net.http_post(
      url:='https://iecgydonctmabiijadsf.supabase.co/functions/v1/lalamove-token-refresh',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'apikey', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dispatcher_key' LIMIT 1), '')
      ),
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $cmd2$);
END $d3$;

-- ---------------------------------------------------------------------------
-- 3) Mojibake em alert_configurations
-- ---------------------------------------------------------------------------
UPDATE alert_configurations
   SET name = replace(
                replace(
                  replace(name,
                    chr(79)||chr(114)||chr(239)||chr(191)||chr(189)||chr(97)||chr(109)||chr(101)||chr(110)||chr(116)||chr(111),
                    chr(79)||chr(114)||chr(231)||chr(97)||chr(109)||chr(101)||chr(110)||chr(116)||chr(111)),
                  chr(239)||chr(191)||chr(189)||chr(97), chr(225)),
                chr(239)||chr(191)||chr(189)||chr(111), chr(243))
 WHERE name LIKE '%' || chr(239) || chr(191) || chr(189) || '%';

UPDATE alert_configurations
   SET message_template = replace(
                replace(
                  replace(message_template,
                    chr(239)||chr(191)||chr(189)||chr(97), chr(225)),
                  chr(239)||chr(191)||chr(189)||chr(111), chr(243)),
                chr(239)||chr(191)||chr(189)||chr(99), chr(231))
 WHERE message_template LIKE '%' || chr(239) || chr(191) || chr(189) || '%';

COMMIT;