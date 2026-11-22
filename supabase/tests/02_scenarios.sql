-- Cenarios de validacao do trigger geo_evaluate_tracking (etapas 46, 50 e 52).
-- Rodado por supabase/tests/run.sh em um Postgres descartavel.
-- Cada bloco levanta excecao se a assercao falhar (ON_ERROR_STOP aborta tudo).

\set ON_ERROR_STOP on
-- client_min_messages=notice: cada assercao imprime 'ok: ...' para servir de evidencia
SET client_min_messages = notice;

-- Trigger real, conforme 20261122130100_geo_foundation.sql:529-533
DROP TRIGGER IF EXISTS trg_active_tracking_geo ON public.active_tracking;
CREATE TRIGGER trg_active_tracking_geo
  BEFORE INSERT OR UPDATE OF current_latitude, current_longitude, eta_minutes, next_stop_index
  ON public.active_tracking
  FOR EACH ROW EXECUTE FUNCTION public.geo_evaluate_tracking();

CREATE OR REPLACE FUNCTION public.assert_true(p_ok boolean, p_msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU: %', p_msg;
  END IF;
  RAISE NOTICE 'ok: %', p_msg;
END; $$;

-- ===========================================================================
-- Cenario 1 — ETA_DELAY (etapa 50)
-- scheduled_at 60 min atras + eta_minutes 30 => chegada prevista 30 min no futuro,
-- 90 min depois do agendado, acima da tolerancia de 15 => 1 alerta ETA_DELAY.
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '11111111-0000-4000-8000-000000000001';
  v_drv   uuid := '21111111-0000-4000-8000-000000000001';
  v_n     integer;
  v_late  numeric;
BEGIN
  DELETE FROM active_tracking WHERE order_id = v_order;
  DELETE FROM order_geo_events WHERE order_id = v_order;
  DELETE FROM alerts WHERE order_id = v_order;
  DELETE FROM lalamove_stops WHERE order_id = v_order;
  DELETE FROM lalamove_orders WHERE id = v_order;

  INSERT INTO lalamove_orders (id, lalamove_id, lalamove_status, status,
      pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
      scheduled_at, driver_name, driver_plate)
  VALUES (v_order, 'LM-ETA-1', 'ON_GOING', 'ON_GOING',
      -25.4295963, -49.2712724, -25.4433, -49.2288,
      now() - interval '60 minutes', 'Motorista ETA', 'ETA1A23');
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude, contact_name, contact_phone)
  VALUES (v_order, 0, -25.4295963, -49.2712724, 'Fornecedor', '+5541999990001'),
         (v_order, 1, -25.4433, -49.2288, 'Cliente', '+5541999990002');

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude,
      eta_minutes, tracking_status)
  VALUES (v_order, v_drv, -25.4300, -49.2700, 30, 'ACTIVE');

  SELECT count(*) INTO v_n FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'ETA_DELAY';
  PERFORM public.assert_true(v_n = 1, 'cenario 1: 1 evento ETA_DELAY emitido');

  SELECT (payload->>'late_minutes')::numeric INTO v_late FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'ETA_DELAY';
  PERFORM public.assert_true(v_late = 90, 'cenario 1: late_minutes = 90 (recebido '||coalesce(v_late::text,'null')||')');

  -- 2o UPDATE no mesmo pedido: UNIQUE(order_id,event_type,stop_index) mantem 1
  UPDATE active_tracking SET current_latitude = -25.4301 WHERE order_id = v_order;
  SELECT count(*) INTO v_n FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'ETA_DELAY';
  PERFORM public.assert_true(v_n = 1, 'cenario 1: ETA_DELAY idempotente no 2o UPDATE');
END $$;

-- ===========================================================================
-- Cenario 2 — pedido no prazo nao gera ETA_DELAY
-- scheduled_at +30 min, eta_minutes 10 => chegada 20 min antes => sem evento.
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '22222222-0000-4000-8000-000000000002';
  v_n integer;
