/**
 * Diagnóstico: por que get_user_permissions retorna 0?
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY2OTk1NiwiZXhwIjoyMTAxMjQ1OTU2fQ.EvEAzIgWT-xh-RpzaEw2XH24ZHQn2THFJ7XaRsvP9D0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function diagnose() {
  console.log('🔍 Diagnóstico de get_user_permissions...\n');

  // 1. Verifica user_roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', '6758071f-faa3-4c17-9e2d-b1f1ee492608');

  console.log('📋 user_roles:');
  console.log(JSON.stringify(userRoles, null, 2));

  // 2. Verifica role_permissions para admin
  const { data: adminPerms } = await supabase
    .from('role_permissions')
    .select('*, permissions(name)')
    .eq('role', 'admin')
    .limit(5);

  console.log(`\n📋 role_permissions (admin) - primeiros 5:`);
  console.log(JSON.stringify(adminPerms, null, 2));

  // 3. Total de permissões admin
  const { count: adminPermsCount } = await supabase
    .from('role_permissions')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin');

  console.log(`\n📊 Total de role_permissions para admin: ${adminPermsCount}`);

  // 4. Verifica função has_role
  const { data: hasRoleResult, error: hasRoleErr } = await supabase.rpc('has_role', {
    _user_id: '6758071f-faa3-4c17-9e2d-b1f1ee492608',
    _role: 'admin'
  });

  console.log(`\n🔧 has_role('admin') para o usuário:`, hasRoleResult, hasRoleErr?.message || '');

  // 5. Tenta get_user_permissions novamente
  const { data: rpcData } = await supabase.rpc('get_user_permissions', {
    _user_id: '6758071f-faa3-4c17-9e2d-b1f1ee492608'
  });
  console.log(`\n📊 get_user_permissions resultado: ${rpcData?.length} permissões`);
  console.log('Permissões:', rpcData?.map((p: any) => p.permission_name).slice(0, 10));

  // 6. Tenta com SQL manual
  console.log('\n🔧 Teste com SQL manual direto...');
  const { data: manualData, error: manualErr } = await supabase
    .from('user_roles')
    .select(`
      role,
      role_permissions!inner(
        permissions!inner(name, module, action)
      )
    `)
    .eq('user_id', '6758071f-faa3-4c17-9e2d-b1f1ee492608')
    .eq('is_active', true);

  console.log('Manual SQL:', JSON.stringify(manualData, null, 2).substring(0, 1000));
  console.log('Erro:', manualErr?.message || 'nenhum');
}

diagnose().catch(console.error);