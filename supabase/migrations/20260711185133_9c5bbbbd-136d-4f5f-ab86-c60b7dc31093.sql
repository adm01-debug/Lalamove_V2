CREATE POLICY "Allow authenticated users to view tracking"
  ON public.tracking_events_default FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view tracking"
  ON public.tracking_events_y2026m05 FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view tracking"
  ON public.tracking_events_y2026m06 FOR SELECT
  USING (auth.role() = 'authenticated');