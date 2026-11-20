/**
 * Aplica SQL final de correção via Management API
 */

const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.');
  process.exit(1);
}
const sql = `
-- Garantir que TODOS os usuários autenticados tenham role admin
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::public.app_role
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- Garantir políticas permissivas para user_roles (todas as variações)
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

-- Função helper
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role::TEXT FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1; $$;
`;

async function applySQL() {
  console.log('🚀 Aplicando SQL final...\n');

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        query: sql,
        read_only: false,
      }),
    }
  );

  const result = await response.text();
  console.log('Status:', response.status);
  console.log('Resposta:', result);
}

applySQL().catch(console.error);