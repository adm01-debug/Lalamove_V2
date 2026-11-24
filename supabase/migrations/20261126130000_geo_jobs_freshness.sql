-- ============================================================================
-- Agendador geo: o branch route_plan ignorava a idade do GPS.
--
-- refresh_geo_jobs() enfileirava route_plan para todo tracking ACTIVE com
-- coordenadas, sem exigir posicao recente. Tracking cuja sincronizacao parou
-- mas ficou com tracking_status='ACTIVE' (estado real: 20 trackings com
-- last_updated em 2026-08-31) gerava ~1 job de rota a cada 5 min — 822 jobs em
-- 24 h — cada um pagando Directions no provedor e reescrevendo
-- expected_route/route_computed_at com coordenada de meses atras.
--
-- Correcao: mesma janela de 2 h que o branch eta_refresh ja usava. O
-- job-worker tambem barra posicao velha (GEO_POSITION_MAX_AGE_MIN = 120), esta
-- guarda evita gerar o job e a linha na fila.
--
-- Idempotente (CREATE OR REPLACE). O cron 'geo-jobs-refresh' nao muda.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_geo_jobs()
RETURNS TABLE(enqueued_eta integer, enqueued_route integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Rota: tracking ativo com posicao recente, sem rota, com rota velha, ou com desvio repetido
  FOR r IN
    SELECT t.id
      FROM active_tracking t
     WHERE t.tracking_status = 'ACTIVE'
       AND t.current_latitude IS NOT NULL
       AND t.current_longitude IS NOT NULL
       AND t.last_updated > now() - interval '2 hours'
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
$$;

REVOKE ALL ON FUNCTION public.refresh_geo_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_geo_jobs() TO service_role;

COMMENT ON FUNCTION public.refresh_geo_jobs() IS
  'Enfileira eta_refresh e route_plan (rota velha/desvio) apenas para tracking ativo com GPS nas ultimas 2 h';

COMMIT;