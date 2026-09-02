# 🔬 Auditoria Técnica — Lalamove V2

> **Data:** 2026-09-02 · **Auditor:** Claude (Arquiteto Sênior + QA)
> **Escopo:** repositório `adm01-debug/lalamove_v2` (branch `main`) + banco Supabase de destino `iecgydonctmabiijadsf`
> **Método:** leitura de código + inspeção do estado real do banco via MCP (RLS, policies, grants, funções, crons, pg_stat_statements). Lint/tsc/build **não** foram executados nesta sessão (cobertos pelo CI); nenhum resultado de teste é afirmado como validado localmente.

---

## Nota final: **7,2 / 10**

Sistema maduro (~80–85% pronto), com fundação de segurança forte (RLS 100%, RBAC, MFA) e documentação excepcional, mas com **um punhado de falhas de segurança concretas** que puxam a nota crítica para baixo: `.env` commitado com drift de projeto, `GRANT ALL` para `anon` em 65 tabelas, webhook que falha-aberto e uma edge function não autenticada sem fonte no repositório.

---

## Fase 0 — Inventário do Sistema

| Item | Valor |
|---|---|
| Stack | React 18.3 + Vite 7 + TypeScript 5.8 (strict) + Tailwind/shadcn · Supabase (PG 17.6) · Deno Edge Functions |
| Código | ~455 arquivos `.ts/.tsx`, ~84.880 linhas · 697 arquivos versionados |
| Frontend | 55 páginas, **62 rotas** (`src/App.tsx`), estado via TanStack Query + Zustand |
| Banco | schema `public`: **62 tabelas + 3 views** · 20 MB · **103 migrations** aplicadas |
| Edge Functions | **25 deployadas** (`verify_jwt` misto) |
| Automação | **10 cron jobs** (`pg_cron`) + `pg_net` para HTTP · **47 funções SECURITY DEFINER** |
| Integrações | Lalamove (v2/uAPI), Bitrix24 (OAuth+fila), Mapbox (proxy), Lovable AI |
| Testes | 44 arquivos (Vitest unit + Playwright e2e: rbac/mfa/login-lockout/password-reset + Deno contract tests) |
| Docs | 27 documentos em `docs/` + 2 ADRs + CHANGELOG + README (46 KB) |
| Dados (prod/staging) | 3 usuários, 50 pedidos, 20 motoristas, 30 contatos, 105 alertas, 216 eventos de tracking |
| Último pedido | 2026-08-27 (sistema ativo) |

---

## Fase 1 — As 20 Dimensões

### 1. Arquitetura — **7/10**
**Evidências:** organização feature-based (`src/components/<domínio>`, `src/pages/<domínio>`), camada compartilhada de edge (`supabase/functions/_shared/`: contract, schemas, logger, telemetry, cors). ADRs presentes (`docs/adr/001-rls-first-architecture.md`, `002-driver-locations-partitioning.md`). Separação UI/serviço/dados razoável (`src/services`, `src/hooks`).
**Gaps p/ 10:** algumas "god pages" (`MetricsPage` dividida em `.panels.tsx`, `RiskRulesPage` em `.dialogs.tsx` — sinal de arquivo grande fatiado); ausência de boundary explícito entre domínios; **drift arquitetural**: config do cliente aponta para projeto Supabase diferente do backend deployado.
**Ações:** documentar o mapa de módulos em `docs/ARCHITECTURE.md`; extrair lógica das páginas >400 linhas para hooks/serviços.

### 2. Autenticação — **8/10**
**Evidências:** Supabase Auth + MFA (`is_aal2()`, `mfa_sessions`, `log_mfa_session`), lockout de login (`check_login_lockout_v2` com IP, `record_failed_login_v2`, `login_attempts`), reset de senha com token+expiração (`password_reset_tokens`, `use_reset_token`), alerta de novo dispositivo (`new_device_alerts`, `user_devices`, fingerprint via `is_known_device`), tabelas WebAuthn/passkeys. `autoRefreshToken: true`, `persistSession: true`.
**Gaps p/ 10:** tratamento de race condition no refresh concorrente não documentado; política de senha não é explícita no código (delegada ao Supabase).
**Ações:** documentar política de senha e o fluxo de refresh no `RUNBOOK`.

