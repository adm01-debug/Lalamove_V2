# scripts/db-audit — auditores de banco

Auditores portados do repo irmão **Zapp Web V2** (`scripts/db-audit/`) e adaptados a este
repositório. Só entrou o que é genérico ou o que dá para adaptar sem inventar schema: nada aqui
depende de tabela do Zapp (Talk X, contatos, CRM).

Banco oficial deste repo: **`iecgydonctmabiijadsf`** (`supabase/config.toml:1`).

> **Estado de verificação (2026-11-08):** nenhuma sessão de agente tem MCP nem credencial do banco
> `iecgydonctmabiijadsf`. Tudo o que é marcado “exige `DESTINO_URL`” abaixo está **NÃO VERIFICADO**:
> o código foi portado correto, mas nunca falou com o banco deste projeto. Os auditores offline
> (migrations + `src/` + `supabase/functions/`) foram executados de verdade — ver “Achados”.

## Como rodar

Tudo é Node 22 com API nativa, sem dependência nova. O único auditor que precisa de pacote é
`check-realtime-subscriptions.mjs` (usa `typescript`, já devDependency) — rode-o depois de
`npm ci`.

```bash
# bateria de testes dos próprios auditores (227 testes)
node --test scripts/db-audit/*.test.mjs

# guardas offline (não tocam no banco)
node scripts/db-audit/check-migration-drift.mjs
node scripts/db-audit/supabase-usage-guard.mjs
node scripts/db-audit/check-realtime-subscriptions.mjs
node scripts/db-audit/check-screen-permission-db-guards.mjs            # relatório
node scripts/db-audit/check-screen-permission-db-guards.mjs --exigir-trava   # vira gate
```

`DESTINO_URL` é a connection string do banco oficial (`postgresql://...`, porta 5432 ou 6543 em
session mode). **Nunca** vai para argv nem para o ambiente do processo filho: o transporte é
`psql-environment.mjs` (campos libpq + `PGPASSFILE` 0600 em diretório 0700). Não existe segredo
versionado nesta pasta — só o certificado público da CA Supabase.

## Catálogo dos arquivos

