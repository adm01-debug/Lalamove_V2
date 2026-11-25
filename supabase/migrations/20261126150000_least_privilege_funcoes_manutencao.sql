-- Least privilege nas funcoes internas de manutencao.
--
-- Todas nasceram com o grant padrao do Postgres (EXECUTE para PUBLIC), o que as
-- deixa chamaveis por `anon` na API REST publica -- e a chave anon vai no bundle
-- do front. Duas tem efeito de negocio direto:
--   * end_order_tracking(order_id, motivo): encerra o tracking de QUALQUER pedido
--     e cancela eventos geo pendentes, sem nenhuma checagem de papel;
--   * process_job_queue(limit): dispara o dispatcher da fila com a chave do vault.
--
-- Escopo restrito as funcoes que NAO sao chamadas pelo front (verificado em src/:
-- so aparecem em src/integrations/supabase/types.ts, que e gerado). pg_cron roda
-- como o dono da funcao (postgres) e continua funcionando; as edges rodam como
-- service_role e recebem o grant explicito abaixo.
--
-- Ficam intactas por serem chamadas pelo front: check_login_lockout_v2 e
-- record_failed_login_v2 (login), is_phone_opted_out, messaging_month_cost_cents
-- e refresh_cache_view.

revoke execute on function public.process_job_queue(integer) from public, anon, authenticated;
revoke execute on function public.refresh_geo_jobs() from public, anon, authenticated;
revoke execute on function public.cleanup_processing_logs() from public, anon, authenticated;
revoke execute on function public.notification_messages_scrub_bodies(integer) from public, anon, authenticated;
revoke execute on function public.geo_budget_notify_if_needed() from public, anon, authenticated;
revoke execute on function public.create_audit_log(text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.cache_view_count(text) from public, anon, authenticated;
revoke execute on function public.end_order_tracking(uuid, text) from public, anon, authenticated;
revoke execute on function public.record_messaging_usage(text, text, integer, integer, integer, date) from public, anon, authenticated;
revoke execute on function public.trg_close_tracking_on_order_end() from public, anon, authenticated;

grant execute on function public.process_job_queue(integer) to service_role;
grant execute on function public.refresh_geo_jobs() to service_role;
grant execute on function public.cleanup_processing_logs() to service_role;
grant execute on function public.notification_messages_scrub_bodies(integer) to service_role;
grant execute on function public.geo_budget_notify_if_needed() to service_role;
grant execute on function public.create_audit_log(text, text, uuid, jsonb) to service_role;
grant execute on function public.cache_view_count(text) to service_role;
grant execute on function public.end_order_tracking(uuid, text) to service_role;
grant execute on function public.record_messaging_usage(text, text, integer, integer, integer, date) to service_role;
grant execute on function public.trg_close_tracking_on_order_end() to service_role;

-- Falha alto se qualquer uma continuar exposta a anon/authenticated ou se
-- service_role tiver perdido o execute -- a migration inteira reverte.
do $$
declare
  v_nomes text[] := array[
    'process_job_queue', 'refresh_geo_jobs', 'cleanup_processing_logs',
    'notification_messages_scrub_bodies', 'geo_budget_notify_if_needed',
    'create_audit_log', 'cache_view_count', 'end_order_tracking',
    'record_messaging_usage', 'trg_close_tracking_on_order_end'
  ];
  v_ainda_exposta text;
  v_sem_service text;
begin
  select string_agg(x.assinatura || ' -> ' || r.rol, ', ')
    into v_ainda_exposta
    from (
      select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as assinatura, p.oid
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any(v_nomes)
    ) x
    cross join (values ('anon'), ('authenticated')) as r(rol)
   where has_function_privilege(r.rol, x.oid, 'EXECUTE');

  if v_ainda_exposta is not null then
    raise exception 'least privilege incompleto: %', v_ainda_exposta;
  end if;

  select string_agg(x.assinatura, ', ')
    into v_sem_service
    from (
      select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as assinatura, p.oid
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any(v_nomes)
    ) x
   where not has_function_privilege('service_role', x.oid, 'EXECUTE');

  if v_sem_service is not null then
    raise exception 'service_role sem execute em: %', v_sem_service;
  end if;
end $$;