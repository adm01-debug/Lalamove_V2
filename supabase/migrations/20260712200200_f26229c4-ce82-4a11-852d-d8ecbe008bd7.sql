-- Funções internas de manutenção/telemetria/triggers e sensíveis:
-- executadas por cron (postgres) ou edge functions (service_role).
-- Não devem ser expostas a anon nem authenticated.
DO $$
DECLARE
  v_fn text;
  v_internal text[] := ARRAY[
    'run_daily_cleanup()',
    'run_daily_cleanup_with_logging()',
    'cleanup_old_login_attempts()',
    'cleanup_expired_tokens()',
    'cleanup_old_cron_logs()',
    'run_rls_security_audit()',
    'provision_tracking_partitions()',
    'prune_tracking_events_partitions(integer)',
    'ensure_tracking_events_partition(date)',
    'rollup_contract_version_usage(integer)',
    'get_active_uapi_token()',
    'increment_contract_usage(text,text,boolean)',
    'invalidate_old_tokens()',
    'set_token_expiration()',
    'sanitize_auth_log_metadata()',
    'log_mfa_session()',
    'trigger_bitrix24_sync()',
    'update_updated_at_column()',
    'test_rls_policies()'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_internal LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated', v_fn);
  END LOOP;
END $$;

-- Funções administrativas de diagnóstico: já validam has_role internamente,
-- mas não precisam ser expostas a visitantes anônimos.
REVOKE EXECUTE ON FUNCTION public.get_cron_jobs_health(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_contract_v1_sunset_readiness(integer, numeric) FROM anon;