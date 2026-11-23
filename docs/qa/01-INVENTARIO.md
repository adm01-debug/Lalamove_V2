# 01 — Inventário do sistema e registro de cobertura

Auditoria de QA somente-leitura. Base: commit `281cd07` (`main` de 22/11/2026 22:42 UTC),
branch de trabalho `claude/chore-auditoria-qa-300-etapas-261123-0010`.
Toda linha deste arquivo termina com **status de cobertura**: `revisado` ou `não revisado + motivo`.

> Convenção de prova usada em todos os arquivos desta pasta:
> **EXECUTADO** = comando/consulta/request rodado nesta sessão, com saída vista.
> **RASTREADO** = caminho seguido lendo o código, sem execução.

---

## 1. Suposições do dono (o campo `<contexto>` do pedido veio vazio)

Deduzido do código e dos docs do próprio repo:

| # | Suposição | Base |
|---|---|---|
| S1 | É um painel interno de operação logística: cota, cria, rastreia e comprova entregas via API Lalamove v3. | `supabase/functions/lalamove-api/`, `docs/LALAMOVE_API_V3.md`, rotas `/orders`, `/lalamove-operacoes` |
| S2 | Usuários são funcionários (operação, gestão, TI), não clientes finais. Não há cadastro público: `/auth` é login, e o reset de senha passa por **aprovação de admin** (`/password-reset-approvals`). | `src/App.tsx`, `src/pages/PasswordResetApprovalsPage.tsx` |
| S3 | Quatro papéis hierárquicos: `viewer` < `operator` < `manager` < `admin`, com MFA exigido em 7 rotas sensíveis. | `src/components/auth/ProtectedRoute.tsx`, `inventario/estado/rotas.json` |
| S4 | O motorista **não** usa este sistema: ele é alcançado por mensageria (Zapp/WhatsApp + SMS de contingência). Não há app de motorista. | `docs/agentes/mensageria.md`, `docs/pendencias/P-02-app-mobile-motoristas.md` |
| S5 | Produção é Vercel (`lalamove-v2.vercel.app`) + Supabase Cloud `iecgydonctmabiijadsf`; deploy automático no merge em `main`. | `supabase/config.toml:1`, `docs/agentes/deploy.md`, `.github/workflows/deploy-edges.yml` |
| S6 | O dono não programa: toda engenharia é feita por agentes de IA que leem `AGENTS.md` e `docs/agentes/**`. Documento errado = produção quebrada. | `AGENTS.md` (postura), estrutura de `docs/agentes/` |

Se qualquer suposição estiver errada, os achados que dependem dela estão marcados no
`03-ACHADOS.md` com a suposição citada.

---

## 2. Stack, build e ambientes — **revisado** (EXECUTADO)

