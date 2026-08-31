
-- Fix password_reset_tokens: replace overly permissive INSERT policy
-- Only authenticated users should be able to insert their own tokens
DROP POLICY IF EXISTS "System can insert reset tokens" ON public.password_reset_tokens;

CREATE POLICY "Authenticated can insert own reset tokens"
ON public.password_reset_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
