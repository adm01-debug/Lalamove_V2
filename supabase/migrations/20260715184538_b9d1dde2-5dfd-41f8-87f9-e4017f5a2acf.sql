-- Hardening: revogar EXECUTE de PUBLIC nas funções SECURITY DEFINER pré-auth
-- e conceder explicitamente apenas aos roles necessários (anon para login,
-- authenticated para chamadas pós-login se aplicável). Reduz a superfície
-- caso novos roles sejam adicionados ao projeto no futuro.

REVOKE EXECUTE ON FUNCTION public.check_login_lockout_v2(text, inet) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_login_lockout_v2(text, inet) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_failed_login_v2(text, inet, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_failed_login_v2(text, inet, text) TO anon, authenticated, service_role;