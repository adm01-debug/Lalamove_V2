# Mapa do repositório — referência para agentes

Ler quando precisar saber onde fica algo antes de buscar por texto.

## Onde olhar primeiro

| Precisa de | Leia |
|---|---|
| Visão geral, fluxos desenhados, tabelas, edges, hooks | `README.md` (≈46 KB, com índice no topo) |
| Camadas, decisões e integrações | `docs/ARCHITECTURE.md` |
| O que está quebrado / dívida levantada | `docs/AUDITORIA_TECNICA_2026-09.md`, `docs/audit_report.md`, `SECURITY_CHECKLIST.md` |
| Inventário de funcionalidades (o que existe de verdade) | `docs/LEVANTAMENTO_COMPLETO_FUNCIONALIDADES.md`, `docs/FUNCIONALIDADES_E_FERRAMENTAS.md` |
| Qual banco, migrations, GitHub, deploy, API Lalamove, regras de domínio | `AGENTS.md` + `docs/agentes/*.md` (esta pasta) |
| Operação (incidente, plantão, simulação de falha) | `docs/RUNBOOK_LALAMOVE.md`, `docs/TROUBLESHOOTING.md`, `docs/LALAMOVE_FAILURE_SIMULATION.md` |
| Contratos de API e webhooks | `docs/API_CONTRACTS.md`, `docs/API_REFERENCE.md`, `docs/WEBHOOK_HANDLER.md`, `docs/LALAMOVE_API_V3.md` |
| Fila, cache, logs, screening, cron | `docs/JOB_QUEUE_SYSTEM.md`, `docs/QUEUE_SYSTEM.md`, `docs/CACHE_SYSTEM.md`, `docs/LOGGING_AND_HEALTH.md`, `docs/SCREENING_SYSTEM.md`, `docs/CRON_JOBS.md` |
| Decisões registradas | `docs/adr/001-rls-first-architecture.md`, `docs/adr/002-driver-locations-partitioning.md` |
| Camada de mapas (Google Maps × Mapbox): análise, planos de 100 etapas, decisões D1–D12/M1–M10 | `docs/planos/README.md`, `docs/planos/ANALISE_GOOGLE_MAPS_X_LALAMOVE_V2.md`, `docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md`, `docs/planos/PLANO_MAPBOX_100_ETAPAS.md`, `docs/MAPBOX.md` |
| Histórico | `CHANGELOG.md`, `docs/LALAMOVE_MASTER_ANALYSIS.md`, `docs/LALAMOVE_SCORECARD.md`, os `lalamove_*.md/html/docx/pdf` da raiz — contexto, **não** fonte de verdade |

Nenhum desses docs é gerado por script: todos foram escritos à mão em sessões anteriores e **podem estar
desatualizados** (o `docs/DEPLOYMENT.md`, por exemplo, ainda descreve só o deploy pela Lovable). Divergência
entre doc e código: o código ganha; corrija o doc no mesmo PR.

## Mapa rápido

