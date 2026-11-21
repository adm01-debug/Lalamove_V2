CREATE OR REPLACE FUNCTION public.geo_audit_config()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, changes)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, gen_random_uuid(),
          jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
  RETURN COALESCE(NEW, OLD);
END; $function$
