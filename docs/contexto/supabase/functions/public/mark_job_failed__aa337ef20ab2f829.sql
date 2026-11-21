CREATE OR REPLACE FUNCTION public.mark_job_failed(p_job_id uuid, p_error_message text, p_error_stack text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
END; $function$