| arquivo | o que faz | precisa de `DESTINO_URL`? |
| --- | --- | --- |
| `check-migration-drift.mjs` | Valida `supabase/migrations/` (nome `NNNNNNNNNNNNNN_nome.sql`, versão única, arquivo com SQL real, exceções do manifesto) e, com banco, compara cada migration com `supabase_migrations.schema_migrations` (hash canônico do SQL). | só a parte do ledger |
| `migration-evidence.json` | Manifesto de exceções do auditor acima (migration só-comentário, SQL fixado, tombstone). Hoje vazio: nenhuma das 153 migrations precisa de exceção. | não |
| `supabase-usage-guard.mjs` | Varre `src/` e `supabase/functions/` e falha se `.from('x')`/`.rpc('y')` do cliente principal aponta para objeto que não existe no schema. Ratchet: violação conhecida fica em `known-violations.json`; **nova** derruba. | não (modo degradado, ver abaixo) |
| `catalog-from-types.mjs` | **Novo neste repo.** Extrai tabelas/views/funções/enums de `src/integrations/supabase/types.ts` (gerado do banco vivo) para servir de snapshot ao guard quando não há `supabase/schema-catalog.json`. | não |
| `known-violations.json` | Baseline do guard acima. As 2 entradas atuais são achado real deste repo (ver “Achados”). | não |
| `check-realtime-subscriptions.mjs` | Lê por AST toda assinatura `.on('postgres_changes', { schema, table })` do front e exige que a tabela esteja na publicação `supabase_realtime`. A publicação é derivada dos `ALTER PUBLICATION ... ADD TABLE` commitados. Assinatura com tabela dinâmica é fail-closed. | não (precisa de `typescript`) |
| `check-screen-permission-db-guards.mjs` | Cruza o que a **tela** usa para esconder ação (`requiredPermission`, `requiredRole`, `PermissionGate permission/role/roles`, `hasPermission`/`hasRole`) com a **trava no banco** (`has_permission(...)` / `has_role(...)` em migration). `--exigir-trava` transforma o relatório em gate. | não |
| `check-remocoes-destrutivas.mjs` | Compara dois catálogos (antes/depois do DDL) e bloqueia a remoção de objeto que **ainda tem call-site** no código. Olha o objeto, não linhas de diff. | sim (gera os catálogos) |
| `catalog.sql` | Gera `supabase/schema-catalog.json`: tabelas, views, colunas, funções + assinaturas, trigger functions, CHECK constraints do schema `public`. | sim |
| `check-manifest-fresh.mjs` + `manifest-lib.mjs` + `manifest.sql` | `manifest.sql` gera o manifesto estrutural (16 seções com hash: colunas, defaults, constraints, índices, views, tipos, RLS, policies, triggers, funções, grants). O auditor compara `supabase/schema-manifest.json` com uma geração fresca e **só aprova com a identidade do banco comprovada**. | sim |
| `check-grants-fresh.mjs` + `grants-baseline.sql` | Baseline de ACL: EXECUTE por role em toda função pública + SELECT de `anon` em toda tabela/view. Detecta GRANT novo a `anon`/`authenticated` sem migration, e REVOKE aplicado antes do código. Metadados (`generated_at`/`note`) não contam como drift. | sim |
| `diff.mjs` | Diffa dois manifestos (`manifest.sql`) — útil para comparar dois bancos ou duas gerações. Identidade aqui é informativa. | não (consome arquivos) |
| `database-identity.mjs` + `database-identity.json` | Prova que a URL conectada é o projeto oficial **sem imprimir a credencial**: extrai o project-ref (host direto ou usuário do pooler), compara com `project_ref_sha256`, confere database/schema/`server_major` e endurece o TLS (`sslmode=verify-full` + CA pinada). | — (biblioteca) |
| `certs/supabase-prod-ca-2021.crt` | CA pública do Supabase, pinada por SHA-256 do arquivo e por fingerprint do certificado. | — |
| `register-migration.mjs` | Registra uma migration no ledger seguindo o ritual anti-colisão: `max(version)` fresco, aborta se a versão não for estritamente maior, checa colisão de objeto por nome em outra version, e aborta se o `RETURNING` do `INSERT ... ON CONFLICT DO NOTHING` vier vazio. Sem `--apply` é dry-run puro (imprime o SQL). | só com `--apply` |
| `dry-run-plan.mjs` | Lê a saída de `supabase db push --dry-run` e recusa se o plano anunciado não é exatamente o autorizado (uma version, ou um bundle em ordem estrita). | não |
| `psql-environment.mjs` / `psql-safe.mjs` | Transporte seguro para `psql`: nada de URI/senha em argv ou no ambiente do filho; política de retry só para falha de transporte (`PSQL_CONNECT_RETRIES`, `PSQL_CONNECT_RETRY_DELAY_MS`). `psql-safe.mjs` é o proxy transparente (`node psql-safe.mjs -c "..."`). | sim (em uso) |
| `sql-lexer.mjs` | Lexer SQL compartilhado (comentário de linha/bloco aninhado, string com `''`, corpo `$tag$...$tag$`, `standard_conforming_strings`). Base do hash canônico do drift e da projeção do usage guard. | — |
| `seguranca-processo.mjs` | `resolverExecutavel` (caminho absoluto antes de criar processo filho) e `resolverCaminhoPermitido` (recusa path traversal vindo de argv/env; raízes = repositório + temporário). | — |

### Variáveis de ambiente

