
CREATE OR REPLACE FUNCTION public.notify_webhook_security_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_severity alert_severity;
  v_dedup_key text;
  v_should_send boolean;
  v_title text;
  v_message text;
  v_subtype text;
BEGIN
  IF NEW.event_type NOT IN ('SIGNATURE_INVALID', 'REPLAY_REJECTED') THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type = 'SIGNATURE_INVALID' THEN
    v_severity := 'CRITICAL';
    v_subtype := 'WEBHOOK_SIGNATURE_INVALID';
    v_title := 'Webhook Lalamove: assinatura HMAC inválida';
    v_message := format(
      'Rejeição HMAC detectada. Motivo: %s. Verifique se o LALAMOVE_API_SECRET está sincronizado com o provedor.',
      COALESCE(NEW.error_message, 'assinatura ausente ou incorreta')
    );
  ELSE
    v_severity := 'WARNING';
    v_subtype := 'WEBHOOK_REPLAY_REJECTED';
    v_title := 'Webhook Lalamove: replay rejeitado';
    v_message := format(
      'Payload fora da janela de tempo aceita. Motivo: %s. Pode indicar clock skew ou tentativa de replay.',
      COALESCE(NEW.error_message, 'timestamp inválido')
    );
  END IF;

  v_dedup_key := 'webhook_security:' || v_subtype;

  SELECT should_send
    INTO v_should_send
    FROM public.claim_alert_notification(v_dedup_key, 'INTEGRATION_FAILURE'::alert_type, 900);

  IF NOT COALESCE(v_should_send, false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.alerts (type, severity, title, message, metadata)
  VALUES (
    'INTEGRATION_FAILURE'::alert_type,
    v_severity,
    v_title,
    v_message,
    jsonb_build_object(
      'subtype', v_subtype,
      'webhook_event_id', NEW.id,
      'lalamove_order_id', NEW.lalamove_order_id,
      'received_at', NEW.received_at,
      'error_message', NEW.error_message
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_webhook_security_event ON public.webhook_events;

CREATE TRIGGER trg_notify_webhook_security_event
AFTER INSERT ON public.webhook_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_webhook_security_event();
