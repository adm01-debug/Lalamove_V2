CREATE OR REPLACE FUNCTION public.add_job(p_type text, p_payload jsonb, p_priority integer DEFAULT 5, p_max_attempts integer DEFAULT 3, p_dedup_key text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