### 3. Autorização — **8/10**
**Evidências:** RBAC com `app_role` (admin/manager/operator/viewer) via `has_role()`/`has_permission()` (SECURITY DEFINER, `STABLE`, `search_path` fixo). **RLS 100%** (0 tabelas sem RLS). Proteção contra privilege-escalation: alterar `user_roles` exige `has_role(admin) AND is_aal2()` (MFA obrigatório). Usuário só vê o próprio role. `role_permissions`/`permissions` populados.
**Gaps p/ 10:** ver Segurança — `GRANT ALL TO anon` em 65 tabelas (neutralizado por RLS, mas fere menor-privilégio); `mcp-query` deployada sem JWT.
**Ações:** revogar grants amplos de `anon` (item Quick Win abaixo).

### 4. Banco de Dados — **8/10**
**Evidências:** 103 migrations versionadas; particionamento mensal de `tracking_events` (`provision_tracking_partitions` + `prune_tracking_events_partitions(6)` em cron); tipos corretos (`inet`, `timestamptz`, `numeric`); índices cobrem as queries de app (único `missing_index` é `cron.job_run_details`, tabela de sistema); naming `snake_case` consistente; views seguras (`orders_safe_view`, `drivers_safe_view`).
**Gaps p/ 10:** **migrations duplicadas** — `20241231000000_saved_filters.sql` vs `20250102000001_saved_filters.sql`, e **dois arquivos com o mesmo timestamp** `20260828000003` (`comprehensive_rls_fix` + `populate_permissions`), o que quebra a ordenação determinística; grants a `anon` no nível de tabela.
**Ações:** renomear a migration duplicada de `20260828000003`; consolidar `saved_filters`.

### 5. CI/CD — **7/10**
**Evidências:** `.github/workflows/ci.yml` cobre lint, `tsc --noEmit`, Vitest, Playwright e2e (com upload de report), Deno contract tests + integration (gated em `main`), `npm audit --audit-level=high`, build. Dependabot ativo (visível no histórico). PR template presente.
**Gaps p/ 10:** job `deploy` é **no-op** (`echo "Deploy via Lovable"`) — deploy é opaco/tribal; **sem rollback**; sem branch protection evidente; `build` job depende de `contract-tests` mas o passo `build` roda um script que gera lixo (ver Qualidade).
**Ações:** substituir o `echo` por deploy real (`supabase functions deploy`) ou documentar o gatilho Lovable no runbook; adicionar gate de cobertura.

### 6. Data Integrity — **7/10**
**Evidências:** FK/constraints presentes; idempotência de webhook via `webhook_events`; validação Zod em 7 edge functions + camada `_shared/contract.ts` com versionamento de contrato; proteção de replay no webhook; `region_cache` com CHECK de tamanho.
**Gaps p/ 10:** **webhook fail-open** (aceita payload sem validar assinatura quando o secret não está setado); **6 blocos `catch {}` vazios** engolindo erros silenciosamente; `mcp_exec` tem `exception when others then null`.
**Ações:** tornar o webhook fail-closed; preencher/loggar os catches vazios.

