CREATE OR REPLACE FUNCTION public.notification_messages_scrub_bodies(p_keep_days integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  WITH alvo AS (
    UPDATE notification_messages
       SET body_preview = NULL,
           metadata = metadata - 'media_url'
     WHERE created_at < now() - make_interval(days => p_keep_days)
       AND (body_preview IS NOT NULL OR metadata ? 'media_url')
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM alvo;
  RETURN v_count;
END; $function$
