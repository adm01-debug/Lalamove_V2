ALTER TABLE public.lalamove_stops
  ADD CONSTRAINT lalamove_stops_stop_index_non_negative CHECK (stop_index >= 0),
  ADD CONSTRAINT lalamove_stops_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT lalamove_stops_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  ADD CONSTRAINT lalamove_stops_pod_status_valid CHECK (pod_status IS NULL OR pod_status IN ('pending', 'delivered', 'failed'));