| variável | usada por | para quê |
| --- | --- | --- |
| `DESTINO_URL` | drift (ledger), manifest, grants, register `--apply`, `psql-safe` | connection string do banco oficial |
| `MIGRATIONS_DIR` | `check-migration-drift.mjs` | diretório de fixtures nos testes |
| `MIGRATION_EVIDENCE_PATH` | `check-migration-drift.mjs` | manifesto de exceções alternativo |
| `MANIFEST_PATH` / `GRANTS_BASELINE_PATH` / `CATALOG_IDENTITY_PATH` / `DATABASE_IDENTITY_PATH` | auditores de frescor | caminhos alternativos (testes) |
| `PSQL_BIN` | tudo que chama `psql` | binário alternativo (fake nos testes) |
| `PSQL_CONNECT_RETRIES`, `PSQL_CONNECT_RETRY_DELAY_MS` | `psql-environment.mjs` | retry de falha de transporte (desligado por padrão) |
| `LEDGER_RETRY_DELAYS_MS` | `check-migration-drift.mjs` | retry da consulta ao ledger (padrão `5000,15000`) |

**Nenhum** deles é segredo versionado. `DESTINO_URL` vem de secret do GitHub/ambiente do operador;
segredo de edge continua só em `supabase secrets set` / painel (ver `docs/agentes/banco.md`).

## Modo degradado (sem acesso ao banco)

Três auditores exigem um snapshot do banco que este repo ainda não tem
(`supabase/schema-catalog.json`, `supabase/schema-manifest.json`,
`scripts/db-audit/grants-baseline.json`). Eles **não fingem que passaram**:

- `check-manifest-fresh.mjs` e `check-grants-fresh.mjs` saem com **2** e imprimem o comando `psql`
  exato para gerar o arquivo, avisando que a primeira geração deve ser revisada antes de virar
  baseline.
- `check-remocoes-destrutivas.mjs` sai com **2** e imprime os dois comandos de geração.
- `supabase-usage-guard.mjs` é o único que continua útil: sem catálogo ele usa a **união** de
  `src/integrations/supabase/types.ts` (gerado do banco vivo) com tudo o que `supabase/migrations/`
  cria, e **avisa no stdout** que está em modo degradado. A união é aditiva de propósito —
  replayar os DROPs das 153 migrations sobre um snapshot sem data derrubaria objeto que hoje
  existe e o guard viraria fonte de falso positivo. Quem prova remoção é o catálogo/manifesto
  contra o banco.
- `check-realtime-subscriptions.mjs` deriva a publicação das migrations commitadas, não do banco.
  Tabela adicionada à publicação pelo painel/Lovable não aparece. A prova do banco vivo é:
  `psql "$DESTINO_URL" -X -At -c "select schemaname||'.'||tablename from pg_publication_tables where pubname='supabase_realtime' order by 1"`.

## Achados reais deste repo (registrados, não corrigidos)

Levantados pela execução dos guardas offline em 2026-11-08. Corrigir é decisão do dono.

1. **`.rpc('exec')` em duas edges** — `supabase/functions/apply-fixes/index.ts:41` e
   `supabase/functions/seed-fix-rls/index.ts:120` chamam uma função `public.exec` que **nenhuma
   migration cria** e que **não existe** em `types.ts`. São edges que rodariam DDL arbitrário por
   RPC, fora do fluxo de `docs/agentes/banco.md`. Registradas em `known-violations.json`.
2. **4 assinaturas Realtime sem publicação** — o front assina `public.auth_logs`,
   `public.blocked_ips`, `public.mfa_sessions` e `public.new_device_alerts`, e nenhum
   `ALTER PUBLICATION supabase_realtime ADD TABLE` commitado as inclui. Se a publicação no banco
   também não as tiver, o canal conecta, `subscribe()` devolve SUBSCRIBED e **nenhum evento chega**
   — tela muda, sem erro. Conjunto travado em `check-realtime-subscriptions.test.mjs`.
3. **3 permissões nomeadas sem trava no banco** — `security.manage`, `security.view` e
   `users.roles` escondem ação via `PermissionGate`, e **nenhuma migration chama
   `has_permission(..., '<nome>')`**: a função existe e tem GRANT/REVOKE gerenciados
   (`20251231115949_...:155`, `20260712210653_...:19`, `20260715164406_...:7`), mas nenhuma policy
   a usa com um nome de permissão. Esconder botão não bloqueia a ação. Os 4 papéis
   (`admin`/`manager`/`operator`/`viewer`) têm trava de verdade — `has_role(` aparece ~371 vezes
   nas migrations. Conjunto travado em `check-screen-permission-db-guards.test.mjs`.
