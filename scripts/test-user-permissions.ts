/**
 * Testa a função get_user_permissions
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
// Historicamente chamada de ANON_KEY, mas o valor sempre foi o service_role (bypassa RLS) - nome mantido para nao alterar os usos abaixo.
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_ANON_KEY) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar este script.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login
async function testPermissions() {
  console.log('🔑 Fazendo login como ti@promobrindes.com.br...\n');

  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ti@promobrindes.com.br',
    password: process.env.SEED_TI_PASSWORD || (() => { console.error('Defina SEED_TI_PASSWORD no ambiente antes de rodar este script.'); process.exit(1); })(), // senha do usuario de seed, nunca hardcoded
  });

  if (authError) {
    console.log('❌ Erro de login:', authError.message);
    console.log('\nTentando verificar permissões diretamente via service role...\n');

    // Fallback: usar service role key
    const { createClient: createClient2 } = await import('@supabase/supabase-js');
    const adminSupabase = createClient2(
      SUPABASE_URL,
      SUPABASE_ANON_KEY, // reaproveita a mesma env var acima (ver comentario na declaracao)
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