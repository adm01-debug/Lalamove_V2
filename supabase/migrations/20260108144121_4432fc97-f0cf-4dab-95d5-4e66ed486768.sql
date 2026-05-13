-- =====================================================
-- MIGRAÇÃO: Corrigir políticas RLS permissivas
-- Substituir (true) por verificações de role
-- =====================================================

-- 1. ACTIVE_TRACKING
DROP POLICY IF EXISTS "Authenticated users can manage tracking" ON public.active_tracking;
DROP POLICY IF EXISTS "Service role has full access to tracking" ON public.active_tracking;

CREATE POLICY "Managers can insert tracking" ON public.active_tracking
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can update tracking" ON public.active_tracking
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Admins can delete tracking" ON public.active_tracking
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 2. ALERT_CONFIGURATIONS
DROP POLICY IF EXISTS "Authenticated users can manage alert configs" ON public.alert_configurations;
DROP POLICY IF EXISTS "Service role has full access to alert configs" ON public.alert_configurations;

CREATE POLICY "Managers can insert alert configs" ON public.alert_configurations
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update alert configs" ON public.alert_configurations
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete alert configs" ON public.alert_configurations
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. ALERTS
DROP POLICY IF EXISTS "Authenticated users can manage alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role has full access to alerts" ON public.alerts;

CREATE POLICY "Operators can insert alerts" ON public.alerts
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Operators can update alerts" ON public.alerts
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can delete alerts" ON public.alerts
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 4. ALERTS_SENT
DROP POLICY IF EXISTS "Authenticated users can manage alerts sent" ON public.alerts_sent;
DROP POLICY IF EXISTS "Service role has full access to alerts sent" ON public.alerts_sent;

CREATE POLICY "System can insert alerts sent" ON public.alerts_sent
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can update alerts sent" ON public.alerts_sent
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete alerts sent" ON public.alerts_sent
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. AUTH_LOGS
DROP POLICY IF EXISTS "System can insert auth logs" ON public.auth_logs;

CREATE POLICY "Authenticated can insert auth logs" ON public.auth_logs
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'viewer'));

-- 6. BITRIX24_ACTIVITIES
DROP POLICY IF EXISTS "Authenticated users can manage activities" ON public.bitrix24_activities;

CREATE POLICY "Managers can insert activities" ON public.bitrix24_activities
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update activities" ON public.bitrix24_activities
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete activities" ON public.bitrix24_activities
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 7. BITRIX24_STAGE_MAPPINGS
DROP POLICY IF EXISTS "Authenticated users can manage stage mappings" ON public.bitrix24_stage_mappings;

CREATE POLICY "Managers can insert stage mappings" ON public.bitrix24_stage_mappings
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update stage mappings" ON public.bitrix24_stage_mappings
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete stage mappings" ON public.bitrix24_stage_mappings
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. BITRIX24_SYNC
DROP POLICY IF EXISTS "Authenticated users can manage sync data" ON public.bitrix24_sync;

CREATE POLICY "Operators can insert sync data" ON public.bitrix24_sync
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Operators can update sync data" ON public.bitrix24_sync
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can delete sync data" ON public.bitrix24_sync
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 9. BITRIX24_TOKENS
DROP POLICY IF EXISTS "Authenticated users can manage tokens" ON public.bitrix24_tokens;

CREATE POLICY "Admins can insert tokens" ON public.bitrix24_tokens
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tokens" ON public.bitrix24_tokens
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tokens" ON public.bitrix24_tokens
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 10. DRIVER_APPROVAL_QUEUE
DROP POLICY IF EXISTS "Authenticated users can manage approvals" ON public.driver_approval_queue;
DROP POLICY IF EXISTS "Service role has full access to approvals" ON public.driver_approval_queue;

CREATE POLICY "Managers can insert approvals" ON public.driver_approval_queue
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update approvals" ON public.driver_approval_queue
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete approvals" ON public.driver_approval_queue
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 11. DRIVER_EVALUATIONS
DROP POLICY IF EXISTS "Authenticated users can insert evaluations" ON public.driver_evaluations;
DROP POLICY IF EXISTS "Service role has full access to evaluations" ON public.driver_evaluations;

CREATE POLICY "Operators can insert evaluations" ON public.driver_evaluations
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can update evaluations" ON public.driver_evaluations
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete evaluations" ON public.driver_evaluations
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 12. DRIVER_INCIDENTS
DROP POLICY IF EXISTS "Authenticated users can insert incidents" ON public.driver_incidents;
DROP POLICY IF EXISTS "Service role has full access to incidents" ON public.driver_incidents;

