
-- Revoga EXECUTE de PUBLIC/anon/authenticated em helpers internos SECURITY DEFINER.
-- Essas funções são usadas dentro de policies (que rodam com owner) ou apenas
-- por Edge Functions (service_role). Não devem ser API pública.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_aal2() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_token_valid(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.use_reset_token(text, inet) FROM PUBLIC, anon, authenticated;

-- Garante que service_role e o owner mantêm execução.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_aal2() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_token_valid(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_reset_token(text, inet) TO service_role;
