-- 1. Partition tracking_events
DROP TABLE IF EXISTS public.tracking_events;

CREATE TABLE public.tracking_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    order_id UUID,
    driver_id UUID,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    heading NUMERIC,
    speed NUMERIC,
    event_type TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create initial partitions (e.g., for the next 12 months)
CREATE TABLE public.tracking_events_y2026m05 PARTITION OF public.tracking_events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE public.tracking_events_y2026m06 PARTITION OF public.tracking_events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE public.tracking_events_default PARTITION OF public.tracking_events DEFAULT;

-- 2. Composite Indices
CREATE INDEX idx_tracking_order_created ON public.tracking_events (order_id, created_at);
CREATE INDEX idx_tracking_driver_created ON public.tracking_events (driver_id, created_at);

-- 3. Enable RLS on tracking_events
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view tracking" 
ON public.tracking_events FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Setup pgTAP (if extensions are available)
-- Note: In Supabase, pgTAP is usually available in the extensions schema
-- CREATE EXTENSION IF NOT EXISTS pgtap SCHEMA extensions;

-- Example of RLS Test Function (pgTAP style)
CREATE OR REPLACE FUNCTION public.test_rls_policies()
RETURNS SETOF TEXT AS $$
BEGIN
    RETURN NEXT has_table('public', 'drivers', 'Table drivers should exist');
    RETURN NEXT has_table('public', 'lalamove_orders', 'Table lalamove_orders should exist');
    
    -- Test RLS enabled
    RETURN NEXT is_rls_enabled('public', 'drivers', 'RLS should be enabled on drivers');
    RETURN NEXT is_rls_enabled('public', 'lalamove_orders', 'RLS should be enabled on lalamove_orders');
    
    -- Here we would add more complex pgTAP tests if needed
END;
$$ LANGUAGE plpgsql;
