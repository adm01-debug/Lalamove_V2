/**
 * Aplica permissão security.manage via SQL
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY2OTk1NiwiZXhwIjoyMTAxMjQ1OTU2fQ.EvEAzIgWT-xh-RpzaEw2XH24ZHQn2THFJ7XaRsvP9D0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function checkPermissions() {
  console.log('🔍 Verificando permissões cadastradas...\n');

  // Listar todas as permissões
  const { data: perms, error } = await supabase
    .from('permissions')
    .select('*')
    .order('module');

  if (error) {
    console.log('❌ Erro:', error.message);
    return;
  }

  console.log(`📋 ${perms?.length} permissões cadastradas:`);
  perms?.forEach(p => console.log(`  - ${p.name} (${p.module}.${p.action})`));

  // Verificar se security.manage existe
  const hasSecurityManage = perms?.some(p => p.name === 'security.manage');
  console.log(`\n${hasSecurityManage ? '✅' : '❌'} 'security.manage' ${hasSecurityManage ? 'existe' : 'NÃO existe'}`);

  // Verificar role_permissions para admin
  const { data: rp, error: rpErr } = await supabase
    .from('role_permissions')
    .select('role, permission_id, permissions(name)')
    .eq('role', 'admin');

  if (rpErr) {
    console.log('\n❌ Erro ao listar role_permissions:', rpErr.message);
    return;
  }

  console.log(`\n📋 ${rp?.length} permissões no role 'admin':`);
  rp?.slice(0, 5).forEach(p => console.log(`  - ${(p.permissions as any)?.name}`));
  if (rp && rp.length > 5) console.log(`  ... e mais ${rp.length - 5}`);

  // Verificar role do usuário
  const { data: users } = await supabase.auth.admin.listUsers();
  const targetUser = users?.users?.find(u => u.email === 'ti@promobrindes.com.br');

  if (!targetUser) {
    console.log('\n❌ Usuário não encontrado');
    return;
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', targetUser.id)
    .eq('role', 'admin');

  console.log(`\n👤 User role do ti@promobrindes.com.br:`);
  console.log(JSON.stringify(userRole, null, 2));
}

checkPermissions().catch(console.error);