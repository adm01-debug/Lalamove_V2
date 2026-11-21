# AGENTS.md — Lalamove V2

Regras do dono para qualquer agente de IA; vencem `docs/` (histórico) e o `README.md`. Detalhe em
`docs/agentes/<tema>.md`; divergiu da realidade → corrija no mesmo PR do fix. Responda sempre em PT-BR.
Suplemento operacional do Hermes: `.hermes.md` (pastas de chat, cadeado do project-guard).

## Postura
- O dono não é dev: decide negócio; o agente executa a engenharia inteira via MCP. Nunca passo manual do
  dono nem pedir que ele revise diff.
- Qualidade + velocidade, mínimo de tokens. Decida como dev sênior; pergunte só com custo, arquitetura,
  dado destrutivo em produção, trade-off de negócio ou item "chame o dono". Para ler, não peça permissão.
- Verdade acima de validação: não sabe → diga; falhou → diga. Afirmação sobre código cita evidência
  (arquivo:linha, diff, saída de comando); sem evidência = "NÃO VERIFICADO" + motivo; nunca "testado" sem
  ter rodado. Branch/commit/PR não provam nada — leia o código.
- Diff mínimo, zero churn: causa raiz, não reescrita; não refatore, renomeie ou comente o que não foi pedido;
  não reescreva arquivo inteiro para mudar 3 linhas. Dependência nova ou bump major só se indispensável
  (avise na PR). As PRs do Dependabot foram todas fechadas/incorporadas em 21/11/2026 — ver
  `docs/AUDITORIA_PRS_FECHADAS_2026-11.md`.
- `APROVADO` = execute o plano como descrito, sem reconfirmar.
- Uma tarefa por vez, cada uma com sua branch/PR. Outro bug → "Próximos passos". Travou → reporte o erro
  exato e pare; não contorne regra. Releia o pedido antes de concluir.
- Tokens: leia só o trecho necessário; grafo antes de busca por texto; exploração ampla → subagente;
  nenhuma tool "por garantia"; não gere código que não será aplicado.
- Segredos nunca em código, commit ou resposta — só em env/secret do serviço (edge:
  `supabase secrets set` ou painel Supabase/Lovable). PAT exposto em chat → rotacionar na hora. Nunca
  imprima nem commite `.env`, PAT `sbp_*` ou `service_role`. `scripts/*.ts` já teve 19 arquivos com
  `service_role`/PAT hardcoded, e a edge `migrate-helper` vazava `service_role`/`db_url` sem JWT — PR
  `claude/fix-segredos-commitados-261108-2105` limpou o código; **a rotação das chaves e a confirmação de que a
  edge saiu da produção seguem pendentes com o dono** — ver `docs/agentes/banco.md` > "Segredos
  commitados".

## Bugs e funcionalidades
- Diagnóstico antes de patch: logs e estado real, ponto exato (arquivo:linha), causa; várias causas → liste
  todas, corrija a pedida.
- Antes da PR: typecheck/lint/testes do que tocou. Só erro seu conta; erro herdado da `main` → "Próximos passos".
- "Pronto" = PR mergeada + deploy confirmado + comportamento verificado (log, query ou request real); faltou
  um → diga onde parou.
- Funcionalidade pronta = integrada ponta a ponta (rota em `src/App.tsx`, entrada no menu em
  `src/components/layout/sidebar-config.ts`, hook/edge chamados, tabela com RLS, estados de
  erro/loading/vazio, submit), sem mock, hardcode ou TODO. Pela metade não é pronto; não cabe na sessão →
  entregue o funcional e liste o que falta, em ordem, com arquivos. Nunca deixe código morto ou feature
  "quase" sem dizer.
- Toda rota nova respeita o RBAC do `ProtectedRoute` (`requiredRole`, `requireMFA`) — ver
  `docs/agentes/regras-dominio.md`.

## Comunicação
- Resultado primeiro, só o que muda decisão do dono. Sem introdução, recapitulação, narração, hedging,
  disclaimer, lição de moral ou cortesia. Efeito no negócio; técnica só se perguntarem. Resposta e plano
  proporcionais ao tamanho do fix; não despeje log — cite a linha que importa. Caminhos, comandos e links
  completos. Destrutivo de verdade: uma linha ("isso apaga X, sem volta — confirma?").
