
-- Fix RLS policies: change from public role to authenticated role

-- user_passkeys
DROP POLICY IF EXISTS "Users can view own passkeys" ON public.user_passkeys;
DROP POLICY IF EXISTS "Users can insert own passkeys" ON public.user_passkeys;
DROP POLICY IF EXISTS "Users can update own passkeys" ON public.user_passkeys;
DROP POLICY IF EXISTS "Users can delete own passkeys" ON public.user_passkeys;

CREATE POLICY "Users can view own passkeys" ON public.user_passkeys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own passkeys" ON public.user_passkeys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own passkeys" ON public.user_passkeys FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own passkeys" ON public.user_passkeys FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- mfa_sessions
DROP POLICY IF EXISTS "Users can manage own MFA sessions" ON public.mfa_sessions;
CREATE POLICY "Users can manage own MFA sessions" ON public.mfa_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_devices
DROP POLICY IF EXISTS "Users can manage own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can view own devices" ON public.user_devices;
CREATE POLICY "Users can manage own devices" ON public.user_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own devices" ON public.user_devices FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- new_device_alerts
DROP POLICY IF EXISTS "Users can view own device alerts" ON public.new_device_alerts;
CREATE POLICY "Users can view own device alerts" ON public.new_device_alerts FOR SELECT TO authenticated USING (auth.uid() = user_id);
