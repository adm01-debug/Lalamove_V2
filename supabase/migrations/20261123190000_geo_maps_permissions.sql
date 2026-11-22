-- ============================================================================
-- Etapa 92 do plano Google (docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md)
--
-- O admin de mapas estava protegido apenas por has_role(admin) nas policies e
-- por isAdmin() na tela. Faltava a permissao nomeada que o resto do sistema usa
-- (permissions + role_permissions): sem ela, nao havia como dar leitura de
-- custo ao manager sem dar escrita, e a UI nao tinha o que consultar.
--
--   maps.settings.write  -> admin
--   maps.usage.read      -> admin e manager
--
-- Nao mexe nas policies existentes (admin continua podendo tudo); apenas
-- acrescenta leitura de uso para manager, que hoje toma 0 linhas em geo_usage
-- quando nao e admin.
-- ============================================================================

INSERT INTO public.permissions (name, module, action, description) VALUES
  ('maps.settings.write', 'maps', 'settings.write', 'Trocar provedor de mapa e editar orcamento'),
  ('maps.usage.read',     'maps', 'usage.read',     'Consultar uso e custo dos provedores de mapa')
ON CONFLICT (name) DO NOTHING;

-- admin recebe as duas
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
WHERE name IN ('maps.settings.write', 'maps.usage.read')
ON CONFLICT (role, permission_id) DO NOTHING;

-- manager recebe apenas leitura de uso
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', id FROM public.permissions
WHERE name = 'maps.usage.read'
ON CONFLICT (role, permission_id) DO NOTHING;

-- leitura de geo_usage passa a aceitar "admin OR manager OR permissao maps.usage.read".
-- O OR mantem o comportamento atual (has_role manager) para nao depender de backfill.
DROP POLICY IF EXISTS "geo_usage_read_manager" ON public.geo_usage;
CREATE POLICY "geo_usage_read_manager" ON public.geo_usage FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_permission(auth.uid(), 'maps.usage.read')
  );

COMMENT ON COLUMN public.permissions.module IS 'Modulo funcional; maps cobre provedores de mapa e custo (etapa 92).';
