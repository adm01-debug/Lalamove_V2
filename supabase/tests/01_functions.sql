-- GERADO por supabase/tests/run.sh — nao editar a mao.
-- Funcoes reais copiadas das migrations, sem alteracao de logica.

-- geo_haversine_m <- 20261122130100_geo_foundation.sql
CREATE OR REPLACE FUNCTION public.geo_haversine_m(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 2 * 6371008.8 * asin( LEAST(1.0, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- geo_point_to_segment_m <- 20261122130100_geo_foundation.sql
CREATE OR REPLACE FUNCTION public.geo_point_to_segment_m(
  plat double precision, plng double precision,
  alat double precision, alng double precision,
  blat double precision, blng double precision)
RETURNS double precision LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  k    double precision := cos(radians(plat));
  v_ax double precision := (alng - plng) * k;
  v_ay double precision := (alat - plat);
  v_bx double precision := (blng - plng) * k;
  v_by double precision := (blat - plat);
  v_dx double precision;
  v_dy double precision;
  len2 double precision;
  t    double precision;
  cx   double precision;
  cy   double precision;
BEGIN
  v_dx := v_bx - v_ax; v_dy := v_by - v_ay;
  len2 := v_dx*v_dx + v_dy*v_dy;
  IF len2 = 0 THEN
    RETURN geo_haversine_m(plat, plng, alat, alng);
  END IF;
  t := GREATEST(0, LEAST(1, -(v_ax*v_dx + v_ay*v_dy) / len2));
  cx := v_ax + t*v_dx; cy := v_ay + t*v_dy;
  RETURN geo_haversine_m(plat, plng, plat + cy, plng + cx / k);
END; $$;

-- geo_point_to_polyline_m <- 20261122130100_geo_foundation.sql
CREATE OR REPLACE FUNCTION public.geo_point_to_polyline_m(
  plat double precision, plng double precision, polyline jsonb)
RETURNS double precision LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  n     integer;
  i     integer;
  best  double precision := NULL;
  d     double precision;
  a     jsonb; b jsonb;
BEGIN
  IF polyline IS NULL OR jsonb_typeof(polyline) <> 'array' THEN RETURN NULL; END IF;
  n := jsonb_array_length(polyline);
  IF n = 0 THEN RETURN NULL; END IF;
  IF n = 1 THEN
    a := polyline->0;
    RETURN geo_haversine_m(plat, plng, (a->>'lat')::double precision, (a->>'lng')::double precision);
  END IF;
  FOR i IN 0 .. n-2 LOOP
    a := polyline->i; b := polyline->(i+1);
    d := geo_point_to_segment_m(plat, plng,
           (a->>'lat')::double precision, (a->>'lng')::double precision,
           (b->>'lat')::double precision, (b->>'lng')::double precision);
    IF best IS NULL OR d < best THEN best := d; END IF;
  END LOOP;
  RETURN best;
END; $$;

-- geo_emit_event <- 20261122130100_geo_foundation.sql
CREATE OR REPLACE FUNCTION public.geo_emit_event(
  p_order_id uuid, p_driver_id uuid, p_event public.alert_type, p_stop_index integer,
  p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer,
  p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id uuid;
  v_alert_id uuid;
  v_job_id   uuid;
BEGIN
  INSERT INTO order_geo_events (order_id, event_type, stop_index, driver_lat, driver_lng, distance_m, eta_min, payload,
                                notification_status)
  VALUES (p_order_id, p_event, p_stop_index, p_lat, p_lng, p_distance_m, p_eta_min, p_metadata,
          CASE WHEN p_enqueue THEN 'queued' ELSE 'skipped' END)
  ON CONFLICT (order_id, event_type, stop_index) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN RETURN NULL; END IF;   -- ja disparado

  INSERT INTO alerts (type, severity, title, message, order_id, driver_id, metadata)
  VALUES (p_event, 'INFO', p_title, p_message, p_order_id, p_driver_id,
          p_metadata || jsonb_build_object('geo_event_id', v_event_id, 'distance_m', p_distance_m, 'eta_min', p_eta_min))
  RETURNING id INTO v_alert_id;

  IF p_enqueue THEN
    v_job_id := add_job(
      'notification',
      jsonb_build_object(
        'alert_id', v_alert_id, 'type', p_event::text, 'severity', 'INFO',
        'title', p_title, 'message', p_message,
        'order_id', p_order_id, 'driver_id', p_driver_id,
        'metadata', p_metadata || jsonb_build_object('geo_event_id', v_event_id, 'distance_m', p_distance_m, 'eta_min', p_eta_min)
      ),
      3, 3,
      'geo:' || p_order_id::text || ':' || p_event::text || ':' || p_stop_index::text,
      jsonb_build_object('source', 'geo_trigger'));
  END IF;

  UPDATE order_geo_events SET alert_id = v_alert_id, job_id = v_job_id WHERE id = v_event_id;
  RETURN v_event_id;
END; $$;

-- add_job <- 20261122120200_job_queue_system.sql
CREATE OR REPLACE FUNCTION public.add_job(
  p_type text, p_payload jsonb, p_priority integer DEFAULT 5,
  p_max_attempts integer DEFAULT 3, p_dedup_key text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job_id uuid;
BEGIN
  IF p_dedup_key IS NOT NULL THEN
    SELECT id INTO v_job_id FROM job_queue
      WHERE dedup_key = p_dedup_key AND status IN ('PENDING','PROCESSING') LIMIT 1;
    IF v_job_id IS NOT NULL THEN RETURN v_job_id; END IF;
  END IF;
  INSERT INTO job_queue (type, payload, priority, max_attempts, dedup_key, metadata, created_by)
    VALUES (p_type, p_payload, p_priority, p_max_attempts, p_dedup_key, p_metadata, auth.uid())
    RETURNING id INTO v_job_id;
  RETURN v_job_id;
END; $$;

-- geo_evaluate_tracking <- 20261122131000_geo_eta_delay.sql
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

  IF v_dist IS NULL THEN RETURN NEW; END IF;   -- sem coordenada da parada nao ha evento

  v_meta := jsonb_build_object(
    'order_ref', o.lalamove_id, 'driver_name', o.driver_name, 'driver_plate', o.driver_plate,
    'share_link', o.share_link, 'pickup_address', o.pickup_address, 'delivery_address', o.delivery_address,
    'recipients', CASE
        WHEN NEW.next_stop_index = 0 THEN jsonb_build_array(jsonb_build_object(
            'role', 'pickup_contact', 'channel', 'whatsapp',
            'name', COALESCE(o.pickup_contact_name, o.supplier_contact),
            -- D1 (etapa 59): pickup_contact_phone -> supplier_contact (só com
            -- auto_notify_supplier) -> lalamove_stops[0].contact_phone. Sem o
            -- supplier_contact aqui, pedido que só tem fornecedor cadastrado
            -- montava destinatário com nome e to=null.
            'to',   COALESCE(
                      o.pickup_contact_phone,
                      CASE WHEN o.auto_notify_supplier THEN o.supplier_contact ELSE NULL END,
                      (SELECT contact_phone FROM lalamove_stops WHERE order_id = o.id AND stop_index = 0 LIMIT 1))))
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

  -- ---------------- AVANCO DE PARADA (etapa 46) ----------------
  -- Nada mais no repositorio escrevia `next_stop_index`: a coluna nascia em 0
  -- (`geo_foundation.sql:241`) e ficava em 0 para sempre. Como o bloco de ENTREGA acima
  -- exige `next_stop_index >= 1`, ele nunca executava — nenhum pedido recebia alerta de
  -- aproximacao/chegada na entrega. Este bloco fecha isso.
  --
  -- Regra (plano, etapa 46): chegou ao raio de chegada por 2 ciclos consecutivos
  -- (`near_stop_cycles >= 2`) OU o status Lalamove virou PICKED_UP -> avanca uma parada e
  -- marca `arrived_at` na parada que ficou para tras. Antes de avancar, o codigo so
  -- emitia DRIVER_ARRIVED_*; agora a parada tambem e quitada.
  --
  -- Ordem importa: o avanco roda no FIM, depois de todos os eventos, para que stop_index
  -- dos eventos emitidos seja o da parada que estava sendo perseguida neste ciclo.
  IF NEW.next_stop_index < v_last_index
     AND v_status IN ('ON_GOING','MATCHED','ASSIGNING_DRIVER','PICKED_UP','DELIVERING')
     AND (NEW.near_stop_cycles >= 2 OR v_status = 'PICKED_UP') THEN

    UPDATE lalamove_stops SET arrived_at = COALESCE(arrived_at, now())
     WHERE order_id = NEW.order_id AND stop_index = NEW.next_stop_index;

    NEW.next_stop_index  := NEW.next_stop_index + 1;
    NEW.near_stop_cycles := 0;   -- zera, senao o contador herdado dispararia
                                 -- DRIVER_ARRIVED_DELIVERY no ciclo seguinte

    -- as metricas precisam apontar para a NOVA parada, nao para a que acabou de ser deixada
    SELECT latitude, longitude INTO v_stop_lat, v_stop_lng
      FROM lalamove_stops WHERE order_id = NEW.order_id AND stop_index = NEW.next_stop_index LIMIT 1;
    IF v_stop_lat IS NULL THEN
      IF NEW.next_stop_index = 0 THEN
        v_stop_lat := o.pickup_latitude;   v_stop_lng := o.pickup_longitude;
      ELSE
        v_stop_lat := o.delivery_latitude; v_stop_lng := o.delivery_longitude;
      END IF;
    END IF;

    IF v_stop_lat IS NOT NULL AND v_stop_lng IS NOT NULL THEN
      NEW.distance_to_next_stop_m := round(
        geo_haversine_m(NEW.current_latitude, NEW.current_longitude, v_stop_lat, v_stop_lng)::numeric, 1);
    ELSE
      NEW.distance_to_next_stop_m := NULL;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

