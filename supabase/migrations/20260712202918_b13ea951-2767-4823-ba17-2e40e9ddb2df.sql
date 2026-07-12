-- permissions: restringe leitura ao modelo RBAC (admin/manager).
DROP POLICY IF EXISTS "Anyone authenticated can view permissions" ON public.permissions;
CREATE POLICY "Authorized roles can view permissions"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- role_permissions: idem.
DROP POLICY IF EXISTS "Anyone authenticated can view role_permissions" ON public.role_permissions;
CREATE POLICY "Authorized roles can view role_permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- feature_flags: leitura escopada a usuários autenticados (necessária p/ gating no client).
DROP POLICY IF EXISTS "Feature flags are viewable by all authenticated users" ON public.feature_flags;
CREATE POLICY "Feature flags are viewable by authenticated users"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);