### 7. Documentação — **9/10**
**Evidências:** 27 docs (`ARCHITECTURE`, `API_CONTRACTS`, `DATA_DICTIONARY`, `RUNBOOK_LALAMOVE`, `DEPLOYMENT`, `TROUBLESHOOTING`, `CACHE_SYSTEM`, `JOB_QUEUE_SYSTEM`, `LOGGING_AND_HEALTH`, etc.), 2 ADRs, `CHANGELOG.md`, README com 97 seções, `SECURITY_CHECKLIST.md`, `CONTRIBUTING.md`.
**Gaps p/ 10:** sem OpenAPI/Swagger formal; `mcp-query` não documentada e em drift; itens do `SECURITY_CHECKLIST` estão desmarcados (inclusive "`.env` no `.gitignore`", que está de fato violado).
**Ações:** gerar OpenAPI das edge functions; sincronizar o checklist com o estado real.

### 8. Infraestrutura / DevOps — **6/10**
**Evidências:** Supabase gerenciado (backup/SSL/pooler nativos), secrets em Vault (`supabase_vault` instalado), crons versionados, health checks (`get_cron_jobs_health`, `check-external-api`).
**Gaps p/ 10:** **`.env` commitado** no git; **drift**: `.env` → `deejghdaiistzvendnot`, backend linkado → `iecgydonctmabiijadsf`; deploy via Lovable (caixa-preta, sem IaC); sem DR testado documentado.
**Ações:** remover `.env` do versionamento (`git rm --cached`), alinhar o project ref, documentar o pipeline Lovable.

### 9. Logging / Monitoring — **8/10**
**Evidências:** logger estruturado (`_shared/logger.ts`), `runtime_error_logs`, `query_telemetry`, `cron_job_logs`, `auth_logs` com `sanitize_auth_log_metadata` (mascaramento de PII em cron), `rate_limit_logs`, retenção via crons (`cleanup_old_*`, 30/14/60/180 dias). Dashboards de erro/rate-limit no front.
**Gaps p/ 10:** sem correlação por request-id ponta a ponta; sem uptime monitor externo evidente.
**Ações:** propagar `x-request-id` do front até edge/DB.

### 10. Observabilidade — **6/10**
**Evidências:** logs + métricas (tabelas de telemetria) + dashboards SLO/SLA/Performance/SystemHealth; `web-vitals` no front; `get_contract_v1_sunset_readiness` (telemetria de contrato).
**Gaps p/ 10:** **sem distributed tracing** (n8n→Supabase→Bitrix24); **sem error tracking centralizado** (Sentry/Bugsnag); SLIs/SLOs em dashboard mas não formalizados como alerta.
**Ações:** integrar Sentry nas edge functions e no front.

### 11. Lógica de Negócio — **7/10**
**Evidências:** versionamento de contrato (`contract_version_usage`, `increment_contract_usage`, rollup mensal); motor de avaliação de motorista (`evaluate-driver`, `driver_evaluations`, `risk_rules`, `risk_score`); escalonamento de alertas (`escalate-alerts` a cada 5 min, `get_pending_escalations`); fila Bitrix24. Regras em `src/services` + funções SQL.
**Gaps p/ 10:** parte das regras vive em SQL, parte no front — falta single-source-of-truth explícito; edge cases financeiros não auditáveis sem os dados.
**Ações:** centralizar regras de risco/preço numa camada única documentada.

### 12. Manutenibilidade — **7/10**
**Evidências:** código limpo, strict TS, poucos smells; pre-commit (`lint-staged` + `pre-commit-secrets.sh`).
**Gaps p/ 10:** **3 lockfiles** (`bun.lock` + `bun.lockb` + `package-lock.json`) = gerenciadores misturados; **`.gitignore.new`** órfão versionado; **`lalamove_order_history_full.json` de 21 MB** commitado; páginas grandes fatiadas.
**Ações:** escolher 1 package manager e remover os outros lockfiles; remover o JSON de 21 MB e o `.gitignore.new`.

### 13. Operacionalidade — **6/10**
**Evidências:** `RUNBOOK_LALAMOVE.md` + `TROUBLESHOOTING.md`; crons de manutenção; `feature_flags` (kill-switch disponível); `LALAMOVE_FAILURE_SIMULATION.md`.
**Gaps p/ 10:** deploy/rollback não automatizados (<5 min não garantido); circuit breakers por integração não implementados; `feature_flags` existe mas não há evidência de uso como kill-switch no runtime.
**Ações:** implementar rollback documentado e wire de `feature_flags` nos pontos de integração.

