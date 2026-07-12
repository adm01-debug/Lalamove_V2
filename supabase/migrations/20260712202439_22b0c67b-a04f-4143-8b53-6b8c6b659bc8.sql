-- Remove políticas conflitantes/frágeis de user_roles.
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins require MFA to manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

-- SELECT: usuário vê os próprios papéis; admin vê todos (sem exigir MFA para leitura).
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Gestão (INSERT/UPDATE/DELETE): exige admin COM MFA (AAL2). Sem recursão:
-- has_role() e is_aal2() são SECURITY DEFINER e não acionam RLS de user_roles.
CREATE POLICY "MFA admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.is_aal2());

CREATE POLICY "MFA admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.is_aal2())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.is_aal2());

CREATE POLICY "MFA admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.is_aal2());