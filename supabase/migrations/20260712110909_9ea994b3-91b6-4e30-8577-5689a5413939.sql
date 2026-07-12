ALTER TABLE public.lalamove_orders
  ADD CONSTRAINT lalamove_orders_total_cost_nonneg CHECK (total_cost >= 0),
  ADD CONSTRAINT lalamove_orders_distance_nonneg CHECK (distance_meters IS NULL OR distance_meters >= 0),
  ADD CONSTRAINT lalamove_orders_delay_nonneg CHECK (delay_minutes IS NULL OR delay_minutes >= 0),
  ADD CONSTRAINT lalamove_orders_duration_nonneg CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  ADD CONSTRAINT lalamove_orders_stalled_threshold_nonneg CHECK (stalled_threshold_minutes IS NULL OR stalled_threshold_minutes >= 0),
  ADD CONSTRAINT lalamove_orders_route_dev_threshold_nonneg CHECK (route_deviation_threshold_minutes IS NULL OR route_deviation_threshold_minutes >= 0),
  ADD CONSTRAINT lalamove_orders_rating_range CHECK (custom_rating IS NULL OR (custom_rating >= 0 AND custom_rating <= 5)),
  ADD CONSTRAINT lalamove_orders_pickup_lat_range CHECK (pickup_latitude IS NULL OR (pickup_latitude >= -90 AND pickup_latitude <= 90)),
  ADD CONSTRAINT lalamove_orders_pickup_lng_range CHECK (pickup_longitude IS NULL OR (pickup_longitude >= -180 AND pickup_longitude <= 180)),
  ADD CONSTRAINT lalamove_orders_delivery_lat_range CHECK (delivery_latitude IS NULL OR (delivery_latitude >= -90 AND delivery_latitude <= 90)),
  ADD CONSTRAINT lalamove_orders_delivery_lng_range CHECK (delivery_longitude IS NULL OR (delivery_longitude >= -180 AND delivery_longitude <= 180));