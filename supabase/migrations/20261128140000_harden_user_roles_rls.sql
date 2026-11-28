-- Fecha escalada de privilegio em user_roles: qualquer conta logada (inclusive
-- viewer) podia se promover a admin.
--
-- Origem: 20260828000002_dashboard_fixes.sql e 20260828000003_comprehensive_rls_fix.sql
-- trocaram as policies corretas por versoes permissivas para resolver um 406 do
-- dashboard. Como policies PERMISSIVAS de RLS combinam com OR, a policy
-- "MFA admins can insert/update/delete roles" (20260712202439) continuou existindo
-- mas ficou irrelevante: o "WITH CHECK (true)" das permissivas autorizava tudo.
-- 20260828000003 e a ultima migration que tocou a tabela ate aqui.
--
-- Alem das policies, 20260828000003:23-27 concedeu role 'admin' a TODO usuario
-- existente sem nenhum. Isso tambem precisa reverter, senao a correcao de RLS nao
-- reduz risco nenhum: todo mundo ja e admin.
--
-- Idempotente e com verificacao no fim: se alguma policy permissiva sobreviver, a
-- transacao aborta.

begin;

-- 1) Policies de escrita permissivas: saem. As "MFA admins can ..." de
--    20260712202439:17-31 voltam a valer sozinhas (exigem has_role(admin) E is_aal2()).
drop policy if exists "Authenticated users can insert roles" on public.user_roles;
drop policy if exists "Authenticated users can update roles" on public.user_roles;

-- 2) Leitura volta ao padrao do repo (20260712202439:10-13): o proprio papel, ou
--    admin. Sem USING (true), um viewer deixa de listar quem e admin.
drop policy if exists "Authenticated users can view roles" on public.user_roles;
drop policy if exists "Users can view own roles" on public.user_roles;
create policy "Users can view own roles" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Desfaz o auto-admin em massa de 20260828000003:27, mantendo quem realmente
--    precisa. O INSERT daquela migration nao informou `assigned_by` nem `notes`:
--    e esse o sinal que separa a concessao automatica de uma concessao humana.
--    Nao apaga nada as cegas: grava a lista em audit_log antes, para o dono
--    decidir caso algum acesso admin faca falta.
do $$
declare
  v_afetados uuid[];
begin
  select array_agg(ur.user_id) into v_afetados
    from public.user_roles ur
   where ur.role = 'admin'::public.app_role
     and ur.assigned_by is null;

  if v_afetados is not null then
    begin
      insert into public.audit_log (action, entity_type, entity_id, details, created_at)
      select 'revoke_mass_admin', 'user_roles', u::text,
             jsonb_build_object('motivo', 'auto-admin em massa de 20260828000002:24-30 e 20260828000003:23-27',
                                'como_reconceder', 'insert into public.user_roles(user_id, role, assigned_by, notes) values (''<uuid>'', ''admin'', ''<uuid de quem autorizou>'', ''concedido manualmente'')'),
             now()
        from unnest(v_afetados) u;
    exception when undefined_table or undefined_column then
      raise notice 'audit_log ausente: lista de % admin(s) nao registrada', array_length(v_afetados, 1);
    end;

    delete from public.user_roles
     where role = 'admin'::public.app_role
       and user_id = any (v_afetados);
    raise notice 'removidos % papel(es) admin concedidos automaticamente', array_length(v_afetados, 1);
  end if;
end $$;

-- 4) Assercao: nenhuma policy permissiva pode ter sobrevivido.
do $$
declare
  v_restantes text[];
begin
  select array_agg(policyname) into v_restantes
    from pg_policies
   where schemaname = 'public'
     and tablename = 'user_roles'
     and cmd in ('INSERT', 'UPDATE', 'ALL')
     and (with_check = 'true' or with_check is null)
     and roles::text like '%authenticated%';

  if v_restantes is not null then
    raise exception 'policy permissiva sobreviveu em user_roles: %', v_restantes;
  end if;
end $$;

-- 5) Assercao de nao ficar sem ninguem: se o passo 3 zerou os admins, aborta tudo.
--    Sem isto a correcao deixaria o painel sem administrador e ninguem mais
--    conseguiria conceder papel nenhum (a escrita agora exige admin + MFA).
do $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin'::public.app_role) then
    raise exception
      'a migration removeria TODOS os admins: reconceda o dono antes (insert into public.user_roles(user_id, role) values (<uuid do dono>, ''admin''))';
  end if;
end $$;

commit;