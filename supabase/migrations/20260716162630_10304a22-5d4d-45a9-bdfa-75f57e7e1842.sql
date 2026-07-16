CREATE INDEX idx_driver_incidents_driver_created ON public.driver_incidents USING btree (driver_id, created_at DESC);
DROP INDEX IF EXISTS public.idx_incidents_driver;