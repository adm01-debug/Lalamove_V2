CREATE OR REPLACE FUNCTION public.notification_status_transition_allowed(p_from text, p_to text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_from = p_to OR CASE p_from
    WHEN 'queued'    THEN p_to IN ('sent','failed','uncertain','expired','suppressed')
    WHEN 'sent'      THEN p_to IN ('delivered','read','failed','uncertain','expired')
    WHEN 'delivered' THEN p_to IN ('read','failed')
    ELSE false   -- read/failed/uncertain/expired/suppressed sao finais
  END;
$function$
