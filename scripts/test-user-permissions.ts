/**
 * Testa a função get_user_permissions
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2Njk5NTYsImV4cCI6MjEwMTI0NTk1Nn0.Us06xRWbkFNb7js95Zhvw5ADAphGDFI-9dN8vXX_8HQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login
async function testPermissions() {
  console.log('🔑 Fazendo login como ti@promobrindes.com.br...\n');

  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ti@promobrindes.com.br',
    password: 'prompt-ti-2026', // senha padrão do seed
  });

  if (authError) {
    console.log('❌ Erro de login:', authError.message);
    console.log('\nTentando verificar permissões diretamente via service role...\n');

    // Fallback: usar service role key
    const { createClient: createClient2 } = await import('@supabase/supabase-js');
    const adminSupabase = createClient2(
      SUPABASE_URL,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2d5ZG9uY3RtYWJpaWphZHNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTY2OTk1NiwiZXhwIjoyMTAxMjQ1OTU2fQ.EvEAzIgWT-xh-RpzaEw2XH24ZHQn2THFJ7XaRsvP9D0',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: rpcData, error: rpcError } = await adminSupabase
      .rpc('get_user_permissions', { _user_id: '6758071f-faa3-4c17-9e2d-b1f1ee492608' });

    if (rpcError) {
      console.log('❌ Erro RPC:', rpcError.message);
    } else {
      console.log(`✅ RPC retornou ${rpcData?.length} permissões`);
      console.log('Primeiras 5:', rpcData?.slice(0, 5).map((p: any) => p.permission_name));
    }
    return;
  }

  console.log('✅ Login realizado');
  console.log(`   User ID: ${auth.user?.id}\n`);

  // Testar a função get_user_permissions
  console.log('🔍 Testando função get_user_permissions...');
  const { data: perms, error: permsError } = await supabase.rpc('get_user_permissions', {
    _user_id: auth.user!.id,
  });

  if (permsError) {
    console.log('❌ Erro:', permsError.message);
  } else {
    console.log(`✅ ${perms?.length} permissões retornadas:`);
    perms?.slice(0, 10).forEach((p: any) => console.log(`   - ${p.permission_name}`));
    if (perms?.length > 10) console.log(`   ... e mais ${perms.length - 10}`);

    const hasSecurityManage = perms?.some((p: any) => p.permission_name === 'security.manage');
    console.log(`\n${hasSecurityManage ? '✅' : '❌'} Tem permissão 'security.manage': ${hasSecurityManage}`);

    const hasUsersRoles = perms?.some((p: any) => p.permission_name === 'users.roles');
    console.log(`${hasUsersRoles ? '✅' : '❌'} Tem permissão 'users.roles': ${hasUsersRoles}`);
  }
}

testPermissions().catch(console.error);