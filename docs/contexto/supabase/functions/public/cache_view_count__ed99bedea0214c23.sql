CREATE OR REPLACE FUNCTION public.cache_view_count(p_view text)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count bigint;
BEGIN
  IF p_view NOT IN ('driver_stats_cache','delivery_metrics_cache','hourly_metrics_cache') THEN
    RETURN 0;
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', p_view) INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$function$
