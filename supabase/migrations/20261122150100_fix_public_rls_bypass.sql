-- Remove as policies "Public can *" (TO anon) criadas por
-- 20260828000001_seed_fix_rls.sql para seed de dados fictícios, que nunca
-- foram revertidas e ficaram ativas em produção.
--
-- Essa migration dropou policies por NOME, mas usou nomes antigos que já
-- tinham sido renomeados por migrations anteriores (20260108144121,
-- 20260108144200, 20260306010037, 20260315222201, 20260516114956) — então
-- as policies restritas por role (has_role) nunca foram removidas, só
-- passaram a coexistir com a pública. Policies RLS permissivas são
-- combinadas com OR: a pública (TO anon, sem restrição) bypassa
-- completamente a restrita. Resultado: qualquer requisição sem login podia
-- ler e escrever PII de cliente/motorista, GPS ao vivo, fila de aprovação
-- de motorista, e inserir/editar/apagar alertas — achado numa auditoria
-- completa do arquivo, motivada pelo mesmo bug já corrigido em
-- alert_configurations (ver 20261122150000_fix_alert_configs_anon_insert.sql).
--
-- Cada tabela mantém, sem nenhuma mudança: a policy "FOR SELECT TO
-- authenticated" de 20251224143803 (nunca removida — usuários logados
-- continuam lendo), as policies restritas por has_role para escrita, e a
-- policy de service_role (ALL). Só a policy pública (anon) é removida.

-- DRIVERS
DROP POLICY IF EXISTS "Public can view drivers" ON public.drivers;
DROP POLICY IF EXISTS "Public can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Public can update drivers" ON public.drivers;

-- LALAMOVE_ORDERS
DROP POLICY IF EXISTS "Public can view orders" ON public.lalamove_orders;
DROP POLICY IF EXISTS "Public can insert orders" ON public.lalamove_orders;
DROP POLICY IF EXISTS "Public can update orders" ON public.lalamove_orders;

-- LALAMOVE_STOPS
DROP POLICY IF EXISTS "Public can view stops" ON public.lalamove_stops;
DROP POLICY IF EXISTS "Public can insert stops" ON public.lalamove_stops;

-- LALAMOVE_STATUS_HISTORY
DROP POLICY IF EXISTS "Public can view status history" ON public.lalamove_status_history;
DROP POLICY IF EXISTS "Public can insert status history" ON public.lalamove_status_history;

-- DRIVER_INCIDENTS
DROP POLICY IF EXISTS "Public can view incidents" ON public.driver_incidents;
DROP POLICY IF EXISTS "Public can insert incidents" ON public.driver_incidents;

-- DRIVER_APPROVAL_QUEUE
DROP POLICY IF EXISTS "Public can view approvals" ON public.driver_approval_queue;
DROP POLICY IF EXISTS "Public can insert approvals" ON public.driver_approval_queue;
DROP POLICY IF EXISTS "Public can update approvals" ON public.driver_approval_queue;

-- ACTIVE_TRACKING
-- É o vetor confirmado do achado "simulação do mapa dispara aviso real a
-- fornecedor": sem login, dava para INSERT/UPDATE/DELETE em rastreamento real.
DROP POLICY IF EXISTS "Public can view tracking" ON public.active_tracking;
DROP POLICY IF EXISTS "Public can insert tracking" ON public.active_tracking;
DROP POLICY IF EXISTS "Public can update tracking" ON public.active_tracking;
DROP POLICY IF EXISTS "Public can delete tracking" ON public.active_tracking;

-- TRACKING_EVENTS
DROP POLICY IF EXISTS "Public can view tracking events" ON public.tracking_events;
DROP POLICY IF EXISTS "Public can insert tracking events" ON public.tracking_events;

-- ALERTS
DROP POLICY IF EXISTS "Public can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Public can insert alerts" ON public.alerts;
DROP POLICY IF EXISTS "Public can update alerts" ON public.alerts;
DROP POLICY IF EXISTS "Public can delete alerts" ON public.alerts;

-- ALERTS_SENT
DROP POLICY IF EXISTS "Public can view alerts sent" ON public.alerts_sent;
DROP POLICY IF EXISTS "Public can insert alerts sent" ON public.alerts_sent;
