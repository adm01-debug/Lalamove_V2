-- Fecha a superficie anon de funcoes SECURITY DEFINER que nao sao pre-login.
-- Origem: advisors anon_security_definer_function_executable (5 lints).
-- check_login_lockout_v2/record_failed_login_v2 SAO pre-login: permanecem com anon.
begin;

revoke execute on function public.is_phone_opted_out(text) from public, anon;
revoke execute on function public.messaging_month_cost_cents(date) from public, anon;
revoke execute on function public.refresh_cache_view(text, text) from public, anon;

grant execute on function public.is_phone_opted_out(text) to authenticated, service_role;
grant execute on function public.messaging_month_cost_cents(date) to authenticated, service_role;
grant execute on function public.refresh_cache_view(text, text) to authenticated, service_role;

do $$
declare
  v_bad text;
begin
  select string_agg(sig, ', ') into v_bad
  from (values
    ('public.is_phone_opted_out(text)'),
    ('public.messaging_month_cost_cents(date)'),
    ('public.refresh_cache_view(text, text)')
  ) as t(sig)
  where has_function_privilege('anon', sig, 'EXECUTE');

  if v_bad is not null then
    raise exception 'anon ainda executa: %', v_bad;
  end if;

  select string_agg(sig, ', ') into v_bad
  from (values
    ('public.is_phone_opted_out(text)'),
    ('public.messaging_month_cost_cents(date)'),
    ('public.refresh_cache_view(text, text)')
  ) as t(sig)
  where not has_function_privilege('authenticated', sig, 'EXECUTE')
     or not has_function_privilege('service_role', sig, 'EXECUTE');

  if v_bad is not null then
    raise exception 'authenticated/service_role perderam acesso: %', v_bad;
  end if;

  if not has_function_privilege('anon', 'public.check_login_lockout_v2(text, inet)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.record_failed_login_v2(text, inet, text)', 'EXECUTE') then
    raise exception 'regressao: funcoes de pre-login perderam anon';
  end if;

  raise notice 'revoke anon verificado';
end $$;

commit;