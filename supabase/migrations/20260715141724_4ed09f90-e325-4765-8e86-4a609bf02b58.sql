-- Endurecimento de superfície de ataque: revoga EXECUTE para authenticated
-- em funções que só devem ser chamadas por edge functions com service_role.
-- Ambas continuam plenamente funcionais para service_role (bypassa REVOKE).

REVOKE EXECUTE ON FUNCTION public.claim_alert_notification(text, alert_type, integer) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_pending_escalations() FROM authenticated, anon, public;

-- Garantir que service_role permanece com acesso explícito.
GRANT EXECUTE ON FUNCTION public.claim_alert_notification(text, alert_type, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_escalations() TO service_role;