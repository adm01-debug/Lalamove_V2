CREATE OR REPLACE FUNCTION public.geo_evaluate_tracking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_notify_del := COALESCE(o.notify_delivery_contact, d.notify_delivery_contact);
  v_driver_name := COALESCE(o.driver_name, 'o motorista');

  -- ultima parada (entrega): maior stop_index em lalamove_stops, senao 1
  SELECT COALESCE(MAX(stop_index), 1) INTO v_last_index FROM lalamove_stops WHERE order_id = o.id;

  -- coordenada da proxima parada: lalamove_stops[next_stop_index] -> fallback colunas do pedido
  SELECT latitude, longitude INTO v_stop_lat, v_stop_lng
    FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1;
  IF v_stop_lat IS NULL THEN
    IF NEW.next_stop_index = 0 THEN
      v_stop_lat := o.pickup_latitude;   v_stop_lng := o.pickup_longitude;
    ELSE
      v_stop_lat := o.delivery_latitude; v_stop_lng := o.delivery_longitude;
    END IF;
  END IF;

  -- metricas
  IF v_stop_lat IS NOT NULL AND v_stop_lng IS NOT NULL THEN
    v_dist := geo_haversine_m(NEW.current_latitude, NEW.current_longitude, v_stop_lat, v_stop_lng);
    NEW.distance_to_next_stop_m := round(v_dist::numeric, 1);
    IF v_dist <= v_arrived_m THEN
      NEW.near_stop_cycles := COALESCE(OLD.near_stop_cycles, 0) + 1;
    ELSE
      NEW.near_stop_cycles := 0;
    END IF;
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
            'to',   COALESCE(o.pickup_contact_phone, (SELECT contact_phone FROM lalamove_stops WHERE order_id = o.id AND stop_index = 0 LIMIT 1))))
        ELSE jsonb_build_array(jsonb_build_object(
            'role', 'delivery_contact', 'channel', 'whatsapp',
            'name', (SELECT contact_name  FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1),
            'to',   (SELECT contact_phone FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1)))
      END);

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
END; $function$
