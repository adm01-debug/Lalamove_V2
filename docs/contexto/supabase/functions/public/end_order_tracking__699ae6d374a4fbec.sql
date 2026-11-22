CREATE OR REPLACE FUNCTION public.end_order_tracking(p_order_id uuid, p_reason text DEFAULT 'order_closed'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ended integer := 0;
  v_cancelled integer := 0;
BEGIN
  IF p_order_id IS NULL THEN RETURN 0; END IF;

  UPDATE active_tracking
     SET tracking_status = 'ended',
         tracking_ended_at = COALESCE(tracking_ended_at, now()),
         last_updated = now()
   WHERE order_id = p_order_id
     AND COALESCE(tracking_status, 'ACTIVE') <> 'ended';
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  -- Eventos que ficaram esperando a janela de horario nunca devem sair depois
  -- que o pedido acabou.
  UPDATE order_geo_events
     SET notification_status = 'skipped'
   WHERE order_id = p_order_id
     AND notification_status = 'deferred';
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  IF v_ended > 0 OR v_cancelled > 0 THEN
    RAISE LOG 'end_order_tracking(%): % tracking(s) encerrado(s), % evento(s) cancelado(s) [%]',
      p_order_id, v_ended, v_cancelled, p_reason;
  END IF;
  RETURN v_ended;
END; $function$
