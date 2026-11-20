/**
 * Script para popular a tabela de Contatos com dados fictícios
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

// Nomes brasileiros
const FIRST_NAMES = ['João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Fernanda', 'Lucas', 'Juliana', 'Rafael', 'Camila', 'Bruno', 'Beatriz', 'André', 'Larissa', 'Felipe', 'Carolina', 'Marcos', 'Patrícia', 'Rodrigo', 'Amanda', 'Diego', 'Tatiana', 'Gustavo', 'Renata', 'Lucas', 'Mariana', 'Felipe', 'Camila', 'Rafael', 'Bruna', 'Eduardo', 'Fernanda', 'Marcelo', 'Patricia'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira', 'Rodrigues', 'Almeida', 'Nascimento', 'Araújo', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Moraes', 'Barbosa', 'Melo', 'Cardoso', 'Cruz', 'Machado', 'Moreira'];

const ADDRESSES = [
  'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  'Rua Augusta, 1500 - Consolação, São Paulo - SP',
  'Av. Faria Lima, 2000 - Itaim Bibi, São Paulo - SP',
  'Av. Rebouças, 2500 - Pinheiros, São Paulo - SP',
  'Av. Paulista, 2000 - Cerqueira César, São Paulo - SP',
  'Rua Oscar Freire, 500 - Jardins, São Paulo - SP',
  'Av. Brasil, 3000 - Jardim América, São Paulo - SP',
  'Av. 9 de Julho, 4000 - Jardim Europa, São Paulo - SP',
  'Rua Haddock Lobo, 800 - Cerqueira César, São Paulo - SP',
  'Av. Wesceslau Brás, 100 - Butantã, São Paulo - SP',
  'Av. Dr. Chucri Zaidan, 200 - Vila São Luís, São Paulo - SP',
  'Av. Giovanni Gronchi, 500 - Morumbi, São Paulo - SP',
  'Rua dos Pinheiros, 1000 - Pinheiros, São Paulo - SP',
  'Av. Brigadeiro Faria Lima, 3500 - Itaim Bibi, São Paulo - SP',
  'Av. Engenheiro Luís Carlos Berrini, 200 - Brooklin, São Paulo - SP',
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  const ddds = ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68', '69', '71', '72', '73', '74', '75', '76', '77', '78', '79', '81', '82', '83', '84', '85', '86', '87', '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99'];
  const ddd = randomElement(ddds);
  const first = randomInt(90000, 99999);
  const second = randomInt(1000, 9999);
  return `+55${ddd}${first}${second}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function randomDate(daysBack: number = 60): string {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past)).toISOString();
}

async function getUserId(): Promise<string | null> {
  // Listar usuários para pegar o ID do owner
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.log('Erro ao listar usuários:', error.message);
    return null;
  }
  return data?.users?.[0]?.id ?? null;
}

async function seedContacts() {
  console.log('👥 Populando tabela de contatos...\n');

  // Pegar usuário autenticado (owner_id)
  const { data: userData } = await supabase.auth.getUser();
  let ownerId = userData?.user?.id;

  // Se não tiver usuário autenticado, pegar o primeiro da lista via API admin
  if (!ownerId) {
    console.log('⚠️  Sem usuário autenticado. Buscando via admin API...');
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error || !data?.users?.[0]) {
      console.log('❌ Não foi possível obter usuário. Tentando criar contatos com owner_id de exemplo...');
      ownerId = '00000000-0000-0000-0000-000000000000';
    } else {
      ownerId = data.users[0].id;
    }
  }

  console.log(`Owner ID: ${ownerId}\n`);

  const contacts = [];
  const kinds: ('sender' | 'recipient' | 'both')[] = ['sender', 'recipient', 'both'];

  for (let i = 0; i < 30; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;

    contacts.push({
      id: generateUUID(),
      owner_id: ownerId,
      name: fullName,
      phone_e164: generatePhone(),
      address: randomElement(ADDRESSES),
      kind: randomElement(kinds),
      usage_count: randomInt(1, 20),
      last_used_at: randomDate(30),
    });
  }

  // Limpar contatos existentes do owner (se houver)
  await supabase.from('contacts').delete().eq('owner_id', ownerId);

  const { data, error } = await supabase.from('contacts').insert(contacts).select();

  if (error) {
    console.log(`❌ Erro ao criar contatos: ${error.message}`);
    return;
  }

  console.log(`✅ ${data?.length || 0} contatos criados com sucesso!\n`);
  console.log('📋 Resumo dos contatos:');
  data?.slice(0, 5).forEach((c: any) => {
    console.log(`  - ${c.name} (${c.phone_e164}) - ${c.kind} - usado ${c.usage_count}x`);
  });
  console.log(`  ... e mais ${(data?.length || 0) - 5} contatos`);
}

seedContacts().catch(console.error);