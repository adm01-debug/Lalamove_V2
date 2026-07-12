ALTER TABLE public.alert_configurations
  ADD CONSTRAINT alert_configurations_min_interval_non_negative
  CHECK (min_interval_seconds IS NULL OR min_interval_seconds >= 0);