REVOKE EXECUTE ON FUNCTION public.check_login_lockout(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_failed_login(text, inet) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_failed_login(text, inet) TO service_role;
