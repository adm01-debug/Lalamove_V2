-- Composite index for driver playback queries: filter by tracking_id + order by recorded_at DESC.
-- Eliminates the sort step observed in EXPLAIN ANALYZE and replaces the single-column
-- idx_driver_locations_tracking (which only helped the filter, not the ordering).
CREATE INDEX IF NOT EXISTS idx_driver_locations_tracking_recorded
  ON public.driver_locations (tracking_id, recorded_at DESC);

DROP INDEX IF EXISTS public.idx_driver_locations_tracking;