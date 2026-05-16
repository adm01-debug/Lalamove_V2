-- Ajustar search_path para segurança das funções
ALTER FUNCTION public.log_mfa_session() SET search_path = public;

-- Revogar execução pública de funções sensíveis para evitar acesso anônimo
REVOKE EXECUTE ON FUNCTION public.is_aal2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_mfa_session() FROM PUBLIC;

-- Conceder execução apenas para usuários autenticados
GRANT EXECUTE ON FUNCTION public.is_aal2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_mfa_session() TO authenticated;

-- Garantir que tabelas críticas tenham RLS habilitado (Prevenindo erros do linter)
ALTER TABLE IF EXISTS public.mfa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

-- Reforçar política de admin com MFA
DO $$
BEGIN
    -- Remover políticas que podem ser muito permissivas se existirem
    -- DROP POLICY IF EXISTS "Admins manage everything" ON public.user_roles;
    
    -- Criar política restritiva para admins
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_roles' AND policyname = 'Admins require MFA to manage roles'
    ) THEN
        CREATE POLICY "Admins require MFA to manage roles"
        ON public.user_roles
        FOR ALL
        TO authenticated
        USING (
            (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin' 
            AND (auth.jwt() ->> 'aal' = 'aal2')
        );
    END IF;
END $$;
