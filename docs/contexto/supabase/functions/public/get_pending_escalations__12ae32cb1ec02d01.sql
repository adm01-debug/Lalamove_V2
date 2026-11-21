CREATE OR REPLACE FUNCTION public.get_pending_escalations()
 RETURNS TABLE(alert_id uuid, alert_type alert_type, severity alert_severity, title text, message text, order_id uuid, driver_id uuid, created_at timestamp with time zone, escalation_after_seconds integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.type, a.severity, a.title, a.message, a.order_id, a.driver_id, a.created_at,
         COALESCE(c.escalation_after_seconds, 900)
  FROM public.alerts a
  JOIN public.alert_configurations c
    ON c.alert_type = a.type AND c.is_enabled = true AND c.escalation_enabled = true
  WHERE a.acknowledged_at IS NULL
    AND a.escalated_at IS NULL
    AND a.is_dismissed = false
    AND a.severity IN ('CRITICAL','WARNING')
    AND a.created_at < now() - make_interval(secs => COALESCE(c.escalation_after_seconds, 900));
$function$
