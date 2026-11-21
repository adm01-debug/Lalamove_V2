CREATE OR REPLACE FUNCTION public.is_aal2()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (SELECT auth.jwt() ->> 'aal' = 'aal2');
END;
$function$
