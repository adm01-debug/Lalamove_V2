-- Revoke broad authenticated access from PII views
REVOKE ALL ON public.drivers_safe_view FROM authenticated;
REVOKE ALL ON public.orders_safe_view FROM authenticated;
REVOKE ALL ON public.orders_operator_view FROM authenticated;

-- Grant SELECT only to specific roles via database roles
-- Since app roles are managed via user_roles table and has_role() function,
-- and the views already use security_invoker=true which applies underlying
-- table RLS, we need to re-grant to authenticated (RLS on base tables handles filtering)
-- But we keep anon revoked. The underlying RLS on drivers/lalamove_orders already restricts by role.
GRANT SELECT ON public.drivers_safe_view TO authenticated;
GRANT SELECT ON public.orders_safe_view TO authenticated;
GRANT SELECT ON public.orders_operator_view TO authenticated;