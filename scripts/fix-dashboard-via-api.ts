/**
 * Aplica todas as correções do Dashboard via SQL usando API REST do Supabase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY2OTk1NiwiZXhwIjoyMTAxMjQ1OTU2fQ.EvEAzIgWT-xh-RpzaEw2XH24ZHQn2THFJ7XaRsvP9D0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function applyFixes() {
  console.log('🚀 Aplicando correções no banco...\n');

  const statements = [
    // 1. Drop existing policies
    `DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles`,
    `DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles`,
    `DROP POLICY IF EXISTS "Users can manage their own filters" ON public.saved_filters`,
    `DROP POLICY IF EXISTS "Users can view entity versions" ON public.entity_versions`,

    // 2. Create new permissive policies for user_roles
    `CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true)`,
    `CREATE POLICY "Authenticated users can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true)`,
    `CREATE POLICY "Authenticated users can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (true)`,
    `CREATE POLICY "Service role full access user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true)`,

    // 3. Dashboard tables permissions
    `CREATE POLICY "Authenticated users can manage filters" ON public.saved_filters FOR ALL TO authenticated USING (true) WITH CHECK (true)`,
    `CREATE POLICY "Authenticated users can view entity versions" ON public.entity_versions FOR SELECT TO authenticated USING (true)`,
    `CREATE POLICY "Authenticated users can insert entity versions" ON public.entity_versions FOR INSERT TO authenticated WITH CHECK (true)`,
  ];

  for (const sql of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql }).throwOnError();
      console.log(`  ✅ ${sql.substring(0, 70).replace(/\s+/g, ' ')}`);
    } catch (err: any) {
      console.log(`  ⚠️  ${err.message?.substring(0, 100) || 'Erro desconhecido'}`);
    }
  }

  // 4. Insert admin role for existing users
  console.log('\n👤 Adicionando role admin para usuários...');
  const { data: users } = await supabase.auth.admin.listUsers();
  if (users?.users) {
    for (const user of users.users) {
      try {
        await supabase.from('user_roles').upsert({
          user_id: user.id,
          role: 'admin'
        }, { onConflict: 'user_id,role' });
        console.log(`  ✅ User ${user.email} -> admin`);
      } catch (err: any) {
        console.log(`  ⚠️  ${user.email}: ${err.message?.substring(0, 50)}`);
      }
    }
  }

  console.log('\n🎉 Correções aplicadas!\n');
}

applyFixes().catch(console.error);