import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// verify_jwt=true valida a assinatura do token, mas nao diz quem chamou: qualquer
// conta autenticada conseguia disparar esta funcao, que usa service_role e derruba
// as policies vigentes para recriar tudo liberado para anon.
function getCaller(req: Request): { uid: string | null; isServiceRole: boolean } {
  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role === 'service_role') return { uid: null, isServiceRole: true };
    return { uid: payload.sub ?? null, isServiceRole: false };
  } catch {
    return { uid: null, isServiceRole: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // Contrato de entrada (formato único de erro 422 + versão v1/v2):
    // supabase/functions/_shared/contract.ts e _shared/schemas.ts.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("seed-fix-rls", contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);
    const contract = validateContract(
      getSchema("seed-fix-rls", contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceKey)

    const { uid, isServiceRole } = getCaller(req)
    if (!isServiceRole) {
      if (!uid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      // has_role() exige auth.uid() = _user_id, nulo com o client service_role;
      // consultamos user_roles direto (mesma condicao de has_role sem o auth.uid()).
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, is_active, expires_at')
        .eq('user_id', uid)
        .in('role', ['admin', 'manager'])
      if (rolesError) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const now = Date.now()
      const hasAccess = (roles ?? []).some((r) => r.is_active === true && (!r.expires_at || new Date(r.expires_at).getTime() > now))
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: 'Forbidden: requires admin or manager role' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // SQL para corrigir as políticas RLS
    const sql = `
      -- DRIVERS
      DROP POLICY IF EXISTS "Authenticated users can view drivers" ON public.drivers;
      DROP POLICY IF EXISTS "Authenticated users can insert drivers" ON public.drivers;
      DROP POLICY IF EXISTS "Authenticated users can update drivers" ON public.drivers;
      DROP POLICY IF EXISTS "Service role has full access to drivers" ON public.drivers;
      CREATE POLICY "Public can view drivers" ON public.drivers FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert drivers" ON public.drivers FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Public can update drivers" ON public.drivers FOR UPDATE TO authenticated USING (true);
      CREATE POLICY "Service role full access drivers" ON public.drivers FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- LALAMOVE_ORDERS
      DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.lalamove_orders;
      DROP POLICY IF EXISTS "Authenticated users can insert orders" ON public.lalamove_orders;
      DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.lalamove_orders;
      DROP POLICY IF EXISTS "Service role has full access to orders" ON public.lalamove_orders;
      CREATE POLICY "Public can view orders" ON public.lalamove_orders FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert orders" ON public.lalamove_orders FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Public can update orders" ON public.lalamove_orders FOR UPDATE TO authenticated USING (true);
      CREATE POLICY "Service role full access orders" ON public.lalamove_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- LALAMOVE_STOPS
      DROP POLICY IF EXISTS "Authenticated users can view stops" ON public.lalamove_stops;
      DROP POLICY IF EXISTS "Authenticated users can insert stops" ON public.lalamove_stops;
      DROP POLICY IF EXISTS "Service role has full access to stops" ON public.lalamove_stops;
      CREATE POLICY "Public can view stops" ON public.lalamove_stops FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert stops" ON public.lalamove_stops FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Service role full access stops" ON public.lalamove_stops FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- LALAMOVE_STATUS_HISTORY
      DROP POLICY IF EXISTS "Authenticated users can view status history" ON public.lalamove_status_history;
      DROP POLICY IF EXISTS "Authenticated users can insert status history" ON public.lalamove_status_history;
      DROP POLICY IF EXISTS "Service role has full access to status history" ON public.lalamove_status_history;
      CREATE POLICY "Public can view status history" ON public.lalamove_status_history FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert status history" ON public.lalamove_status_history FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Service role full access status history" ON public.lalamove_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- DRIVER_INCIDENTS
      DROP POLICY IF EXISTS "Authenticated users can view incidents" ON public.driver_incidents;
      DROP POLICY IF EXISTS "Authenticated users can insert incidents" ON public.driver_incidents;
      DROP POLICY IF EXISTS "Service role has full access to incidents" ON public.driver_incidents;
      CREATE POLICY "Public can view incidents" ON public.driver_incidents FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert incidents" ON public.driver_incidents FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Service role full access incidents" ON public.driver_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- DRIVER_APPROVAL_QUEUE
      DROP POLICY IF EXISTS "Authenticated users can manage approvals" ON public.driver_approval_queue;
      DROP POLICY IF EXISTS "Service role has full access to approvals" ON public.driver_approval_queue;
      CREATE POLICY "Public can view approvals" ON public.driver_approval_queue FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert approvals" ON public.driver_approval_queue FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Public can update approvals" ON public.driver_approval_queue FOR UPDATE TO authenticated USING (true);
      CREATE POLICY "Service role full access approvals" ON public.driver_approval_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- ACTIVE_TRACKING
      DROP POLICY IF EXISTS "Authenticated users can view tracking" ON public.active_tracking;
      DROP POLICY IF EXISTS "Authenticated users can manage tracking" ON public.active_tracking;
      DROP POLICY IF EXISTS "Service role has full access to tracking" ON public.active_tracking;
      CREATE POLICY "Public can view tracking" ON public.active_tracking FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert tracking" ON public.active_tracking FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Public can update tracking" ON public.active_tracking FOR UPDATE TO authenticated USING (true);
      CREATE POLICY "Public can delete tracking" ON public.active_tracking FOR DELETE TO authenticated USING (true);
      CREATE POLICY "Service role full access tracking" ON public.active_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- TRACKING_EVENTS
      DROP POLICY IF EXISTS "Authenticated users can view tracking events" ON public.tracking_events;
      DROP POLICY IF EXISTS "Authenticated users can insert tracking events" ON public.tracking_events;
      DROP POLICY IF EXISTS "Service role has full access to tracking events" ON public.tracking_events;
      CREATE POLICY "Public can view tracking events" ON public.tracking_events FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert tracking events" ON public.tracking_events FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Service role full access tracking events" ON public.tracking_events FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- ALERTS
      DROP POLICY IF EXISTS "Authenticated users can view alerts" ON public.alerts;
      DROP POLICY IF EXISTS "Authenticated users can manage alerts" ON public.alerts;
      DROP POLICY IF EXISTS "Service role has full access to alerts" ON public.alerts;
      CREATE POLICY "Public can view alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Public can update alerts" ON public.alerts FOR UPDATE TO authenticated USING (true);
      CREATE POLICY "Public can delete alerts" ON public.alerts FOR DELETE TO authenticated USING (true);
      CREATE POLICY "Service role full access alerts" ON public.alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- ALERTS_SENT
      DROP POLICY IF EXISTS "Authenticated users can view alerts sent" ON public.alerts_sent;
      DROP POLICY IF EXISTS "Authenticated users can manage alerts sent" ON public.alerts_sent;
      DROP POLICY IF EXISTS "Service role has full access to alerts sent" ON public.alerts_sent;
      CREATE POLICY "Public can view alerts sent" ON public.alerts_sent FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert alerts sent" ON public.alerts_sent FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Service role full access alerts sent" ON public.alerts_sent FOR ALL TO service_role USING (true) WITH CHECK (true);

      -- ALERT_CONFIGURATIONS
      DROP POLICY IF EXISTS "Authenticated users can view alert configs" ON public.alert_configurations;
      DROP POLICY IF EXISTS "Authenticated users can manage alert configs" ON public.alert_configurations;
      DROP POLICY IF EXISTS "Service role has full access to alert configs" ON public.alert_configurations;
      CREATE POLICY "Public can view alert configs" ON public.alert_configurations FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Public can insert alert configs" ON public.alert_configurations FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Service role full access alert configs" ON public.alert_configurations FOR ALL TO service_role USING (true) WITH CHECK (true);
    `

    // Executar SQL via rpc (precisamos criar uma função primeiro)
    // Usando postgresql connection direta
    const { data, error } = await supabase.rpc('exec', { sql_text: sql }).throwOnError()

    return new Response(
      JSON.stringify({ success: true, message: 'RLS policies updated' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
