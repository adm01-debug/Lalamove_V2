# `scripts/ci/` — guardas de CI do Lalamove V2

Scripts que provam, sem rodar o app, propriedades que o repositório precisa manter:
estrutura dos workflows, pins de supply chain, inventário de testes, quarentena e
relatórios. Só APIs nativas do Node 22 — **nenhum deles depende de `node_modules`**, então
rodam antes de `npm ci`.

Rode tudo com:

```sh
node --test scripts/ci/*.unit.mjs        # testes dos próprios guardas
```

> **Nenhum destes guardas está ligado ao `.github/workflows/ci.yml` ainda.** O ci.yml tem
> PR aberta (#81) e não pode ser editado nesta leva. Os comandos para ligar cada um estão
> na coluna "como rodar"; o passo que falta no ci.yml está em
> [Pendências de ligação](#pendências-de-ligação).

---

## Estrutura, workflows, docs e testes (porte do Zapp Web V2 — grupo 1)

| Script | O que audita | Como rodar | Secrets / rede |
|---|---|---|---|
| `render-workflow-docs.mjs` | Todo `.github/workflows/*.yml` declara, no topo, um bloco `# docs:` com `gatilho`, `prova`, `falha` e `avisa` (e opcionalmente `# nao-e-bug:`). Projeta isso em `docs/ci/README.md`. | `node scripts/ci/render-workflow-docs.mjs` (gera) · `--check` (falha se divergir) | nenhum |
| `workflow-invariants.mjs` | 4 invariantes do `ci.yml`: **I1** os jobs de gate declarados existem; **I2** nenhum usa `if: always()` no nível do job (usar `!cancelled()`); **I3** `npx vitest run` e `npx playwright test` em no máximo 1 job cada; **I4** todo `actions/upload-artifact` tem `if:`. | `node scripts/ci/workflow-invariants.mjs [arquivo.yml]` | nenhum |
| `check-workflow-pins.mjs` | **P1** Action referenciada por SHA de 40 caracteres (tag é mutável); **P2** `owner/repo` presente em `allowed-actions.json`; **P3** `*_IMAGE` com `@sha256:`; **P4** versão de toolchain literal igual à de `.github/toolchain.json`. | `node scripts/ci/check-workflow-pins.mjs` | nenhum |
| `check-workflow-pins-resolvem.mjs` | Cada pin `owner/repo@<sha40> # vX.Y.Z` é o commit **real** da tag do comentário (pin inventado derruba o workflow no "Set up job"). | `node scripts/ci/check-workflow-pins-resolvem.mjs` | **rede**: `git ls-remote https://github.com/...`, sem token |
| `check-test-inventory.mjs` | **T1** todo `supabase/functions/**/*.test.ts` é citado no `ci.yml` (ou coberto pelo glob); **T2** toda suíte Node de `scripts/` (`*.test.mjs`, `*.unit.mjs`, `*.integration.mjs`) aparece dentro de um bloco `run:` de algum workflow. Citação em comentário, nome de etapa ou `env:` não conta. | `node scripts/ci/check-test-inventory.mjs` | nenhum (usa `git ls-files` se houver git) |
| `check-quarantine.mjs` | `e2e/quarantine.js`: cada item em quarentena tem `spec` existente no recorte `e2e/*.e2e.ts`, `motivo`, `issue` e `prazo` em `AAAA-MM-DD`; **prazo vencido derruba o CI**. Arquivo ausente = nada em quarentena (passa com aviso). | `node scripts/ci/check-quarantine.mjs [--hoje=AAAA-MM-DD]` | nenhum |
| `gerar-matriz-edge-tabela.mjs` | Matriz edge function × tabela a partir de `.from('tabela')` em `supabase/functions/<fn>/**/*.ts`. Gera `docs/ci/MATRIZ_EDGE_TABELA.md`. | `node scripts/ci/gerar-matriz-edge-tabela.mjs` · `--check` | nenhum |
| `redigir-relatorio.mjs` | Redige segredos do `playwright-report/` **antes** do upload — inclusive dentro dos ZIP de trace e do ZIP base64 embutido no `index.html` — e falha se sobrar uma ocorrência. | `node scripts/ci/redigir-relatorio.mjs playwright-report --segredo-env=NOME [--segredo-env=OUTRO]` | lê o **valor** pelo nome da env (nunca por argv): `LOVABLE_BROWSER_SUPABASE_SESSION_JSON`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `marcador-specs.mjs` | Biblioteca + CLI do marcador de causa do alerta de E2E: `sha256` dos diretórios de `test-results/` para o alerta só repetir quando a causa muda; detecta "falhou o login" vs "spec quebrado". | `node scripts/ci/marcador-specs.mjs [dir=test-results]` | nenhum |
| `issue-rotativa.mjs` | Biblioteca: abre/atualiza/**rotaciona** a issue de alerta (fecha com resumo e reabre ao passar de 20 comentários). Recebe `gh(method, path, body)` injetado — não fala com a rede por conta própria. | importado por `actions-kpi.mjs --publicar` | o `gh` injetado precisa de token |
| `actions-kpi.mjs` | KPI de uso do Actions numa janela de dias: runs, cancelados, falhas, minutos por workflow + 5 jobs mais lentos. **Somente leitura por padrão.** | `node scripts/ci/actions-kpi.mjs` · `--publicar` abre/atualiza a issue `[kpi-actions]` | `GITHUB_REPOSITORY` + `GH_TOKEN`/`GITHUB_TOKEN`; `JANELA_DIAS` (default 7) |
| `branch-podaveis.mjs` | Monta o bloco `git push origin --delete` das branches patch-equivalentes à `main`, com commit há mais de 7 dias, sem PR aberta, fora de `main`/`develop`/protegidas e com nome seguro para shell. **Nunca apaga nada.** | `node scripts/ci/branch-podaveis.mjs --equivalentes <tsv> --prs <json> --protegidas <txt> [--limite-prs N]` | nenhum (os arquivos vêm de passos `git`/`gh` anteriores) |
| `fila-merge.mjs` | Fila de merge serial, **somente leitura**: uma PR em voo por vez; indica a próxima atrasada com auto-merge (FIFO por `enabledAt`); PR com check vermelho fica fora. Não atualiza, não aprova, não mergeia. | `node scripts/ci/fila-merge.mjs` · `--confirmar <n> [--recusadas "A B"]` | `GITHUB_REPOSITORY` + `gh` autenticado (só leitura) |
| `workflow-test-support.mjs` | Infraestrutura dos testes dos guardas: leitores de job/step/valor de YAML em blocos (`jobsOf`, `jobOf`, `stepsOf`, `valueOf`, `conditionAllows`…). Não é parser YAML geral. | importado pelos `*.unit.mjs` | — |
| `allowed-actions.json` | Allowlist de `owner/repo` de Action, lida por `check-workflow-pins.mjs`. | — | — |
| `.github/toolchain.json` | Fonte única das versões literalizadas nos workflows (`node`, `deno`). | — | — |

### Pendências de ligação

Nenhum passo foi acrescentado ao `ci.yml` (PR #81 aberta no arquivo). Para ligar o grupo 1
num workflow, estes são os comandos:

```yaml
- run: node --test scripts/ci/*.unit.mjs
- run: node scripts/ci/workflow-invariants.mjs
- run: node scripts/ci/check-workflow-pins.mjs
- run: node scripts/ci/check-workflow-pins-resolvem.mjs
- run: node scripts/ci/check-test-inventory.mjs
- run: node scripts/ci/check-quarantine.mjs
- run: node scripts/ci/render-workflow-docs.mjs --check
- run: node scripts/ci/gerar-matriz-edge-tabela.mjs --check
```

E, no job `e2e`, antes do `upload-artifact`:

```yaml
- name: Redigir segredos do relatório
  if: ${{ !cancelled() }}
  run: node scripts/ci/redigir-relatorio.mjs playwright-report --segredo-env=VITE_SUPABASE_PUBLISHABLE_KEY
```

Para a quarentena ter efeito de verdade, o `playwright.config.ts` precisa ignorar os specs
declarados (`testIgnore: specsEmQuarentena(quarentena)` — ver `check-quarantine.mjs`). Hoje
não ignora: o guarda valida a lista, mas o Playwright ainda roda os specs.

### Limitações conhecidas

- `check-workflow-pins.mjs` compara versões em `node-version:`/`deno-version:` literais. Versão
  passada por expressão (`node-version: ${{ env.NODE_VERSION }}`, como no `contexto.yml`) é
  ignorada: o valor não está na linha. O `env:` que a define não é conferido.
- `check-test-inventory.mjs` deixa `src/**/*.{test,spec}.{ts,tsx}` fora de propósito — o
  `ci.yml` roda `npx vitest run` sem caminho e o `include` do `vitest.config.ts` cobre a
  pasta inteira; cobrar citação individual geraria órfão falso.
- `gerar-matriz-edge-tabela.mjs` não vê tabela acessada por `.rpc()`, por nome em variável
  (`from(nome)`) nem por SQL cru.
- O helper `resolverExecutavel` está **embutido** em `check-workflow-pins-resolvem.mjs`,
  `check-test-inventory.mjs` e `fila-merge.mjs`. No Zapp ele vinha de
  `scripts/lib/seguranca-processo.mjs`; aqui a duplicação é deliberada para o grupo 1 não
  depender de arquivo de outro porte em andamento.

### O que NÃO foi portado do Zapp Web V2 (e por quê)

| Script do Zapp | Motivo |
|---|---|
| `reuso-arvore.mjs` | Dispensa a CI do push quando a árvore já foi aprovada na PR. Só funciona com branch protection `strict=true` + squash — a `main` deste repo não tem branch protection nem required check, então as árvores raramente coincidem e o script (fail-open) cairia sempre em "roda tudo". Além disso precisaria de um job dentro do `ci.yml`, que está bloqueado. Zero benefício hoje. |
| `fila-merge` com `github-settings-baseline.json` | Portado, mas **sem** o baseline: não existe `required_status_checks` aqui. A regra "check vermelho segura a PR" passou a valer para todos os checks do rollup (fail-closed). |
| `check-audit-pdf-determinism.mjs` | Verifica que `generate_audit_pdf.ts` gera PDF byte-idêntico em 3 fusos. Este repo não tem gerador de PDF — `docs/audit_report.pdf` é arquivo estático commitado. Sem o gerador, o guarda não tem o que rodar. |
| `check-claude-md-integrity.mjs` | Já existe equivalente: `scripts/ci/check-agents-md-integrity.mjs`. |
| `commit-msg-lint.mjs` | Já existe neste repo. |
| `check-talkx-pr-body.mjs` e demais `talkx-*` | Talk X é produto do Zapp; não existe aqui. |
| `install-pgbouncer.sh`, `install-postgresql-client.sh`, `team-chat-local-gates.sh` | Infra de CI do Zapp (PgBouncer, psql no runner, gates locais do team-chat). Nada disso existe neste repo. |
| `e2e-teardown.mjs` | Apaga fixtures de E2E em produção do Zapp (instância Evolution `PRINCIPAL`). Específico daquele ambiente. |

---

## Outros guardas desta pasta

Os arquivos de ratchet (`lint-ratchet`, `typecheck-ratchet`, `implicit-any-ratchet`,
`a11y-button-name-ratchet`), de segredos (`check-bundle-secrets`,
`check-e2e-artifact-secrets`, `check-pr-workflow-secrets`, `check-edge-error-exposure`),
de orçamento (`bundle-budget`, `vercel-env-baseline`) e seus `*-baseline.json` vêm de outro
porte, feito em paralelo — a documentação deles entra aqui depois, pelo dono daquele lote.

`check-agents-md-integrity.mjs` e `commit-msg-lint.mjs` são do próprio repositório e estão
descritos em `AGENTS.md` > "Stack e comandos".
