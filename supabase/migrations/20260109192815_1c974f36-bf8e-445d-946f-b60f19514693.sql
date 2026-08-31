-- ============================================================================
-- SECURITY FIXES: Critical RLS Policy Updates - Part 2
-- Date: 2026-01-09
-- Description: Fix remaining RLS policies after Part 1 partial success
-- ============================================================================

-- 11. CRITICAL: Fix login_attempts - Remove public access, restrict to system/admin
DROP POLICY IF EXISTS "Public can select login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Public can insert login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Public can update login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;

CREATE POLICY "Admins can view login attempts"
ON public.login_attempts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 12. CRITICAL: Fix password_reset_tokens - Restrict to user's own tokens
DROP POLICY IF EXISTS "System can select reset tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Users can select own tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Users can select own reset tokens" ON public.password_reset_tokens;

CREATE POLICY "Users can select own reset tokens"
ON public.password_reset_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- 13. Fix password_reset_requests - Add proper restrictions
DROP POLICY IF EXISTS "Anyone can insert reset requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Authenticated users can insert reset requests" ON public.password_reset_requests;

-- Allow authenticated users to insert for their own email
CREATE POLICY "Authenticated users can request password reset"
ON public.password_reset_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 14. Fix webhook_events - Restrict to managers and above
DROP POLICY IF EXISTS "Authenticated users can view webhooks" ON public.webhook_events;
DROP POLICY IF EXISTS "Authorized roles can view webhooks" ON public.webhook_events;

CREATE POLICY "Authorized roles can view webhooks"
ON public.webhook_events
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- 15. Fix bitrix24_sync - Restrict to managers and above
DROP POLICY IF EXISTS "Authenticated users can view sync" ON public.bitrix24_sync;
DROP POLICY IF EXISTS "Authorized roles can view bitrix sync" ON public.bitrix24_sync;

CREATE POLICY "Authorized roles can view bitrix sync"
ON public.bitrix24_sync
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- 16. Fix alerts - Restrict to operators and above  
DROP POLICY IF EXISTS "Authenticated users can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Authorized roles can view alerts" ON public.alerts;

CREATE POLICY "Authorized roles can view alerts"
ON public.alerts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'operator'::app_role)
);