CREATE POLICY "Operators can insert incidents" ON public.driver_incidents
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can update incidents" ON public.driver_incidents
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete incidents" ON public.driver_incidents
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 13. DRIVER_LOCATIONS
DROP POLICY IF EXISTS "Service role has full access to driver locations" ON public.driver_locations;

CREATE POLICY "Operators can insert driver locations" ON public.driver_locations
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Operators can update driver locations" ON public.driver_locations
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can delete driver locations" ON public.driver_locations
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 14. DRIVERS
DROP POLICY IF EXISTS "Authenticated users can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Service role has full access to drivers" ON public.drivers;

CREATE POLICY "Managers can insert drivers" ON public.drivers
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update drivers" ON public.drivers
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete drivers" ON public.drivers
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 15. GEO_BLOCKS
DROP POLICY IF EXISTS "Authenticated users can manage geo blocks" ON public.geo_blocks;

CREATE POLICY "Admins can insert geo blocks" ON public.geo_blocks
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update geo blocks" ON public.geo_blocks
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete geo blocks" ON public.geo_blocks
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 16. IP_WHITELIST
DROP POLICY IF EXISTS "Authenticated users can manage whitelist" ON public.ip_whitelist;

CREATE POLICY "Admins can insert whitelist" ON public.ip_whitelist
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update whitelist" ON public.ip_whitelist
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete whitelist" ON public.ip_whitelist
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 17. LALAMOVE_ORDERS
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON public.lalamove_orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.lalamove_orders;
DROP POLICY IF EXISTS "Service role has full access to orders" ON public.lalamove_orders;

CREATE POLICY "Operators can insert orders" ON public.lalamove_orders
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Operators can update orders" ON public.lalamove_orders
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can delete orders" ON public.lalamove_orders
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 18. MFA_SESSIONS
DROP POLICY IF EXISTS "Users can manage their MFA sessions" ON public.mfa_sessions;

CREATE POLICY "Users can insert their MFA sessions" ON public.mfa_sessions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their MFA sessions" ON public.mfa_sessions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their MFA sessions" ON public.mfa_sessions
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 19. NEW_DEVICE_ALERTS
DROP POLICY IF EXISTS "Service role can manage device alerts" ON public.new_device_alerts;

CREATE POLICY "Users can insert their device alerts" ON public.new_device_alerts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their device alerts" ON public.new_device_alerts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their device alerts" ON public.new_device_alerts
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 20. PERMISSIONS
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.permissions;

CREATE POLICY "Admins can insert permissions" ON public.permissions
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update permissions" ON public.permissions
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete permissions" ON public.permissions
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 21. RISK_RULES
DROP POLICY IF EXISTS "Authenticated users can manage risk rules" ON public.risk_rules;

CREATE POLICY "Managers can insert risk rules" ON public.risk_rules
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update risk rules" ON public.risk_rules
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete risk rules" ON public.risk_rules
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 22. ROLE_PERMISSIONS
DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;

CREATE POLICY "Admins can insert role permissions" ON public.role_permissions
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update role permissions" ON public.role_permissions
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete role permissions" ON public.role_permissions
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 23. USER_DEVICES
DROP POLICY IF EXISTS "Users can manage their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Service role can manage all devices" ON public.user_devices;

CREATE POLICY "Users can insert their devices" ON public.user_devices
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their devices" ON public.user_devices
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their devices" ON public.user_devices
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 24. USER_PASSKEYS
DROP POLICY IF EXISTS "Users can manage their passkeys" ON public.user_passkeys;

CREATE POLICY "Users can insert their passkeys" ON public.user_passkeys
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their passkeys" ON public.user_passkeys
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their passkeys" ON public.user_passkeys
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 25. USER_ROLES
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Admins can insert user roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 26. WEBAUTHN_CHALLENGES
DROP POLICY IF EXISTS "Users can manage their challenges" ON public.webauthn_challenges;

CREATE POLICY "Users can insert their challenges" ON public.webauthn_challenges
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their challenges" ON public.webauthn_challenges
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their challenges" ON public.webauthn_challenges
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 27. WEBHOOK_EVENTS
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.webhook_events;
DROP POLICY IF EXISTS "Service role has full access to events" ON public.webhook_events;

CREATE POLICY "Operators can insert events" ON public.webhook_events
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator'));

CREATE POLICY "Managers can update events" ON public.webhook_events
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can delete events" ON public.webhook_events
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));