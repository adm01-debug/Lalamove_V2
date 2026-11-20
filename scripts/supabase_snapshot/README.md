# supabase-snapshot

Mantém um retrato completo do banco OFICIAL (`iecgydonctmabiijadsf`, ver `supabase/config.toml:1`) para
agentes de IA lerem **antes** de qualquer tarefa ou planejamento que toque banco, RLS, functions, cron,
storage ou edge functions.

## Estado neste repo — NÃO VERIFICADO

O coletor foi portado do Zapp Web V2 e a suíte offline (109 testes, conexão simulada) passa aqui, mas
**nenhuma coleta real foi executada contra `iecgydonctmabiijadsf`**: esta sessão não tem o secret
`SUPABASE_DB_URL` nem MCP apontando para o banco do Lalamove (AGENTS.md > "Banco"). Logo:

- O conteúdo de `docs/contexto/supabase/` é **NÃO VERIFICADO** até o primeiro run com o secret.
- Enquanto o secret não existir, o job `banco` de `.github/workflows/contexto.yml` roda só a suíte
  offline e **sai verde com aviso** (`::warning::Secret SUPABASE_DB_URL não definido`); no
  `workflow_dispatch` manual ele falha, para a pessoa ver.
- Qualquer afirmação sobre o estado da produção feita a partir deste repo, sem esse run, é
  "NÃO VERIFICADO".

## Onde está o resultado

O job `banco` de `.github/workflows/contexto.yml` roda a cada 10 min e publica em
`docs/contexto/supabase/` da branch **`contexto`** (junto com `codigo/` e `regras/`; índice em
`docs/contexto/00-INDEX.md`). Só há commit quando algo mudou.

A publicação não vai para a `main` de propósito: a `main` deste repo não tem branch protection, mas um
commit a cada 10 min nela dispararia o `ci.yml` inteiro e um deploy da Vercel (projeto `lalamove-v2`) a
cada coleta.

Como ler, sem trocar de branch:

```sh
git fetch origin contexto
git show origin/contexto:docs/contexto/supabase/README.md          # protocolo + resumo
git show origin/contexto:docs/contexto/supabase/tables/public/<tabela>.md
git show origin/contexto:docs/contexto/supabase/lints.md           # antes de mexer em RLS/functions/índices
```

O repo é **privado**: `raw.githubusercontent.com` exige token. Pelo MCP `GITHUB - MCP - FOREVER`, use
`github_get_content` com `ref=contexto`.

Última coleta concluída publicada: `docs/contexto/supabase/manifest.json` → `gerado_em` (UTC).
Última publicação: `git log -1 --format=%cI origin/contexto -- docs/contexto/supabase`.
O manifest também informa `erros` e `carried`; uma coleta recente pode ser parcial. Detalhes em `errors.md`.
Seu timestamp não entra em `snapshot.json` nem nos fingerprints: consultar um banco sem mudanças
renova o frescor sem inventar uma alteração estrutural no `CHANGELOG.md`.

Neste repo `schema.sql` e `types.ts` estão desligados (`PGDUMP=false`, `GEN_TYPES=false` no workflow):
o runner só tem o client `pg_dump` 16 e a versão do servidor oficial não foi verificada; `types.ts` já é
versionado em `src/integrations/supabase/types.ts`, e ligá-lo exigiria Node no job do banco.

## Secret necessário

`SUPABASE_DB_URL` (Settings → Secrets and variables → Actions do repo `adm01-debug/Lalamove_V2`), com
estas três exigências:

1. **Session pooler, não conexão direta.** O host direto `db.iecgydonctmabiijadsf.supabase.co` é só IPv6
   e o runner do GitHub não tem IPv6 → falha na conexão. Use o "Session pooler" do dashboard:
   `postgresql://postgres.iecgydonctmabiijadsf:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres`.
2. **Usuário `postgres` (recomendado).** O `cron.job` e `cron.job_run_details` têm RLS com policy
   `username = current_user`; um role read-only comum enxerga zero jobs — e este projeto usa pg_cron
   (`docs/CRON_JOBS.md`). O `postgres` do Supabase tem `BYPASSRLS`. O script abre a sessão em
   `default_transaction_read_only = on` — mesmo com `postgres` nada é escrito.
3. Se preferir um role separado (perde o cron, vê o resto): SQL abaixo.

Criar/rotacionar esse secret é passo do dono (AGENTS.md: "Destrutivo, segredos e rotação: só com o dono").
O valor **nunca** entra em código, commit, log ou resposta.

## O que é coletado

| Fonte | O que entra |
|---|---|
| Postgres (catálogo) | schemas (+USAGE das roles da API), tabelas (RLS on/forced, partições — relevante para `tracking_events`, replica identity), colunas (tipo, default, identity/generated, enum, comentário), constraints (PK/FK/UNIQUE/CHECK com ON DELETE/UPDATE e referências reversas), índices (método, colunas, predicado), views + materialized (security_invoker, dependências), functions/procedures (corpo, security definer, search_path, quem pode executar via RPC), triggers (timing/eventos; inclui `auth.users` e `storage.objects`), policies RLS (inclui `storage` e `realtime.messages`), enums (+ onde são usados)/domains/composites, extensões, sequences (owned by), grants (tabela, coluna, sequence, **default privileges**), roles (+`rolconfig`: timeouts por role) |
| Supabase | `cron.job`, `pgmq` (filas), `supabase_migrations.schema_migrations` (com SQL), `storage.buckets`, `vault.secrets` (só nomes), Database Webhooks, realtime publications, foreign servers (credenciais redigidas) |
| Lints (`lints.md`) | RLS desabilitado / sem policies, tabela sem PK, FK sem índice, SECURITY DEFINER sem `search_path`, view em `public` sem `security_invoker`, função chamável por `anon`, extensão em `public`, policy com `auth.uid()` sem `(select …)`, tabela no Realtime sem REPLICA IDENTITY FULL |
| Relacionamentos | todas as FKs + diagrama ER Mermaid (até 120 tabelas) |
| Referências a cada função (`functions.md`, `snapshot.json` → `db.functions[].callers`) | referências estáticas (`.rpc('fn')` ou `fn(` em `src/`, `supabase/functions/`, migrations ativas, scripts operacionais…), jobs do pg_cron, triggers, outras funções e views |
| Management API (opcional) | edge functions (versão, verify_jwt, entrypoint, URL — 26 funções + `_shared` neste repo), nomes dos secrets, auth (providers, hooks, config), PostgREST (schemas expostos, max_rows), Postgres/pooler/storage config, network/SSL, branches, PITR/backups — segredos redigidos |
| Métricas voláteis (`stats.*`, `cron-runs.md`) | tamanho por tabela/schema, linhas e scans (aproximados), índices nunca usados, storage por bucket, auth (agregados), filas, top queries do `pg_stat_statements` (normalizadas), conexões, saúde dos serviços, últimas execuções do cron |

Nunca sai: linha de tabela, dado de usuário, valor de secret/chave/senha, connection string. O job do
workflow ainda roda um guard (`grep`) que aborta a publicação se algo com cara de JWT, `sb_secret_`,
`sb_publishable_`, PAT `sbp_*` ou URL de Postgres com senha aparecer na saída.

### Estatísticas de consultas

O schema de `pg_stat_statements` é descoberto em `pg_extension`/`pg_namespace`; a consulta usa
identificador delimitado e não depende do `search_path`. `STAT_STATEMENTS_TOP=0` ou extensão ausente
apenas omitem essa coleta opcional. Falha no catálogo, na view ou no tratamento do resultado é registrada
como `db_stats.top_queries`, preservando tamanho do banco, conexões, storage, filas e os agregados de
auth que puderam ser lidos. Erro em auth permanece independente como `db_stats.auth`. Nenhuma permissão é
concedida e nenhuma extensão é criada pelo coletor; a ausência de `top_queries` após erro não é
apresentada como lista vazia.

### Como interpretar referências a funções

O mapa de código ignora assinaturas de declaração/alteração de funções, diretórios históricos
`_foreign`/`_superseded`, testes, fixtures e stories reconhecidos por nome. Chamadas no corpo de uma
função SQL e em migrations ativas continuam contando; pastas sobrepostas em `CODE_SCAN_DIRS` não
duplicam as ocorrências. A busca por nome é heurística e compartilha referências entre overloads: não
comprova execução e a ausência de referência **não autoriza remover** uma função.

Se a coleta de `functions` falha, os metadados/SQL e as referências entre funções (`callers.db`)
continuam vindo do histórico. Código, cron, triggers e views atualizam suas próprias categorias quando
a fonte foi lida; fonte reaproveitada ou indisponível preserva as referências anteriores disponíveis.
Uma coleta bem-sucedida vazia remove referências antigas. Falha de leitura do código é registrada em
`errors.md`; não equivale a código sem chamadas.

### Role somente leitura (opcional — não enxerga pg_cron)

