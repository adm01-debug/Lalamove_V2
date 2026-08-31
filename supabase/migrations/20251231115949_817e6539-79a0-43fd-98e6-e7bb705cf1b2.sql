-- =============================================
-- MÓDULO DE SEGURANÇA COMPLETO
-- =============================================

-- 1. ENUM para roles do sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'operator', 'viewer');

-- 2. Tabela de roles de usuários
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    assigned_by UUID,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Tabela de permissões granulares
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabela de permissões por role
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role app_role NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (role, permission_id)
);

-- 5. Tabela de logs de rate limit
CREATE TABLE public.rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    endpoint TEXT NOT NULL,
    user_id UUID,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    window_end TIMESTAMP WITH TIME ZONE,
    blocked BOOLEAN DEFAULT false,
    user_agent TEXT,
    country_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Tabela de IPs bloqueados
CREATE TABLE public.blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    blocked_by UUID,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_permanent BOOLEAN DEFAULT false,
    attempts_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Tabela de whitelist de IPs
CREATE TABLE public.ip_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    cidr_range TEXT,
    description TEXT NOT NULL,
    added_by UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Tabela de sessões de MFA
CREATE TABLE public.mfa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    factor_id TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. Tabela de logs de autenticação
CREATE TABLE public.auth_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    event_type TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. Tabela de tokens de recuperação de senha
CREATE TABLE public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. Tabela de verificação de email
CREATE TABLE public.email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- FUNÇÕES DE SEGURANÇA
-- =============================================

-- Função para verificar se usuário tem role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > now())
    )
$$;

-- Função para verificar se usuário tem permissão
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role = rp.role
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = _user_id
          AND ur.is_active = true
          AND (ur.expires_at IS NULL OR ur.expires_at > now())
          AND p.name = _permission_name
    )
$$;

-- Função para verificar se IP está bloqueado
CREATE OR REPLACE FUNCTION public.is_ip_blocked(_ip_address INET)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.blocked_ips
        WHERE ip_address = _ip_address
          AND (is_permanent = true OR expires_at > now())
    )
$$;

-- Função para verificar se IP está na whitelist
CREATE OR REPLACE FUNCTION public.is_ip_whitelisted(_ip_address INET)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ip_whitelist
        WHERE is_active = true
          AND (ip_address = _ip_address OR _ip_address << cidr_range::inet)
    )
$$;

-- Função para obter roles do usuário
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
$$;