### 14. Performance — **8/10**
**Evidências:** **nenhuma query de aplicação** no top de `pg_stat_statements` (só introspecção/cron); particionamento + índices; TanStack Query (cache), `react-window` (virtualização), `web-vitals`, `idb` (cache offline), materialized views de cache. `get_pending_escalations()` a 6,6 ms médios em 3.564 chamadas.
**Gaps p/ 10:** bundle size não monitorado no CI; sem LCP medido em prod.
**Ações:** adicionar `size-limit` ao CI.

### 15. Qualidade de Código — **8/10**
**Evidências:** ESLint (flat config) + Prettier + `.lintstagedrc` + pre-commit de secrets; **strict mode**; apenas **2 `any`**, **3 `console.log`**, **4 TODO/FIXME** em toda a base `src`.
**Gaps p/ 10:** `build` script gera lixo — `echo 'PDF content placeholder' > docs/audit_report.pdf`; `exec-sql/index.ts` (dead code perigoso) no repo; 6 catches vazios.
**Ações:** remover a linha do `build` e o `exec-sql`; `noUnusedLocals` está `false`.

### 16. Segurança — **5/10** ⚠️ (dimensão crítica ×3)
**Positivo:** RLS 100%, RBAC granular, MFA-gate em mudança de role, proteção de privilege-escalation, lockout, geo/IP blocking, replay-protection e comparação constante-no-tempo no webhook, `mcp_exec` restrito a `postgres`/`service_role`.
**Falhas concretas:**
1. **`.env` commitado** (`git ls-files .env` confirma) com anon key + ref do projeto **errado** (`deejghdaiistzvendnot`, fonte Lovable) vs backend real `iecgydonctmabiijadsf` — viola o próprio `SECURITY_CHECKLIST` e cria risco funcional de o cliente falar com o projeto errado.
2. **`GRANT ALL ... TO anon`** (DELETE/INSERT/UPDATE/TRUNCATE) em **65 tabelas** — RLS neutraliza hoje (default-deny, 0 policies `anon`), mas qualquer tabela futura sem RLS = exposição anônima total.
3. **Webhook fail-open** — `lalamove-webhook` **pula** a validação HMAC quando `LALAMOVE_API_SECRET` está ausente; só rejeita `if (!valid && secret)`. Payload forjado é aceito se o secret sumir.
4. **`mcp-query` deployada com `verify_jwt=false` e sem fonte no repo** — superfície não autenticada e não auditável.
5. **`exec-sql`** no repo: sem auth, CORS `*`, `sql.split(';')` ingênuo, service role — classe RCE se deployada (hoje não está na lista de deploy, mas é código latente).
**Ações:** ver Top 10 / roadmap.

### 17. Testes — **7/10**
**Evidências:** 44 arquivos; Vitest (unit em `__tests__`), Playwright e2e (**rbac, mfa, login-lockout, password-reset** — cobre autorização e auth), Deno contract + integration tests. `@axe-core/playwright` (a11y).
**Gaps p/ 10:** sem gate de cobertura no CI; cobertura fina nas edge functions; sem testes de carga.
**Ações:** adicionar `--coverage` com threshold e testes de RLS negativos explícitos.

### 18. Tipagem / Type Safety — **9/10**
**Evidências:** `strict: true`, `noImplicitAny: true`, tipos do DB gerados (`src/integrations/supabase/types.ts`), Zod para validação runtime, apenas **2 `any`** em ~85k linhas.
**Gaps p/ 10:** `noUnusedLocals/Parameters: false`; drift potencial entre `types.ts` (gerado do projeto antigo?) e o schema de destino.
**Ações:** regenerar `types.ts` contra `iecgydonctmabiijadsf` e ligar `noUnusedLocals`.

