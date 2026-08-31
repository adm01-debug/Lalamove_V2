-- 1. Fix email_verifications: enforce ownership on INSERT
DROP POLICY IF EXISTS "System can insert verifications" ON public.email_verifications;

CREATE POLICY "Users can insert own verifications"
ON public.email_verifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Fix login_attempts: remove anon INSERT capability entirely
-- Server-side should use service_role key which bypasses RLS
DROP POLICY IF EXISTS "System can insert login attempts" ON public.login_attempts;

CREATE POLICY "Admins can insert login attempts"
ON public.login_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- 3. Fix password_reset_requests: validate user_email belongs to auth.uid()
DROP POLICY IF EXISTS "Authenticated users can request password reset" ON public.password_reset_requests;

CREATE POLICY "Users can request own password reset"
ON public.password_reset_requests
FOR INSERT
TO authenticated
WITH CHECK (
  user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- 4. Revoke anon access from PII views
REVOKE SELECT ON public.drivers_safe_view FROM anon;
REVOKE SELECT ON public.orders_safe_view FROM anon;
REVOKE SELECT ON public.orders_operator_view FROM anon;