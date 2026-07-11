
-- ============================================================================
-- Hardening de EXECUTE em funções SECURITY DEFINER (defesa em profundidade)
-- Reduz superfície de ataque: funções internas deixam de ser chamáveis por
-- anon/authenticated via Data API. Funções usadas em RLS (has_role) e nos
-- fluxos pré-auth/cliente (login lockout, reset de senha, permissões) são
-- preservadas. Triggers continuam funcionando pois executam como owner.
-- ============================================================================

-- 1) Funções de manutenção/auditoria: somente automação de backend (service_role).
REVOKE ALL ON FUNCTION public.cleanup_expired_tokens()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_cron_logs()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_login_attempts()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_daily_cleanup()                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_daily_cleanup_with_logging()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_rls_security_audit()            FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_tokens()         TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_cron_logs()          TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_login_attempts()     TO service_role;
GRANT EXECUTE ON FUNCTION public.run_daily_cleanup()              TO service_role;
GRANT EXECUTE ON FUNCTION public.run_daily_cleanup_with_logging() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_rls_security_audit()         TO service_role;

-- 2) Funções chamadas exclusivamente por edge functions (service_role).
REVOKE ALL ON FUNCTION public.get_active_uapi_token()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_known_device(uuid, text)         FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_active_uapi_token()          TO service_role;
GRANT EXECUTE ON FUNCTION public.is_known_device(uuid, text)      TO service_role;

-- 3) Funções de trigger: nunca devem ser chamáveis via API (executam como owner).
REVOKE ALL ON FUNCTION public.invalidate_old_tokens()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sanitize_auth_log_metadata()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_token_expiration()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_bitrix24_sync()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_mfa_session()                  FROM PUBLIC, anon, authenticated;
