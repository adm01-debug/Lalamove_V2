
-- 1. Fix password_reset_requests: Remove the overly permissive INSERT policy (WITH CHECK true)
-- and keep only the authenticated one
DROP POLICY IF EXISTS "Anyone can request password reset" ON public.password_reset_requests;

-- 2. Fix login_attempts: The INSERT policy allows NULL auth.uid() which is needed for 
-- unauthenticated login attempts, but we should ensure it uses security definer functions
-- instead of direct table access. Already uses RPC functions, so this is OK.

-- 3. Create a secure view for operators that hides sensitive customer data
CREATE OR REPLACE VIEW public.orders_operator_view
WITH (security_invoker = true)
AS
SELECT
  id,
  lalamove_id,
  status,
  pickup_address,
  delivery_address,
  -- Mask customer phone: show only last 4 digits
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
    THEN customer_phone
    ELSE CASE 
      WHEN customer_phone IS NOT NULL 
      THEN '****' || RIGHT(customer_phone, 4)
      ELSE NULL
    END
  END AS customer_phone,
  -- Mask customer name for operators: show only first name
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
    THEN customer_name
    ELSE SPLIT_PART(customer_name, ' ', 1) || ' ***'
  END AS customer_name,
  vehicle_type,
  total_cost,
  currency,
  scheduled_at,
  estimated_delivery,
  actual_delivery,
  driver_id,
  is_urgent,
  outcome,
  delay_minutes,
  duration_minutes,
  distance_meters,
  tags,
  department,
  cost_center,
  internal_status,
  internal_order_id,
  share_link,
  internal_notes,
  custom_rating,
  quotation_id,
  pickup_latitude,
  pickup_longitude,
  delivery_latitude,
  delivery_longitude,
  metadata,
  bitrix24_deal_id,
  created_at,
  updated_at
FROM public.lalamove_orders;

-- 4. Sanitize auth_logs metadata on insert to strip sensitive fields
CREATE OR REPLACE FUNCTION public.sanitize_auth_log_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Remove potentially sensitive fields from metadata
  IF NEW.metadata IS NOT NULL THEN
    NEW.metadata = NEW.metadata - 'password' - 'secret' - 'token' - 'api_key' - 'security_answer' - 'otp_code';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sanitize_auth_log_metadata_trigger
  BEFORE INSERT ON public.auth_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_auth_log_metadata();
