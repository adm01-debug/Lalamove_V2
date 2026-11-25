-- Hardening apontado pelos advisors do Supabase (performance + security),
-- depois de descartar os itens que sao falso positivo neste projeto.
--
-- NAO mexe em `public.cache_status`: ele e security definer de proposito. A
-- policy de SELECT de `cache_refresh_log` e admin-only e a tela
-- /cache-monitoring exige apenas `manager` (App.tsx:171); rodar como invoker
-- faria o manager ver "never_refreshed" nas tres views -- foi exatamente o bug
-- que a 20261123150000 corrigiu. As colunas expostas sao nome de view,
-- contagem de linhas e horario de refresh.
--
-- NAO mexe nas funcoes chamaveis por anon (check_login_lockout_v2,
-- record_failed_login_v2, is_phone_opted_out, messaging_month_cost_cents,
-- refresh_cache_view): estao documentadas como necessarias ao front em
-- 20261126150000_least_privilege_funcoes_manutencao.sql.

-- 1) search_path mutavel: seis funcoes resolviam objetos pelo search_path da
--    sessao do chamador. Fixar em public + pg_temp nao muda resultado e fecha o
--    advisor `function_search_path_mutable`.
do $$
declare
  v_oid oid;
  v_nomes text[] := array[
    'geo_haversine_m', 'geo_point_to_segment_m', 'geo_point_to_polyline_m',
    'normalize_br_phone', 'notification_status_transition_allowed',
    'notification_messages_touch'
  ];
begin
  for v_oid in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any(v_nomes)
  loop
    execute format('alter function %s set search_path = public, pg_temp', v_oid::regprocedure);
  end loop;
end $$;

-- 2) FKs sem indice de cobertura (advisor `unindexed_foreign_keys`). Indices
--    aditivos: nenhum dado muda, so o custo de DELETE/UPDATE no lado pai e as
--    consultas por essas colunas.
create index if not exists geo_budget_updated_by_idx on public.geo_budget (updated_by);
create index if not exists geo_defaults_updated_by_idx on public.geo_defaults (updated_by);
create index if not exists geo_settings_updated_by_idx on public.geo_settings (updated_by);
create index if not exists lalamove_webhook_config_registered_by_idx on public.lalamove_webhook_config (registered_by);
create index if not exists message_templates_updated_by_idx on public.message_templates (updated_by);
create index if not exists messaging_settings_updated_by_idx on public.messaging_settings (updated_by);
create index if not exists notification_messages_fallback_of_idx on public.notification_messages (fallback_of);
create index if not exists notification_messages_alert_id_idx on public.notification_messages (alert_id);
create index if not exists notification_optouts_created_by_idx on public.notification_optouts (created_by);
create index if not exists notification_routes_updated_by_idx on public.notification_routes (updated_by);

-- 3) BRIN duplicado: cada particao de tracking_events ja tem um BRIN proprio em
--    created_at (`tracking_events_<particao>_created_at_idx`), criado junto com
--    a particao. As tres particoes mais novas ganharam um segundo BRIN avulso
--    identico (`*_created_brin`), sem nenhuma definicao a mais. O BRIN do pai
--    (`idx_tracking_events_created_brin`) e `ON ONLY`, portanto nao propaga e
--    fica no lugar como referencia -- nao e tocado.
drop index if exists public.tracking_events_y2026m11_created_brin;
drop index if exists public.tracking_events_y2026m12_created_brin;
drop index if exists public.tracking_events_y2027m01_created_brin;

-- Falha alto e reverte tudo se algum item nao tiver efeito.
do $$
declare
  v_pendente text;
begin
  select string_agg(p.oid::regprocedure::text, ', ')
    into v_pendente
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any(array['geo_haversine_m','geo_point_to_segment_m','geo_point_to_polyline_m','normalize_br_phone','notification_status_transition_allowed','notification_messages_touch'])
     and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
  if v_pendente is not null then
    raise exception 'search_path ainda mutavel em: %', v_pendente;
  end if;

  select string_agg(con.conrelid::regclass::text || '.' || con.conname, ', ')
    into v_pendente
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where con.contype = 'f'
     and n.nspname = 'public'
     and not exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisvalid
                      and (i.indkey::int2[])[0:array_length(con.conkey,1)-1] = con.conkey);
  if v_pendente is not null then
    raise exception 'FK sem indice: %', v_pendente;
  end if;
end $$;
