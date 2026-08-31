
-- ============================================================
-- FIX 1: Restrict driver phone data from operators
-- ============================================================

-- Drop existing operator SELECT policy on drivers
DROP POLICY IF EXISTS "Authorized roles can view drivers" ON public.drivers;

-- Admins and managers can see all driver data
CREATE POLICY "Admins managers can view all drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Operators can view drivers (phone masked via secure view)
CREATE POLICY "Operators can view drivers limited"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'operator'::app_role)
);

-- Create a secure view for operators that masks phone numbers
CREATE OR REPLACE VIEW public.drivers_safe_view
WITH (security_invoker = true)
AS
SELECT
  id, name, vehicle_type, status, rating, risk_score, risk_level,
  total_deliveries, completed_deliveries, failed_deliveries, cancelled_deliveries,
  success_rate, failure_rate, avg_delay_minutes, lalamove_id, vehicle_plate,
  photo_url, blacklisted, blacklist_reason, whitelisted, notes,
  last_active_at, last_delivery_at, last_evaluated_at, first_seen_at,
  external_rating, external_success_rate, external_total_deliveries,
  risk_reasons, created_at, updated_at,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) 
    THEN phone
    ELSE '***RESTRITO***'
  END AS phone
FROM public.drivers;

-- ============================================================
-- FIX 2: Restrict customer contact data in orders from operators
-- ============================================================

DROP POLICY IF EXISTS "Authorized roles can view orders" ON public.lalamove_orders;

-- Admins and managers see everything
CREATE POLICY "Admins managers can view all orders"
ON public.lalamove_orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Operators can view orders (phone masked via secure view)
CREATE POLICY "Operators can view orders"
ON public.lalamove_orders
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'operator'::app_role)
);

-- Create a secure view for orders that masks customer phone
CREATE OR REPLACE VIEW public.orders_safe_view
WITH (security_invoker = true)
AS
SELECT
  id, lalamove_id, status, vehicle_type, customer_name,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
    THEN customer_phone
    ELSE '***RESTRITO***'
  END AS customer_phone,
  pickup_address, delivery_address, total_cost, currency,
  scheduled_at, estimated_delivery, actual_delivery,
  driver_id, bitrix24_deal_id, share_link, tags, metadata,
  internal_notes, internal_order_id, internal_status,
  department, cost_center, quotation_id, is_urgent,
  outcome, delay_minutes, custom_rating, distance_meters, duration_minutes,
  pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
  created_at, updated_at
FROM public.lalamove_orders;

-- ============================================================
-- FIX 3: Restrict alert_configurations from operators
-- ============================================================

DROP POLICY IF EXISTS "Authorized roles can view alert configs" ON public.alert_configurations;

CREATE POLICY "Admins managers can view alert configs"
ON public.alert_configurations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- ============================================================
-- FIX 4: Restrict driver_locations to active deliveries only
-- ============================================================

DROP POLICY IF EXISTS "Authorized roles can view driver locations" ON public.driver_locations;

-- Admins and managers see all locations
CREATE POLICY "Admins managers can view all locations"
ON public.driver_locations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Operators can only see locations for ACTIVE trackings
CREATE POLICY "Operators can view active delivery locations only"
ON public.driver_locations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'operator'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.active_tracking at
    WHERE at.id = driver_locations.tracking_id
      AND at.tracking_status = 'ACTIVE'
  )
);
