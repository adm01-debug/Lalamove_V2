-- Função para verificar se o usuário tem MFA verificado (AAL2)
CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT auth.jwt() ->> 'aal' = 'aal2');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Tabela para auditoria de sessões MFA
CREATE TABLE IF NOT EXISTS public.mfa_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    factor_id UUID,
    aal_level TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela mfa_sessions
ALTER TABLE public.mfa_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para mfa_sessions
CREATE POLICY "Usuários podem ver suas próprias sessões MFA"
ON public.mfa_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Restringir acesso a tabelas de segurança para exigir MFA (AAL2) se for admin
-- Nota: Isso aplica uma camada extra de segurança além do RBAC básico

-- Exemplo para a tabela user_roles (apenas se o usuário for admin e tiver MFA)
DO $$
BEGIN
    -- Remover políticas antigas se existirem para evitar conflitos (opcional, dependendo do estado atual)
    -- DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
    
    -- Criar política que exige AAL2 para admins gerenciarem roles
    CREATE POLICY "Admins require MFA to manage roles"
    ON public.user_roles
    FOR ALL
    USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin' 
        AND (auth.jwt() ->> 'aal' = 'aal2')
    );
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- Registrar evento de login MFA (Trigger ou via Edge Function seria ideal, mas aqui criamos a base)
CREATE OR REPLACE FUNCTION public.log_mfa_session()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.mfa_sessions (user_id, aal_level, ip_address, user_agent)
  VALUES (auth.uid(), auth.jwt() ->> 'aal', NULL, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
