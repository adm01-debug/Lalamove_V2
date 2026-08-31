ALTER TABLE public.driver_incidents
  ADD CONSTRAINT driver_incidents_resolution_consistency
  CHECK (
    (resolved IS NOT TRUE AND resolved_at IS NULL)
    OR (resolved IS TRUE)
  );