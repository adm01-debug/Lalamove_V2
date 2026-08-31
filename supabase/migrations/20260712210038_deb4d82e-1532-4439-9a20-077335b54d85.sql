-- Revoke EXECUTE from PUBLIC (which implicitly includes anon/authenticated)
-- and grant only to service_role for internal DB functions.

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.update_updated_at_column()',
    'public.invalidate_old_tokens()',
    'public.log_mfa_session()',
    'public.set_token_expiration()',
    'public.sanitize_auth_log_metadata()',
    'public.trigger_bitrix24_sync()',
    'public.cleanup_old_login_attempts()',
    'public.run_rls_security_audit()',
    'public.run_daily_cleanup_with_logging()',
    'public.provision_tracking_partitions()',
    'public.prune_tracking_events_partitions(integer)',
    'public.cleanup_expired_tokens()',
    'public.cleanup_old_cron_logs()',
    'public.run_daily_cleanup()',
    'public.rollup_contract_version_usage(integer)',
    'public.ensure_tracking_events_partition(date)',
    'public.increment_contract_usage(text, text, boolean)',
    'public.test_rls_policies()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;