CREATE OR REPLACE FUNCTION public.mark_job_processing(p_job_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v boolean;
BEGIN
  UPDATE job_queue SET status='PROCESSING', started_at=now(), updated_at=now()
    WHERE id=p_job_id AND status='PENDING' RETURNING true INTO v;
  RETURN COALESCE(v,false);
END; $function$
