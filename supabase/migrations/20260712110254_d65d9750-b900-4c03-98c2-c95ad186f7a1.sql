-- tracking_events (partitioned parent -> propagates to all partitions)
ALTER TABLE public.tracking_events
  ADD CONSTRAINT tracking_events_latitude_check  CHECK (latitude  >= -90  AND latitude  <= 90),
  ADD CONSTRAINT tracking_events_longitude_check CHECK (longitude >= -180 AND longitude <= 180),
  ADD CONSTRAINT tracking_events_speed_check     CHECK (speed IS NULL OR speed >= 0),
  ADD CONSTRAINT tracking_events_heading_check   CHECK (heading IS NULL OR (heading >= 0 AND heading <= 360));

-- active_tracking
ALTER TABLE public.active_tracking
  ADD CONSTRAINT active_tracking_curlat_check  CHECK (current_latitude  >= -90  AND current_latitude  <= 90),
  ADD CONSTRAINT active_tracking_curlon_check  CHECK (current_longitude >= -180 AND current_longitude <= 180),
  ADD CONSTRAINT active_tracking_orglat_check  CHECK (origin_lat IS NULL OR (origin_lat >= -90  AND origin_lat <= 90)),
  ADD CONSTRAINT active_tracking_orglng_check  CHECK (origin_lng IS NULL OR (origin_lng >= -180 AND origin_lng <= 180)),
  ADD CONSTRAINT active_tracking_dstlat_check  CHECK (destination_lat IS NULL OR (destination_lat >= -90  AND destination_lat <= 90)),
  ADD CONSTRAINT active_tracking_dstlng_check  CHECK (destination_lng IS NULL OR (destination_lng >= -180 AND destination_lng <= 180)),
  ADD CONSTRAINT active_tracking_speed_check   CHECK (speed IS NULL OR speed >= 0),
  ADD CONSTRAINT active_tracking_heading_check CHECK (heading IS NULL OR (heading >= 0 AND heading <= 360));

-- driver_locations
ALTER TABLE public.driver_locations
  ADD CONSTRAINT driver_locations_latitude_check  CHECK (latitude  >= -90  AND latitude  <= 90),
  ADD CONSTRAINT driver_locations_longitude_check CHECK (longitude >= -180 AND longitude <= 180),
  ADD CONSTRAINT driver_locations_speed_check     CHECK (speed_kmh IS NULL OR speed_kmh >= 0),
  ADD CONSTRAINT driver_locations_accuracy_check  CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
  ADD CONSTRAINT driver_locations_heading_check   CHECK (heading_degrees IS NULL OR (heading_degrees >= 0 AND heading_degrees <= 360));