- Toda execução fecha com exatamente 3 "Próximos passos" (`N. [título] — [por quê] · [arquivo]`), por
  impacto, do que você viu, executáveis via MCP, para não-dev; nada de genérico ("adicionar testes",
  "melhorar documentação", "revisar segurança"). É um menu: `1`, `1 e 3`, `APROVADO 2`, "todos" ou o bloco
  devolvido = executar na ordem, sem reconfirmar. Só consulta, já rejeitadas ou nada pendente →
  `Próximos passos: nada pendente neste escopo.`

## Fluxo Git — detalhe em `docs/agentes/github-ci.md`
- Repo `adm01-debug/Lalamove_V2`, `main`, **privado**. Escrita no GitHub: MCP **`GITHUB - MCP - FOREVER`**
  (`github_push_files`: `files` + `delete` num commit); `git push`/`gh` só em repo autorizado na sessão.
- Nunca commite em `main`. Só escreva em branch que **você** criou nesta sessão; branch alheia ou já
  existente é somente leitura. Antes do push, confira que o último commit é seu.
- PR aberta nos mesmos arquivos → pare e avise o dono (liste via `github_graphql`).
- Branch de `main` atualizado: `claude/<fix|feat|chore|infra>-<slug>-<AAMMDD-HHMM>`.
- Vários agentes no mesmo repo: o Hermes exige worktree isolado em vez de `git checkout -b` no clone
  compartilhado (`git worktree add "$HOME/hermes-workspaces/chat-<id>" -b <branch>`, cleanup com
  `git worktree remove --force` + `git worktree prune`). Em sessão de nuvem, cada sessão já tem o seu
  clone — branch nova basta.
- Commit PT-BR, 1 atômico, `<tipo>(<escopo>): <assunto ≥10 chars, sem ponto>`; tipos aceitos por
  `scripts/ci/commit-msg-lint.mjs`: `feat fix docs style refactor perf test build ci chore security revert`
  (não há `infra:` — branch `infra` → `ci:`/`chore:`). **Não há hook `commit-msg` instalado** (sem husky no
  `package.json`): rode `node scripts/ci/commit-msg-lint.mjs <arquivo>` à mão ou escreva certo de primeira.
- PR sempre: título = o que muda; corpo = causa + o que foi verificado, com evidência; o template é
  `.github/PULL_REQUEST_TEMPLATE.md`.
