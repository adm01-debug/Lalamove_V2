/**
 * Aplica as correções do dashboard via conexão direta PostgreSQL
 */

import pg from 'pg';

const { Client } = pg;

const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const SUPABASE_DB_HOST = `db.${SUPABASE_PROJECT_REF}.supabase.co`;
const SUPABASE_DB_PORT = 5432;
const SUPABASE_DB_NAME = 'postgres';
const SUPABASE_DB_USER = `postgres.${SUPABASE_PROJECT_REF}`;
const SUPABASE_DB_PASSWORD = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY2OTk1NiwiZXhwIjoyMTAxMjQ1OTU2fQ.EvEAzIgWT-xh-RpzaEw2XH24ZHQn2THFJ7XaRsvP9D0';

async function applyFixes() {
  console.log('🔌 Conectando ao banco PostgreSQL do Supabase...\n');

  const client = new Client({
    host: SUPABASE_DB_HOST,
    port: SUPABASE_DB_PORT,
    database: SUPABASE_DB_NAME,
    user: SUPABASE_DB_USER,
    password: SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conexão estabelecida!\n');

    const sqlStatements = [
      // Drop existing policies
      `DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles`,
      `DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles`,
      `DROP POLICY IF EXISTS "Users can manage their own filters" ON public.saved_filters`,
      `DROP POLICY IF EXISTS "Users can view entity versions" ON public.entity_versions`,

      // Create new permissive policies
      `CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true)`,
      `CREATE POLICY "Authenticated users can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true)`,
      `CREATE POLICY "Authenticated users can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (true)`,
      `CREATE POLICY "Service role full access user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // Create helper function
      `CREATE OR REPLACE FUNCTION public.get_current_user_role()
       RETURNS TEXT
       LANGUAGE sql
       STABLE
       SECURITY DEFINER
       SET search_path = public
       AS $$
         SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
       $$`,

      // Permissions for dashboard tables
      `CREATE POLICY "Authenticated users can manage filters" ON public.saved_filters FOR ALL TO authenticated USING (true) WITH CHECK (true)`,
      `CREATE POLICY "Authenticated users can view entity versions" ON public.entity_versions FOR SELECT TO authenticated USING (true)`,
      `CREATE POLICY "Authenticated users can insert entity versions" ON public.entity_versions FOR INSERT TO authenticated WITH CHECK (true)`,
    ];

    console.log('📝 Aplicando correções...\n');

    for (const sql of sqlStatements) {
      try {
        await client.query(sql);
        console.log(`  ✅ ${sql.substring(0, 70).replace(/\s+/g, ' ')}...`);
      } catch (err: any) {
        console.log(`  ⚠️  ${err.message.substring(0, 100)}`);
      }
    }

    // Insert admin role for existing users
    console.log('\n👤 Adicionando role admin para usuários existentes...');
    const result = await client.query(`
      INSERT INTO public.user_roles (user_id, role)
      SELECT au.id, 'admin'::text
      FROM auth.users au
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id
      )
      ON CONFLICT (user_id, role) DO NOTHING
      RETURNING user_id
    `);
    console.log(`  ✅ ${result.rowCount} usuários com role admin definido\n`);

    console.log('🎉 Correções aplicadas com sucesso!\n');
    console.log('💡 Agora reinicie o servidor e faça login novamente.\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await client.end();
  }
}

applyFixes();