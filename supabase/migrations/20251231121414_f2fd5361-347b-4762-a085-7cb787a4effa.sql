-- Table to store known user devices
CREATE TABLE public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_fingerprint TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    browser TEXT,
    os TEXT,
    device_name TEXT,
    is_trusted BOOLEAN DEFAULT false,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    location_city TEXT,
    location_country TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, device_fingerprint)
);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Users can only see their own devices
CREATE POLICY "Users can view own devices"
ON public.user_devices
FOR SELECT
USING (auth.uid() = user_id);

-- Users can manage their own devices
CREATE POLICY "Users can manage own devices"
ON public.user_devices
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- System can insert devices
CREATE POLICY "System can insert devices"
ON public.user_devices
FOR INSERT
WITH CHECK (true);

-- Table to store new device login alerts sent
CREATE TABLE public.new_device_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_id UUID REFERENCES public.user_devices(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    email_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.new_device_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view own alerts
CREATE POLICY "Users can view own device alerts"
ON public.new_device_alerts
FOR SELECT
USING (auth.uid() = user_id);

-- System can manage alerts
CREATE POLICY "System can manage device alerts"
ON public.new_device_alerts
FOR ALL
WITH CHECK (true);

-- Function to check if device is known
CREATE OR REPLACE FUNCTION public.is_known_device(_user_id UUID, _fingerprint TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_devices
        WHERE user_id = _user_id
          AND device_fingerprint = _fingerprint
    )
$$;

-- Index for faster lookups
CREATE INDEX idx_user_devices_user_fingerprint ON public.user_devices(user_id, device_fingerprint);
CREATE INDEX idx_user_devices_last_seen ON public.user_devices(last_seen_at DESC);
CREATE INDEX idx_new_device_alerts_user ON public.new_device_alerts(user_id, created_at DESC);