| Onde | O que tem |
|---|---|
| `src/App.tsx` | **todas** as rotas (`<Route>`), cada uma com `ProtectedRoute requiredRole` / `requireMFA` — é o índice real das telas |
| `src/pages/` | 54 páginas `*Page.tsx` + subpastas por domínio (`orders/`, `drivers/`, `reports/`, `approvals/`, `lalamove/`, `settings/`, `permissions/`, `heatmap/`, `incidents/`, `evaluations/`, `ip-whitelist/`, `ratelimit/`, `map-tools/`, `bitrix24/`, `alert-configurations/`) |
| `src/components/` | 131 componentes em `ui/` (shadcn) + por domínio: `dashboard/`, `orders/`, `drivers/`, `map/`, `alerts/`, `approvals/`, `notifications/`, `reports/`, `webhooks/`, `health/`, `admin/`, `auth/`, `layout/`, `pwa/`, `debug/`, `lalamove/` |
| `src/hooks/` | 82 hooks (`useLalamove`, `useLalamoveUapi`, `useJobQueue`, `usePermissions`, `useMFA`, `useDrivers`, `useApproval*`, `useCache*`, `useMetrics`…) + `__tests__/` |
| `src/lib/` | regra de negócio do Lalamove fora do React: `lalamove-api.ts`, `lalamoveValidation.ts`, `lalamoveGuards.ts`, `lalamoveTimeline.ts`, `lalamoveErrors.ts`, `lalamoveOrderEdit.ts`, `uapi-proxy.ts`, `cep.ts`, `phone.ts`, `bitrix-config.ts` |
| `src/utils/` | `circuitBreaker.ts`, `logger.ts`, `exportUtils.ts`, `alertSounds.ts`, `timeUtils.ts`, `webVitals.ts` |
| `src/services/` | `errorMonitoring.ts` (as classes de domínio citadas no `README` vivem em `src/lib/` e nas edges) |
| `src/integrations/supabase/` | `client.ts`, `types.ts` (**gerado** — não editar à mão), `previewAuthStorage.ts` |
| `src/integrations/lovable/` | `index.ts` (auth brokerado do preview Lovable) |
| `src/types/` | `lalamove.ts`, `driver.ts`, `index.ts` (+ `__tests__/`) |
| `src/i18n/locales/` | `pt-BR.json`, `en.json`, `es.json` |
| `supabase/functions/` | 27 edge functions + `_shared/` (`contract.ts`, `schemas.ts`, `cors.ts`, `logger.ts`, `telemetry.ts` e os dois `contract*.test.ts`) |
| `supabase/migrations/` | 153 arquivos `.sql` (`20241231000000` … `20260902000000`) |
| `supabase/config.toml` | `project_id` + `verify_jwt` por função — leia antes de criar edge nova |
| `e2e/` | Playwright, specs `*.e2e.ts` (`login-lockout`, `mfa`, `password-reset`, `rbac`) + `helpers/auth.ts` |
| `scripts/` | 30 scripts soltos de sessões antigas (`apply-*`, `fix-*`, `list-tables*`, `seed-*`, `test-*`, `backup.sh`, `deploy.sh`, `health-check.sh`, `pre-commit-secrets.sh`). **Vários têm `service_role`/PAT no código** (`docs/agentes/banco.md` > Segredos commitados) e alguns reabrem RLS permissiva — não rode por impulso e não crie novos aqui |
| raiz | `lalamove_token_manager.py` + `lalamove_cron_setup.sh` + `lalamove_f0*.json`/`lalamove_bundle_import.json` são o servidor de token e os workflows do **n8n** (`lalamove_n8n_integration.md`), fora do build do front |
| `Makefile` | atalhos de Supabase local (`make start/stop/db-reset/db-migrate/backup/deploy`) |

## Comandos

O repo usa **npm**: há `package-lock.json` e **não** há `bun.lock` — `npm ci` (é o que o CI roda).

- testes unitários só do que você tocou: `npx vitest run <caminho>` (`vitest.config.ts`: `jsdom`, setup em
  `src/test/setup.ts`, inclui `src/**/*.{test,spec}.{ts,tsx}`, cobertura mínima de 70% configurada);
- typecheck: `npx tsc --noEmit -p tsconfig.app.json` (o CI roda `npx tsc --noEmit`, que resolve as
  referências de `tsconfig.json`);
- lint dos arquivos tocados: `npx eslint <arquivos>` (`eslint.config.js`);
- E2E: `npx playwright test` (ou `npm run test:e2e`); sobe o Vite na porta 8080 sozinho;
- contratos das edges: `deno test --allow-net --allow-env supabase/functions/_shared/contract.test.ts
  supabase/functions/lalamove-webhook/security.test.ts`;
- guards do padrão de agentes: `node scripts/ci/check-agents-md-integrity.mjs`,
  `node scripts/ci/commit-msg-lint.mjs <arquivo>` e `node --test scripts/ci/*.unit.mjs`;
- banco local: `supabase start` + `supabase db reset` (aplica as 153 migrations do zero).

**Não há hook de git instalado** (sem husky no `package.json`, `.git/hooks` só com `*.sample`): o
`.lintstagedrc` e o `scripts/pre-commit-secrets.sh` não rodam sozinhos.

## Grafo de código (graphify) — detalhes

`npm run graph:setup` → `scripts/graphify/setup.sh`; precisa de `uv` ou `pipx`. `graphify-out/` fica no
`.gitignore`: cada clone gera o seu. Frescura: compare `git rev-parse --short HEAD` com a linha
"Built from commit" de `graphify-out/GRAPH_REPORT.md`; se divergir, `graphify update .` (só AST, sem custo
de API). Os hooks `PreToolUse` em `.claude/settings.json` chamam `graphify hook-guard` e não fazem nada
onde o graphify não estiver instalado. Em sessão de nuvem, `.claude/hooks/session-start.sh` instala o
graphify e gera o grafo em segundo plano (log em `graphify-out/.session-start.log`; pula se o grafo já é do
commit atual).
