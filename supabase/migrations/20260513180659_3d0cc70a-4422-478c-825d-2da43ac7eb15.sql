-- 1. Backup permissions/policies
-- (Policies will be recreated manually below)

-- 2. Rename existing empty table
ALTER TABLE public.tracking_events RENAME TO tracking_events_old;

-- 3. Create partitioned table
CREATE TABLE public.tracking_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.lalamove_orders(id),
    driver_id UUID NOT NULL REFERENCES public.drivers(id),
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    heading NUMERIC,
    speed NUMERIC,
    event_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 4. Create indexes (now on the parent table)
CREATE INDEX idx_tracking_events_order_id ON public.tracking_events (order_id);
CREATE INDEX idx_tracking_events_created_at ON public.tracking_events (created_at DESC);

-- 5. Create partitions for 2026 (assuming current date is around May 2026 based on context)
CREATE TABLE public.tracking_events_y2026m05 PARTITION OF public.tracking_events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE public.tracking_events_y2026m06 PARTITION OF public.tracking_events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE public.tracking_events_y2026m07 PARTITION OF public.tracking_events
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE public.tracking_events_y2026m08 PARTITION OF public.tracking_events
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE public.tracking_events_y2026m09 PARTITION OF public.tracking_events
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE public.tracking_events_y2026m10 PARTITION OF public.tracking_events
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

-- 6. Enable RLS
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- 7. Recreate Policies
CREATE POLICY "Users can view tracking for their orders"
ON public.tracking_events FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert tracking events"
ON public.tracking_events FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 8. Cleanup
DROP TABLE public.tracking_events_old;
