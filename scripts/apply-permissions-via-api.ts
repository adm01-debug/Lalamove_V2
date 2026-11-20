/**
 * Aplica SQL via Supabase Management API
 */

const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.');
  process.exit(1);
}
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.');
  process.exit(1);
}
import * as fs from 'fs';

async function applySQL() {
  console.log('🚀 Aplicando SQL de permissões via Management API...\n');

  const sql = fs.readFileSync(
    'supabase/migrations/20260828000003_populate_permissions.sql',
    'utf-8'
  );

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        query: sql,
        read_only: false,
      }),
    }
  );

  const result = await response.text();
  console.log('Status:', response.status);
  console.log('Resposta:', result);
}

applySQL().catch(console.error);