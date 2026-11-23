CREATE OR REPLACE FUNCTION public.record_messaging_usage(p_channel text, p_provider text, p_messages integer DEFAULT 1, p_segments integer DEFAULT 1, p_cost_cents integer DEFAULT 0, p_day date DEFAULT NULL::date)
 RETURNS messaging_usage
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v public.messaging_usage;
BEGIN
  INSERT INTO messaging_usage (day, channel, provider, messages, segments, cost_cents)
  VALUES (
    COALESCE(p_day, (now() AT TIME ZONE 'America/Sao_Paulo')::date),
    p_channel, p_provider,
    GREATEST(COALESCE(p_messages, 0), 0),
    GREATEST(COALESCE(p_segments, 0), 0),
    GREATEST(COALESCE(p_cost_cents, 0), 0)
  )
  ON CONFLICT (day, channel, provider) DO UPDATE
    SET messages   = messaging_usage.messages   + EXCLUDED.messages,
        segments   = messaging_usage.segments   + EXCLUDED.segments,
        cost_cents = messaging_usage.cost_cents + EXCLUDED.cost_cents,
        updated_at = now()
  RETURNING * INTO v;
  RETURN v;
END; $function$
