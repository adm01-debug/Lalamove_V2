
-- Fix orders_operator_view to use security_invoker
DROP VIEW IF EXISTS public.orders_operator_view;

CREATE VIEW public.orders_operator_view
WITH (security_invoker = true)
AS
SELECT
  id, lalamove_id, status, pickup_address, delivery_address,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
    THEN customer_phone
    ELSE '***RESTRITO***'
  END AS customer_phone,
  customer_name, vehicle_type, total_cost, currency,
  scheduled_at, estimated_delivery, actual_delivery,
  driver_id, is_urgent, outcome, delay_minutes, duration_minutes, distance_meters,
  tags, department, cost_center, internal_status, internal_order_id,
  share_link, internal_notes, custom_rating, quotation_id,
  pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
  metadata, bitrix24_deal_id, created_at, updated_at
FROM public.lalamove_orders;
