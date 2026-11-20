/**
 * Script para aplicar RLS via Supabase Pooler (PostgreSQL)
 * Execute via: npx tsx scripts/apply-rls-via-pg.ts
 */

import pg from 'pg';

const { Client } = pg;

// Configuração do Supabase (usando conexão direta ao banco)
const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const SUPABASE_DB_HOST = `db.${SUPABASE_PROJECT_REF}.supabase.co`;
const SUPABASE_DB_PORT = 5432;
const SUPABASE_DB_NAME = 'postgres';
const SUPABASE_DB_USER = `postgres.${SUPABASE_PROJECT_REF}`;
// O valor sempre foi o service_role JWT (nao uma senha de Postgres comum).
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_DB_PASSWORD) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar este script.');
  process.exit(1);
}
async function applyRLSPolicies() {
  console.log('🔌 Conectando ao pooler PostgreSQL do Supabase...');

  const client = new Client({
    host: SUPABASE_DB_HOST,
    port: SUPABASE_DB_PORT,
    database: SUPABASE_DB_NAME,
    user: SUPABASE_DB_USER,
    password: SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conexão estabelecida!\n');

    // SQL para aplicar políticas RLS permissivas
    const sqlStatements = [
      // DRIVERS
      `DROP POLICY IF EXISTS "Authenticated users can view drivers" ON public.drivers`,
      `DROP POLICY IF EXISTS "Authenticated users can insert drivers" ON public.drivers`,
      `DROP POLICY IF EXISTS "Authenticated users can update drivers" ON public.drivers`,
      `DROP POLICY IF EXISTS "Service role has full access to drivers" ON public.drivers`,
      `CREATE POLICY "Public can view drivers" ON public.drivers FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert drivers" ON public.drivers FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Public can update drivers" ON public.drivers FOR UPDATE TO anon USING (true)`,
      `CREATE POLICY "Service role full access drivers" ON public.drivers FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // LALAMOVE_ORDERS
      `DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.lalamove_orders`,
      `DROP POLICY IF EXISTS "Authenticated users can insert orders" ON public.lalamove_orders`,
      `DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.lalamove_orders`,
      `DROP POLICY IF EXISTS "Service role has full access to orders" ON public.lalamove_orders`,
      `CREATE POLICY "Public can view orders" ON public.lalamove_orders FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert orders" ON public.lalamove_orders FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Public can update orders" ON public.lalamove_orders FOR UPDATE TO anon USING (true)`,
      `CREATE POLICY "Service role full access orders" ON public.lalamove_orders FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // LALAMOVE_STOPS
      `DROP POLICY IF EXISTS "Authenticated users can view stops" ON public.lalamove_stops`,
      `DROP POLICY IF EXISTS "Authenticated users can insert stops" ON public.lalamove_stops`,
      `DROP POLICY IF EXISTS "Service role has full access to stops" ON public.lalamove_stops`,
      `CREATE POLICY "Public can view stops" ON public.lalamove_stops FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert stops" ON public.lalamove_stops FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Service role full access stops" ON public.lalamove_stops FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // LALAMOVE_STATUS_HISTORY
      `DROP POLICY IF EXISTS "Authenticated users can view status history" ON public.lalamove_status_history`,
      `DROP POLICY IF EXISTS "Authenticated users can insert status history" ON public.lalamove_status_history`,
      `DROP POLICY IF EXISTS "Service role has full access to status history" ON public.lalamove_status_history`,
      `CREATE POLICY "Public can view status history" ON public.lalamove_status_history FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert status history" ON public.lalamove_status_history FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Service role full access status history" ON public.lalamove_status_history FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // DRIVER_INCIDENTS
      `DROP POLICY IF EXISTS "Authenticated users can view incidents" ON public.driver_incidents`,
      `DROP POLICY IF EXISTS "Authenticated users can insert incidents" ON public.driver_incidents`,
      `DROP POLICY IF EXISTS "Service role has full access to incidents" ON public.driver_incidents`,
      `CREATE POLICY "Public can view incidents" ON public.driver_incidents FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert incidents" ON public.driver_incidents FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Service role full access incidents" ON public.driver_incidents FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // DRIVER_APPROVAL_QUEUE
      `DROP POLICY IF EXISTS "Authenticated users can manage approvals" ON public.driver_approval_queue`,
      `DROP POLICY IF EXISTS "Service role has full access to approvals" ON public.driver_approval_queue`,
      `CREATE POLICY "Public can view approvals" ON public.driver_approval_queue FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert approvals" ON public.driver_approval_queue FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Public can update approvals" ON public.driver_approval_queue FOR UPDATE TO anon USING (true)`,
      `CREATE POLICY "Service role full access approvals" ON public.driver_approval_queue FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // ACTIVE_TRACKING
      `DROP POLICY IF EXISTS "Authenticated users can view tracking" ON public.active_tracking`,
      `DROP POLICY IF EXISTS "Authenticated users can manage tracking" ON public.active_tracking`,
      `DROP POLICY IF EXISTS "Service role has full access to tracking" ON public.active_tracking`,
      `CREATE POLICY "Public can view tracking" ON public.active_tracking FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert tracking" ON public.active_tracking FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Public can update tracking" ON public.active_tracking FOR UPDATE TO anon USING (true)`,
      `CREATE POLICY "Public can delete tracking" ON public.active_tracking FOR DELETE TO anon USING (true)`,
      `CREATE POLICY "Service role full access tracking" ON public.active_tracking FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // TRACKING_EVENTS
      `DROP POLICY IF EXISTS "Authenticated users can view tracking events" ON public.tracking_events`,
      `DROP POLICY IF EXISTS "Authenticated users can insert tracking events" ON public.tracking_events`,
      `DROP POLICY IF EXISTS "Service role has full access to tracking events" ON public.tracking_events`,
      `CREATE POLICY "Public can view tracking events" ON public.tracking_events FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert tracking events" ON public.tracking_events FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Service role full access tracking events" ON public.tracking_events FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // ALERTS
      `DROP POLICY IF EXISTS "Authenticated users can view alerts" ON public.alerts`,
      `DROP POLICY IF EXISTS "Authenticated users can manage alerts" ON public.alerts`,
      `DROP POLICY IF EXISTS "Service role has full access to alerts" ON public.alerts`,
      `CREATE POLICY "Public can view alerts" ON public.alerts FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert alerts" ON public.alerts FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Public can update alerts" ON public.alerts FOR UPDATE TO anon USING (true)`,
      `CREATE POLICY "Public can delete alerts" ON public.alerts FOR DELETE TO anon USING (true)`,
      `CREATE POLICY "Service role full access alerts" ON public.alerts FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // ALERTS_SENT
      `DROP POLICY IF EXISTS "Authenticated users can view alerts sent" ON public.alerts_sent`,
      `DROP POLICY IF EXISTS "Authenticated users can manage alerts sent" ON public.alerts_sent`,
      `DROP POLICY IF EXISTS "Service role has full access to alerts sent" ON public.alerts_sent`,
      `CREATE POLICY "Public can view alerts sent" ON public.alerts_sent FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert alerts sent" ON public.alerts_sent FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Service role full access alerts sent" ON public.alerts_sent FOR ALL TO service_role USING (true) WITH CHECK (true)`,

      // ALERT_CONFIGURATIONS
      `DROP POLICY IF EXISTS "Authenticated users can view alert configs" ON public.alert_configurations`,
      `DROP POLICY IF EXISTS "Authenticated users can manage alert configs" ON public.alert_configurations`,
      `DROP POLICY IF EXISTS "Service role has full access to alert configs" ON public.alert_configurations`,
      `CREATE POLICY "Public can view alert configs" ON public.alert_configurations FOR SELECT TO anon USING (true)`,
      `CREATE POLICY "Public can insert alert configs" ON public.alert_configurations FOR INSERT TO anon WITH CHECK (true)`,
      `CREATE POLICY "Service role full access alert configs" ON public.alert_configurations FOR ALL TO service_role USING (true) WITH CHECK (true)`,
    ];

    console.log('📝 Aplicando políticas RLS...\n');

    for (const sql of sqlStatements) {
      try {
        await client.query(sql);
        console.log(`  ✅ ${sql.substring(0, 60)}...`);
      } catch (err: any) {
        if (err.code === '42704') {
          // Policy does not exist, skip
          continue;
        }
        console.log(`  ⚠️  ${err.message.substring(0, 80)}`);
      }
    }

    console.log('\n✅ Políticas RLS atualizadas com sucesso!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  } finally {
    await client.end();
  }
}

applyRLSPolicies();
