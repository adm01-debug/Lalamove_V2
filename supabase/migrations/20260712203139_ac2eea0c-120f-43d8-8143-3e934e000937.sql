-- Menor privilégio: revogar EXECUTE de anon/authenticated em funções internas.
-- Estratégia defensiva: revoga explicitamente por assinatura exata.

-- 1) Funções de MANUTENÇÃO/CRON: revogar de anon + authenticated (só service_role/cron)
REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_tokens() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_cron_logs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_daily_cleanup() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_daily_cleanup_with_logging() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_rls_security_audit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.test_rls_policies() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_tracking_partitions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_tracking_events_partitions(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_tracking_events_partition(date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_contract_usage(text, text, boolean) FROM anon, authenticated;

-- 2) Funções de GATILHO (executam como owner; nunca chamadas diretamente): revogar de anon + authenticated
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_bitrix24_sync() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invalidate_old_tokens() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_token_expiration() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sanitize_auth_log_metadata() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_mfa_session() FROM anon, authenticated;

-- 3) Funções administrativas por RPC: manter authenticated (já checam has_role internamente), revogar de anon
REVOKE EXECUTE ON FUNCTION public.get_contract_v1_sunset_readiness(integer, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cron_jobs_health(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_active_uapi_token() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_aal2() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_known_device(uuid, text) FROM anon;

-- Observação: funções de fluxo pré-login (check_login_lockout*, record_failed_login*,
-- clear_login_attempts, use_reset_token, is_token_valid) e funções usadas em RLS
-- (has_role, has_permission, is_ip_whitelisted, is_country_blocked, is_ip_blocked)
-- mantêm seus grants por serem legitimamente necessárias.