-- Habilita Realtime para as 4 tabelas de segurança usadas em
-- src/hooks/useSecurityPushNotifications.ts. Sem esta publicação as
-- assinaturas postgres_changes retornam silenciosamente zero eventos.
ALTER PUBLICATION supabase_realtime ADD TABLE public.new_device_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_ips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auth_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mfa_sessions;
