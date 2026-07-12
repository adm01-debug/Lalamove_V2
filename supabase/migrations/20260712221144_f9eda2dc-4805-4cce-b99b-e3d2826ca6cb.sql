-- 1. Escalation & fallback columns on alert_configurations
ALTER TABLE public.alert_configurations
  ADD COLUMN IF NOT EXISTS dedup_window_seconds integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS escalation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_after_seconds integer NOT NULL DEFAULT 900,
  ADD COLUMN IF NOT EXISTS escalation_email_addresses text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS escalation_whatsapp_numbers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS escalation_slack_channels text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fallback_channel text,
  ADD COLUMN IF NOT EXISTS fallback_recipients text[] DEFAULT '{}';

ALTER TABLE public.alert_configurations
  DROP CONSTRAINT IF EXISTS alert_configurations_dedup_window_non_negative;
ALTER TABLE public.alert_configurations
  ADD CONSTRAINT alert_configurations_dedup_window_non_negative
  CHECK (dedup_window_seconds >= 0);
ALTER TABLE public.alert_configurations
  DROP CONSTRAINT IF EXISTS alert_configurations_escalation_after_positive;
ALTER TABLE public.alert_configurations
  ADD CONSTRAINT alert_configurations_escalation_after_positive
  CHECK (escalation_after_seconds > 0);
ALTER TABLE public.alert_configurations
  DROP CONSTRAINT IF EXISTS alert_configurations_fallback_channel_valid;
ALTER TABLE public.alert_configurations
  ADD CONSTRAINT alert_configurations_fallback_channel_valid
  CHECK (fallback_channel IS NULL OR fallback_channel IN ('whatsapp','email','slack','sms','bitrix24','n8n'));

-- 2. Acknowledgement / escalation lifecycle on alerts
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_alerts_pending_escalation
  ON public.alerts (severity, created_at)
  WHERE acknowledged_at IS NULL AND escalated_at IS NULL AND is_dismissed = false;

-- 3. Deduplication ledger
CREATE TABLE IF NOT EXISTS public.alert_dedup (
  dedup_key text PRIMARY KEY,
  alert_type alert_type NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  occurrence_count integer NOT NULL DEFAULT 1,
  suppressed_count integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.alert_dedup TO authenticated;
GRANT ALL ON public.alert_dedup TO service_role;
ALTER TABLE public.alert_dedup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authorized roles can view alert dedup" ON public.alert_dedup;
CREATE POLICY "Authorized roles can view alert dedup" ON public.alert_dedup
  FOR SELECT USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE INDEX IF NOT EXISTS idx_alert_dedup_last_notified ON public.alert_dedup (last_notified_at);

-- 4. Atomic dedup claim function
CREATE OR REPLACE FUNCTION public.claim_alert_notification(
  p_dedup_key text,
  p_alert_type alert_type,
  p_window_seconds integer
)
RETURNS TABLE(should_send boolean, occurrence_count integer, suppressed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    UPDATE public.alert_dedup
      SET occurrence_count = occurrence_count + 1,
          suppressed_count = suppressed_count + 1
      WHERE dedup_key = p_dedup_key;
    RETURN QUERY SELECT false, v_existing.occurrence_count + 1, v_existing.suppressed_count + 1;
    RETURN;
  END IF;

  UPDATE public.alert_dedup
    SET occurrence_count = occurrence_count + 1,
        last_notified_at = now()
    WHERE dedup_key = p_dedup_key;
  RETURN QUERY SELECT true, v_existing.occurrence_count + 1, v_existing.suppressed_count;
END;
$$;

-- 5. Pending escalations reader (admin/manager only) used by worker via service_role
CREATE OR REPLACE FUNCTION public.get_pending_escalations()
RETURNS TABLE(
  alert_id uuid,
  alert_type alert_type,
  severity alert_severity,
  title text,
  message text,
  order_id uuid,
  driver_id uuid,
  created_at timestamptz,
  escalation_after_seconds integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.type, a.severity, a.title, a.message, a.order_id, a.driver_id, a.created_at,
         COALESCE(c.escalation_after_seconds, 900)
  FROM public.alerts a
  JOIN public.alert_configurations c
    ON c.alert_type = a.type AND c.is_enabled = true AND c.escalation_enabled = true
  WHERE a.acknowledged_at IS NULL
    AND a.escalated_at IS NULL
    AND a.is_dismissed = false
    AND a.severity IN ('CRITICAL','WARNING')
    AND a.created_at < now() - make_interval(secs => COALESCE(c.escalation_after_seconds, 900));
$$;

-- 6. Acknowledge helper
CREATE OR REPLACE FUNCTION public.acknowledge_alert(p_alert_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'operator')) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  UPDATE public.alerts
    SET acknowledged_at = now(), acknowledged_by = auth.uid(), is_read = true
    WHERE id = p_alert_id AND acknowledged_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;