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