- Mergeie sem aprovação (squash, apague a branch à mão — `delete_branch_on_merge` está desligado) PR sua
  pronta: CI verde, sem conflito, escopo comum (front, edge, config, docs). **Atenção:** o `ERESOLVE` do `npm ci` foi resolvido e a CI
  da `main` está verde desde 21/11/2026 (runs #466+); qualquer vermelho agora é regressão real e bloqueia
  o merge. **Deixe aberta e chame o dono**:
  DDL/migration em produção; CI/workflows, segredos, Dockerfile; deleção de dado, arquitetura ou custo;
  conflito com PR de outro agente. **A `main` tem branch protection com 7 required checks**
  (`lint-and-typecheck`, `test`, `build`, `security`, `Deno Contract Tests`, `E2E (Playwright)`,
  `Guarda AGENTS.md / docs/agentes`) — verificado em 21/11/2026: o merge é recusado com HTTP 405 enquanto
  algum check não passa.
- Conflito: rebase em `main`; `--force-with-lease` só na sua branch.
- Merge = produção: confira o deploy e reporte (`docs/agentes/deploy.md`). CI vermelha → leia o resumo da
  falha antes de qualquer patch; do seu merge → `fix:` em branch nova na mesma sessão.
- Fim: link da PR + estado.

## Banco — ler `docs/agentes/banco.md` antes de SQL, migration ou deploy
- Oficial: Supabase Cloud **`iecgydonctmabiijadsf`** (`supabase/config.toml:1`).
- **Nenhum MCP Supabase desta sessão aponta para ele.** Os carregados são `SUPABASE - ZAPP WEB V2 - MCP`
  (`tnnnlkbymytvtqngbbqh`), `SUPABASE - GESTÃO DE CLIENTES` (`pgxfvjmuubtbowutlide`) e
  `SUPABASE - GESTÃO DE PRODUTOS` (`doufsxqlfjyuvxuezpln`) — **não escreva em nenhum deles**. Sem MCP do
  banco do Lalamove, qualquer afirmação sobre o estado da produção é "NÃO VERIFICADO" até o dono liberar
  acesso.
- Diagnóstico = produção só leitura; teste = Postgres descartável (`supabase start`); nunca "escrever para
  testar".
- DDL só pelo fluxo de `banco.md` (arquivo em `supabase/migrations/` → PR → merge → deploy do código →
  apply). Destrutivo, segredos e rotação: só com o dono.

## Serviços
- **Lalamove API v3** — ler `docs/agentes/lalamove-api.md` ao mexer em cotação, pedido, rastreamento, POD,
  token ou webhook. Edges `lalamove-api`, `lalamove-gateway`, `lalamove-uapi`, `lalamove-token-refresh`,
  `lalamove-webhook`; segredos `LALAMOVE_API_KEY`/`LALAMOVE_API_SECRET` só nas edges (HMAC).
- **Deploy (Vercel + Lovable)** — ler `docs/agentes/deploy.md` ao confirmar deploy ou mexer em env/domínio.
  Projeto Vercel `lalamove-v2` (team `juca1`) ligado a este repo; o `README`/`docs/DEPLOYMENT.md` ainda
  descrevem o deploy antigo pela Lovable. Nunca segredo de servidor no Vercel; `VITE_*` é público.
- **Mapbox** — token servido pela edge `get-mapbox-token` (JWT obrigatório) e proxy `mapbox-proxy`;
  `MAPBOX_ACCESS_TOKEN` nunca no front.
- **Bitrix24** — edges `bitrix24-sync` e `bitrix24-process-queue` (fila + OAuth2); segredos nas edges.
- **Notificações** — edge `send-notification` (WhatsApp/e-mail/Slack/Bitrix24/n8n) e `escalate-alerts`;
  chamadas internas usam `service_role`.
- **Lovable AI** — `route-analyzer` consome `LOVABLE_API_KEY` com **custo por token**: nunca invoque em
  massa para "testar".
- **GitHub/CI** — ler `docs/agentes/github-ci.md` ao mexer em settings, branch protection ou workflows.
- **Regras de domínio** — ler `docs/agentes/regras-dominio.md` ao mexer em papéis/MFA, aprovações, score de
  risco, fila de jobs, cache ou partições de `tracking_events`.

## Stack e comandos — detalhe em `docs/agentes/mapa-repo.md`
- Vite + React + TS (`src/`), Supabase (`supabase/functions/`, `supabase/migrations/`), Playwright (`e2e/`),
  **npm** (`package-lock.json`; não há `bun.lock` — `npm ci`), Node 22 no CI e 24.x no Vercel.
- `npx vitest run <caminho>` (configuração em `vitest.config.ts`, inclui `src/**/*.{test,spec}.{ts,tsx}`);
  `npx tsc --noEmit -p tsconfig.app.json`; `npx eslint <arquivos>`; `npx playwright test` (specs
  `e2e/*.e2e.ts`); contratos das edges: `deno test --allow-net --allow-env
  supabase/functions/_shared/contract.test.ts supabase/functions/lalamove-webhook/security.test.ts`.
- Guards antes do PR: `node scripts/ci/check-agents-md-integrity.mjs` (vigia este arquivo +
  `docs/agentes/`), `node scripts/ci/commit-msg-lint.mjs <arquivo-de-mensagem>` e
  `node --test scripts/ci/*.unit.mjs` (teste dos próprios guards).
- Antes de qualquer tarefa: `docs/agentes/mapa-repo.md` (onde fica cada coisa) e, para fluxo de negócio,
  `docs/ARCHITECTURE.md` + `docs/AUDITORIA_TECNICA_2026-09.md`.
- Automação em `scripts/<nome>/` com README (leia antes de alterar); scripts soltos na raiz de `scripts/`
  são legado de sessões antigas (e vazam segredo) — não crie novos lá.

## Grafo de código (graphify)
Grafo em `graphify-out/` (`npm run graph:setup`; ver `mapa-repo.md`). Quando `graphify-out/graph.json`
existir: `graphify query "<pergunta>"`, `graphify path "<A>" "<B>"`, `graphify explain "<conceito>"` antes
de buscar por texto; `GRAPH_REPORT.md` só para revisão ampla. Alterou código ou o report não é do HEAD
atual → `graphify update .` (só AST). Em nuvem o grafo é gerado em segundo plano
(`.claude/hooks/session-start.sh`) — siga sem ele até terminar.
