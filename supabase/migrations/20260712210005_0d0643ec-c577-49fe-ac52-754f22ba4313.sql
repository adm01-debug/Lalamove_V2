-- Least-privilege hardening: revoke direct EXECUTE from anon/authenticated
-- on internal trigger + maintenance SECURITY DEFINER functions.
-- These are invoked by the DB (triggers) or by cron/service_role only.

-- Trigger functions (never called directly by clients)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invalidate_old_tokens() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_mfa_session() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_token_expiration() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_auth_log_metadata() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_bitrix24_sync() FROM anon, authenticated;

-- Maintenance / cron routines (invoked by scheduled jobs as service_role/owner)
REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_rls_security_audit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_daily_cleanup_with_logging() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_tracking_partitions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_tracking_events_partitions(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_tokens() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_cron_logs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_daily_cleanup() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_tracking_events_partition(date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_contract_usage(text, text, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.test_rls_policies() FROM anon, authenticated;