BEGIN
  DELETE FROM active_tracking WHERE order_id = v_order;
  DELETE FROM order_geo_events WHERE order_id = v_order;
  DELETE FROM alerts WHERE order_id = v_order;
  DELETE FROM lalamove_stops WHERE order_id = v_order;
  DELETE FROM lalamove_orders WHERE id = v_order;

  INSERT INTO lalamove_orders (id, lalamove_id, lalamove_status, status,
      pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, scheduled_at)
  VALUES (v_order, 'LM-ETA-2', 'ON_GOING', 'ON_GOING',
      -25.4295963, -49.2712724, -25.4433, -49.2288, now() + interval '30 minutes');
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude)
  VALUES (v_order, 0, -25.4295963, -49.2712724), (v_order, 1, -25.4433, -49.2288);

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude,
      eta_minutes, tracking_status)
  VALUES (v_order, '22222222-1111-4000-8000-000000000002', -25.4300, -49.2700, 10, 'ACTIVE');

  SELECT count(*) INTO v_n FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'ETA_DELAY';
  PERFORM public.assert_true(v_n = 0, 'cenario 2: pedido no prazo nao gera ETA_DELAY');
END $$;

-- ===========================================================================
-- Cenario 3 — sem scheduled_at nao levanta excecao nem emite
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '33333333-0000-4000-8000-000000000003';
  v_n integer;
BEGIN
  DELETE FROM active_tracking WHERE order_id = v_order;
  DELETE FROM order_geo_events WHERE order_id = v_order;
  DELETE FROM lalamove_stops WHERE order_id = v_order;
  DELETE FROM lalamove_orders WHERE id = v_order;

  INSERT INTO lalamove_orders (id, lalamove_id, lalamove_status, status,
      pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, scheduled_at)
  VALUES (v_order, 'LM-ETA-3', 'ON_GOING', 'ON_GOING',
      -25.4295963, -49.2712724, -25.4433, -49.2288, NULL);
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude)
  VALUES (v_order, 0, -25.4295963, -49.2712724), (v_order, 1, -25.4433, -49.2288);

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude,
      eta_minutes, tracking_status)
  VALUES (v_order, '33333333-1111-4000-8000-000000000003', -25.4300, -49.2700, 45, 'ACTIVE');

  SELECT count(*) INTO v_n FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'ETA_DELAY';
  PERFORM public.assert_true(v_n = 0, 'cenario 3: sem scheduled_at nao emite ETA_DELAY');
END $$;

-- ===========================================================================
-- Cenario 4 — AVANCO DE PARADA (etapa 46)
-- Motorista estacionado na coleta por 2 ciclos (near_stop_cycles >= 2):
-- next_stop_index passa de 0 para 1, arrived_at da parada 0 preenchido,
-- near_stop_cycles zerado e distance_to_next_stop_m recalculado para a entrega.
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '44444444-0000-4000-8000-000000000004';
  v_idx   integer;
  v_cyc   integer;
  v_arr   timestamptz;
  v_dist  numeric;
