-- =============================================
-- MIGRAÇÃO: Correções para o Dashboard
-- 1. Corrigir RLS para user_roles (resolver erro 406)
-- 2. Criar função helper para role do usuário
-- =============================================

-- 1. CORREÇÃO URGENTE: user_roles com erro 406
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Política permissiva para usuários autenticados verem roles
CREATE POLICY "Authenticated users can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Service role full access user_roles" ON public.user_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Garantir que o role do usuário logado existe na tabela user_roles
-- Isso resolve o problema de role indefinido
INSERT INTO public.user_roles (user_id, role)
SELECT
  au.id,
  'admin'::public.app_role
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Criar função helper para obter role do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;