```sql
create role snapshot_reader login password '<senha-forte>';
grant pg_read_all_data to snapshot_reader;           -- leitura de todos os schemas
grant usage on schema cron, vault, storage, auth, supabase_migrations to snapshot_reader;
```
`pg_read_all_data` cobre `cron.job`, `vault.secrets` (só metadados; o valor descriptografado fica em
`vault.decrypted_secrets`, que o script não lê), `storage`, `auth` e `supabase_migrations`. Para
`pg_stat_statements` e `pg_stat_activity` completos, adicione `grant pg_read_all_stats to snapshot_reader;`.
Monte a `SUPABASE_DB_URL` com esse usuário.

## Variáveis opcionais (no workflow, bloco `env`)

| Var | Default | Efeito |
|---|---|---|
| `SNAPSHOT_DIR` | `docs/supabase` (no workflow: `docs/contexto/supabase`) | pasta de saída |
| `PGDUMP_SCHEMAS` | `public` | schemas do `schema.sql`, separados por vírgula |
| `GEN_TYPES` | `true` (no workflow: `false`) | gera `types.ts` via `npx supabase gen types` |
| `PGDUMP` | `true` (no workflow: `false`) | gera `schema.sql` via `pg_dump` (exige pg_dump >= versão do servidor) |
| `SNAPSHOT_EXCLUDE_SCHEMAS` | vazio | schemas extras a ignorar na introspecção |
| `SNAPSHOT_INCLUDE_SCHEMAS` | vazio | schemas internos do Supabase a forçar inclusão |
| `STAT_STATEMENTS_TOP` | `15` | consultas mais custosas em `stats.md` (0 desliga) |
| `CRON_RUNS_PER_JOB` | `3` | execuções recentes guardadas por job do pg_cron |
| `REPO_ROOT` | `.` | raiz do repo para cruzar funções × código (vazio desliga) |
| `CODE_SCAN_DIRS` | `src,supabase/functions,supabase/migrations,scripts,app,lib,server,api` | pastas varridas na busca de chamadas |

## Comportamento

- Só há commit quando o conteúdo estrutural mudou. Métricas voláteis vivem em
  `stats.md`/`stats.json`/`cron-runs.md`; quando só elas mudam, o commit é limitado a 1 por hora
  (`VOLATILE_MIN_INTERVAL_MIN` no workflow).
- Schemas internos do Supabase (`auth`, `storage`, `realtime`, `extensions`, `graphql*`, `net`,
  `pgsodium`, `vault`…) ficam fora da introspecção geral para não poluir; o que importa deles entra em
  seções dedicadas. Use `SNAPSHOT_INCLUDE_SCHEMAS` para forçar um deles.
- Uma seção que falha (ex.: sem permissão em `vault`) é reaproveitada da coleta anterior com aviso no
  topo do arquivo — nunca gera "tudo removido" no CHANGELOG.
- `CHANGELOG.md` registra, a cada mudança, o que foi adicionado/removido/alterado por categoria.
- Falha em uma seção não derruba as outras: vai para `errors.md` e para o README. O job só falha se o
  banco inteiro não responder, se o push falhar 3 vezes, ou se o guard de segredos detectar algo.
- Sessão read-only no Postgres, `statement_timeout` 90s, `lock_timeout` 5s. **Nada é escrito no banco.**
- A Management API devolve só o bundle compilado das edge functions, então o snapshot guarda metadados
  (`edge-functions/<slug>/README.md`); o fonte canônico é `supabase/functions/<slug>/` no repo.
- Conexão com `prepare_threshold=None`: funciona tanto na conexão direta quanto no pooler (session ou
  transaction mode). `pg_dump` exige session mode ou conexão direta.
- `concurrency` impede duas coletas simultâneas.
- Commits levam `[skip ci]` e o push usa `GITHUB_TOKEN` (não dispara outros workflows).

## Custo

O cron de 10 min ⇒ **~144 runs/dia** do workflow. Decisão do dono: ver "Custo" em
`.github/workflows/contexto.yml` e no README de `scripts/regras_negocio/`.

## Rodar localmente

```bash
pip install -r scripts/supabase_snapshot/requirements.txt    # psycopg[binary]>=3.1,<4
export SUPABASE_DB_URL='postgresql://...'                    # nunca ecoe esse valor
python3 scripts/supabase_snapshot/snapshot.py
```

## Testes offline

```sh
python3 scripts/supabase_snapshot/test_snapshot.py -v
```

Não exigem banco, rede, credenciais nem o pacote `psycopg`: a conexão é simulada. Verificam a preservação
do SQL e dos metadados em coletas parciais, a ausência de arquivos anteriores e a recuperação na coleta
saudável seguinte, as combinações de cron/triggers/views reaproveitados, o frescor do manifest em UTC e a
matriz de estatísticas. **109 testes, todos passando neste repo** (`Ran 109 tests … OK`).
