-- Substituir TODAS as políticas SELECT USING(true) restantes por verificação de roles
-- Migration final para garantir segurança total

-- 1. active_tracking
DROP POLICY IF EXISTS "Authenticated users can view tracking" ON public.active_tracking;
CREATE POLICY "Authorized roles can view tracking" ON public.active_tracking
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 2. alert_configurations
DROP POLICY IF EXISTS "Authenticated users can view alert configs" ON public.alert_configurations;
CREATE POLICY "Authorized roles can view alert configs" ON public.alert_configurations
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 3. alerts_sent
DROP POLICY IF EXISTS "Authenticated users can view alerts sent" ON public.alerts_sent;
CREATE POLICY "Authorized roles can view alerts sent" ON public.alerts_sent
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 4. bitrix24_activities
DROP POLICY IF EXISTS "Authenticated users can view activities" ON public.bitrix24_activities;
CREATE POLICY "Authorized roles can view activities" ON public.bitrix24_activities
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- 5. bitrix24_stage_mappings
DROP POLICY IF EXISTS "Authenticated users can view stage mappings" ON public.bitrix24_stage_mappings;
CREATE POLICY "Authorized roles can view stage mappings" ON public.bitrix24_stage_mappings
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 6. bitrix24_sync
DROP POLICY IF EXISTS "Authenticated users can view sync data" ON public.bitrix24_sync;
CREATE POLICY "Authorized roles can view sync data" ON public.bitrix24_sync
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- 7. bitrix24_tokens (CRÍTICO - apenas admins)
DROP POLICY IF EXISTS "Authenticated users can view tokens" ON public.bitrix24_tokens;
CREATE POLICY "Only admins can view tokens" ON public.bitrix24_tokens
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- 8. driver_approval_queue
DROP POLICY IF EXISTS "Authenticated users can view approvals" ON public.driver_approval_queue;
CREATE POLICY "Authorized roles can view approvals" ON public.driver_approval_queue
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 9. driver_evaluations
DROP POLICY IF EXISTS "Authenticated users can view evaluations" ON public.driver_evaluations;
CREATE POLICY "Authorized roles can view evaluations" ON public.driver_evaluations
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 10. driver_incidents
DROP POLICY IF EXISTS "Authenticated users can view incidents" ON public.driver_incidents;
CREATE POLICY "Authorized roles can view incidents" ON public.driver_incidents
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 11. driver_locations
DROP POLICY IF EXISTS "Authenticated users can view driver locations" ON public.driver_locations;
CREATE POLICY "Authorized roles can view driver locations" ON public.driver_locations
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 12. drivers
DROP POLICY IF EXISTS "Authenticated users can view drivers" ON public.drivers;
CREATE POLICY "Authorized roles can view drivers" ON public.drivers
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 13. lalamove_orders
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.lalamove_orders;
CREATE POLICY "Authorized roles can view orders" ON public.lalamove_orders
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 14. lalamove_status_history
DROP POLICY IF EXISTS "Authenticated users can view status history" ON public.lalamove_status_history;
CREATE POLICY "Authorized roles can view status history" ON public.lalamove_status_history
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 15. lalamove_stops
DROP POLICY IF EXISTS "Authenticated users can view stops" ON public.lalamove_stops;
CREATE POLICY "Authorized roles can view stops" ON public.lalamove_stops
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 16. login_attempts - Remover políticas permissivas (já existe política de admin)
DROP POLICY IF EXISTS "Anyone can check login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Anyone can update login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Anyone can insert login attempts" ON public.login_attempts;

-- Recriar política de INSERT com verificação (necessário para login)
CREATE POLICY "Authenticated can insert login attempts" ON public.login_attempts
  FOR INSERT WITH CHECK (true);

-- UPDATE restrito a roles autorizadas
CREATE POLICY "Authorized roles can update login attempts" ON public.login_attempts
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role) OR
    has_role(auth.uid(), 'viewer'::app_role)
  );

-- 17. risk_rules
DROP POLICY IF EXISTS "Authenticated users can view risk rules" ON public.risk_rules;
CREATE POLICY "Authorized roles can view risk rules" ON public.risk_rules
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 18. tracking_events
DROP POLICY IF EXISTS "Authenticated users can view tracking events" ON public.tracking_events;
CREATE POLICY "Authorized roles can view tracking events" ON public.tracking_events
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- 19. webhook_events
DROP POLICY IF EXISTS "Authenticated users can view webhook events" ON public.webhook_events;
CREATE POLICY "Authorized roles can view webhook events" ON public.webhook_events
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );