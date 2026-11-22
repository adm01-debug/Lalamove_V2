-- Etapas 44 e 50 do plano Google Maps.
--
-- 44 — Recalcular rota quando o motorista sai do caminho:
--      `geo_evaluate_tracking` já calculava `is_on_route` e `off_route_cycles`, mas ninguém
--      consumia esse contador: a rota ficava velha e o ETA derivava. Agora, ao completar 2
--      ciclos fora da rota, o trigger enfileira um `route_plan` no `job_queue`. O rate de
--      1 job a cada 5 min por pedido vem do `ON CONFLICT` em `dedup_key` junto com o
--      filtro `created_at > now() - interval '5 minutes'`.
--
-- 50 — `ETA_DELAY`: existia no enum (`20261122130000_geo_alert_types.sql:11`) e em
--      `alert_configurations` (`20261122130100:548-549` com `message_template`), mas
--      nenhum código emitia o evento. Agora o trigger emite quando a previsão de chegada
--      passa do `scheduled_at` + a tolerância de `LATE_DELIVERY`, uma vez por pedido por
--      parada (`order_geo_events` tem UNIQUE(order_id, event_type, stop_index)).

-- ----------------------------------------------------------------------------
-- 1. Tolerância de atraso configurável
-- ----------------------------------------------------------------------------
-- A tolerância vem de `alert_configurations.LATE_DELIVERY.min_interval_seconds`? Não:
-- esse campo é o intervalo mínimo entre alertas, não a tolerância de negócio. A tolerância
-- fica em `geo_defaults` (mesma tabela que já guarda raio/ETA de aproximação).
ALTER TABLE public.geo_defaults
  ADD COLUMN IF NOT EXISTS late_tolerance_min integer NOT NULL DEFAULT 15;

COMMENT ON COLUMN public.geo_defaults.late_tolerance_min IS
  'Minutos de atraso tolerados antes de emitir ETA_DELAY (etapa 50). Junto com lalamove_orders.scheduled_at.';

-- ----------------------------------------------------------------------------
-- 2. geo_evaluate_tracking: emite ETA_DELAY e enfileira route_plan
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.geo_evaluate_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o             record;
  d             record;
  v_status      text;
  v_stop_lat    double precision;
  v_stop_lng    double precision;
  v_last_index  integer;
  v_dist        double precision;
  v_radius      integer;
  v_eta_min     integer;
  v_arrived_m   integer;
  v_off_m       integer;
  v_notify_del  boolean;
  v_meta        jsonb;
  v_driver_name text;
  v_eta_at      timestamptz;
  v_late_limit  timestamptz;
