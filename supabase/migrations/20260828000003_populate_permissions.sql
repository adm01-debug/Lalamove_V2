-- =============================================
-- MIGRAÇÃO: Popular tabela de permissões e role_permissions
-- Resolve erro "Você não tem permissão para acessar este recurso"
-- =============================================

-- 1. Inserir todas as permissões necessárias (apenas se não existirem)
INSERT INTO public.permissions (name, module, action, description) VALUES
  -- Users module
  ('users.view', 'users', 'view', 'Visualizar usuários'),
  ('users.create', 'users', 'create', 'Criar usuários'),
  ('users.update', 'users', 'update', 'Atualizar usuários'),
  ('users.delete', 'users', 'delete', 'Deletar usuários'),
  ('users.roles', 'users', 'roles', 'Gerenciar roles e permissões'),
  ('users.audit', 'users', 'audit', 'Visualizar auditoria de usuários'),
  -- Drivers module
  ('drivers.view', 'drivers', 'view', 'Visualizar motoristas'),
  ('drivers.approve', 'drivers', 'approve', 'Aprovar motoristas'),
  ('drivers.block', 'drivers', 'block', 'Bloquear motoristas'),
  -- Orders module
  ('orders.view', 'orders', 'view', 'Visualizar pedidos'),
  ('orders.create', 'orders', 'create', 'Criar pedidos'),
  ('orders.update', 'orders', 'update', 'Atualizar pedidos'),
  ('orders.cancel', 'orders', 'cancel', 'Cancelar pedidos'),
  -- Approvals module
  ('approvals.view', 'approvals', 'view', 'Visualizar aprovações'),
  ('approvals.review', 'approvals', 'review', 'Revisar aprovações'),
  -- Alerts module
  ('alerts.view', 'alerts', 'view', 'Visualizar alertas'),
  ('alerts.manage', 'alerts', 'manage', 'Gerenciar alertas'),
  ('alerts.configure', 'alerts', 'configure', 'Configurar alertas'),
  -- Analytics module
  ('analytics.view', 'analytics', 'view', 'Visualizar analytics'),
  ('analytics.export', 'analytics', 'export', 'Exportar relatórios'),
  -- Settings module
  ('settings.view', 'settings', 'view', 'Visualizar configurações'),
  ('settings.update', 'settings', 'update', 'Atualizar configurações'),
  -- Security module
  ('security.view', 'security', 'view', 'Visualizar segurança'),
  ('security.audit', 'security', 'audit', 'Auditoria de segurança'),
  ('security.mfa', 'security', 'mfa', 'Configurar MFA'),
  -- Integrations module
  ('integrations.view', 'integrations', 'view', 'Visualizar integrações'),
  ('integrations.configure', 'integrations', 'configure', 'Configurar integrações')
ON CONFLICT (name) DO NOTHING;

-- 2. Garantir que o role admin tem TODAS as permissões
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, p.id
FROM public.permissions p
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3. Garantir que o role manager tem permissões operacionais (sem users.roles)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::public.app_role, p.id
FROM public.permissions p
WHERE p.name IN (
  'users.view', 'drivers.view', 'drivers.approve', 'drivers.block',
  'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
  'approvals.view', 'approvals.review',
  'alerts.view', 'alerts.manage', 'alerts.configure',
  'analytics.view',
  'settings.view',
  'security.view',
  'integrations.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 4. Garantir que operator tem permissões básicas
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'operator'::public.app_role, p.id
FROM public.permissions p
WHERE p.name IN (
  'drivers.view', 'orders.view', 'orders.create', 'orders.update',
  'approvals.view', 'alerts.view', 'analytics.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 5. Garantir que viewer só pode ver
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'viewer'::public.app_role, p.id
FROM public.permissions p
WHERE p.name IN (
  'drivers.view', 'orders.view', 'analytics.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 6. Garantir que TODOS os user_roles estão com is_active = true
UPDATE public.user_roles
SET is_active = true
WHERE is_active IS NULL OR is_active = false;

-- 7. Verificar contagem (retorno)
DO $$
DECLARE
  perms_count INT;
  rp_count INT;
BEGIN
  SELECT COUNT(*) INTO perms_count FROM public.permissions;
  SELECT COUNT(*) INTO rp_count FROM public.role_permissions;
  RAISE NOTICE '✅ Permissões cadastradas: %', perms_count;
  RAISE NOTICE '✅ Role permissions cadastradas: %', rp_count;
END $$;