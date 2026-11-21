CREATE OR REPLACE FUNCTION public.get_next_jobs(p_limit integer DEFAULT 10, p_types text[] DEFAULT NULL::text[])
 RETURNS SETOF job_queue
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT * FROM job_queue
  WHERE status = 'PENDING'
    AND (next_retry_at IS NULL OR next_retry_at <= now())
    AND (p_types IS NULL OR type = ANY(p_types))
  ORDER BY priority DESC, created_at ASC
  LIMIT p_limit FOR UPDATE SKIP LOCKED;
END; $function$
