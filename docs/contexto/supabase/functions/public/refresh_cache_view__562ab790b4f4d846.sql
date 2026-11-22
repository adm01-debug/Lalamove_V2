CREATE OR REPLACE FUNCTION public.refresh_cache_view(p_view_name text DEFAULT NULL::text, p_triggered_by text DEFAULT 'system'::text)
 RETURNS TABLE(view_refreshed text, duration_ms integer, row_count bigint, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name TEXT;
  v_start TIMESTAMPTZ;
  v_dur INTEGER;
  v_count BIGINT;
  v_log_id UUID;
BEGIN
  IF p_view_name IS NULL THEN
    FOR v_name IN SELECT unnest(ARRAY['driver_stats_cache','delivery_metrics_cache','hourly_metrics_cache'])
    LOOP
      RETURN QUERY SELECT * FROM public.refresh_cache_view(v_name, p_triggered_by);
    END LOOP;
    RETURN;
  END IF;

  IF p_view_name NOT IN ('driver_stats_cache','delivery_metrics_cache','hourly_metrics_cache') THEN
    RETURN QUERY SELECT p_view_name, NULL::INTEGER, NULL::BIGINT, 'failed'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.cache_refresh_log (view_name, status, triggered_by)
  VALUES (p_view_name, 'running', p_triggered_by)
  RETURNING id INTO v_log_id;

  v_start := clock_timestamp();
  BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', p_view_name);
    v_dur := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER;
    EXECUTE format('SELECT COUNT(*) FROM %I', p_view_name) INTO v_count;

    UPDATE public.cache_refresh_log
       SET refresh_completed_at = clock_timestamp(),
           refresh_duration_ms = v_dur,
           row_count = v_count,
           status = 'success'
     WHERE id = v_log_id;

    RETURN QUERY SELECT p_view_name, v_dur, v_count, 'success'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cache_refresh_log
       SET refresh_completed_at = clock_timestamp(),
           status = 'failed',
           error_message = SQLERRM
     WHERE id = v_log_id;
    RETURN QUERY SELECT p_view_name, NULL::INTEGER, NULL::BIGINT, 'failed'::TEXT;
  END;
END;
$function$
