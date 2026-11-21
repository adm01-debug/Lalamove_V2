CREATE OR REPLACE FUNCTION public.can_run_db_diagnostics(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND (
       public.has_role(_user_id, 'admin')
       OR EXISTS (
         SELECT 1 FROM public.mcp_diagnostics_grants g
         WHERE g.user_id = _user_id AND g.is_active = true
       )
     );
$function$