BEGIN
  DELETE FROM active_tracking WHERE order_id = v_order;
  DELETE FROM order_geo_events WHERE order_id = v_order;
  DELETE FROM alerts WHERE order_id = v_order;
  DELETE FROM lalamove_stops WHERE order_id = v_order;
  DELETE FROM lalamove_orders WHERE id = v_order;

  INSERT INTO lalamove_orders (id, lalamove_id, lalamove_status, status,
      pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude)
  VALUES (v_order, 'LM-STOP-4', 'ON_GOING', 'ON_GOING',
      -25.4295963, -49.2712724, -25.4433, -49.2288);
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude)
  VALUES (v_order, 0, -25.4295963, -49.2712724), (v_order, 1, -25.4433, -49.2288);

  -- em cima da coleta: distance_to_next_stop_m ~0 <= arrived_radius_m (100)
  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude,
      eta_minutes, tracking_status)
  VALUES (v_order, '44444444-1111-4000-8000-000000000004', -25.4295963, -49.2712724, 20, 'ACTIVE');

  SELECT next_stop_index, near_stop_cycles INTO v_idx, v_cyc
    FROM active_tracking WHERE order_id = v_order;
  PERFORM public.assert_true(v_idx = 0, 'cenario 4: INSERT nao avanca a parada (idx='||v_idx||')');
  PERFORM public.assert_true(v_cyc = 1, 'cenario 4: 1o ciclo conta near_stop_cycles=1 (recebido '||v_cyc||')');

  -- 2o ciclo: desloca 10 m (muda lat, dispara o trigger) mas continua dentro do raio
  UPDATE active_tracking SET current_latitude = -25.4296900 WHERE order_id = v_order;

  SELECT next_stop_index, near_stop_cycles, distance_to_next_stop_m
    INTO v_idx, v_cyc, v_dist FROM active_tracking WHERE order_id = v_order;
  PERFORM public.assert_true(v_idx = 1, 'cenario 4: 2o ciclo dentro do raio avanca next_stop_index para 1 (recebido '||v_idx||')');
  PERFORM public.assert_true(v_cyc = 0, 'cenario 4: near_stop_cycles zerado apos avancar (recebido '||v_cyc||')');
  PERFORM public.assert_true(v_dist > 1000, 'cenario 4: distance_to_next_stop_m recalculada para a entrega (recebido '||coalesce(v_dist::text,'null')||')');

  SELECT arrived_at INTO v_arr FROM lalamove_stops WHERE order_id = v_order AND stop_index = 0;
  PERFORM public.assert_true(v_arr IS NOT NULL, 'cenario 4: arrived_at da parada 0 preenchido');

  -- 3o ciclo: ja na entrega, nao avanca para fora do range
  UPDATE active_tracking SET current_latitude = -25.4297800 WHERE order_id = v_order;
  SELECT next_stop_index INTO v_idx FROM active_tracking WHERE order_id = v_order;
  PERFORM public.assert_true(v_idx = 1, 'cenario 4: nao avanca alem da ultima parada (recebido '||v_idx||')');
END $$;

-- ===========================================================================
-- Cenario 5 — PICKED_UP avanca imediatamente, sem esperar 2 ciclos
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '55555555-0000-4000-8000-000000000005';
  v_idx integer;
BEGIN
  DELETE FROM active_tracking WHERE order_id = v_order;
  DELETE FROM order_geo_events WHERE order_id = v_order;
  DELETE FROM alerts WHERE order_id = v_order;
  DELETE FROM lalamove_stops WHERE order_id = v_order;
  DELETE FROM lalamove_orders WHERE id = v_order;

  INSERT INTO lalamove_orders (id, lalamove_id, lalamove_status, status,
      pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude)
  VALUES (v_order, 'LM-STOP-5', 'PICKED_UP', 'PICKED_UP',
      -25.4295963, -49.2712724, -25.4433, -49.2288);
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude)
  VALUES (v_order, 0, -25.4295963, -49.2712724), (v_order, 1, -25.4433, -49.2288);

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude,
      eta_minutes, tracking_status)
  VALUES (v_order, '55555555-1111-4000-8000-000000000005', -25.4400, -49.2600, 15, 'ACTIVE');

  SELECT next_stop_index INTO v_idx FROM active_tracking WHERE order_id = v_order;
  PERFORM public.assert_true(v_idx = 1, 'cenario 5: PICKED_UP avanca a parada no 1o ciclo (recebido '||v_idx||')');
END $$;

-- ===========================================================================
-- Cenario 6 — tracking nao-ACTIVE nao avalia nada
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '66666666-0000-4000-8000-000000000006';
  v_n integer;
  v_idx integer;
