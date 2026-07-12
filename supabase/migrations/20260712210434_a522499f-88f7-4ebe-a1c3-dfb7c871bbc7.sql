REVOKE EXECUTE ON FUNCTION public.clear_login_attempts(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_login_attempts(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_login_attempts(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.clear_login_attempts(text) TO service_role;