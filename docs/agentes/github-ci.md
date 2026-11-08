# GitHub (perímetro, CI, workflows) — referência para agentes

Ler quando mexer em branch protection, settings do repo, `.github/workflows/`, ou quando um merge ou um
workflow falhar de forma estranha.

## Escrita no GitHub

- Repo `adm01-debug/Lalamove_V2` (grafia canônica), branch `main`, **privado**.
- **Escrita: preferir o MCP `GITHUB - MCP - FOREVER`** (`github_push_files`). O MCP padrão do GitHub
  retorna 403 em write nos repos `adm01-debug`. `github_push_files` sobrescreve o arquivo — mande o
  conteúdo integral com apenas a mudança semântica e confira depois que o remoto bate com o que você
  testou; aceita `files` e `delete` no mesmo commit (1 commit atômico).
- `git push`/`gh` só quando **este** repo está entre as fontes autorizadas da sessão (em sessão de nuvem,
  o cabeçalho da sessão lista o escopo). Fora disso o proxy devolve 403 — use o MCP.
- Para listar PRs abertas com os arquivos que tocam em uma chamada só, use `github_graphql`
  (`pullRequests(states:OPEN){ nodes { number headRefName files { nodes { path } } } }`):
  `github_list_pull_requests` devolve o repositório inteiro em cada nó e estoura o contexto.
- Commits: `<tipo>(<escopo>): <assunto>` com assunto ≥ 10 caracteres e sem ponto final; tipos aceitos por
  `scripts/ci/commit-msg-lint.mjs`: `feat fix docs style refactor perf test build ci chore security
  revert`. `infra` existe só como tipo de **branch** (`claude/infra-...`); no commit use `ci:` ou `chore:`.
  **Não há hook `commit-msg` instalado** (`package.json` não tem husky nem `prepare`, e `.git/hooks` só
  tem os `*.sample`) — o `.lintstagedrc` da raiz também é inerte. Rode o lint à mão quando quiser a
  conferência: `node scripts/ci/commit-msg-lint.mjs .git/COMMIT_EDITMSG`.

## Perímetro do GitHub — estado canônico (lido em 2026-11-08, HEAD `924454e`)

**Regra:** qualquer mudança nos campos abaixo atualiza **esta tabela** no mesmo PR.