### 19. Validação — **7/10**
**Evidências:** Zod no front (`@hookform/resolvers` + zod) e em 7 edge functions; `_shared/schemas.ts` + `contract.ts` (validação de contrato versionada); CHECK constraints (`region_cache`).
**Gaps p/ 10:** validação dupla (front+back) não é universal; validadores BR (CPF/CNPJ) não evidenciados; schemas Zod não 100% compartilhados front↔edge.
**Ações:** promover `_shared/schemas.ts` como fonte única e reusar no front.

### 20. Operações (Processos) — **6/10**
**Evidências:** `CONTRIBUTING.md`, PR template, Dependabot, `SECURITY_CHECKLIST.md`, git flow implícito (main/develop no CI).
**Gaps p/ 10:** sem branch protection evidente; deploy tribal (Lovable); checklist de segurança desmarcado; sem processo de incidente/post-mortem formal.
**Ações:** ativar branch protection em `main` (PR + checks obrigatórios).

---

## Fase 2 — Scorecard

```
╔══════════════════════════════════╦═══════╦════════════════════════════════════════════════╗
║ DIMENSÃO                         ║ NOTA  ║ GAP PRINCIPAL PARA 10/10                       ║
╠══════════════════════════════════╬═══════╬════════════════════════════════════════════════╣
║ 1.  Arquitetura            (×2)  ║  7/10 ║ Drift de projeto; god-pages                    ║
║ 2.  Autenticação           (×3)  ║  8/10 ║ Race no refresh; política de senha implícita   ║
║ 3.  Autorização            (×3)  ║  8/10 ║ Grants amplos p/ anon; mcp-query sem JWT       ║
║ 4.  Banco de Dados         (×2)  ║  8/10 ║ Migrations duplicadas (timestamp colidido)     ║
║ 5.  CI/CD                        ║  7/10 ║ Deploy no-op; sem rollback; sem branch protect ║
║ 6.  Data Integrity         (×3)  ║  7/10 ║ Webhook fail-open; catches vazios              ║
║ 7.  Documentação                 ║  9/10 ║ Sem OpenAPI; checklist desatualizado           ║
║ 8.  Infraestrutura / DevOps      ║  6/10 ║ .env commitado; drift de ref; deploy opaco     ║
║ 9.  Logging / Monitoring         ║  8/10 ║ Sem correlação por request-id                  ║
║ 10. Observabilidade              ║  6/10 ║ Sem tracing nem error-tracking central         ║
║ 11. Lógica de Negócio            ║  7/10 ║ Regras espalhadas SQL+front                    ║
║ 12. Manutenibilidade             ║  7/10 ║ 3 lockfiles; JSON 21MB; .gitignore.new         ║
║ 13. Operacionalidade             ║  6/10 ║ Rollback e circuit breakers ausentes           ║
║ 14. Performance             (×2*) ║  8/10 ║ Bundle size não monitorado                     ║
║ 15. Qualidade de Código          ║  8/10 ║ Build gera lixo; exec-sql dead code            ║
║ 16. Segurança              (×3)  ║  5/10 ║ .env+drift, grants anon, webhook fail-open     ║
║ 17. Testes                 (×2)  ║  7/10 ║ Sem gate de cobertura                          ║
║ 18. Tipagem                (×2)  ║  9/10 ║ Regenerar types; noUnusedLocals off            ║
║ 19. Validação              (×2)  ║  7/10 ║ Validação dupla não universal                  ║
║ 20. Operações (Processos)        ║  6/10 ║ Sem branch protection; deploy tribal           ║
╠══════════════════════════════════╬═══════╬════════════════════════════════════════════════╣
║ NOTA GERAL PONDERADA             ║ 7,2/10║ Segurança (×3) é o maior arrasto               ║
╚══════════════════════════════════╩═══════╩════════════════════════════════════════════════╝
```
*Pesos: ×3 Segurança/Auth/Authz/Data Integrity · ×2 Banco/Tipagem/Validação/Testes/Arquitetura · ×1 demais.*
Cálculo: (5+8+8+7)×3 + (8+9+7+7+7)×2 + (7+9+6+8+6+7+7+6+8+8+6)×1 = 84+76+78 = **238 / 33 = 7,21**.