BEGIN
  DELETE FROM active_tracking WHERE order_id = v_order;
  DELETE FROM order_geo_events WHERE order_id = v_order;
  DELETE FROM lalamove_stops WHERE order_id = v_order;
  DELETE FROM lalamove_orders WHERE id = v_order;

  INSERT INTO lalamove_orders (id, lalamove_id, lalamove_status, status,
      pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
      scheduled_at)
  VALUES (v_order, 'LM-END-6', 'ON_GOING', 'ON_GOING',
      -25.4295963, -49.2712724, -25.4433, -49.2288, now() - interval '90 minutes');
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude)
  VALUES (v_order, 0, -25.4295963, -49.2712724), (v_order, 1, -25.4433, -49.2288);

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude,
      eta_minutes, tracking_status)
  VALUES (v_order, '66666666-1111-4000-8000-000000000006', -25.4295963, -49.2712724, 40, 'ENDED');

  SELECT count(*) INTO v_n FROM order_geo_events WHERE order_id = v_order;
  SELECT next_stop_index INTO v_idx FROM active_tracking WHERE order_id = v_order;
  PERFORM public.assert_true(v_n = 0, 'cenario 6: tracking ENDED nao emite evento');
  PERFORM public.assert_true(v_idx = 0, 'cenario 6: tracking ENDED nao avanca parada');
END $$;

-- ===========================================================================
-- Cenario 7 — etapa 44 nao duplica job: o trigger nao cria route_plan
-- ===========================================================================
DO $$
DECLARE
  v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM job_queue WHERE type = 'route_plan';
  PERFORM public.assert_true(v_n = 0, 'cenario 7: trigger nao enfileira route_plan (quem faz e o cron refresh_geo_jobs)');
END $$;

-- ===========================================================================
-- Cenario 8 — fixture de trajeto (etapa 52): 40 pontos dentro do raio de rota
-- Consome supabase/tests/fixtures/route_curitiba.json ponto a ponto, com
-- expected_route = a propria rota, e exige is_on_route=true em todos.
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '77777777-0000-4000-8000-000000000007';
  v_route jsonb;
  v_pt    jsonb;
  v_off   integer;
  v_bad   integer := 0;
  v_total integer := 0;
  v_last_dist numeric;
BEGIN
  DELETE FROM active_tracking WHERE order_id = v_order;
  DELETE FROM order_geo_events WHERE order_id = v_order;
  DELETE FROM alerts WHERE order_id = v_order;
  DELETE FROM lalamove_stops WHERE order_id = v_order;
  DELETE FROM lalamove_orders WHERE id = v_order;

  -- a fixture e carregada pelo run.sh em public.fixture_route_curitiba
  SELECT rota INTO v_route FROM public.fixture_route_curitiba WHERE true;
  PERFORM public.assert_true(v_route IS NOT NULL AND jsonb_array_length(v_route) = 40,
    'cenario 8: fixture com 40 pontos carregada');

  INSERT INTO lalamove_orders (id, lalamove_id, lalamove_status, status,
      pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude)
  VALUES (v_order, 'LM-FIXTURE-52', 'ON_GOING', 'ON_GOING',
      (v_route->0->>'lat')::numeric, (v_route->0->>'lng')::numeric,
      (v_route->39->>'lat')::numeric, (v_route->39->>'lng')::numeric);
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude)
  VALUES (v_order, 0, (v_route->0->>'lat')::numeric, (v_route->0->>'lng')::numeric),
         (v_order, 1, (v_route->39->>'lat')::numeric, (v_route->39->>'lng')::numeric);

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude,
      eta_minutes, tracking_status, expected_route)
  VALUES (v_order, '77777777-1111-4000-8000-000000000007',
      (v_route->0->>'lat')::numeric, (v_route->0->>'lng')::numeric,
      60, 'ACTIVE', v_route);

  SELECT off_route_threshold_m INTO v_off FROM geo_defaults WHERE id = true;

  FOR i IN 0 .. 39 LOOP
    v_pt := v_route->i;
    UPDATE active_tracking
       SET current_latitude  = (v_pt->>'lat')::numeric,
           current_longitude = (v_pt->>'lng')::numeric
     WHERE order_id = v_order;
    v_total := v_total + 1;
    IF (SELECT is_on_route FROM active_tracking WHERE order_id = v_order) IS NOT TRUE THEN
      v_bad := v_bad + 1;
    END IF;
  END LOOP;

  PERFORM public.assert_true(v_total = 40, 'cenario 8: 40 posicoes consumidas do trajeto');
  PERFORM public.assert_true(v_bad = 0, 'cenario 8: is_on_route=true em todos os 40 pontos (falhas='||v_bad||')');

  SELECT distance_to_next_stop_m INTO v_last_dist FROM active_tracking WHERE order_id = v_order;
  PERFORM public.assert_true(v_last_dist IS NOT NULL AND v_last_dist <= 100,
    'cenario 8: no ultimo ponto a distancia ate a entrega <= arrived_radius_m (recebido '||coalesce(v_last_dist::text,'null')||')');
