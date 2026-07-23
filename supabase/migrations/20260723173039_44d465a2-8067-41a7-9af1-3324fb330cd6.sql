CREATE INDEX IF NOT EXISTS idx_alerts_pending_escalation
ON public.alerts (type, created_at)
WHERE acknowledged_at IS NULL
  AND escalated_at IS NULL
  AND is_dismissed = false
  AND severity IN ('CRITICAL','WARNING');