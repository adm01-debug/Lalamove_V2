/**
 * Aplica correções via Supabase Management API
 * Endpoint: POST /v1/projects/{ref}/database/query
 */

const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const SUPABASE_ACCESS_TOKEN = ''; // PRECISA SER PREENCHIDO - PAT token

async function applyFixes() {
  console.log('🚀 Aplicando correções via Management API...\n');

  if (!SUPABASE_ACCESS_TOKEN) {
    console.log('❌ ATENÇÃO: Você precisa de um Personal Access Token!');
    console.log('   1. Acesse: https://supabase.com/dashboard/account/tokens');
    console.log('   2. Crie um novo token com permissão database:write');
    console.log('   3. Cole na variável SUPABASE_ACCESS_TOKEN deste script\n');
    console.log('   Ou use o SQL Editor manualmente com o SQL abaixo:\n');

    const sql = `-- Corrigir RLS do user_roles (resolve erro 406)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can manage their own filters" ON public.saved_filters;
DROP POLICY IF EXISTS "Users can view entity versions" ON public.entity_versions;

CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role full access user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage filters" ON public.saved_filters FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view entity versions" ON public.entity_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert entity versions" ON public.entity_versions FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::text
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id)
ON CONFLICT (user_id, role) DO NOTHING;`;

    console.log('='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70));
    return;
  }

  const sqlStatements = [
    `DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles`,
    `DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles`,
    `DROP POLICY IF EXISTS "Users can manage their own filters" ON public.saved_filters`,
    `DROP POLICY IF EXISTS "Users can view entity versions" ON public.entity_versions`,

    `CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true)`,
    `CREATE POLICY "Authenticated users can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true)`,
    `CREATE POLICY "Authenticated users can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (true)`,
    `CREATE POLICY "Service role full access user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true)`,

    `CREATE POLICY "Authenticated users can manage filters" ON public.saved_filters FOR ALL TO authenticated USING (true) WITH CHECK (true)`,
    `CREATE POLICY "Authenticated users can view entity versions" ON public.entity_versions FOR SELECT TO authenticated USING (true)`,
    `CREATE POLICY "Authenticated users can insert entity versions" ON public.entity_versions FOR INSERT TO authenticated WITH CHECK (true)`,
  ];

  const fullSQL = sqlStatements.join('; ');

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        query: fullSQL,
        read_only: false,
      }),
    }
  );

  const result = await response.text();
  console.log('Status:', response.status);
  console.log('Resposta:', result);
}

applyFixes().catch(console.error);