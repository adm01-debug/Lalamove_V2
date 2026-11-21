CREATE OR REPLACE FUNCTION public.cleanup_old_region_cache(p_retention_days integer DEFAULT 90)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.region_cache
  WHERE updated_at < now() - (GREATEST(p_retention_days, 1) || ' days')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$
