-- Otimização de observabilidade e manutenção do dedup de alertas.
-- Simulação de ~200 cenários: consultas por janela temporal (dashboards de supressão),
-- limpeza periódica de linhas antigas e análises por tipo de alerta.
-- O lookup por dedup_key na claim_alert_notification já é coberto pela PK/UNIQUE.

CREATE INDEX IF NOT EXISTS idx_alert_dedup_type_notified
  ON public.alert_dedup (alert_type, last_notified_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_dedup_suppressed
  ON public.alert_dedup (last_notified_at DESC)
  WHERE suppressed_count > 0;