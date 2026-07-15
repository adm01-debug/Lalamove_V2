CREATE INDEX IF NOT EXISTS idx_alert_configurations_escalation_lookup
  ON public.alert_configurations (alert_type)
  INCLUDE (escalation_after_seconds)
  WHERE is_enabled = true AND escalation_enabled = true;