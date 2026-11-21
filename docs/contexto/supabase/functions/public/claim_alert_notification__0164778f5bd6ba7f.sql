CREATE OR REPLACE FUNCTION public.claim_alert_notification(p_dedup_key text, p_alert_type alert_type, p_window_seconds integer)
 RETURNS TABLE(should_send boolean, occurrence_count integer, suppressed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.alert_dedup%ROWTYPE;
BEGIN
  SELECT * INTO v_existing FROM public.alert_dedup WHERE dedup_key = p_dedup_key FOR UPDATE;

  IF v_existing.dedup_key IS NULL THEN
    INSERT INTO public.alert_dedup(dedup_key, alert_type) VALUES (p_dedup_key, p_alert_type);
    RETURN QUERY SELECT true, 1, 0;
    RETURN;
  END IF;

  IF v_existing.last_notified_at > now() - make_interval(secs => GREATEST(p_window_seconds, 0)) THEN
    UPDATE public.alert_dedup d
      SET occurrence_count = d.occurrence_count + 1,
          suppressed_count = d.suppressed_count + 1
      WHERE d.dedup_key = p_dedup_key;
    RETURN QUERY SELECT false, v_existing.occurrence_count + 1, v_existing.suppressed_count + 1;
    RETURN;
  END IF;

  UPDATE public.alert_dedup d
    SET occurrence_count = d.occurrence_count + 1,
        last_notified_at = now()
    WHERE d.dedup_key = p_dedup_key;
  RETURN QUERY SELECT true, v_existing.occurrence_count + 1, v_existing.suppressed_count;
END;
$function$
