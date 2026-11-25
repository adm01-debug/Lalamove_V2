-- Fecha escalada de privilegio: 16 funcoes de manutencao SECURITY DEFINER
-- (limpeza, poda de particoes, tokens, auditoria) estavam executaveis por
-- qualquer conta autenticada. Nenhuma delas tem checagem de papel no corpo e
-- nenhuma e chamada pelo app (src/ ou edge functions) - todas rodam por cron
-- como postgres. Um viewer logado podia apagar particoes de tracking_events e
-- registros de auditoria via POST /rest/v1/rpc/<nome>.
begin;

do $$
declare
  v_names text[] := array[
    'prune_tracking_events_partitions',
    'run_daily_cleanup',
    'run_daily_cleanup_with_logging',
    'cleanup_old_audit_logs',
    'cleanup_old_cron_logs',
    'cleanup_old_login_attempts',
    'cleanup_old_observability_logs',
    'cleanup_old_region_cache',
    'provision_tracking_partitions',
    'ensure_tracking_events_partition',
    'rollup_contract_version_usage',
    'sanitize_auth_log_metadata',
    'invalidate_old_tokens',
    'set_token_expiration',
    'cleanup_expired_tokens',
    'run_rls_security_audit'
  ];
  v_rec record;
  v_done text[] := array[]::text[];
begin
  for v_rec in
    select p.oid, p.oid::regprocedure::text sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (v_names)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_rec.oid::regprocedure);
    v_done := v_done || v_rec.sig;
  end loop;

  if array_length(v_done, 1) <> 16 then
    raise exception 'esperava 16 funcoes, revoguei %: %', coalesce(array_length(v_done,1),0), v_done;
  end if;

  raise notice 'revogado de public/anon/authenticated: %', v_done;
end $$;

do $$
declare
  v_bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any (array[
      'prune_tracking_events_partitions','run_daily_cleanup','run_daily_cleanup_with_logging',
      'cleanup_old_audit_logs','cleanup_old_cron_logs','cleanup_old_login_attempts',
      'cleanup_old_observability_logs','cleanup_old_region_cache','provision_tracking_partitions',
      'ensure_tracking_events_partition','rollup_contract_version_usage','sanitize_auth_log_metadata',
      'invalidate_old_tokens','set_token_expiration','cleanup_expired_tokens','run_rls_security_audit'])
    and (has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE'));

  if v_bad is not null then
    raise exception 'ainda executavel por authenticated/anon: %', v_bad;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any (array[
      'prune_tracking_events_partitions','run_daily_cleanup','run_daily_cleanup_with_logging',
      'cleanup_old_audit_logs','cleanup_old_cron_logs','cleanup_old_login_attempts',
      'cleanup_old_observability_logs','cleanup_old_region_cache','provision_tracking_partitions',
      'ensure_tracking_events_partition','rollup_contract_version_usage','sanitize_auth_log_metadata',
      'invalidate_old_tokens','set_token_expiration','cleanup_expired_tokens','run_rls_security_audit'])
    and not has_function_privilege('service_role', p.oid, 'EXECUTE');

  if v_bad is not null then
    raise exception 'service_role perdeu acesso: %', v_bad;
  end if;

  raise notice 'revoke de manutencao verificado';
end $$;

commit;