4. **`types.ts` e migrations divergem** — `types.ts` declara 61 tabelas e 3 views; a projeção só
   das migrations dá 80 relações e 78 funções, e a união das duas fontes dá 82/81 (ou seja: cada
   lado tem objeto que o outro não tem). Parte do schema vivo foi criada fora de `supabase/migrations/` (ex.:
   `geo_blocks`, usada em 5 pontos de `src/pages/GeoBlockingPage.tsx`, não tem migration) e parte
   das migrations não chegou ao `types.ts`. Só o catálogo contra o banco fecha essa conta.
5. **`server_major` da identidade é suposição** — `database-identity.json` fixa PostgreSQL 17
   (igual ao projeto irmão). Com `DESTINO_URL` em mãos, confirme antes de confiar no auditor de
   manifesto: divergência sai como erro de identidade (exit 2), não como drift.

## Scripts npm sugeridos (não aplicados — `package.json` é de outro agente)

```json
"db:audit":            "node --test scripts/db-audit/*.test.mjs",
"db:drift":            "node scripts/db-audit/check-migration-drift.mjs",
"db:usage-guard":      "node scripts/db-audit/supabase-usage-guard.mjs",
"db:realtime-guard":   "node scripts/db-audit/check-realtime-subscriptions.mjs",
"db:permission-guard": "node scripts/db-audit/check-screen-permission-db-guards.mjs"
```

## O que NÃO foi portado do Zapp Web V2

| arquivo (origem) | motivo |
| --- | --- |
| `check-runtime-config.mjs` + `runtime-config.sql` + `realtime-publication-baseline.json` | O veredito é cravado no schema do Zapp: autovacuum esperado em `messages`/`email_messages`/`email_threads`/`contacts` e baseline de publicação com o project-ref dele. Adaptar exigiria inventar a lista certa para o Lalamove sem acesso ao banco — validaria ficção. |
| `consolidar-veredito.mjs` (+ teste) | Consolida o resultado de uma lista **fechada** de passos do workflow `db-live-guard.yml`, que não existe aqui (e `.github/workflows/` está fora do escopo desta sessão). |
| `lote-pendente.mjs` (+ teste) | Wrapper de CI que grava no `GITHUB_STEP_SUMMARY` e chama `check-migration-drift.mjs --classificar`. Não há workflow para chamá-lo, e o próprio teste dele só verifica a ligação com dois workflows do Zapp. (Na origem, `--classificar` é flag morta: `check-migration-drift.mjs` não lê `process.argv`.) |
| `confirm-hash.mjs` | Biblioteca que amarra `runtime_sha256` + SHA do arquivo + `github.sha` para o passo de apply. Sem o workflow de dry-run/apply não há consumidor nem CLI: ficaria código morto. |
| `gen-types.sh`, `local-pg-proxy.mjs` (+ teste) | Regeneram `types.ts` pelo Supabase CLI atrás de um proxy pgbouncer. Faltam o CLI, o pgbouncer, o banco e o workflow que os chama; aqui o `types.ts` é gerado pela Lovable. |
| `replay-local.sh`, `wait-postgres-final-start.sh`, `retry-disposable-postgres-test.sh` | Infra do replay em Postgres descartável do Zapp: bootstrap com tabelas `_zapp_*`, pin de DNS do project-ref dele e assinaturas de flake da suíte `*.test.sh` (que não foi portada). |
| `*-contract.test.{mjs,sh}`, `talkx-*`, `crm-sync-*`, `contact-types-*`, `multiplix-*`, `telefonia-*`, `sla-*`, `n011-*`, `ledger-*`, `ai-projection-*`, `export-targeted-ledger-evidence`, `extrair-consulta-ledger` | Contratos do schema do Zapp (Talk X, contatos, CRM, telefonia, SLA) — nada disso existe no domínio Lalamove (pedidos, motoristas, cotação, rastreamento, POD, incidentes, aprovações, job queue, `tracking_events` particionada). |