| Campo | Estado canônico | Lido por |
|---|---|---|
| Visibilidade | **privado**; `has_issues` e `has_wiki` ligados, `has_discussions` desligado | `github_get_repo` |
| Branch protection em `main` | **nenhuma** (`branchProtectionRules: []`) | `github_graphql` |
| Rulesets | **nenhum** (`[]`) | `github_list_rulesets` |
| Required status checks | **nenhum** — CI vermelha **não** impede merge | consequência dos dois acima |
| Merge | `allow_squash_merge=true` · `allow_merge_commit=true` · `allow_rebase_merge=true` · `allow_auto_merge=**false**` · `delete_branch_on_merge=**false**` · `allow_update_branch=false` | `github_get_repo` |
| Squash | `squash_merge_commit_title=COMMIT_OR_PR_TITLE` · `squash_merge_commit_message=COMMIT_MESSAGES` | `github_get_repo` |
| Environments | **3**: `copilot` · `Preview` · `Production` — todos sem protection rule e sem política de branch | `github_list_environments` |
| Actions | `enabled=true` · `allowed_actions=**all**` · `sha_pinning_required=**false**` | `github_get_actions_permissions` |
| Secrets de Actions | **3**: `VITE_SUPABASE_PROJECT_ID` · `VITE_SUPABASE_PUBLISHABLE_KEY` · `VITE_SUPABASE_URL` | `github_list_actions_secrets` (nomes) |
| PRs abertas | **10**, todas do Dependabot (#68–#77), só `package.json` + `package-lock.json` | `github_graphql` |
| `homepage` do repo | `https://lalamove-v2.vercel.app` — **não** é um domínio do projeto Vercel (ver `docs/agentes/deploy.md`); valor provavelmente obsoleto | `github_get_repo` |

Consequências práticas, não teóricas:

- **Sem branch protection e sem auto-merge, quem segura merge ruim é o agente.** Antes de mergear: CI verde
  no commit da PR (`github_list_check_runs` / `github_get_run_failure_summary`), sem conflito, escopo comum.
  Dúvida → PR aberta e chame o dono.
- **`delete_branch_on_merge=false`:** depois do squash, apague a branch (`github_delete_branch`).
- **`merge_commit` e `rebase` continuam habilitados**: não use — padrão é squash, para a `main` ficar legível.
- **Nada bloqueia push direto em `main`.** A regra "nunca commite em `main`" é só disciplina; não há rede
  de proteção.
- O token desta sessão **tem** permissão administrativa de leitura (`permissions.admin=true` em
  `github_get_repo`), então os campos acima são leitura real — não "não verificável".

## Workflows

Há **1** arquivo: `.github/workflows/ci.yml` (`name: CI/CD`) — mais os dinâmicos do GitHub (Dependabot,
Dependency Graph, Copilot). Gatilhos: `push` em `main` e `develop`; `pull_request` para `main`.

| Job | O que roda | Depende de |
|---|---|---|
| `lint-and-typecheck` | `npm ci`, `npm run lint`, `npx tsc --noEmit` | — |
| `test` | `npx vitest run --reporter=verbose` | `lint-and-typecheck` |
| `e2e` | Playwright chromium com `VITE_SUPABASE_*` dos secrets; sobe artifact `playwright-report` | `lint-and-typecheck` |
| `contract-tests` | `deno test` em `_shared/contract.test.ts` + `lalamove-webhook/security.test.ts` | — |
| `edge-integration-tests` | `deno test` de I/O **contra as edges implantadas**, só em `refs/heads/main` | `contract-tests` |
| `build` | `npm run build` | `test`, `contract-tests` |
| `security` | `npm audit --audit-level=high` | — |
| `deploy` | só `echo "Deploy automático via Lovable"` — **não implanta nada** | `build` |

**O CI está vermelho na `main` desde 2026-10-03, no primeiro passo.** `npm ci` aborta com `ERESOLVE`
(conflito de peer dependency), então `lint-and-typecheck` e `security` falham e `test`, `e2e`, `build`,
`edge-integration-tests` e `deploy` ficam `skipped`; só `Deno Contract Tests` passa, porque não usa npm.
Evidência: run `37129323702` na `main` (`924454e`) com `conclusion: failure`; run `37834522487`
(`dependabot/.../vite-8.3.2`, `45ef819`) com o passo falho `Run npm ci` nos dois jobs. É a **mesma** causa
que derruba o build do Vercel (`docs/agentes/deploy.md`). Consequências para você:

- **"CI verde" não existe neste repo hoje** — não espere por isso para mergear uma PR fora do perímetro de
  dependência; compare o estado da sua PR com o da `main` (`gh api .../actions/runs?branch=main`) e diga na
  PR que a falha é herdada, com o número do run.
- Qualquer PR que **mexa em dependência ou lockfile** é a exceção: ali o `npm ci` é o alvo, e verde passa a
  ser obrigatório.
- Enquanto isso valer, o que de fato roda é `Deno Contract Tests` — rode o resto localmente antes da PR.

Armadilhas deste CI:

- **O job `e2e` e o `edge-integration-tests` batem na produção** (secrets do projeto real). Spec ou teste
  de contrato que escreve dado deixa lixo em produção — leia `docs/agentes/banco.md` antes de alterá-los.
- **`npm ci` é obrigatório**: o repo usa `package-lock.json`; não existe `bun.lock`. Lockfile desatualizado
  derruba todos os jobs no primeiro passo.
- **Actions sem pin de SHA** (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`,
  `denoland/setup-deno@v2`) e `allowed_actions=all`: qualquer mudança de tag upstream entra sem revisão.
- **Node divergente**: CI em `22`, Vercel em `24.x` (`docs/agentes/deploy.md`). Build que passa no CI pode
  falhar no deploy — foi isso que derrubou o último deploy do Vercel.
- `npm audit --audit-level=high` sem `continue-on-error`: aviso novo de dependência reprova o job
  `security` sem ter relação com o seu diff (não é required check, mas pinta a PR de vermelho).
- `develop` aparece no gatilho e **não existe** no remoto: `github_list_branches` devolve 25 branches e
  nenhuma é `develop`. O remoto carrega lixo de sessões antigas — `master` (parada em `b4d7a5d`), quatro
  `lovable-sync-*`, seis `fix/*`, `chore/deps-batch-2026-09`, `deps/all-bumps-consolidated`,
  `claude/auditoria-tecnica-sistema-4g42vd` e as 10 do Dependabot. Branch alheia é **somente leitura**:
  não rebase, não force-push, não apague sem ordem do dono.

## Guards que você pode rodar antes do PR

- `node scripts/ci/check-agents-md-integrity.mjs` — exige as seções obrigatórias do `AGENTS.md` e barra o
  conjunto `AGENTS.md` + `CLAUDE.md` + `docs/agentes/*.md` encolher mais de 30% (ou qualquer arquivo
  vigiado encolher mais de 50%) em relação à base. Base por variável: `CLAUDE_MD_BASE=origin/main`.
- `node scripts/ci/commit-msg-lint.mjs <arquivo-de-mensagem>` — Conventional Commits do repo.
- `node --test scripts/ci/*.unit.mjs` — teste dos próprios guards (9 casos: tipos aceitos, assunto curto,
  ponto final, escopo maiúsculo, mensagens que o git gera e o canal real do CLI).
- `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint <arquivos>`, `npx vitest run <caminho>` — o que o
  job `lint-and-typecheck`/`test` vai rodar de novo no CI.

Nenhum dos dois guards está ligado ao CI hoje: ligá-los mexe em `.github/workflows/` → **PR aberta e chame
o dono** (regra do `AGENTS.md`).
