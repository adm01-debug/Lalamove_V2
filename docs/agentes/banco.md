# Banco de dados — referência para agentes

Ler quando for rodar SQL, criar/aplicar migration, montar Postgres local ou auditar o estado da produção.
Resumo das regras no `AGENTS.md`; aqui está o detalhe.

## Onde se trabalha

| Situação | Banco | Como |
|---|---|---|
| Diagnóstico | **produção, só leitura** | sem MCP nesta sessão (abaixo); use o painel Supabase ou a CLI linkada do dono. Nunca escrita para "testar" |
| Migration nova | arquivo em `supabase/migrations/` | PR → merge em `main` → apply (abaixo) |
| Teste de comportamento de banco | **Postgres descartável** | `supabase start` + `supabase db reset` (aplica a cadeia inteira); nunca no banco oficial |
| Migration destrutiva, segredos, rotação de chaves | **só com o dono do projeto** | — |

O front **só** fala com o banco que estiver em `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
(`src/integrations/supabase/client.ts:6-7`): sem `.env` local apontando para `http://127.0.0.1:54321`, o
`npm run dev` conversa com a **produção**. Os testes de unidade injetam valores dummy
(`vitest.config.ts`), e o E2E usa `VITE_SUPABASE_*` dos secrets do GitHub (`.github/workflows/ci.yml`,
job `e2e`; os três secrets de Actions do repo são justamente `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`). O valor deles não é legível por API —
**trate o E2E do CI como rodando contra a produção** até alguém provar o contrário, e não escreva spec que
cria/apaga dado real.

## Banco OFICIAL

| O que | Valor |
|---|---|
| Projeto Supabase | **`iecgydonctmabiijadsf`** — "Lalamove - V2" (`supabase/config.toml:1`, `supabase/.temp/linked-project.json`) |
| Organização | `epkppivlamnqwhhrtdde` |
| URL | `https://iecgydonctmabiijadsf.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/iecgydonctmabiijadsf |
| MCP para SQL | **nenhum nesta sessão** — ver abaixo |
| Ledger | `supabase_migrations.schema_migrations` (`docs/DEPLOYMENT.md` > Migrations) |
| Migrations no repo | 153 arquivos `.sql` (`20241231000000` … `20260902000000`), sem versão duplicada |
| Edge functions no repo | 27 pastas em `supabase/functions/` (+ `_shared/`) |

### Nenhum MCP desta sessão aponta para este banco

Os MCPs Supabase carregados hoje são de **outros** projetos — conferido por `get_project_url`:

- `SUPABASE - ZAPP WEB V2 - MCP` → `tnnnlkbymytvtqngbbqh` (Zapp Web V2);
- `SUPABASE - GESTÃO DE CLIENTES` → `pgxfvjmuubtbowutlide` (CRM);
- `SUPABASE - GESTÃO DE PRODUTOS` → `doufsxqlfjyuvxuezpln` (Catálogo).

**Não escreva em nenhum deles.** Enquanto não houver um MCP do `iecgydonctmabiijadsf` (ou credencial do
dono), toda afirmação sobre tabelas, RLS, policies, funções, crons e ledger da produção do Lalamove é
`NÃO VERIFICADO (sem acesso ao banco nesta sessão)` — inclusive as deste arquivo que citam `docs/`.

## Como o DDL entra em produção

1. **Caminho documentado hoje:** arquivo em `supabase/migrations/` → push/merge em `main` → a Lovable
   sincroniza e aplica (`docs/DEPLOYMENT.md` > Deploy Process / Migrations). Não há workflow de migration
   no repo (`.github/workflows/ci.yml` é o único arquivo, e o job `deploy` só dá `echo "Deploy automático
   via Lovable"`). Logo: **o merge é o apply** — não existe passo de aprovação humana entre os dois.
2. **Ordem obrigatória: arquivo → PR → merge em `main` → deploy do código → apply.** Nunca DDL a partir de
   branch aberta. `REVOKE`, `DROP`, rename ou mudança de contrato de função usada pelo front/edges: nunca
   antes do deploy do código correspondente.
3. **Versão sem colisão:** antes de criar o arquivo, `ls supabase/migrations | tail` e busque PRs abertas
   tocando `supabase/migrations/`. Padrão de nome: `YYYYMMDDHHMMSS_slug.sql` (as antigas da Lovable usam
   um UUID no lugar do slug). Confirme no ledger (`SELECT max(version) FROM
   supabase_migrations.schema_migrations`) antes de assumir que a produção está na mesma altura do repo.
4. **Idempotência obrigatória:** `IF NOT EXISTS`, `OR REPLACE`, `DROP ... IF EXISTS`, `ON CONFLICT`. A
   cadeia é reaplicada do zero em todo `supabase db reset` local e em qualquer remix Lovable.
5. `CREATE INDEX CONCURRENTLY` e `VACUUM` não rodam dentro de transação — fora de migration.
6. Migration que contenha segredo (URL + key para `pg_cron`/`pg_net`) **não entra no repo**: o agendamento
   é feito por inserção direta, como `docs/CRON_JOBS.md` registra ("o agendamento contém segredos … não via
   migração — para não vazar em remixes").

## Segredos commitados — código limpo em 2026-11-08; migrate-helper confirmado fora da produção; `service_role`/`anon` provavelmente ainda NÃO rotacionadas

Varredura em 2026-11-08 no HEAD `924454e` achou segredo hardcoded em 19 arquivos de `scripts/` (13 com o
JWT `service_role`, 6 com o PAT `sbp_…` da Management API) e na edge `migrate-helper`
(`ACCESS_KEY` fixa + `verify_jwt = false`; a action `credentials` devolvia `SUPABASE_SERVICE_ROLE_KEY` e
`SUPABASE_DB_URL` a quem soubesse a chave). A PR #80 (`claude/fix-segredos-commitados-261108-2105`, mergeada
2026-11-20):

