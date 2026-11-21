CREATE OR REPLACE FUNCTION public.geo_emit_event(p_order_id uuid, p_driver_id uuid, p_event alert_type, p_stop_index integer, p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer, p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$