---

## Top 10 Ações por ROI (impacto ÷ esforço)

| # | Ação | Dim | Impacto | Esforço | Tipo |
|---|---|---|---|---|---|
| 1 | Tornar o webhook Lalamove **fail-closed** (rejeitar quando `LALAMOVE_API_SECRET` ausente) | 6/16 | Alto | Baixo | Código |
| 2 | **Remover `.env` do git** + alinhar `project_id` para `iecgydonctmabiijadsf` | 8/16 | Alto | Baixo | Config |
| 3 | **`REVOKE` grants amplos de `anon`** nas 65 tabelas (manter só o necessário) | 3/16 | Alto | Baixo | Migration |
| 4 | **Deletar `exec-sql`** do repo (RCE-class latente) | 15/16 | Alto | Baixo | Código |
| 5 | Puxar a **fonte de `mcp-query`** e adicionar auth (ou remover deploy) | 16 | Alto | Médio | Código |
| 6 | Remover lixo do `build` (`echo ... audit_report.pdf`) | 15 | Médio | Baixo | Config |
| 7 | Corrigir **migration `20260828000003` duplicada** (timestamp colidido) | 4 | Médio | Baixo | Migration |
| 8 | Consolidar lockfiles (1 package manager) + remover JSON 21 MB + `.gitignore.new` | 12 | Médio | Baixo | Chore |
| 9 | Ativar **branch protection** em `main` (PR + checks) | 5/20 | Médio | Baixo | Processo |
| 10 | Integrar **Sentry** (front + edge) | 10 | Alto | Médio | Código |

---

## Roadmap em 3 Ondas

### 🔴 Quick Wins (1–3 dias) — Impacto Alto / Esforço Baixo
- Webhook fail-closed (#1)
- `.env` fora do git + alinhar project ref (#2)
- `REVOKE` de `anon` (#3)
- Deletar `exec-sql` (#4)
- Limpar `build` script (#6), migration duplicada (#7), lockfiles/JSON/`.gitignore.new` (#8)
- Branch protection (#9)

### 🟠 Sprint 1 (1–2 semanas)
- `mcp-query`: recuperar fonte + auth (#5)
- Sentry front+edge (#10)
- Regenerar `src/integrations/supabase/types.ts` contra o projeto de destino
- Gate de cobertura no CI + testes RLS negativos
- Preencher/loggar os 6 catches vazios

### 🟡 Sprint 2 (2–4 semanas)
- Distributed tracing (request-id ponta a ponta) n8n→Supabase→Bitrix24
- Deploy real + rollback documentado (substituir o `echo` do CI)
- Circuit breakers por integração + wire de `feature_flags`
- OpenAPI das edge functions
- Single-source-of-truth de schemas Zod (front↔edge) e de regras de negócio

---

## Parecer de Maturidade

Base de código **sólida e bem documentada**, típica de um sistema em ~80–85% de conclusão: RLS em 100% das tabelas, RBAC com MFA, tipagem strict quase perfeita (2 `any` em 85k linhas), CI abrangente e 27 documentos técnicos colocam Lalamove V2 acima da média. O que separa dos 10/10 é **segurança operacional**: um `.env` commitado apontando para o projeto errado, grants de `anon` amplos demais, um webhook que falha-aberto e uma edge function não autenticada sem fonte no repositório são falhas concretas — não teóricas — e todas de correção barata. Fechando as seis Quick Wins de segurança, a nota crítica sobe de 5 para ~8 e a geral ultrapassa 8,0.
