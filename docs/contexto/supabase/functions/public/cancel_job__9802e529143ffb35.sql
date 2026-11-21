CREATE OR REPLACE FUNCTION public.cancel_job(p_job_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE job_queue SET status='CANCELLED', completed_at=now(), updated_at=now()
    WHERE id=p_job_id AND status IN ('PENDING','PROCESSING');
  RETURN FOUND;
END; $function$
