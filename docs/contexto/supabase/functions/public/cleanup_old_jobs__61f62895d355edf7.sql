CREATE OR REPLACE FUNCTION public.cleanup_old_jobs(p_days_old integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v integer;
BEGIN
  DELETE FROM job_queue WHERE status IN ('COMPLETED','FAILED','CANCELLED')
    AND created_at < now() - (p_days_old || ' days')::interval;
  GET DIAGNOSTICS v = ROW_COUNT; RETURN v;
END; $function$
