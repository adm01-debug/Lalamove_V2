-- Fecha a leitura anonima das views de metrica.
--
-- As tres materialized views (driver_stats_cache, delivery_metrics_cache,
-- hourly_metrics_cache) e a view cache_status foram criadas por supabase_admin,
-- cujo default privilege em public concede ALL a anon. Resultado: qualquer
-- visitante com a chave publica do front (que vai no bundle) lia direto pelo
-- PostgREST, sem login:
--   * driver_stats_cache: nome, telefone, risk_score, blacklist e volume de
--     entregas de TODOS os motoristas (20 linhas) -- dado pessoal (LGPD);
--   * delivery_metrics_cache / hourly_metrics_cache: faturamento agregado por
--     dia e por hora.
-- Prova antes da correcao: GET /rest/v1/driver_stats_cache com a chave
-- publishable devolvia 206 com content-range 0-0/20 (sem sessao).
--
-- Nenhuma rota publica do front le essas views: todas as paginas que usam
-- useCachedStats/useCacheViews estao atras de ProtectedRoute. Revogar apenas de
-- anon preserva o painel (authenticated continua com SELECT).
--
-- Nao e possivel alterar o default privilege de supabase_admin a partir de
-- postgres (ERROR 42501). Fica registrado: toda view/tabela nova criada por
-- supabase_admin em public nasce legivel por anon e precisa de revoke explicito.

revoke select on public.driver_stats_cache from anon

revoke select on public.delivery_metrics_cache from anon

revoke select on public.hourly_metrics_cache from anon

revoke select on public.cache_status from anon

do $$
declare
  v_expostos int;
  v_sem_auth text;
begin
  select count(*) into v_expostos
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'v', 'm')
    and has_table_privilege('anon', c.oid, 'SELECT');

  if v_expostos > 0 then
    raise exception 'anon ainda le % objetos em public', v_expostos;
  end if;

  select string_agg(x.nome, ', ') into v_sem_auth
  from (values ('driver_stats_cache'), ('delivery_metrics_cache'),
               ('hourly_metrics_cache'), ('cache_status')) x(nome)
  where not has_table_privilege('authenticated', ('public.' || x.nome)::regclass, 'SELECT');

  if v_sem_auth is not null then
    raise exception 'authenticated perdeu select em: %', v_sem_auth;
  end if;
end $$
