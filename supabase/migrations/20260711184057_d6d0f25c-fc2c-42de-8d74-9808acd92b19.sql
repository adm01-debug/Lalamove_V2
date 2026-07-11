
-- Funções de contexto de usuário não fazem sentido para anon: exigir login.
REVOKE ALL ON FUNCTION public.get_user_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_roles(uuid)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_aal2()                  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_aal2()                  TO authenticated, service_role;
