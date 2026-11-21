CREATE OR REPLACE FUNCTION public.refresh_geo_jobs()
 RETURNS TABLE(enqueued_eta integer, enqueued_route integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_eta   integer := 0;
  v_route integer := 0;
  v_slot  text := to_char(now(), 'YYYYMMDDHH24') || '_' || (floor(extract(minute from now()) / 5)::int);
  r       RECORD;
BEGIN
  -- ETA: tracking ativo com posicao conhecida nas ultimas 2 h
  FOR r IN
    SELECT t.id
      FROM active_tracking t
     WHERE t.tracking_status = 'ACTIVE'
       AND t.current_latitude IS NOT NULL
       AND t.current_longitude IS NOT NULL
       AND t.last_updated > now() - interval '2 hours'
  LOOP
    IF add_job(
         p_type       => 'eta_refresh',
         p_payload    => jsonb_build_object('trackingId', r.id),
         p_priority   => 6,
         p_max_attempts => 2,
         p_dedup_key  => 'eta:' || r.id::text || ':' || v_slot
       ) IS NOT NULL THEN
      v_eta := v_eta + 1;
    END IF;
  END LOOP;

  -- Rota: tracking ativo sem rota, com rota velha, ou com desvio repetido
  FOR r IN
    SELECT t.id
      FROM active_tracking t
     WHERE t.tracking_status = 'ACTIVE'
       AND t.current_latitude IS NOT NULL
       AND t.current_longitude IS NOT NULL
       AND (
             t.expected_route IS NULL
          OR t.route_computed_at IS NULL
          OR t.route_computed_at < now() - interval '30 minutes'
          OR COALESCE(t.off_route_cycles, 0) >= 2
           )
       AND (t.route_computed_at IS NULL OR t.route_computed_at < now() - interval '5 minutes')
  LOOP
    IF add_job(
         p_type       => 'route_plan',
         p_payload    => jsonb_build_object('trackingId', r.id),
         p_priority   => 6,
         p_max_attempts => 2,
         p_dedup_key  => 'route:' || r.id::text || ':' || v_slot
       ) IS NOT NULL THEN
      v_route := v_route + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_eta, v_route;
END;
$function$
