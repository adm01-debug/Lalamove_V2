ALTER TABLE public.driver_evaluations
  ADD CONSTRAINT driver_evaluations_risk_score_range CHECK (risk_score >= 0 AND risk_score <= 100),
  ADD CONSTRAINT driver_evaluations_failure_rate_range CHECK (failure_rate IS NULL OR (failure_rate >= 0 AND failure_rate <= 1)),
  ADD CONSTRAINT driver_evaluations_total_deliveries_non_negative CHECK (total_deliveries IS NULL OR total_deliveries >= 0),
  ADD CONSTRAINT driver_evaluations_completed_deliveries_non_negative CHECK (completed_deliveries IS NULL OR completed_deliveries >= 0),
  ADD CONSTRAINT driver_evaluations_incident_count_non_negative CHECK (incident_count IS NULL OR incident_count >= 0),
  ADD CONSTRAINT driver_evaluations_completed_lte_total CHECK (completed_deliveries IS NULL OR total_deliveries IS NULL OR completed_deliveries <= total_deliveries);