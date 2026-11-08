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

## Segredos commitados — passivo conhecido (não copie o padrão)

Varredura em 2026-11-08 no HEAD `924454e`:

| Onde | O que |
|---|---|
| 13 arquivos em `scripts/` (`list-tables.ts`, `list-tables-v2.ts`, `set-user-admin.ts`, `seed-database.ts`, `seed-contacts.ts`, `check-permissions.ts`, `diagnose-rpc.ts`, `fix-admin-role-active.ts`, `fix-dashboard-via-api.ts`, `apply-dashboard-fixes.ts`, `apply-rls-via-pg.ts`, `test-after-fix.ts`, `test-user-permissions.ts`) | JWT **`service_role`** do projeto em texto puro |
| 6 arquivos em `scripts/` (`add-security-manage.ts`, `apply-final-sql.ts`, `apply-permissions-via-api.ts`, `apply-sql-via-management-api.ts`, `ensure-admin-active.ts`, `fix-rpc-functions.ts`) | **PAT `sbp_…`** da Supabase Management API |
| `supabase/functions/migrate-helper/index.ts:5` | `ACCESS_KEY` fixa no código e `verify_jwt = false` (`supabase/config.toml:4-5`); a action `credentials` devolve `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` a quem souber a chave (o próprio arquivo diz "Após a migração, remova esta função") |

Regras: **nunca imprima esses valores** (nem em chat, commit, PR ou relatório) — cite `arquivo:linha`.
Rotação da `service_role` e do PAT, e remoção do `migrate-helper` da produção, são **ação do dono** (e
quebram quem depende deles). Scripts novos leem de `process.env`, ponto.

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
