/**
 * Aplica SQL via Supabase Management API (com DO block para tabelas opcionais)
 */

const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.');
  process.exit(1);
}
const sql = `
-- Garantir todas as políticas permissivas (apenas nas tabelas que existem)
DO $$
DECLARE tname TEXT;
  tables_to_check TEXT[] := ARRAY[
    'notification_history','notification_preferences','cron_jobs','webhook_events',
    'risk_rules','system_logs','audit_log','job_queue','auth_logs',
    'feature_flags','saved_views','user_preferences','dashboard_widgets',
    'lalamove_orders','drivers','alerts','tracking_events','active_tracking',
    'driver_incidents','lalamove_stops','lalamove_status_history',
    'driver_approval_queue','alert_configurations','alerts_sent'
  ];
BEGIN
  FOREACH tname IN ARRAY tables_to_check LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_name = tname) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access %I" ON public.%I', tname, tname);
      EXECUTE format('CREATE POLICY "Authenticated full access %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tname, tname);
    END IF;
  END LOOP;
END $$;

-- Conceder permissões GRANT amplas
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
`;

async function applySQL() {
  console.log('🚀 Aplicando SQL via Management API...\n');

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
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