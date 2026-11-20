/**
 * Garante que um usuário específico tenha role admin no banco
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar este script.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function setUserAsAdmin(email: string) {
  console.log(`🔍 Buscando usuário: ${email}\n`);

  // 1. Buscar usuário pelo email
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.log('❌ Erro ao listar usuários:', listError.message);
    return;
  }

  const user = users?.users?.find(u => u.email === email);

  if (!user) {
    console.log(`❌ Usuário ${email} não encontrado!`);
    console.log('\nUsuários existentes:');
    users?.users?.forEach(u => console.log(`  - ${u.email} (${u.id})`));
    return;
  }

  console.log(`✅ Usuário encontrado: ${user.email}`);
  console.log(`   ID: ${user.id}\n`);

  // 2. Verificar role atual
  const { data: existingRole, error: roleError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError) {
    console.log('❌ Erro ao verificar role:', roleError.message);
    return;
  }

  if (existingRole) {
    console.log('✅ Usuário JÁ possui role admin!');
    return;
  }

  // 3. Inserir role admin
  console.log('➕ Adicionando role admin...');
  const { error: insertError } = await supabase
    .from('user_roles')
    .insert({
      user_id: user.id,
      role: 'admin' as any,
    });

  if (insertError) {
    console.log('❌ Erro ao inserir role:', insertError.message);
    return;
  }

  console.log(`✅ Role admin adicionada com sucesso para ${email}!`);
}

setUserAsAdmin('ti@promobrindes.com.br');