-- Função para obter permissões do usuário
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE(permission_name TEXT, module TEXT, action TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT p.name, p.module, p.action
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Políticas para user_roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- Políticas para permissions
CREATE POLICY "Anyone authenticated can view permissions" ON public.permissions
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage permissions" ON public.permissions
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para role_permissions
CREATE POLICY "Anyone authenticated can view role_permissions" ON public.role_permissions
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para rate_limit_logs
CREATE POLICY "Admins can view rate limit logs" ON public.rate_limit_logs
FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "System can insert rate limit logs" ON public.rate_limit_logs
FOR INSERT WITH CHECK (true);

-- Políticas para blocked_ips
CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view blocked IPs" ON public.blocked_ips
FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- Políticas para ip_whitelist
CREATE POLICY "Admins can manage IP whitelist" ON public.ip_whitelist
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view IP whitelist" ON public.ip_whitelist
FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- Políticas para mfa_sessions
CREATE POLICY "Users can manage own MFA sessions" ON public.mfa_sessions
FOR ALL USING (auth.uid() = user_id);

-- Políticas para auth_logs
CREATE POLICY "Users can view own auth logs" ON public.auth_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all auth logs" ON public.auth_logs
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert auth logs" ON public.auth_logs
FOR INSERT WITH CHECK (true);

-- Políticas para password_reset_tokens
CREATE POLICY "Users can view own reset tokens" ON public.password_reset_tokens
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage reset tokens" ON public.password_reset_tokens
FOR ALL WITH CHECK (true);

-- Políticas para email_verifications
CREATE POLICY "Users can view own verifications" ON public.email_verifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage verifications" ON public.email_verifications
FOR ALL WITH CHECK (true);

-- =============================================
-- PERMISSÕES PADRÃO DO SISTEMA
-- =============================================

INSERT INTO public.permissions (name, description, module, action) VALUES
-- Dashboard
('dashboard.view', 'Visualizar dashboard', 'dashboard', 'view'),
('dashboard.export', 'Exportar dados do dashboard', 'dashboard', 'export'),

-- Motoristas
('drivers.view', 'Visualizar motoristas', 'drivers', 'view'),
('drivers.create', 'Criar motoristas', 'drivers', 'create'),
('drivers.edit', 'Editar motoristas', 'drivers', 'edit'),
('drivers.delete', 'Excluir motoristas', 'drivers', 'delete'),
('drivers.approve', 'Aprovar/Rejeitar motoristas', 'drivers', 'approve'),
('drivers.blacklist', 'Gerenciar blacklist', 'drivers', 'blacklist'),

-- Pedidos
('orders.view', 'Visualizar pedidos', 'orders', 'view'),
('orders.create', 'Criar pedidos', 'orders', 'create'),
('orders.edit', 'Editar pedidos', 'orders', 'edit'),
('orders.cancel', 'Cancelar pedidos', 'orders', 'cancel'),

-- Alertas
('alerts.view', 'Visualizar alertas', 'alerts', 'view'),
('alerts.manage', 'Gerenciar alertas', 'alerts', 'manage'),
('alerts.configure', 'Configurar alertas', 'alerts', 'configure'),

-- Relatórios
('reports.view', 'Visualizar relatórios', 'reports', 'view'),
('reports.export', 'Exportar relatórios', 'reports', 'export'),

-- Configurações
('settings.view', 'Visualizar configurações', 'settings', 'view'),
('settings.edit', 'Editar configurações', 'settings', 'edit'),

-- Segurança
('security.view', 'Visualizar segurança', 'security', 'view'),
('security.manage', 'Gerenciar segurança', 'security', 'manage'),
('security.audit', 'Auditoria de segurança', 'security', 'audit'),

-- Usuários
('users.view', 'Visualizar usuários', 'users', 'view'),
('users.create', 'Criar usuários', 'users', 'create'),
('users.edit', 'Editar usuários', 'users', 'edit'),
('users.delete', 'Excluir usuários', 'users', 'delete'),
('users.roles', 'Gerenciar roles', 'users', 'roles'),

-- Integrações
('integrations.view', 'Visualizar integrações', 'integrations', 'view'),
('integrations.manage', 'Gerenciar integrações', 'integrations', 'manage');

-- Permissões por role - Admin (todas)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions;

-- Permissões por role - Manager
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', id FROM public.permissions 
WHERE name NOT IN ('users.delete', 'users.roles', 'security.manage', 'settings.edit');

-- Permissões por role - Operator
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'operator', id FROM public.permissions 
WHERE module IN ('dashboard', 'drivers', 'orders', 'alerts')
  AND action IN ('view', 'create', 'edit', 'approve');

-- Permissões por role - Viewer
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'viewer', id FROM public.permissions 
WHERE action = 'view';

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ip_whitelist_updated_at
    BEFORE UPDATE ON public.ip_whitelist
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_rate_limit_logs_ip ON public.rate_limit_logs(ip_address);
CREATE INDEX idx_rate_limit_logs_created ON public.rate_limit_logs(created_at DESC);
CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip_address);
CREATE INDEX idx_blocked_ips_expires ON public.blocked_ips(expires_at);
CREATE INDEX idx_auth_logs_user ON public.auth_logs(user_id);
CREATE INDEX idx_auth_logs_created ON public.auth_logs(created_at DESC);
CREATE INDEX idx_mfa_sessions_user ON public.mfa_sessions(user_id);

-- Habilitar realtime para tabelas críticas
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rate_limit_logs;