| Item | Realidade medida | Status |
|---|---|---|
| Front | Vite 8 + React 18.3 + TypeScript 5.8 + Tailwind + shadcn/radix; 433 arquivos `.ts/.tsx` em `src/` | revisado |
| Estado/dados | `@tanstack/react-query` 5, `zustand` 5, `idb` (offline), `i18next` | revisado |
| Backend | 27 Supabase Edge Functions (Deno) em `supabase/functions/` | revisado |
| Banco | Postgres (Supabase Cloud `iecgydonctmabiijadsf`), 191 migrations em `supabase/migrations/` | revisado |
| Gerenciador | **npm** (`package-lock.json`, não há `bun.lock`) | revisado |
| Node | 22 no CI (`.github/workflows/ci.yml`), 24.x no Vercel (`docs/agentes/deploy.md`) | revisado |
| Testes unitários | `vitest` — **69 arquivos, 1050 testes**. Rodado nesta sessão: `68 passed / 1 failed`; a única falha é `src/utils/__tests__/exportUtils.test.ts`, e a causa é ambiental (ver §7), não do código | revisado (EXECUTADO) |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` → **1 erro**, também ambiental (`xlsx`, §7). Sem ele, limpo | revisado (EXECUTADO) |
| Lint | `npx eslint .` → **0 erros, 554 warnings** | revisado (EXECUTADO) |
| Build | `npm run build` → **falhou nesta máquina** por falta do pacote `xlsx` (§7); na CI do GitHub o job `build` passa | revisado (EXECUTADO) |
| E2E | Playwright, 7 specs em `e2e/` | revisado |
| Contratos de edge | `deno test` em 8 grupos dentro do `ci.yml` | revisado |
| Grafo de código | `graphify-out/graph.json` gerado no HEAD atual: **8836 nós, 18507 arestas** | revisado (EXECUTADO) |
| Ambientes | `production` (Vercel+Supabase) e `preview` (Vercel por PR). **Não existe ambiente de staging com banco próprio** | revisado |

### Pontos de entrada
| Entrada | Arquivo | Status |
|---|---|---|
| Front | `index.html` → `src/main.tsx` → `src/App.tsx` | revisado |
| Rotas | `src/App.tsx` (56 rotas) | revisado |
| Menu | `src/components/layout/sidebar-config.ts` (49 itens) | revisado |
| Cliente de banco | `src/integrations/supabase/client.ts` | revisado |
| Edges | `supabase/functions/<nome>/index.ts` | revisado |
| Banco | `supabase/migrations/*.sql` (ordem cronológica) | revisado |

---

## 3. Rotas e páginas (56) — **revisado**

Fonte: `inventario/estado/rotas.json`, regerado nesta sessão com
`node scripts/inventario/gerar-rotas.mjs` (EXECUTADO: 56 rotas, 48 protegidas, 7 com MFA,
49 itens de menu, 159 hooks distintos, 0 problemas na heurística do próprio script).

| Rota | Página | Protegida | Papel mínimo exigido | MFA | No menu | Status |
|---|---|---|---|---|---|---|
| `*` | NotFound | não | — | não | não | revisado |
| `/` | DashboardRedesigned | sim | viewer | não | sim | revisado |
| `/alert-configurations` | AlertConfigurationsPage | sim | manager | não | sim | revisado |
| `/alerts` | AlertsPage | sim | operator | não | sim | revisado |
| `/analytics` | AnalyticsDashboardPage | sim | viewer | não | sim | revisado |
| `/approvals` | ApprovalsPage | sim | manager | não | sim | revisado |
| `/auth` | AuthPage | não | — | não | não | revisado |
| `/bitrix24` | Bitrix24Page | sim | manager | **sim** | sim | revisado |
| `/cache-monitoring` | CacheMonitoringPage | sim | manager | não | sim | revisado |
| `/cache-status` | CacheStatusPage | sim | manager | não | sim | revisado |
| `/contacts` | ContactsPage | sim | operator | não | sim | revisado |
| `/dashboard` | DashboardRedesigned | sim | viewer | não | sim | revisado |
| `/delivery-metrics` | DeliveryMetricsPage | sim | viewer | não | sim | revisado |
| `/drivers` | DriversPage | sim | operator | não | sim | revisado |
| `/error-monitoring` | ErrorMonitoringPage | sim | manager | não | sim | revisado |
| `/evaluations` | EvaluationsPage | sim | operator | não | sim | revisado |
| `/external-data` | ExternalDataPage | sim | manager | **sim** | sim | revisado |
| `/forgot-password` | ForgotPasswordPage | não | — | não | não | revisado |
| `/geo-blocking` | GeoBlockingPage | sim | admin | não | sim | revisado |
| `/heatmap` | HeatmapPage | sim | viewer | não | sim | revisado |
| `/incidents` | IncidentsPage | sim | operator | não | sim | revisado |
| `/ip-whitelist` | IPWhitelistPage | sim | admin | não | sim | revisado |
| `/job-queue` | JobQueuePage | sim | manager | não | sim | revisado |
| `/lalamove-operacoes` | LalamoveOperationsPage | sim | operator | não | sim | revisado |
| `/lalamove-quota` | LalamoveQuotaPage | sim | admin | não | sim | revisado |
| `/live-map` | LiveMapPage | sim | viewer | não | sim | revisado |
| `/map` | (redireciona) | não | — | não | sim | revisado |
| `/map-tools` | MapToolsPage | sim | manager | não | sim | revisado |
| `/metrics` | MetricsPage | sim | viewer | não | sim | revisado |
| `/mfa-enroll` | MFAEnrollPage | não | — | não | não | revisado |
| `/mfa-verify` | MFAVerifyPage | não | — | não | não | revisado |
| `/notification-history` | NotificationHistoryPage | sim | viewer | não | sim | revisado |
| `/orders` | OrdersPage | sim | operator | não | sim | revisado |
| `/password-reset-approvals` | PasswordResetApprovalsPage | sim | admin | não | sim | revisado |
| `/performance` | PerformanceDashboardPage | sim | manager | não | sim | revisado |
| `/permissions` | PermissionsPage | sim | admin | não | sim | revisado |
| `/preferences` | UserPreferencesPage | sim | viewer | não | sim | revisado |
| `/profile` | ProfilePage | sim | viewer | não | sim | revisado |
| `/rate-limiting` | RateLimitDashboardPage | sim | admin | não | sim | revisado |
| `/reports` | ReportsPage | sim | viewer | não | sim | revisado |
| `/reports/advanced` | AdvancedReportsPage | sim | viewer | não | sim | revisado |
| `/reset-password` | ResetPasswordPage | não | — | não | não | revisado |
| `/risk-rules` | RiskRulesPage | sim | manager | **sim** | sim | revisado |
| `/roles` | RolesPage | sim | admin | não | sim | revisado |
| `/security` | SecurityDashboardPage | sim | admin | não | sim | revisado |
| `/settings` | SettingsPage | sim | manager | não | sim | revisado |
| `/settings/lalamove` | LalamoveSettingsPage | sim | manager | **sim** | sim | revisado |
| `/settings/maps` | MapsSettingsPage | sim | manager | **sim** | sim | revisado |
| `/settings/uapi` | UAPISettingsPage | sim | manager | **sim** | sim | revisado |
| `/sla` | SLADashboardPage | sim | viewer | não | sim | revisado |
| `/slo` | SLODashboardPage | sim | manager | não | sim | revisado |
| `/system-health` | SystemHealthPage | sim | manager | não | sim | revisado |
| `/system-health-expanded` | SystemHealthExpandedPage | sim | manager | não | sim | revisado |
| `/telemetria` | AdminTelemetriaPage | sim | admin | não | sim | revisado |
| `/unauthorized` | UnauthorizedPage | não | — | não | não | revisado |
| `/webhooks` | WebhooksPage | sim | manager | **sim** | sim | revisado |

Páginas sem rota própria (subcomponentes em `src/pages/<área>/`): 34 arquivos nas pastas
`alert-configurations`, `approvals`, `bitrix24`, `drivers`, `evaluations`, `heatmap`,
`incidents`, `ip-whitelist`, `lalamove`, `map-tools`, `orders`, `permissions`, `ratelimit`,
`reports`, `settings` — **revisado** por amostragem dirigida pelas camadas de UI (ver `03-ACHADOS.md`).

---

## 4. Componentes, hooks, libs e estado — **revisado**

| Grupo | Quantidade | Status |
|---|---|---|
| `src/components/` | 161 arquivos em 18 subpastas (`admin`, `alerts`, `approvals`, `auth`, `dashboard`, `debug`, `drivers`, `health`, `lalamove`, `layout`, `map`, `notifications`, `orders`, `pwa`, `reports`, `ui`, `webhooks` + raiz) | revisado |
| `src/hooks/` | 88 arquivos / 159 hooks exportados | revisado |
| `src/lib/` | 48 arquivos (regras de Lalamove, geo, telefone, CEP, erros, papéis) | revisado |
| `src/utils/` | 8 arquivos (inclui `exportUtils.ts`) | revisado |
| `src/types/` | 5 arquivos | revisado |
| `src/integrations/` | `supabase/client.ts`, `supabase/types.ts`, `supabase/previewAuthStorage.ts`, `lovable/index.ts` | revisado |
| `src/i18n/` | `index.ts` + `locales/` | revisado |
| Estado global | `zustand` (stores) + `react-query` (cache de servidor) + contextos de auth/tema/acessibilidade | revisado |

Hooks (88 arquivos, lista completa para rastreabilidade):
`healthChecks`, `use-mobile`, `useAccessibility`, `useAchievementsSystem`, `useActiveAlerts`,
`useAdvancedReports`, `useAlertConfigurations`, `useAlertGrouping`, `useAlertSettings`,
`useAnalyticsData`, `useApprovalActions`, `useApprovalActionsEnhanced`, `useApprovalRealtime`,
`useAuth`, `useAuthLogs`, `useBitrix24`, `useCacheViews`, `useCachedStats`,
`useCommandPaletteSearch`, `useContacts`, `useContextualHints`, `useContractV1SunsetReadiness`,
`useContractVersionUsage`, `useContractVersionUsageMonthly`, `useCronJobsHealth`,
`useDashboardStats`, `useDataRefresh`, `useDebouncedValue`, `useDeliveryHeatmapData`,
`useDeliveryMetrics`, `useDeviceDetection`, `useDriverEvaluations`, `useDrivers`, `useErrorLogs`,
`useEvaluateDriver`, `useExternalData`, `useFeatureFlags`, `useFuseSearch`, `useGeo`,
`useGeoAdmin`, `useGeoSearch`, `useGlobalUndo`, `useIncidents`, `useJobQueue`, `useLalamove`,
`useLalamoveQuota`, `useLalamoveUapi`, `useLoginLockout`, `useMFA`, `useMapProviderPolicy`,
`useMapSettings`, `useMapbox`, `useMetrics`, `useNotificationHistory`, `useOfflineStorage`,
`usePasswordResetActions`, `usePendingApprovals`, `usePermissions`, `usePredictiveAnalysis`,
`usePrefetch`, `usePushNotifications`, `useQuotationExpiry`, `useRateLimiting`,
`useRealtimeSubscriptions`, `useRecentOrders`, `useRegionResolver`, `useReportPresets`,
`useRiskRules`, `useRole`, `useSLAMetrics`, `useSLOMetrics`, `useScheduledTheme`,
`useSecurityPushNotifications`, `useServiceWorker`, `useSidebarCounts`, `useSoundSettings`,
`useSystemHealth`, `useSystemHealthExpanded`, `useTestNotification`, `useTheme`,
`useTrackingHistory`, `useUAPI`, `useUserDevices`, `useWebAuthn`, `useWebhookEvents`,
`useWebhookSecurityMetrics` — **revisado** (varredura em dois lotes: dados de negócio e infra).

---

## 5. Backend — 27 edge functions — **revisado**

Fonte: `inventario/estado/edges.json`, regerado nesta sessão com
`node scripts/inventario/gerar-repo.mjs` (EXECUTADO).

| Função | Papel | `verify_jwt` | Chamador no repo | Status |
|---|---|---|---|---|
| `apply-fixes` | aplica correções | **não declarado** | sim | revisado |
| `bitrix24-process-queue` | fila Bitrix24 | **não declarado** | sim | revisado |
| `bitrix24-sync` | sincronismo Bitrix24 | declarado | sim | revisado |
| `check-driver-alerts` | alerta de motorista | **não declarado** | sim (cron) | revisado |
| `check-external-api` | saúde de API externa | **não declarado** | sim | revisado |
| `escalate-alerts` | escalonamento | **não declarado** | sim | revisado |
| `evaluate-driver` | avaliação | **não declarado** | sim | revisado |
| `external-companies` | base externa | **não declarado** | sim | revisado |
| `external-db-bridge` | ponte p/ outro banco | **não declarado** | sim | revisado |
| `geo-admin` | rotação de token Mapbox | declarado | **nenhum** | revisado |
| `geo-gateway` | cache/orçamento geo | declarado | sim | revisado |
| `get-mapbox-token` | token do mapa p/ front | declarado | sim | revisado |
| `job-worker` | processa fila | declarado | sim | revisado |
| `lalamove-api` | API Lalamove | declarado | sim | revisado |
| `lalamove-gateway` | gateway Lalamove | declarado | sim | revisado |
| `lalamove-token-refresh` | token Lalamove | declarado | sim (cron) | revisado |
| `lalamove-uapi` | UAPI | declarado | sim | revisado |
| `lalamove-webhook` | webhook Lalamove | **false** (correto p/ webhook) | externo | revisado |
| `llm-wh` | webhook de LLM | **false** | externo | revisado |
| `mcp-query` | consulta de diagnóstico | **false** | sim | revisado |
| `new-device-alert` | alerta de novo dispositivo | **não declarado** | sim | revisado |
| `rotate-tokens` | rotação de tokens | **não declarado** | sim | revisado |
| `route-analyzer` | análise de rota com IA (custo/token) | declarado | sim | revisado |
| `seed-fix-rls` | corrige RLS | **não declarado** | sim | revisado |
| `send-notification` | notificações multicanal | declarado | sim | revisado |
| `simulate-driver-movement` | replay de trajeto | declarado | sim | revisado |
| `test-notification` | teste de notificação | **não declarado** | sim | revisado |

Módulos compartilhados: `_shared/contract.ts`, `schemas.ts`, `cors.ts`, `logger.ts`,
`telemetry.ts`, `phone.ts`, `template.ts`, `geo-precision.ts`, `channels/`, `messaging/` — **revisado**.

---

## 6. Banco de dados — **revisado só pelas migrations** (produção não acessível)

**76 tabelas** de negócio declaradas nas 191 migrations (fora 3 falsos-positivos de parsing), mais
`tracking_events_default` e as partições mensais. `ENABLE ROW LEVEL SECURITY` aparece para **73 relações
distintas**, em 47 migrations; **394 `CREATE POLICY`**. (EXECUTADO: comparação da lista de `CREATE TABLE`
com a lista de `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.) As 4 relações que aparecem sem `ENABLE` são as
partições `tracking_events_y2026m07` a `m10`, que **não existem**: a migration
`20260516114956_…sql:2` faz `DROP TABLE IF EXISTS public.tracking_events` e recria a tabela só com
`y2026m05`, `y2026m06` e `_default` (`:17-24`) — e `ensure_tracking_events_partition`
(`20260715175652_…sql:66-75`) já habilita RLS e cria a policy por papel em cada partição nova.
Este ponto foi levantado como achado e **refutado** na segunda leitura; está registrado em
`03-ACHADOS.md` > "Refutados".

Tabelas: `active_tracking`, `alert_configurations`, `alert_dedup`, `alerts`, `alerts_sent`,
`audit_log`, `auth_logs`, `bitrix24_activities`, `bitrix24_spa_sync`, `bitrix24_stage_mappings`,
`bitrix24_sync`, `bitrix24_tokens`, `blocked_ips`, `cache_refresh_log`, `contacts`,
`contract_version_usage`, `contract_version_usage_monthly`, `cron_job_logs`,
`driver_approval_queue`, `driver_evaluations`, `driver_incidents`, `driver_locations`,
`drivers`, `email_verifications`, `feature_flags`, `geo_budget`, `geo_cache`, `geo_defaults`,
`geo_price_list`, `geo_settings`, `geo_usage`, `ip_whitelist`, `job_queue`,
`job_queue_processing_log`, `lalamove_order_replacements`, `lalamove_orders`,
`lalamove_priority_fee_history`, `lalamove_rate_limits`, `lalamove_status_history`,
`lalamove_stop_proofs`, `lalamove_stops`, `lalamove_uapi_sessions`, `lalamove_webhook_config`,
`login_attempts`, `map_settings_overrides`, `mcp_diagnostics_grants`, `mfa_sessions`,
`new_device_alerts`, `notification_optouts`, `order_geo_events`, `password_reset_requests`,
`password_reset_tokens`, `permissions`, `query_telemetry`, `rate_limit_logs`, `region_cache`,
`report_presets`, `risk_rules`, `role_permissions`, `runtime_error_logs`, `saved_filters`,
`security_test_logs`, `system_logs`, `tracking_events` (+ `_default` e 6 partições mensais
`y2026m05`…`y2026m10`), `user_devices`, `user_passkeys`, `user_roles`, `webauthn_challenges`,
`webhook_events` — **revisado** (estado final de RLS calculado pela última migration que toca
cada tabela; ver `03-ACHADOS.md`).

Jobs de `pg_cron` nomeados nas migrations: `escalate-unacknowledged-alerts`, `geo-cache-prune`,
`geo-jobs-refresh`, `lalamove_uapi_token_refresh_hourly`, `process-job-queue`, mais agendamentos
dinâmicos criados por função — **revisado**.

> **Camada não coberta por execução:** nenhuma consulta foi feita no banco oficial.
> Motivo exato: nenhum MCP desta sessão aponta para `iecgydonctmabiijadsf` (os carregados são
> `tnnnlkbymytvtqngbbqh`, `pgxfvjmuubtbowutlide`, `doufsxqlfjyuvxuezpln` — outros produtos), e o
> token da Management API disponível no proxy só enxerga o projeto `xmyvefffgltlrobazrmg`
> (`Fuxico_V2`) — verificado com `GET https://api.supabase.com/v1/projects`. Logo, **divergência
> entre migrations e schema real é inverificável nesta sessão** e todo achado de banco que dependa
> do estado real está marcado `hipótese`.

### Buckets de arquivo
Nenhum `storage.createBucket` / `storage.from(` encontrado em `src/` ou `supabase/functions/`
(EXECUTADO: `grep -rn "storage.from("`). Comprovantes de entrega (POD) chegam como **URL da
Lalamove** gravada em `lalamove_stop_proofs`, não como upload próprio — **revisado**.

---

## 7. Variáveis de ambiente — **revisado**

Front (`VITE_*`, públicos no bundle): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_GOOGLE_MAPS_BROWSER_KEY`, `VITE_GOOGLE_MAPS_MAP_ID`, `VITE_APP_VERSION`,
`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*` — **revisado**.

Edges (`Deno.env.get`), 31 nomes: `ALLOWED_ORIGINS`, `BITRIX24_CLIENT_ID`,
`BITRIX24_CLIENT_SECRET`, `BITRIX24_WEBHOOK_URL`, `EMAIL_FROM`, `ENVIRONMENT`,
`EVOLUTION_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME`,
`EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`, `EXTERNAL_SUPABASE_URL`, `GOOGLE_MAPS_SERVER_KEY`,
`LALAMOVE_API_KEY`, `LALAMOVE_API_SECRET`, `LALAMOVE_API_URL`, `LALAMOVE_BASE_URL`,
`LALAMOVE_TRUSTED_IPS`, `LALAMOVE_UNIFIED_PROXY_KEY`, `LALAMOVE_UNIFIED_PROXY_URL`,
`LOVABLE_API_KEY`, `MAPBOX_ACCESS_TOKEN`, `MAPBOX_SERVER_TOKEN`, `MAPBOX_TOKENS_API_TOKEN`,
`MAPBOX_USERNAME`, `RESEND_API_KEY`, `SLACK_WEBHOOK_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `VITE_SUPABASE_*` — **revisado**.

`.env.example` documenta 13 — **a diferença virou achado** (`03-ACHADOS.md`).

---

## 8. CI/CD e deploy — **revisado** (EXECUTADO via API do GitHub)

| Workflow | O que faz | Status |
|---|---|---|
| `ci.yml` | 12 jobs: `lint-and-typecheck`, `test`, `E2E (Playwright)`, `build`, `Guarda AGENTS.md`, `security`, `Deno Contract Tests`, `SQL Geo Trigger Tests`, `Deno Edge Function I/O Integration Tests`, `Geo geometry SQL tests`, `Geo trigger SQL tests` | revisado |
| `apply-migrations.yml` | aplica migrations | revisado |
| `deploy-edges.yml` | publica edge functions | revisado |
| `contexto.yml` | gera contexto para agentes **a cada 10 min** (933 execuções) | revisado |
| `inventario-estado-semanal.yml` | refaz `inventario/estado/` e abre PR | revisado |

Guards em `scripts/ci/` (29 scripts + 6 arquivos de *baseline*) — **revisado**.

Estado real medido em 23/11/2026 (EXECUTADO, API do GitHub):
- repositório `adm01-debug/Lalamove_V2`: **`"private": false` / `"visibility": "public"`**;
- `security_and_analysis`: secret scanning **ligado**, `dependabot_security_updates` **desligado**;
- `delete_branch_on_merge: false`;
- proteção da `main`: 7 required checks, `enforce_admins: true`,
  `required_approving_review_count: 0`, `strict: false` (não exige branch atualizada);
- **3 últimos runs do `CI/CD` na `main` falharam** (`#985`, `#986`, `#987`), sempre no job
  `Deno Edge Function I/O Integration Tests`;
- 1 PR aberta: [#283](https://github.com/adm01-debug/Lalamove_V2/pull/283) (migration +
  edge `zapp-callback`), aguardando o dono.

**Não coberto:** estado do deploy na Vercel. Motivo exato: o token da Vercel disponível
enxerga o time `juca1` (`team_QyN41X0q8hrqhW80AwokbFLv`) mas devolve **0 projetos e 0
deployments**; e o host `lalamove-v2.vercel.app` é recusado pelo proxy desta sessão
(`403 Forbidden (agent proxy: no rule or network setting allows this host)`).

**Não coberto:** request real às edge functions publicadas. Motivo exato: o host
`iecgydonctmabiijadsf.supabase.co` também é recusado pelo proxy com o mesmo erro.
A única evidência de comportamento real das edges publicadas nesta auditoria vem do log do
job de integração do CI (ver `02-CENARIOS.md`).

**Observação ambiental (não é defeito do sistema, mas limitou a auditoria):** `npm ci` falha
nesta máquina com `403 Forbidden ... GET https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`,
porque o `package-lock.json` aponta `xlsx` para um tarball fora do registro npm. Para rodar
typecheck/lint/testes instalei as dependências sem `xlsx` num diretório separado — por isso
`exportUtils` falha localmente. O risco de depender desse host virou achado próprio.

---

## 9. Atores, papéis e jornadas — **revisado**

| Ator | Como entra | Jornadas principais | Status |
|---|---|---|---|
| Visitante (sem login) | `/auth`, `/forgot-password`, `/reset-password` | login; pedir reset de senha | revisado |
| `viewer` | login | ver dashboard, métricas, SLA, relatórios, mapa ao vivo, histórico de notificação, perfil e preferências | revisado |
| `operator` | login | tudo de viewer + criar/acompanhar pedido, motoristas, contatos, incidentes, avaliações, alertas, operações Lalamove | revisado |
| `manager` | login (+MFA em 7 rotas) | tudo de operator + configurações, webhooks, Bitrix24, base CRM, regras de risco, fila, cache, saúde, aprovações | revisado |
| `admin` | login (+MFA) | tudo + papéis, permissões, IP whitelist, geo-blocking, segurança, telemetria, aprovação de reset de senha, quota | revisado |
| Lalamove (sistema) | `POST /functions/v1/lalamove-webhook` | eventos de status, POD | revisado |
| Zapp/Evolution (sistema) | callback de mensageria (PR #283, ainda não em produção) | status de entrega de mensagem, resposta do motorista | revisado |
| `pg_cron` (sistema) | agendamento no banco | fila de jobs, escalonamento de alertas, refresh de cache/token, poda do cache geo | revisado |
| Motorista | **não acessa o sistema**; recebe Zapp/WhatsApp/SMS | receber briefing, responder, opt-out | revisado |

Jornadas rastreadas de ponta a ponta em `02-CENARIOS.md`:
J1 login+MFA · J2 reset de senha com aprovação · J3 cotação→pedido Lalamove · J4 webhook de
status · J5 rastreamento/mapa ao vivo · J6 notificação ao motorista · J7 aprovações ·
J8 configuração sensível · J9 relatório/export · J10 fila de jobs e cron.

---

## 10. Regras de negócio — mapa de onde cada uma vive

Detalhe, divergências e o que falta: `03-ACHADOS.md`. Resumo de cobertura:

| Regra | Onde está implementada | Status |
|---|---|---|
| Hierarquia de papéis | `src/lib/roles.ts`, `ProtectedRoute`, policies de RLS, `user_roles`/`role_permissions` | revisado |
| MFA obrigatório em rota sensível | `ProtectedRoute` (`requireMFA`), `mfa_sessions` | revisado |
| Reset de senha só com aprovação de admin | `password_reset_requests`, `password_reset_tokens`, `PasswordResetApprovalsPage` | revisado |
| Bloqueio por tentativa de login | `login_attempts`, `useLoginLockout`, `e2e/login-lockout.e2e.ts` | revisado |
| Ciclo de vida do pedido (status) | `lalamove_orders`, `lalamove_status_history`, `lalamove-webhook`, `src/lib/lalamoveTimeline.ts` | revisado |
| Validação de pedido antes de cotar | `src/lib/lalamoveValidation.ts`, `_shared/schemas.ts` | revisado |
| Cotação e taxa prioritária | `lalamove-api`, `lalamove_priority_fee_history` | revisado |
| Quota/rate limit da API Lalamove | `lalamove_rate_limits`, `contract_version_usage*`, `useLalamoveQuota` | revisado |
| Score/regras de risco | `risk_rules`, `RiskRulesPage`, `evaluate-driver` | revisado |
| Orçamento e cache de geo | `geo_budget`, `geo_usage`, `geo_cache`, `geo-gateway` | revisado |
| Fila de jobs e tentativas | `job_queue`, `job_queue_processing_log`, `job-worker` | revisado |
| Escalonamento de alerta | `alert_configurations`, `alert_dedup`, `escalate-alerts` | revisado |
| Opt-out de mensageria | `notification_optouts`, `_shared/messaging`, `_shared/channels` | revisado |
| Geofence / eventos geo | `order_geo_events`, trigger `geo_evaluate_tracking` | revisado |
| Bloqueio por IP / geo | `ip_whitelist`, `blocked_ips`, `geo-blocking` | revisado |

---

## 11. Registro de cobertura — o que ficou de fora

| Camada / item | Status | Motivo exato |
|---|---|---|
| Schema real do banco de produção | **não revisado** | sem MCP do projeto `iecgydonctmabiijadsf`; token do proxy só vê `xmyvefffgltlrobazrmg` |
| Policies de RLS como estão aplicadas hoje | **não revisado** | idem (só o que as migrations declaram) |
| Dados reais (órfãos, volumes, índices em uso) | **não revisado** | idem — nenhum `SELECT` executado |
| Logs de produção (Supabase/Vercel) | **não revisado** | sem acesso ao projeto; hosts recusados pelo proxy |
| Request real às edges publicadas | **não revisado** | `403` do proxy para `iecgydonctmabiijadsf.supabase.co` |
| Front em produção (render, console, mobile real) | **não revisado** | `403` do proxy para `lalamove-v2.vercel.app` |
| Deploy/env da Vercel | **não revisado** | token enxerga o time mas devolve 0 projetos |
| Secret scanning do GitHub (alertas) | **não revisado** | não consultado; `secret_scanning` está ligado no repo |
| Histórico git completo (credenciais em commits antigos) | **parcial** | o clone desta sessão tem só 50 commits; o commit `63987c9` citado em `docs/PLANO_ESTADO_...` não está no clone |
| `e2e/` executado | **não revisado** | Playwright exige app servido + `VITE_SUPABASE_*` reais; não rodado para não bater em produção |
| `deno test` das edges | **não revisado** localmente | Deno não instalado nesta máquina; a evidência usada vem dos logs do CI |
| Build de produção | **parcial** | falhou localmente só por falta de `xlsx` (host bloqueado); o job `build` do CI passa |
| `.docx`/`.pdf`/`.html` da raiz | **parcial** | binários não inspecionados byte a byte; os `.md`/`.json`/`.py` da raiz foram lidos |
