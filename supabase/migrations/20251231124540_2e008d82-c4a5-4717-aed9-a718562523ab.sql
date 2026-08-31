-- Create table for storing WebAuthn credentials (Passkeys)
CREATE TABLE public.user_passkeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN DEFAULT false,
  transports TEXT[],
  friendly_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT user_passkeys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX idx_user_passkeys_user_id ON public.user_passkeys(user_id);
CREATE INDEX idx_user_passkeys_credential_id ON public.user_passkeys(credential_id);

-- Enable RLS
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own passkeys"
  ON public.user_passkeys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own passkeys"
  ON public.user_passkeys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own passkeys"
  ON public.user_passkeys
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own passkeys"
  ON public.user_passkeys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create table for WebAuthn challenges (temporary storage)
CREATE TABLE public.webauthn_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for cleanup
CREATE INDEX idx_webauthn_challenges_expires ON public.webauthn_challenges(expires_at);

-- Enable RLS
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Challenges can be created and read by anyone (needed for registration/auth flow)
CREATE POLICY "Anyone can create challenges"
  ON public.webauthn_challenges
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read challenges"
  ON public.webauthn_challenges
  FOR SELECT
  USING (true);

CREATE POLICY "System can delete expired challenges"
  ON public.webauthn_challenges
  FOR DELETE
  USING (true);