/**
 * Garante que usuário tem role admin com is_active=true
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY2OTk1NiwiZXhwIjoyMTAxMjQ1OTU2fQ.EvEAzIgWT-xh-RpzaEw2XH24ZHQn2THFJ7XaRsvP9D0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function fixAdminRole() {
  console.log('🔧 Garantindo role admin com is_active=true...\n');

  // 1. Verificar se o role existe com is_active=false
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('*');

  if (error) {
    console.log('❌ Erro:', error.message);
    return;
  }

  console.log(`📊 Total de user_roles: ${roles?.length}\n`);

  // 2. Garantir que o usuário ti@promobrindes.com.br tem role admin ativa
  const { data: users } = await supabase.auth.admin.listUsers();
  const targetUser = users?.users?.find(u => u.email === 'ti@promobrindes.com.br');

  if (!targetUser) {
    console.log('❌ Usuário não encontrado');
    return;
  }

  // 3. Update ou Insert com is_active=true
  const { error: upsertError } = await supabase
    .from('user_roles')
    .upsert({
      user_id: targetUser.id,
      role: 'admin' as any,
      is_active: true,
    }, { onConflict: 'user_id,role' });

  if (upsertError) {
    console.log('❌ Erro ao atualizar:', upsertError.message);
    return;
  }

  // 4. Verificar
  const { data: final } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', targetUser.id)
    .eq('role', 'admin');

  console.log('✅ Role do usuário ti@promobrindes.com.br:');
  console.log(JSON.stringify(final, null, 2));
}

fixAdminRole().catch(console.error);