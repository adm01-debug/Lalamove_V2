-- =====================================================
-- MIGRAÇÃO: Corrigir políticas RLS permissivas restantes
-- =====================================================

-- 1. EMAIL_VERIFICATIONS
DROP POLICY IF EXISTS "System can manage verifications" ON public.email_verifications;

CREATE POLICY "System can insert verifications" ON public.email_verifications
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their verifications" ON public.email_verifications
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete verifications" ON public.email_verifications
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. LALAMOVE_STATUS_HISTORY
DROP POLICY IF EXISTS "Authenticated users can insert status history" ON public.lalamove_status_history;
DROP POLICY IF EXISTS "Service role has full access to status history" ON public.lalamove_status_history;

CREATE POLICY "Operators can insert status history" ON public.lalamove_status_history
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can update status history" ON public.lalamove_status_history
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete status history" ON public.lalamove_status_history
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. LALAMOVE_STOPS
DROP POLICY IF EXISTS "Authenticated users can insert stops" ON public.lalamove_stops;
DROP POLICY IF EXISTS "Service role has full access to stops" ON public.lalamove_stops;

CREATE POLICY "Operators can insert stops" ON public.lalamove_stops
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can update stops" ON public.lalamove_stops
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete stops" ON public.lalamove_stops
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. NEW_DEVICE_ALERTS - corrigir política restante
DROP POLICY IF EXISTS "System can manage device alerts" ON public.new_device_alerts;

-- Já tem políticas individuais, remover a ALL

-- 5. TRACKING_EVENTS
DROP POLICY IF EXISTS "Authenticated users can insert tracking events" ON public.tracking_events;
DROP POLICY IF EXISTS "Service role has full access to tracking events" ON public.tracking_events;

CREATE POLICY "Operators can insert tracking events" ON public.tracking_events
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can update tracking events" ON public.tracking_events
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete tracking events" ON public.tracking_events
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. USER_DEVICES - corrigir política system insert
DROP POLICY IF EXISTS "System can insert devices" ON public.user_devices;

-- Já tem política Users can insert their devices

-- 7. RATE_LIMIT_LOGS
DROP POLICY IF EXISTS "System can insert rate limit logs" ON public.rate_limit_logs;

CREATE POLICY "Authenticated can insert rate limit logs" ON public.rate_limit_logs
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'viewer'));

-- 8. PASSWORD_RESET_TOKENS
DROP POLICY IF EXISTS "System can manage reset tokens" ON public.password_reset_tokens;

CREATE POLICY "System can insert reset tokens" ON public.password_reset_tokens
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "System can select reset tokens" ON public.password_reset_tokens
FOR SELECT TO anon
USING (true);

CREATE POLICY "Admins can delete reset tokens" ON public.password_reset_tokens
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 9. WEBAUTHN_CHALLENGES - corrigir políticas anon
DROP POLICY IF EXISTS "Anyone can create challenges" ON public.webauthn_challenges;
DROP POLICY IF EXISTS "Anyone can read challenges" ON public.webauthn_challenges;
DROP POLICY IF EXISTS "System can delete expired challenges" ON public.webauthn_challenges;

CREATE POLICY "Authenticated can create challenges" ON public.webauthn_challenges
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can read own challenges" ON public.webauthn_challenges
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Nota: LOGIN_ATTEMPTS e PASSWORD_RESET_REQUESTS precisam de acesso anon para funcionar antes do login