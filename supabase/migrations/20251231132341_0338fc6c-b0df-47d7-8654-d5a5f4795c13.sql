-- Create table to track failed login attempts
CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address inet,
  attempt_count integer NOT NULL DEFAULT 1,
  first_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  locked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_locked_until ON public.login_attempts(locked_until);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for recording failed attempts before auth)
CREATE POLICY "Anyone can insert login attempts"
ON public.login_attempts
FOR INSERT
WITH CHECK (true);

-- Allow anyone to select (for checking lockout status before auth)
CREATE POLICY "Anyone can check login attempts"
ON public.login_attempts
FOR SELECT
USING (true);

-- Allow anyone to update (for incrementing attempts)
CREATE POLICY "Anyone can update login attempts"
ON public.login_attempts
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow admins to delete
CREATE POLICY "Admins can delete login attempts"
ON public.login_attempts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to check if account is locked and get remaining time
CREATE OR REPLACE FUNCTION public.check_login_lockout(p_email text)
RETURNS TABLE (
  is_locked boolean,
  remaining_seconds integer,
  attempt_count integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record login_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_record
  FROM login_attempts
  WHERE email = lower(p_email)
  ORDER BY last_attempt_at DESC
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  -- Reset if first attempt was more than 24 hours ago
  IF v_record.first_attempt_at < now() - interval '24 hours' THEN
    DELETE FROM login_attempts WHERE email = lower(p_email);
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  -- Check if currently locked
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > now() THEN
    RETURN QUERY SELECT 
      true,
      EXTRACT(EPOCH FROM (v_record.locked_until - now()))::integer,
      v_record.attempt_count;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 0, v_record.attempt_count;
END;
$$;

-- Function to record failed login attempt with exponential backoff
CREATE OR REPLACE FUNCTION public.record_failed_login(p_email text, p_ip_address inet DEFAULT NULL)
RETURNS TABLE (
  is_now_locked boolean,
  lockout_seconds integer,
  total_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record login_attempts%ROWTYPE;
  v_new_count integer;
  v_lockout_duration interval;
BEGIN
  SELECT * INTO v_record
  FROM login_attempts
  WHERE email = lower(p_email)
  ORDER BY last_attempt_at DESC
  LIMIT 1;

  -- Reset if first attempt was more than 24 hours ago
  IF v_record IS NOT NULL AND v_record.first_attempt_at < now() - interval '24 hours' THEN
    DELETE FROM login_attempts WHERE email = lower(p_email);
    v_record := NULL;
  END IF;

  IF v_record IS NULL THEN
    -- First failed attempt
    INSERT INTO login_attempts (email, ip_address, attempt_count)
    VALUES (lower(p_email), p_ip_address, 1);
    
    RETURN QUERY SELECT false, 0, 1;
    RETURN;
  END IF;

  v_new_count := v_record.attempt_count + 1;

  -- Calculate exponential lockout after 5 attempts
  -- 5 attempts: 30 seconds
  -- 6 attempts: 1 minute
  -- 7 attempts: 2 minutes
  -- 8 attempts: 4 minutes
  -- 9 attempts: 8 minutes
  -- 10+ attempts: 15 minutes max
  IF v_new_count >= 5 THEN
    v_lockout_duration := (30 * power(2, LEAST(v_new_count - 5, 5)))::integer * interval '1 second';
    IF v_lockout_duration > interval '15 minutes' THEN
      v_lockout_duration := interval '15 minutes';
    END IF;
    
    UPDATE login_attempts
    SET 
      attempt_count = v_new_count,
      last_attempt_at = now(),
      locked_until = now() + v_lockout_duration,
      ip_address = COALESCE(p_ip_address, login_attempts.ip_address)
    WHERE id = v_record.id;
    
    RETURN QUERY SELECT 
      true, 
      EXTRACT(EPOCH FROM v_lockout_duration)::integer,
      v_new_count;
    RETURN;
  END IF;

  -- Not yet at lockout threshold
  UPDATE login_attempts
  SET 
    attempt_count = v_new_count,
    last_attempt_at = now(),
    ip_address = COALESCE(p_ip_address, login_attempts.ip_address)
  WHERE id = v_record.id;

  RETURN QUERY SELECT false, 0, v_new_count;
END;
$$;

-- Function to clear login attempts on successful login
CREATE OR REPLACE FUNCTION public.clear_login_attempts(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM login_attempts WHERE email = lower(p_email);
END;
$$;