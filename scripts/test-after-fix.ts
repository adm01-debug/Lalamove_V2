/**
 * Testa novamente após o fix
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY2OTk1NiwiZXhwIjoyMTAxMjQ1OTU2fQ.EvEAzIgWT-xh-RpzaEw2XH24ZHQn2THFJ7XaRsvP9D0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function testAfterFix() {
  console.log('🔍 Testando get_user_permissions APÓS fix...\n');

  const { data: perms, error } = await supabase.rpc('get_user_permissions', {
    _user_id: '6758071f-faa3-4c17-9e2d-b1f1ee492608'
  });

  if (error) {
    console.log('❌ Erro:', error.message);
    return;
  }

  console.log(`✅ ${perms?.length} permissões retornadas!`);

  const hasSecurityManage = perms?.some((p: any) => p.permission_name === 'security.manage');
  const hasUsersRoles = perms?.some((p: any) => p.permission_name === 'users.roles');
  const hasSecurityView = perms?.some((p: any) => p.permission_name === 'security.view');

  console.log(`${hasSecurityManage ? '✅' : '❌'} security.manage`);
  console.log(`${hasUsersRoles ? '✅' : '❌'} users.roles`);
  console.log(`${hasSecurityView ? '✅' : '❌'} security.view`);
}

testAfterFix().catch(console.error);