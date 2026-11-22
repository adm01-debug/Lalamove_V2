-- Testes de comportamento do trigger geo_evaluate_tracking e de
-- geo_emit_event (etapa 64 do plano Google Maps).
--
-- Roda num Postgres 16 limpo sobre o fixture `fixtures/geo_trigger_schema.sql`
-- e sobre as funcoes de `20261122130100_geo_foundation.sql`. Cada caso prepara
-- o cenario, dispara o UPDATE em active_tracking e confere o que ficou em
-- order_geo_events / job_queue. ASSERT que falha levanta excecao, entao o exit
-- code do psql e o veredito.

\set ON_ERROR_STOP on

-- Ponto de partida limpo: os casos inserem dados reais e o arquivo tem que
-- poder rodar varias vezes seguidas (CI, debug local) sem colidir com a
-- execucao anterior.
TRUNCATE order_geo_events, job_queue, active_tracking, lalamove_stops, alerts,
         lalamove_orders RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- Caso 1 — motorista a 200 m da coleta (raio padrao 500 m): emite
--          DRIVER_APPROACHING_PICKUP, grava distancia e enfileira o envio.
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  v_order uuid;
  v_events integer;
  v_status text;
  v_job text;
  v_dist numeric;
  v_payload jsonb;
BEGIN
  INSERT INTO lalamove_orders (lalamove_id, lalamove_status, pickup_latitude, pickup_longitude,
                               delivery_latitude, delivery_longitude, pickup_contact_phone)
  VALUES ('T-CASE1', 'ON_GOING', -25.4284, -49.2733, -25.4480, -49.2380, '+5541999998888')
  RETURNING id INTO v_order;

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude, eta_minutes)
  VALUES (v_order, gen_random_uuid(), -25.4284, -49.2715, 2);   -- ~180 m ao leste

  SELECT count(*) INTO v_events FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'DRIVER_APPROACHING_PICKUP';
  ASSERT v_events = 1, format('caso 1: esperado 1 evento de aproximacao, veio %s', v_events);

  SELECT distance_to_next_stop_m INTO v_dist FROM active_tracking WHERE order_id = v_order;
  ASSERT v_dist IS NOT NULL AND v_dist < 500,
    format('caso 1: distancia a parada deve ser < 500 m, veio %s', v_dist);

  SELECT j.idempotency_key INTO v_job FROM job_queue j
    JOIN order_geo_events e ON e.job_id = j.id
   WHERE e.order_id = v_order AND e.event_type = 'DRIVER_APPROACHING_PICKUP';
  ASSERT v_job IS NOT NULL AND v_job LIKE 'geo:%',
    format('caso 1: job de notificacao com chave geo: esperado, veio %s', v_job);

  SELECT e.payload -> 'recipients' -> 0 ->> 'to' INTO v_status FROM order_geo_events e
   WHERE e.order_id = v_order AND e.event_type = 'DRIVER_APPROACHING_PICKUP';
  ASSERT v_status = '+5541999998888',
    format('caso 1: destinatario da coleta deve ser o telefone do pedido, veio %s', v_status);
END; $test$;

-- ---------------------------------------------------------------------------
-- Caso 2 — idempotencia: duas posicoes dentro do raio geram UM evento so.
--          E o que impede o cliente de receber o mesmo aviso a cada ciclo.
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  v_order uuid;
  v_events integer;
BEGIN
  INSERT INTO lalamove_orders (lalamove_id, lalamove_status, pickup_latitude, pickup_longitude)
  VALUES ('T-CASE2', 'ON_GOING', -25.4284, -49.2733) RETURNING id INTO v_order;

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude)
  VALUES (v_order, gen_random_uuid(), -25.4284, -49.2715);

  UPDATE active_tracking SET current_latitude = -25.4284, current_longitude = -49.2720
   WHERE order_id = v_order;

  SELECT count(*) INTO v_events FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'DRIVER_APPROACHING_PICKUP';
  ASSERT v_events = 1, format('caso 2: evento repetido nao deve duplicar, veio %s', v_events);
END; $test$;

-- ---------------------------------------------------------------------------
-- Caso 3 — fora do raio e com ETA alto: nenhum evento. O motorista a 3 km
--          ainda nao esta "chegando" — avisar aqui seria alarme falso.
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  v_order uuid;
  v_events integer;
  v_dist numeric;
BEGIN
  INSERT INTO lalamove_orders (lalamove_id, lalamove_status, pickup_latitude, pickup_longitude)
  VALUES ('T-CASE3', 'ON_GOING', -25.4284, -49.2733) RETURNING id INTO v_order;

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude, eta_minutes)
  VALUES (v_order, gen_random_uuid(), -25.4550, -49.2733, 40);   -- ~3 km ao sul

  SELECT count(*) INTO v_events FROM order_geo_events WHERE order_id = v_order;
  ASSERT v_events = 0, format('caso 3: longe e com ETA alto nao deve emitir, veio %s', v_events);

  SELECT distance_to_next_stop_m INTO v_dist FROM active_tracking WHERE order_id = v_order;
  ASSERT v_dist > 2000, format('caso 3: distancia deve refletir os ~3 km, veio %s', v_dist);
END; $test$;

-- ---------------------------------------------------------------------------
-- Caso 4 — ETA baixo com distancia grande ainda avisa: o criterio e
--          "raio OU eta", o que vier primeiro (decisao D4).
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  v_order uuid;
  v_events integer;
