CREATE OR REPLACE FUNCTION public.create_audit_log(p_action text, p_resource_type text, p_resource_id uuid, p_changes jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, changes)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_changes);
END;
$function$
