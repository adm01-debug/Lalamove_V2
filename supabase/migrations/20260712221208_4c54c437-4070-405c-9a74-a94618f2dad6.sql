REVOKE EXECUTE ON FUNCTION public.claim_alert_notification(text, alert_type, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_pending_escalations() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.acknowledge_alert(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_alert_notification(text, alert_type, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_escalations() TO service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_alert(uuid) TO authenticated;