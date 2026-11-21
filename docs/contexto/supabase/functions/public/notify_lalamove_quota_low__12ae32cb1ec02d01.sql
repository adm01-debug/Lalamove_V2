CREATE OR REPLACE FUNCTION public.notify_lalamove_quota_low()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_severity alert_severity;
  v_dedup_key text;
  v_should_send boolean;
  v_window_seconds int := 900; -- 15 min
  v_title text;
  v_message text;
BEGIN
  -- Only act when we have a remaining reading and it's low
  IF NEW.limit_remaining IS NULL OR NEW.limit_remaining > 10 THEN
    RETURN NEW;
  END IF;

  -- Severity: CRITICAL if <=3 or ratio >=0.95, else WARNING
  IF NEW.limit_remaining <= 3 OR COALESCE(NEW.usage_ratio, 0) >= 0.95 THEN
    v_severity := 'CRITICAL';
  ELSE
    v_severity := 'WARNING';
  END IF;

  v_dedup_key := 'lalamove_quota_low:' || COALESCE(NEW.endpoint, 'unknown') || ':' || v_severity::text;

  SELECT should_send INTO v_should_send
  FROM public.claim_alert_notification(v_dedup_key, 'INTEGRATION_FAILURE'::alert_type, v_window_seconds);

  IF NOT COALESCE(v_should_send, false) THEN
    RETURN NEW;
  END IF;

  v_title := 'Quota Lalamove baixa: ' || COALESCE(NEW.endpoint, 'endpoint desconhecido');
  v_message := format(
    'Restam %s de %s chamadas (uso %.0f%%). Reset em %s.',
    NEW.limit_remaining,
    COALESCE(NEW.limit_total, 0),
    COALESCE(NEW.usage_ratio, 0) * 100,
    COALESCE(to_char(NEW.limit_reset_at, 'DD/MM HH24:MI:SS'), 'desconhecido')
  );

  INSERT INTO public.alerts (type, severity, title, message, metadata)
  VALUES (
    'INTEGRATION_FAILURE'::alert_type,
    v_severity,
    v_title,
    v_message,
    jsonb_build_object(
      'subtype', 'LALAMOVE_QUOTA_LOW',
      'endpoint', NEW.endpoint,
      'method', NEW.method,
      'limit_total', NEW.limit_total,
      'limit_remaining', NEW.limit_remaining,
      'usage_ratio', NEW.usage_ratio,
      'limit_reset_at', NEW.limit_reset_at,
      'request_id', NEW.request_id,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$function$
