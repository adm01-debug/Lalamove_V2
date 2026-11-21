CREATE OR REPLACE FUNCTION public.mark_job_completed(p_job_id uuid, p_result jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE job_queue SET status='COMPLETED', completed_at=now(),
    metadata = CASE WHEN p_result IS NOT NULL THEN metadata || jsonb_build_object('result',p_result) ELSE metadata END,
    updated_at=now()
    WHERE id=p_job_id AND status='PROCESSING';
  RETURN FOUND;
END; $function$
