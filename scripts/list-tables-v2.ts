/**
 * Lista tabelas usando fetch direto à API REST
 */

const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar este script.');
  process.exit(1);
}
async function listTables() {
  console.log('🔍 Tentando listar tabelas via API...\n');

  // Tentar pg_tables via information_schema
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  // Como não temos exec_sql, vamos tentar a tabela postgres se existir
  // Ou tentar uma tabela comum para ver o schema
  const tablesToTry = [
    'drivers', 'lalamove_orders', 'user_roles', 'alerts',
    'tracking_events', 'active_tracking', 'driver_incidents',
    'lalamove_stops', 'lalamove_status_history',
    'driver_approval_queue', 'alert_configurations', 'alerts_sent'
  ];

  console.log('Tabelas que existem (testadas):');
  for (const table of tablesToTry) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=0`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        }
      });
      if (response.ok) {
        console.log(`  ✅ ${table}`);
      } else {
        const text = await response.text();
        if (!text.includes('does not exist') && !text.includes('42P01')) {
          console.log(`  ⚠️ ${table}: ${response.status}`);
        }
      }
    } catch (e) {
      // skip
    }
  }
}

listTables();