/**
 * Lista as tabelas existentes no schema public do Supabase
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

async function listTables() {
  console.log('🔍 Listando tabelas do schema public...\n');

  // Query para listar tabelas
  const { data, error } = await supabase.rpc('exec_sql' as any, {
    sql: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
  } as any).throwOnError();

  if (error) {
    // Tentar via information_schema
    const { data: tables, error: err2 } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(100) as any;

    if (err2) {
      console.log('❌ Erro:', err2.message);
      console.log('\nTentando via query raw...\n');

      // Tentar via fetch direto
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        }
      });
      const text = await response.text();
      console.log(text.substring(0, 2000));
    } else {
      console.log('Tabelas encontradas:');
      tables?.forEach((t: any) => console.log(`  - ${t.table_name}`));
    }
  } else {
    console.log('Tabelas:');
    data?.forEach((t: any) => console.log(`  - ${t.tablename}`));
  }
}

listTables().catch(console.error);