BEGIN
  -- so posicoes novas de tracking ativo
  IF NEW.tracking_status IS DISTINCT FROM 'ACTIVE' THEN RETURN NEW; END IF;
  IF NEW.current_latitude IS NULL OR NEW.current_longitude IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.current_latitude = OLD.current_latitude AND NEW.current_longitude = OLD.current_longitude
     AND NEW.eta_minutes IS NOT DISTINCT FROM OLD.eta_minutes
     AND NEW.next_stop_index = OLD.next_stop_index THEN
    RETURN NEW;   -- nada relevante mudou
  END IF;

  SELECT * INTO d FROM geo_defaults WHERE id = true;

  SELECT id, status::text AS status_enum, lalamove_status, lalamove_id,
         pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
         pickup_address, delivery_address, scheduled_at, share_link,
         driver_name, driver_plate, pickup_contact_name, pickup_contact_phone, supplier_contact, auto_notify_supplier,
         approach_radius_m, approach_eta_min, notify_delivery_contact
    INTO o
    FROM lalamove_orders WHERE id = NEW.order_id;
  IF o.id IS NULL THEN RETURN NEW; END IF;

  v_status     := COALESCE(o.lalamove_status, o.status_enum);
  v_radius     := COALESCE(o.approach_radius_m, d.approach_radius_m);
  v_eta_min    := COALESCE(o.approach_eta_min,  d.approach_eta_min);
  v_arrived_m  := d.arrived_radius_m;
  v_off_m      := d.off_route_threshold_m;

  -- ultima parada conhecida do pedido (fallback: 1 = coleta + entrega)
  SELECT COALESCE(MAX(stop_index), 1) INTO v_last_index
    FROM lalamove_stops WHERE order_id = o.id;
  IF v_last_index IS NULL THEN v_last_index := 1; END IF;

  -- Coordenada da proxima parada: lalamove_stops[next_stop_index], fallback nas colunas do pedido
  SELECT latitude, longitude INTO v_stop_lat, v_stop_lng
    FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1;
  IF v_stop_lat IS NULL THEN
    IF NEW.next_stop_index = 0 THEN
      v_stop_lat := o.pickup_latitude;  v_stop_lng := o.pickup_longitude;
    ELSE
      v_stop_lat := o.delivery_latitude; v_stop_lng := o.delivery_longitude;
    END IF;
  END IF;

  IF v_stop_lat IS NOT NULL AND v_stop_lng IS NOT NULL THEN
    v_dist := geo_haversine_m(NEW.current_latitude, NEW.current_longitude, v_stop_lat, v_stop_lng);
    NEW.distance_to_next_stop_m := round(v_dist::numeric, 1);
    NEW.near_stop_cycles := CASE WHEN v_dist <= v_arrived_m THEN COALESCE(OLD.near_stop_cycles, 0) + 1 ELSE 0 END;
  ELSE
    v_dist := NULL;
    NEW.distance_to_next_stop_m := NULL;
  END IF;

  IF NEW.expected_route IS NOT NULL THEN
    NEW.distance_to_route_m := round(geo_point_to_polyline_m(NEW.current_latitude, NEW.current_longitude, NEW.expected_route)::numeric, 1);
    IF NEW.distance_to_route_m IS NOT NULL THEN
      NEW.is_on_route := NEW.distance_to_route_m <= v_off_m;
      NEW.off_route_cycles := CASE WHEN NEW.is_on_route THEN 0 ELSE COALESCE(OLD.off_route_cycles, 0) + 1 END;
    END IF;
  END IF;

  -- ---------------- ETAPA 44: replanejar rota quando sai do caminho ----------------
  -- 2 ciclos consecutivos fora da rota (~20-30 s com a cadencia de 10-15 s da UAPI).
  -- O guard de 5 min por pedido usa job_queue.dedup_key + created_at; sem ele, um
  -- motorista parado fora da rota geraria um job a cada ciclo.
  IF NEW.off_route_cycles >= 2 AND o.id IS NOT NULL THEN
    INSERT INTO job_queue (type, payload, status, priority, max_attempts, dedup_key)
    SELECT 'route_plan',
           jsonb_build_object('orderId', o.id, 'trackingId', NEW.id, 'reason', 'off_route',
                              'off_route_cycles', NEW.off_route_cycles,
                              'distance_to_route_m', NEW.distance_to_route_m),
           'PENDING', 5, 3,
           'route_plan:' || o.id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI')
    WHERE NOT EXISTS (
      SELECT 1 FROM job_queue jq
       WHERE jq.type = 'route_plan'
         AND jq.payload->>'orderId' = o.id::text
         AND jq.created_at > now() - interval '5 minutes'
    )
    -- O dedup_key usa o minuto corrente; se um job ja existe dentro da janela mas o
    -- guard acima nao o viu (corrida), a UNIQUE parcial levantaria excecao e abortaria
    -- o UPDATE de tracking. DO NOTHING torna o caso uma no-op.
    ON CONFLICT DO NOTHING;
    -- Reativa o contador para o proximo par de ciclos; sem isso o INSERT acima nao
    -- reavaliaria o guard e o ciclo ficaria preso em >= 2 para sempre.
    NEW.off_route_cycles := 0;
  END IF;

  IF v_dist IS NULL THEN RETURN NEW; END IF;   -- sem coordenada da parada nao ha evento

  v_meta := jsonb_build_object(
    'order_ref', o.lalamove_id, 'driver_name', o.driver_name, 'driver_plate', o.driver_plate,
    'share_link', o.share_link, 'pickup_address', o.pickup_address, 'delivery_address', o.delivery_address,
    'recipients', CASE
        WHEN NEW.next_stop_index = 0 THEN jsonb_build_array(jsonb_build_object(
            'role', 'pickup_contact', 'channel', 'whatsapp',
            'name', COALESCE(o.pickup_contact_name, o.supplier_contact),
            'to',   COALESCE(o.pickup_contact_phone, (SELECT contact_phone FROM lalamove_stops WHERE order_id = o.id AND stop_index = 0 LIMIT 1))))
        ELSE jsonb_build_array(jsonb_build_object(
            'role', 'delivery_contact', 'channel', 'whatsapp',
            'name', (SELECT contact_name  FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1),
            'to',   (SELECT contact_phone FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1)))
      END);

  -- ---------------- ETAPA 50: ETA_DELAY ----------------
  -- Previsao de chegada = agora + eta_minutes; compara com scheduled_at + tolerancia.
  -- So faz sentido com ETA conhecido e pedido agendado. `order_geo_events` tem
  -- UNIQUE(order_id, event_type, stop_index): 1 aviso por parada, mesmo com o motorista
  -- atrasando mais ao longo do trajeto.
  IF o.scheduled_at IS NOT NULL
     AND NEW.eta_minutes IS NOT NULL
     AND v_status IN ('ON_GOING', 'MATCHED', 'ASSIGNING_DRIVER', 'PICKED_UP', 'DELIVERING') THEN
    v_eta_at     := now() + make_interval(mins => NEW.eta_minutes);
    v_late_limit := o.scheduled_at + make_interval(mins => d.late_tolerance_min);
    IF v_eta_at > v_late_limit THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'ETA_DELAY', NEW.next_stop_index,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Atraso previsto',
        format('Pedido %s deve atrasar: previsao de chegada em ~%s min (%s), %s min depois do agendado (%s).',
               COALESCE(o.lalamove_id, o.id::text), NEW.eta_minutes,
               to_char(v_eta_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
               round(EXTRACT(EPOCH FROM (v_eta_at - o.scheduled_at)) / 60)::text,
               to_char(o.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')),
        true,
        v_meta || jsonb_build_object(
          'scheduled_at', o.scheduled_at,
          'eta_at', v_eta_at,
          'late_minutes', round(EXTRACT(EPOCH FROM (v_eta_at - o.scheduled_at)) / 60),
          'late_tolerance_min', d.late_tolerance_min));
    END IF;
  END IF;

  -- ---------------- COLETA (next_stop_index = 0) ----------------
  IF NEW.next_stop_index = 0 AND v_status IN ('ON_GOING','MATCHED','ASSIGNING_DRIVER') THEN
    IF v_dist <= v_radius OR (NEW.eta_minutes IS NOT NULL AND NEW.eta_minutes <= v_eta_min) THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'DRIVER_APPROACHING_PICKUP', 0,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Motorista se aproximando da coleta',
        format('%s (%s) chega em ~%s min para retirar o pedido %s.', v_driver_name, COALESCE(o.driver_plate,'-'),
               COALESCE(NEW.eta_minutes::text, GREATEST(1, round(v_dist/400))::text), COALESCE(o.lalamove_id, o.id::text)),
        true, v_meta);
    END IF;
    IF NEW.near_stop_cycles >= 2 THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'DRIVER_ARRIVED_PICKUP', 0,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Motorista chegou na coleta',
        format('%s (%s) chegou ao local de coleta do pedido %s.', v_driver_name, COALESCE(o.driver_plate,'-'), COALESCE(o.lalamove_id, o.id::text)),
        true, v_meta || '{"always_send":true}'::jsonb);
    END IF;
  END IF;

  -- ---------------- ENTREGA (ultima parada) ----------------
  IF NEW.next_stop_index >= 1 AND NEW.next_stop_index = v_last_index AND v_status IN ('PICKED_UP','ON_GOING') THEN
    IF v_dist <= v_radius OR (NEW.eta_minutes IS NOT NULL AND NEW.eta_minutes <= v_eta_min) THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'DRIVER_APPROACHING_DELIVERY', NEW.next_stop_index,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Motorista se aproximando da entrega',
        format('%s (%s) chega em ~%s min com o pedido %s.', v_driver_name, COALESCE(o.driver_plate,'-'),
               COALESCE(NEW.eta_minutes::text, GREATEST(1, round(v_dist/400))::text), COALESCE(o.lalamove_id, o.id::text)),
        v_notify_del, v_meta);
    END IF;
    IF NEW.near_stop_cycles >= 2 THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'DRIVER_ARRIVED_DELIVERY', NEW.next_stop_index,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Motorista chegou na entrega',
        format('%s (%s) chegou ao local de entrega do pedido %s.', v_driver_name, COALESCE(o.driver_plate,'-'), COALESCE(o.lalamove_id, o.id::text)),
        v_notify_del, v_meta || '{"always_send":true}'::jsonb);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

COMMENT ON FUNCTION public.geo_evaluate_tracking() IS
  'Trigger de active_tracking: calcula distancia/ETA local, emite os eventos de geofence (etapas 54-57), ETA_DELAY (etapa 50) e enfileira route_plan quando o motorista sai da rota (etapa 44).';
