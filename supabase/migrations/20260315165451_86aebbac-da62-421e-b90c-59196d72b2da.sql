
-- Table to store UAPI session tokens with auto-refresh
CREATE TABLE public.lalamove_uapi_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  user_fid text,
  ep_role integer DEFAULT 1,
  city_id integer DEFAULT 21001,
  token_obtained_at timestamptz NOT NULL DEFAULT now(),
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  last_refreshed_at timestamptz,
  refresh_method text DEFAULT 'manual',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Only one active session at a time
CREATE UNIQUE INDEX idx_uapi_sessions_active ON public.lalamove_uapi_sessions (is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.lalamove_uapi_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage UAPI sessions
CREATE POLICY "Admins can manage UAPI sessions"
ON public.lalamove_uapi_sessions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Function to get active token
CREATE OR REPLACE FUNCTION public.get_active_uapi_token()
RETURNS TABLE(access_token text, refresh_token text, user_fid text, token_age_hours numeric, needs_refresh boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    s.access_token,
    s.refresh_token,
    s.user_fid,
    EXTRACT(EPOCH FROM (now() - s.token_obtained_at)) / 3600 AS token_age_hours,
    EXTRACT(EPOCH FROM (now() - s.token_obtained_at)) / 3600 > 20 AS needs_refresh
  FROM public.lalamove_uapi_sessions s
  WHERE s.is_active = true
  LIMIT 1;
$$;
