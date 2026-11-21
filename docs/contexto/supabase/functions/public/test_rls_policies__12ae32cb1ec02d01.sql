CREATE OR REPLACE FUNCTION public.test_rls_policies()
 RETURNS SETOF text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN NEXT has_table('public', 'drivers', 'Table drivers should exist');
    RETURN NEXT has_table('public', 'lalamove_orders', 'Table lalamove_orders should exist');
    
    -- Test RLS enabled
    RETURN NEXT is_rls_enabled('public', 'drivers', 'RLS should be enabled on drivers');
    RETURN NEXT is_rls_enabled('public', 'lalamove_orders', 'RLS should be enabled on lalamove_orders');
    
    -- Here we would add more complex pgTAP tests if needed
END;
$function$
