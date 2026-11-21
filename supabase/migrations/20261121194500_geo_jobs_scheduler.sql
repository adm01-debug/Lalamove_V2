-- ============================================================================
-- Agendador dos jobs geo: ate agora os handlers route_plan/eta_refresh
-- existiam mas NADA os enfileirava — as etapas 45 e 46 do plano (expected_route
-- e ETA por pedido ativo) nunca rodavam sozinhas.
--
-- refresh_geo_jobs():
--   eta_refresh  para todo tracking ACTIVE com GPS nas ultimas 2h
--                (dedup por tracking + slot de 5 min -> no maximo 1 job
--                 por tracking a cada 5 min, como pede a etapa 46)
--   route_plan   para tracking ACTIVE sem rota valida (< 30 min) ou cujo
--                motorista saiu da rota 2+ vezes (etapa 48)
--
-- Idempotente. A dedup_key e limpa quando o job conclui, entao o mesmo
-- tracking pode ser reenfileirado no proximo slot.
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
$$;

REVOKE ALL ON FUNCTION public.refresh_geo_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_geo_jobs() TO service_role;

COMMENT ON FUNCTION public.refresh_geo_jobs() IS
  'Enfileira eta_refresh (slot 5 min) e route_plan (rota velha/desvio) para trackings ativos';

-- a cada 5 minutos, no minuto 1 (fora do minuto 0 do dispatcher)
SELECT cron.schedule('geo-jobs-refresh', '1-59/5 * * * *', $$SELECT public.refresh_geo_jobs();$$);

COMMIT;