- trocou as 22 ocorrências (19 arquivos, 2 delas com o valor sob o nome `SUPABASE_ANON_KEY` ou
  `SUPABASE_DB_PASSWORD` — o conteúdo sempre foi o `service_role`) por leitura de `process.env` com guarda
  (`if (!X) { console.error(...); process.exit(1); }`); também moveu para env a senha hardcoded do usuário
  de seed em `test-user-permissions.ts`;
- removeu `supabase/functions/migrate-helper/` e sua entrada em `supabase/config.toml`.

**Confirmado em produção em 2026-11-22** (`GET /v1/projects/iecgydonctmabiijadsf/edge-functions` via
Management API, sessão com MCP `SUPABASE_-_LALAMOVE_V2_-_MCP`): a função `migrate-helper` não existe mais
na lista de 27 edge functions ativas do projeto — a remoção do código (etapa acima) foi de fato implantada,
não só removida do repo.

**Rotação de `service_role`/`anon`: a conclusão anterior deste doc ("já feito, confirmado") está
provavelmente ERRADA — corrigindo aqui.** Verificação em 2026-11-22 via `GET
/v1/projects/iecgydonctmabiijadsf/api-keys`: o JWT `service_role`/`anon` ativo hoje tem `iat` idêntico ao
`created_at` do projeto (`2026-08-02T11:25:56Z`, confirmado em `GET /v1/projects/iecgydonctmabiijadsf`) —
ou seja, é a chave **original da criação do projeto**, não uma chave nova. Se tivesse havido rotação do JWT
secret em 20/11 (como este doc chegou a afirmar), a chave ativa teria `iat` de 20/11, não da criação do
projeto. O commit `b819be8` (78/78 respostas 401 nos crons 18/19) é evidência real de algo quebrando em
produção em 20/11, mas não prova rotação de chave — pode ter outra causa (ex.: GRANT revogado de `anon`
pela migration `20260902000000_harden_revoke_anon_grants.sql`, que gera erro de permissão no Postgres, não
necessariamente 401 de JWT inválido no gateway). **Tratar como NÃO VERIFICADO que a chave vazada em 08/11
tenha sido invalidada — ela muito provavelmente continua válida hoje.** O dono foi consultado em 2026-11-22
sobre rotacionar agora (a sessão tem acesso via Management API) e decidiu não rotacionar neste momento;
decisão registrada, risco do vazamento permanece aberto até o dono decidir de outra forma.

A PR #108 (mergeada 2026-11-21) já se refere à chave nova no formato `sb_secret_…` — mas essa chave também
já existia desde a criação do projeto (`inserted_at` igual ao `created_at`, 2026-08-02); trocar a
*referência no código* para o formato novo não invalida o JWT legado antigo, que continua aceito pelo
projeto a menos que as legacy keys sejam desativadas (não verificado) ou o JWT secret seja de fato
rotacionado.

**Ainda pendente, ação do dono:**

1. **Rotacionar `service_role`/`anon` (JWT secret) e o PAT `sbp_…` da Management API** — ambos continuam,
   pelo que a evidência de 2026-11-22 mostra, com os mesmos valores que vazaram em 08/11. Rotação do JWT
   secret: painel Supabase do projeto `iecgydonctmabiijadsf` (Settings → API) ou Management API; PAT:
   https://supabase.com/dashboard/account/tokens.
2. Scripts que ainda forem usados precisam de `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ACCESS_TOKEN` /
   `SEED_TI_PASSWORD` exportados no ambiente antes de rodar.

Regra para qualquer agente: **nunca imprima esses valores** (nem em chat, commit, PR ou relatório) — cite
`arquivo:linha`. Scripts novos leem de `process.env`, ponto.

## Armadilhas já pagas

- **`scripts/apply-sql-via-management-api.ts` e irmãos criam policy `FOR ALL TO authenticated USING (true)
  WITH CHECK (true)` e `GRANT ALL ... TO anon`** — o oposto do que a migration
  `20260902000000_harden_revoke_anon_grants.sql` passou a garantir (REVOKE de `anon` + default privileges).
  Rodar esses scripts "para destravar" reabre a superfície. Não rode; se precisar do efeito, escreva
  migration com policy específica por papel.
- **`tracking_events` é particionada por mês** e depende de dois jobs `pg_cron`
  (`provision-tracking-partitions`, dia 1 às 00:05; `prune-tracking-partitions`, dia 2 às 00:20, retenção
  6 meses) — `docs/CRON_JOBS.md`. Mexer na tabela-pai sem rever `ensure_tracking_events_partition` /
  `provision_tracking_partitions()` quebra a inserção de GPS e deixa linha presa na partição DEFAULT.
- Rotinas de limpeza (`run_daily_cleanup`, `cleanup_expired_tokens`, `cleanup_old_login_attempts`,
  `cleanup_old_cron_logs`) **existem e não estão agendadas** — ver `docs/CRON_JOBS.md` antes de criar outra.
- Fluxo pré-login (lockout, reset de senha, MFA) depende de RPCs `SECURITY DEFINER` com `EXECUTE` para
  `anon` (`check_login_lockout_v2`, `record_failed_login_v2`). `REVOKE` nessas funções derruba o login.
- Sessões paralelas commitam no mesmo repo e no mesmo banco: re-sync antes de editar e confira
  `max(version)` antes de registrar migration.