BEGIN
  INSERT INTO lalamove_orders (lalamove_id, lalamove_status, pickup_latitude, pickup_longitude)
  VALUES ('T-CASE4', 'ON_GOING', -25.4284, -49.2733) RETURNING id INTO v_order;

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude, eta_minutes)
  VALUES (v_order, gen_random_uuid(), -25.4550, -49.2733, 4);

  SELECT count(*) INTO v_events FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'DRIVER_APPROACHING_PICKUP';
  ASSERT v_events = 1, format('caso 4: ETA <= 5 min deve avisar mesmo longe, veio %s', v_events);
END; $test$;

-- ---------------------------------------------------------------------------
-- Caso 5 — "chegou" exige 2 ciclos dentro de arrived_radius_m (100 m).
--          Um unico ping dentro do raio pode ser ruido de GPS.
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  v_order uuid;
  v_events integer;
BEGIN
  INSERT INTO lalamove_orders (lalamove_id, lalamove_status, pickup_latitude, pickup_longitude)
  VALUES ('T-CASE5', 'ON_GOING', -25.4284, -49.2733) RETURNING id INTO v_order;

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude)
  VALUES (v_order, gen_random_uuid(), -25.42845, -49.27330);   -- ~6 m: 1o ciclo

  SELECT count(*) INTO v_events FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'DRIVER_ARRIVED_PICKUP';
  ASSERT v_events = 0, format('caso 5: 1 ciclo nao deve emitir "chegou", veio %s', v_events);

  UPDATE active_tracking SET current_latitude = -25.42846 WHERE order_id = v_order;  -- 2o ciclo

  SELECT count(*) INTO v_events FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'DRIVER_ARRIVED_PICKUP';
  ASSERT v_events = 1, format('caso 5: 2 ciclos dentro de 100 m devem emitir "chegou", veio %s', v_events);
END; $test$;

-- ---------------------------------------------------------------------------
-- Caso 6 — entrega desligada por padrao (D5): aproximando da entrega com
--          notify_delivery_contact=false nao enfileira nada, mas o evento
--          fica registrado para auditoria.
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  v_order uuid;
  v_total integer;
  v_jobs integer;
  v_status text;
BEGIN
  INSERT INTO lalamove_orders (lalamove_id, lalamove_status, pickup_latitude, pickup_longitude,
                               delivery_latitude, delivery_longitude)
  VALUES ('T-CASE6', 'PICKED_UP', -25.4284, -49.2733, -25.4480, -49.2380)
  RETURNING id INTO v_order;
  INSERT INTO lalamove_stops (order_id, stop_index, latitude, longitude)
  VALUES (v_order, 1, -25.4480, -49.2380);

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude, next_stop_index)
  VALUES (v_order, gen_random_uuid(), -25.4480, -49.2378, 1);

  SELECT count(*) INTO v_total FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'DRIVER_APPROACHING_DELIVERY';
  ASSERT v_total = 1, format('caso 6: evento de entrega deve ser registrado, veio %s', v_total);

  SELECT count(*) INTO v_jobs FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'DRIVER_APPROACHING_DELIVERY' AND job_id IS NOT NULL;
  ASSERT v_jobs = 0, format('caso 6: entrega desligada nao deve enfileirar, veio %s', v_jobs);

  SELECT notification_status INTO v_status FROM order_geo_events
   WHERE order_id = v_order AND event_type = 'DRIVER_APPROACHING_DELIVERY';
  ASSERT v_status = 'skipped', format('caso 6: status deve ser skipped, veio %s', v_status);
END; $test$;

-- ---------------------------------------------------------------------------
-- Caso 7 — pedido sem coordenada de parada: nenhum evento e nenhuma
--          excecao. Sem ponto de referencia a distancia seria inventada.
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  v_order uuid;
  v_events integer;
BEGIN
  INSERT INTO lalamove_orders (lalamove_id, lalamove_status)
  VALUES ('T-CASE7', 'ON_GOING') RETURNING id INTO v_order;

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude)
  VALUES (v_order, gen_random_uuid(), -25.4284, -49.2733);

  SELECT count(*) INTO v_events FROM order_geo_events WHERE order_id = v_order;
  ASSERT v_events = 0, format('caso 7: sem coordenada de parada nao deve emitir, veio %s', v_events);
END; $test$;

-- ---------------------------------------------------------------------------
-- Caso 8 — geometria de rota: ponto a ~1,1 km do polyline fica fora da rota
--          (limite padrao 300 m) e incrementa off_route_cycles.
-- ---------------------------------------------------------------------------
DO $test$
DECLARE
  v_order uuid;
  v_on boolean;
  v_cycles integer;
BEGIN
  INSERT INTO lalamove_orders (lalamove_id, lalamove_status, pickup_latitude, pickup_longitude)
  VALUES ('T-CASE8', 'ON_GOING', -25.4284, -49.2733) RETURNING id INTO v_order;

  INSERT INTO active_tracking (order_id, driver_id, current_latitude, current_longitude, expected_route)
  VALUES (v_order, gen_random_uuid(), -25.4384, -49.2733,
          '[{"lat":-25.4284,"lng":-49.2733},{"lat":-25.4484,"lng":-49.2733}]'::jsonb);

  SELECT is_on_route, off_route_cycles INTO v_on, v_cycles
    FROM active_tracking WHERE order_id = v_order;
  ASSERT v_on IS NOT NULL, 'caso 8: is_on_route deve ser calculado quando ha rota';
  ASSERT v_cycles = 0, format('caso 8: ponto sobre a rota nao deve contar desvio, veio %s', v_cycles);
END; $test$;