END $$;

-- ===========================================================================
-- Cenario 9 — desvio real marca is_on_route=false e acumula off_route_cycles
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '88888888-0000-4000-8000-000000000008';
  v_route jsonb;
  v_on boolean;
  v_cyc integer;
BEGIN
  DELETE FROM active_tracking WHERE order_id = v_order;
  DELETE FROM order_geo_events WHERE order_id = v_order;
  DELETE FROM lalamove_stops WHERE order_id = v_order;
  DELETE FROM lalamove_orders WHERE id = v_order;

  SELECT rota INTO v_route FROM public.fixture_route_curitiba WHERE true;

  INSERT INTO lalamove_orders (id, lalamove_id, lalamove_status, status,
      pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude)
  VALUES (v_order, 'LM-OFF-8', 'ON_GOING', 'ON_GOING',
      (v_route->0->>'lat')::numeric, (v_route->0->>'lng')::numeric,
      (v_route->39->>'lat')::numeric, (v_route->39->>'lng')::numeric);
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude)
  VALUES (v_order, 0, (v_route->0->>'lat')::numeric, (v_route->0->>'lng')::numeric),
         (v_order, 1, (v_route->39->>'lat')::numeric, (v_route->39->>'lng')::numeric);

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude,
      eta_minutes, tracking_status, expected_route)
  VALUES (v_order, '88888888-1111-4000-8000-000000000008',
      (v_route->0->>'lat')::numeric, (v_route->0->>'lng')::numeric,
      60, 'ACTIVE', v_route);

  -- 500 m ao norte da rota: bem acima de off_route_threshold_m (50)
  UPDATE active_tracking SET current_latitude = -25.4250000, current_longitude = -49.2712724
   WHERE order_id = v_order;

  SELECT is_on_route, off_route_cycles INTO v_on, v_cyc FROM active_tracking WHERE order_id = v_order;
  PERFORM public.assert_true(v_on IS FALSE, 'cenario 9: desvio de 500 m marca is_on_route=false');
  PERFORM public.assert_true(v_cyc = 1, 'cenario 9: off_route_cycles acumula 1 (recebido '||v_cyc||')');
END $$;

-- ===========================================================================
-- Cenario 10 — volta para a rota zera off_route_cycles
-- ===========================================================================
DO $$
DECLARE
  v_order uuid := '88888888-0000-4000-8000-000000000008';
  v_route jsonb;
  v_cyc integer;
BEGIN
  SELECT rota INTO v_route FROM public.fixture_route_curitiba WHERE true;
  UPDATE active_tracking
     SET current_latitude = (v_route->2->>'lat')::numeric,
         current_longitude = (v_route->2->>'lng')::numeric
   WHERE order_id = v_order;

  SELECT off_route_cycles INTO v_cyc FROM active_tracking WHERE order_id = v_order;
  PERFORM public.assert_true(v_cyc = 0, 'cenario 10: voltar para a rota zera off_route_cycles (recebido '||v_cyc||')');
END $$;

\echo ''
\echo '================================================'
\echo ' TUDO OK — todos os cenarios passaram'
\echo '================================================'