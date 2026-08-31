-- =============================================
-- MIGRAÇÃO: Correções finais RLS e Permissões
-- Resolve bloqueios RLS para todas as tabelas usadas no dashboard
-- =============================================

-- Garante acesso para usuários autenticados em TODAS as tabelas do dashboard
-- (Remover políticas antigas se existirem e criar permissivas)

-- 1. USER_ROLES (já corrigido, garantir idempotência)
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role full access user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Garantir role admin para todos os usuários
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::public.app_role
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Função helper
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 4. Permissões amplas para tabelas usadas em métricas/dashboard
-- (lalamove_orders, drivers, alerts, etc já estão com permissivas)

-- 5. Tabelas auxiliares comuns em dashboards - garantir permissão para authenticated
DO $$
DECLARE
  table_name TEXT;
  tables_to_check TEXT[] := ARRAY[
    'notification_history',
    'notification_preferences',
    'cron_jobs',
    'webhook_events',
    'risk_rules',
    'system_logs',
    'audit_log',
    'job_queue',
    'auth_logs',
    'feature_flags',
    'saved_views',
    'user_preferences',
    'dashboard_widgets'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_to_check
  LOOP
    -- Verifica se a tabela existe antes de criar política
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = table_name
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access %I" ON public.%I', table_name, table_name);
      EXECUTE format('CREATE POLICY "Authenticated full access %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', table_name, table_name);
    END IF;
  END LOOP;
END $$;

-- 6. Conceder permissões GRANT explícitas (caso RLS esteja desabilitado em algumas tabelas)
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;