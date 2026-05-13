-- 1. Add missing tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.lalamove_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_tracking;

-- 2. Add viewer role SELECT policies to key tables

CREATE POLICY "Viewers can view orders"
ON public.lalamove_orders
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view alerts"
ON public.alerts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view driver evaluations"
ON public.driver_evaluations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view approval queue"
ON public.driver_approval_queue
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view tracking"
ON public.active_tracking
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view status history"
ON public.lalamove_status_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view risk rules"
ON public.risk_rules
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view webhook events"
ON public.webhook_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view incidents"
ON public.driver_incidents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Viewers can view alert configs"
ON public.alert_configurations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));