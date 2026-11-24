# Contexto de código do Lalamove V2 para agentes de IA

GERADO AUTOMATICAMENTE por scripts/ai-context/gerar.mjs — não editar à mão; será sobrescrito.
Gerado sob demanda (não há workflow de contexto neste repo); rode o comando abaixo e commite a saída junto do fix. Gere com `node scripts/ai-context/gerar.mjs`. Commit-base: `53d34963d70f8ca12de31ac42a7429934ab4f68f` (2026-11-24T10:09:33-03:00).

As regras do dono estão em `AGENTS.md` e `docs/agentes/` — este diretório é só o mapa do código.

## Como usar (leia antes de planejar ou executar qualquer tarefa)
1. **Tela/rota/menu** → `rotas.json` (url → arquivo → hooks → tabelas → edges, com `papel_requerido`/`requer_mfa`) e `modulos.json` (módulo inteiro + dependências entre módulos).
2. **RBAC** → `rbac.json` (rotas por papel, rotas com MFA, divergência menu × ProtectedRoute, tabelas sem RLS).
3. **Hook/serviço/lógica** → `hooks.json`, `logica.json` (quem usa, o que toca, se tem teste).
4. **Edge function** → `edge-functions.json` (verify_jwt, service_role, HMAC, tabelas, env, quem chama, órfãs).
5. **Banco** → `banco.json` (colunas, RLS, policies, índices, FKs, triggers, cron jobs, buckets, drift migration×types, uso no código) — visão do código; o banco vivo exige MCP que esta sessão não tem (`docs/agentes/banco.md`).
6. **Antes de criar arquivo** → `convencoes.json`, `componentes.json` (nomes duplicados, órfãos), `grafo.json` (hubs, ciclos) e `grafo-graphify.json` (grafo por AST, quando gerado).
7. **CI/scripts/deploy/env/integrações/flags** → `ferramentas.json` e `scripts.json`.
8. **Antes de abrir PR** → `testes.json` (comandos e cobertura) e `baseline.json` (alertas, TODOs, hotspots, últimos commits).
Os JSONs são grandes: filtre com `rg`/`jq` pelo caminho/arquivo/tabela da sua tarefa; não carregue tudo.

## Stack
- linguagens: TypeScript (599), SQL (204), JavaScript (114), Markdown (114), JSON (31), Shell (10), Python (8), YAML (8)
- linguagem_principal: TypeScript
- framework: React
- bundler: Vite
- roteador: react-router-dom (rotas declaradas em src/App.tsx)
- banco: Supabase Cloud (project_id em supabase/config.toml: iecgydonctmabiijadsf)
- edge_runtime: Deno (supabase/functions)
- testes: vitest, playwright, deno test (contratos das edges)
- ui: tailwind, radix/shadcn, lucide, recharts, mapbox-gl
- estado: react-query, zustand
- gerenciador_pacotes: npm (package-lock.json; não há bun.lock)
- node: n/d
- deploy: vercel, github actions
- pastas_fonte: src

## Números
| item | qtd |
|---|---|
| arquivos_total | 1112 |
| arquivos_codigo | 712 |
| linhas_codigo | 140929 |
| rotas | 57 |
| rotas_protegidas | 49 |
| rotas_com_mfa | 8 |
| itens_menu | 51 |
| modulos | 43 |
| componentes | 221 |
| hooks | 102 |
| edge_functions | 28 |
| tabelas | 93 |
| migrations | 193 |
| cron_jobs | 24 |
| testes | 183 |
| workflows | 5 |
| scripts | 107 |
| docs_md | 114 |

## Onde ficam as coisas
- telas: src/pages (55)
- componentes: src/components (129), src/pages (88), src/hooks (3)
- hooks: src/hooks (86), src/components (13), scripts/ai-context (1)
- servicos_logica: src/lib (30), src/utils (6), src/integrations (4)
- testes: co-localizado (__tests__) (60), guards em scripts/ (47), supabase/functions/<edge> (45)
- edge_functions: supabase/functions
- migrations: supabase/migrations
- scripts: scripts/ci (29), scripts/db-audit (20), scripts/inventario (5)
- rotas: src/App.tsx
- menu: src/components/layout/MobileBottomNav.tsx, src/components/layout/sidebar-config.ts
- docs: docs (37), (raiz) (7), .github (1)
- nomenclatura: {"componentes":"PascalCase (71%)","hooks":"use + PascalCase","servicos":"camelCase (85%)","edge_functions":"kebab-case (100%)","tabelas":"snake_case (95%)"}
- instruções para agentes no repo: .hermes.md, AGENTS.md, CLAUDE.md, docs/agentes/banco.md, docs/agentes/deploy.md, docs/agentes/github-ci.md, docs/agentes/lalamove-api.md, docs/agentes/mapa-repo.md, docs/agentes/mensageria.md, docs/agentes/pendencias-dono.md, docs/agentes/regras-dominio.md

## Módulos (menu → domínio)
| módulo | itens de menu | telas | arquivos | hooks locais | edges | tabelas |
|---|---|---|---|---|---|---|
| components/auth | 0 | 0 | 9 | 5 | 1 | 6 |
| components/dashboard | 0 | 0 | 13 | 43 | 4 | 5 |
| components/layout | 0 | 0 | 6 | 172 | 14 | 37 |
| components/map | 0 | 0 | 20 | 22 | 2 | 4 |
| components/orders | 0 | 0 | 9 | 37 | 7 | 8 |
| components/ui | 0 | 0 | 62 | 8 | 0 | 0 |
| functions | 0 | 0 | 72 | 0 | 6 | 48 |
| hooks | 0 | 0 | 87 | 232 | 15 | 54 |
| lib | 0 | 0 | 30 | 8 | 3 | 0 |
| pages | 49 | 56 | 57 | 211 | 14 | 54 |
| pages/map-tools | 0 | 0 | 7 | 9 | 1 | 0 |
| pages/reports | 0 | 0 | 5 | 1 | 0 | 3 |
| pages/settings | 0 | 0 | 5 | 1 | 0 | 1 |
| utils | 0 | 0 | 6 | 0 | 0 | 0 |

## Rotas (url → arquivo → papel)
- `/` [tela] → src/pages/DashboardRedesigned.tsx · papel viewer
- `/*` [tela] → src/pages/NotFound.tsx · **público**
- `/alert-configurations` [tela] → src/pages/AlertConfigurationsPage.tsx · papel manager
- `/alerts` [tela] → src/pages/AlertsPage.tsx · papel operator
- `/analytics` [tela] → src/pages/AnalyticsDashboardPage.tsx · papel viewer
- `/approvals` [tela] → src/pages/ApprovalsPage.tsx · papel manager
- `/auth` [tela] → src/pages/AuthPage.tsx · **público**
- `/bitrix24` [tela] → src/pages/Bitrix24Page.tsx · papel manager · MFA
- `/cache-monitoring` [tela] → src/pages/CacheMonitoringPage.tsx · papel manager
- `/cache-status` [tela] → src/pages/CacheStatusPage.tsx · papel manager
- `/contacts` [tela] → src/pages/ContactsPage.tsx · papel operator
- `/dashboard` [tela] → src/pages/DashboardRedesigned.tsx · papel viewer
- `/delivery-metrics` [tela] → src/pages/DeliveryMetricsPage.tsx · papel viewer
- `/drivers` [tela] → src/pages/DriversPage.tsx · papel operator
- `/error-monitoring` [tela] → src/pages/ErrorMonitoringPage.tsx · papel manager
- `/evaluations` [tela] → src/pages/EvaluationsPage.tsx · papel operator
- `/external-data` [tela] → src/pages/ExternalDataPage.tsx · papel manager · MFA
- `/forgot-password` [tela] → src/pages/ForgotPasswordPage.tsx · **público**
- `/geo-blocking` [tela] → src/pages/GeoBlockingPage.tsx · papel admin
- `/heatmap` [tela] → src/pages/HeatmapPage.tsx · papel viewer
- `/incidents` [tela] → src/pages/IncidentsPage.tsx · papel operator
- `/ip-whitelist` [tela] → src/pages/IPWhitelistPage.tsx · papel admin
- `/job-queue` [tela] → src/pages/JobQueuePage.tsx · papel manager
- `/lalamove-operacoes` [tela] → src/pages/LalamoveOperationsPage.tsx · papel operator
- `/lalamove-quota` [tela] → src/pages/LalamoveQuotaPage.tsx · papel admin
- `/live-map` [tela] → src/pages/LiveMapPage.tsx · papel viewer
- `/map` [redirect] → **ARQUIVO NÃO RESOLVIDO** · **público**
- `/map-tools` [tela] → src/pages/MapToolsPage.tsx · papel manager
- `/metrics` [tela] → src/pages/MetricsPage.tsx · papel viewer
- `/mfa-enroll` [tela] → src/pages/MFAEnrollPage.tsx · **público**
- `/mfa-verify` [tela] → src/pages/MFAVerifyPage.tsx · **público**
- `/notification-history` [tela] → src/pages/NotificationHistoryPage.tsx · papel viewer
- `/orders` [tela] → src/pages/OrdersPage.tsx · papel operator
- `/password-reset-approvals` [tela] → src/pages/PasswordResetApprovalsPage.tsx · papel admin
- `/performance` [tela] → src/pages/PerformanceDashboardPage.tsx · papel manager
- `/permissions` [tela] → src/pages/PermissionsPage.tsx · papel admin
- `/preferences` [tela] → src/pages/UserPreferencesPage.tsx · papel viewer
- `/profile` [tela] → src/pages/ProfilePage.tsx · papel viewer
- `/rate-limiting` [tela] → src/pages/RateLimitDashboardPage.tsx · papel admin
- `/reports` [tela] → src/pages/ReportsPage.tsx · papel viewer
- `/reports/advanced` [tela] → src/pages/AdvancedReportsPage.tsx · papel viewer
- `/reset-password` [tela] → src/pages/ResetPasswordPage.tsx · **público**
- `/risk-rules` [tela] → src/pages/RiskRulesPage.tsx · papel manager · MFA
- `/roles` [tela] → src/pages/RolesPage.tsx · papel admin
- `/security` [tela] → src/pages/SecurityDashboardPage.tsx · papel admin
- `/settings` [tela] → src/pages/SettingsPage.tsx · papel manager
- `/settings/lalamove` [tela] → src/pages/LalamoveSettingsPage.tsx · papel manager · MFA
- `/settings/maps` [tela] → src/pages/MapsSettingsPage.tsx · papel manager · MFA
- `/settings/messaging` [tela] → src/pages/MessagingSettingsPage.tsx · papel admin · MFA
- `/settings/uapi` [tela] → src/pages/UAPISettingsPage.tsx · papel manager · MFA
- `/sla` [tela] → src/pages/SLADashboardPage.tsx · papel viewer
- `/slo` [tela] → src/pages/SLODashboardPage.tsx · papel manager
- `/system-health` [tela] → src/pages/SystemHealthPage.tsx · papel manager
- `/system-health-expanded` [tela] → src/pages/SystemHealthExpandedPage.tsx · papel manager
- `/telemetria` [tela] → src/pages/AdminTelemetriaPage.tsx · papel admin
- `/unauthorized` [tela] → src/pages/UnauthorizedPage.tsx · **público**
- `/webhooks` [tela] → src/pages/WebhooksPage.tsx · papel manager · MFA

## Menu (sidebar-config.ts)
- Mais → `#more` — **SEM ROTA**
- [Analytics] Dashboard Analytics → `/analytics`
- [Analytics] Dashboard SLA → `/sla`
- [Analytics] Ferramentas Mapa → `/map-tools` (papel manager)
- [Analytics] Mapa de Calor → `/heatmap`
- [Analytics] Métricas → `/metrics`
- [Analytics] Métricas Entregas → `/delivery-metrics`
- [Analytics] Relatórios → `/reports`
- [Analytics] Relatórios Avançados → `/reports/advanced`
- [Integrações] Base CRM → `/external-data` (papel manager)
- [Integrações] Bitrix24 → `/bitrix24` (papel manager)
- [Integrações] Lalamove API → `/settings/lalamove` (papel manager)
- [Integrações] Mensageria → `/settings/messaging` (papel admin)
- [Integrações] Provedores de Mapa → `/settings/maps` (papel manager)
- [Integrações] UAPI Settings → `/settings/uapi` (papel manager)
- [Integrações] Webhooks → `/webhooks` (papel manager)
- [Mais] Perfil → `/profile`
- [Mais] Preferências → `/preferences`
- [Notificações] Alertas → `/alerts`
- [Notificações] Config. Alertas → `/alert-configurations` (papel manager)
- [Notificações] Histórico → `/notification-history`
- [Operações] Aprovações → `/approvals` (papel manager)
- [Operações] Avaliações → `/evaluations`
- [Operações] Incidentes → `/incidents`
- [Operações] Mapa ao Vivo → `/map`
- [Operações] Mapa ao Vivo → `/live-map`
- [Principal] Contatos → `/contacts`
- [Principal] Dashboard → `/`
- [Principal] Dashboard (alias) → `/dashboard`
- [Principal] Motoristas → `/drivers`
- [Principal] Operações Lalamove → `/lalamove-operacoes`
- [Principal] Pedidos → `/orders`
- [Segurança] Bloqueio Geo → `/geo-blocking` (papel admin)
- [Segurança] Central Segurança → `/security` (papel admin)
- [Segurança] IP Whitelist → `/ip-whitelist` (papel admin)
- [Segurança] Permissões → `/permissions` (papel admin)
- [Segurança] Reset Senha → `/password-reset-approvals` (papel admin)
- [Segurança] Roles → `/roles` (papel admin)
- [Sistema] Cache Monitor → `/cache-monitoring` (papel manager)
- [Sistema] Configurações → `/settings` (papel manager)
- [Sistema] Cota Lalamove → `/lalamove-quota` (papel admin)
- [Sistema] Dashboard SLO → `/slo` (papel manager)
- [Sistema] Erros Runtime → `/error-monitoring` (papel manager)
- [Sistema] Fila de Jobs → `/job-queue` (papel manager)
- [Sistema] Performance → `/performance` (papel manager)
- [Sistema] Rate Limiting → `/rate-limiting` (papel admin)
- [Sistema] Regras de Risco → `/risk-rules` (papel manager)
- [Sistema] Saúde do Sistema → `/system-health` (papel manager)
- [Sistema] Saúde Expandida → `/system-health-expanded` (papel manager)
- [Sistema] Status do Cache → `/cache-status` (papel manager)
- [Sistema] Telemetria BD → `/telemetria` (papel admin)

## Edge functions
- `apply-fixes` [Manutenção/DDL] — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `bitrix24-process-queue` [Bitrix24] — tabelas: bitrix24_activities, bitrix24_stage_mappings, bitrix24_sync, bitrix24_tokens; chamada por 1 arquivo(s) do front
- `bitrix24-sync` [Bitrix24] — tabelas: bitrix24_activities, bitrix24_stage_mappings, bitrix24_sync, bitrix24_tokens, lalamove_orders; chamada por 1 arquivo(s) do front
- `check-driver-alerts` [Notificações/Alertas] — tabelas: active_tracking, alert_configurations, alerts; chamada por 0 arquivo(s) do front
- `check-external-api` — tabelas: -; chamada por 2 arquivo(s) do front
- `escalate-alerts` [Notificações/Alertas] — tabelas: -; chamada por 0 arquivo(s) do front, por SQL/cron
- `evaluate-driver` [Motoristas] — tabelas: alerts, driver_approval_queue, driver_evaluations, driver_incidents, drivers, lalamove_orders, risk_rules; chamada por 1 arquivo(s) do front
- `external-companies` [Dados externos] — tabelas: carriers, companies, contacts, customers, suppliers; chamada por 1 arquivo(s) do front
- `external-db-bridge` [Dados externos] — tabelas: query_telemetry; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `geo-admin` — tabelas: audit_log, user_roles; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `geo-gateway` — tabelas: alerts, geo_budget, geo_cache, geo_price_list, geo_settings, geo_usage_month, query_telemetry; chamada por 4 arquivo(s) do front
- `get-mapbox-token` [Mapbox] — tabelas: -; chamada por 3 arquivo(s) do front
- `job-worker` [Fila de jobs] — tabelas: active_tracking, alert_configurations, driver_locations, lalamove_orders, lalamove_stops, tracking_events; chamada por 0 arquivo(s) do front, por SQL/cron
- `lalamove-api` [Lalamove API v3] — tabelas: alerts, drivers, lalamove_orders, lalamove_priority_fee_history, lalamove_rate_limits, lalamove_status_history, lalamove_stops; chamada por 4 arquivo(s) do front
- `lalamove-gateway` [Lalamove API v3] — tabelas: alerts, lalamove_rate_limits, query_telemetry; chamada por 1 arquivo(s) do front
- `lalamove-token-refresh` [Lalamove API v3] — tabelas: alerts, lalamove_uapi_sessions; chamada por 0 arquivo(s) do front, por SQL/cron
- `lalamove-uapi` [Lalamove API v3] — tabelas: lalamove_orders, lalamove_uapi_sessions; chamada por 1 arquivo(s) do front
- `lalamove-webhook` [Lalamove API v3] (verify_jwt=false) — tabelas: active_tracking, alerts, driver_locations, drivers, lalamove_order_replacements, lalamove_orders, lalamove_status_history, lalamove_stop_proofs, lalamove_stops, tracking_events, webhook_events; chamada por 0 arquivo(s) do front
- `llm-wh` [Dados externos] (verify_jwt=false) — tabelas: -; chamada por 0 arquivo(s) do front
- `mcp-query` (verify_jwt=false) — tabelas: query_telemetry; chamada por 0 arquivo(s) do front
- `new-device-alert` [Notificações/Alertas] — tabelas: auth_logs, new_device_alerts, user_devices; chamada por 1 arquivo(s) do front
- `rotate-tokens` [Segredos/token] — tabelas: alerts, bitrix24_tokens; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `route-analyzer` [Lovable AI (custo por token)] — tabelas: alerts, drivers, lalamove_orders; chamada por 1 arquivo(s) do front
- `seed-fix-rls` [Manutenção/DDL] — tabelas: -; chamada por 0 arquivo(s) do front — **ÓRFÃ**
- `send-notification` [Notificações/Alertas] — tabelas: active_tracking, alert_configurations, alerts, alerts_sent, bitrix24_tokens, drivers, geo_defaults, job_queue, lalamove_orders, order_geo_events; chamada por 1 arquivo(s) do front
- `simulate-driver-movement` [Motoristas] — tabelas: active_tracking, tracking_events, user_roles; chamada por 1 arquivo(s) do front
- `test-notification` [Notificações/Alertas] — tabelas: bitrix24_tokens; chamada por 2 arquivo(s) do front
- `zapp-callback` — tabelas: active_tracking, alerts, driver_incidents, drivers, lalamove_orders, notification_messages, notification_optouts, tracking_events; chamada por 0 arquivo(s) do front — **ÓRFÃ**

## Cron jobs (pg_cron)
- `check-driver-alerts` */2 * * * * (20261123190000_cron_check_driver_alerts.sql)
- `cleanup_audit_logs_daily` 45 3 * * * (20260723174804_fdc57530-908c-4784-9758-01d59f616f3b.sql)
- `cleanup-old-cron-logs` 15 4 * * 0 (20260712202307_d4575c89-bdd8-439f-92bc-3d5524309049.sql)
- `cleanup-old-jobs` 0 3 * * * (20251226010001_configure_pg_cron.sql)
- `cleanup-old-region-cache` 50 3 * * * (20260713110255_6aaaebe5-58db-4f07-b425-9d337432b66b.sql)
- `cleanup-processing-logs` 0 4 * * * (20251226010001_configure_pg_cron.sql)
- `daily-cleanup-tokens-and-attempts` 0 3 * * * (20260109205309_5747a020-5d75-4401-a623-b5688143f754.sql)
- `daily-cleanup-with-logging` 45 3 * * * (20260712202307_d4575c89-bdd8-439f-92bc-3d5524309049.sql)
- `escalate-unacknowledged-alerts` */5 * * * * → edge escalate-alerts (20261122140000_fix_crons_dispatcher.sql)
- `geo-budget-notify` 0 */6 * * * (20261123120000_geo_budget_cron.sql)
- `geo-cache-prune` 15 3 * * * (20261122130100_geo_foundation.sql)
- `geo-jobs-refresh` 1-59/5 * * * * (20261121194500_geo_jobs_scheduler.sql)
- `lalamove_uapi_token_refresh_hourly` 17 * * * * → edge lalamove-token-refresh (20261122140000_fix_crons_dispatcher.sql)
- `notification_messages_scrub_bodies` 25 4 * * * (20261125120000_notification_ledger.sql)
- `process-job-queue` * * * * * → edge escalate-alerts (20251226010001_configure_pg_cron.sql)
- `provision-tracking-partitions` 5 0 1 * * (20260711192431_6df39da5-eab7-41bd-8d4e-f6f7ad4e777e.sql)
- `prune-tracking-partitions` 20 0 2 * * (20260711192632_782b3feb-4233-4a31-85ae-def6a74cec82.sql)
- `refresh-cache-views` 3 * * * * (20261123110000_cron_refresh_cache_views.sql)
- `refresh-delivery-hourly-stats` 5 * * * * (20251226020000_create_materialized_views_cache.sql)
- `refresh-delivery-metrics-cache` */30 * * * * (20251226000004_create_cache_views.sql)
- `refresh-driver-stats-cache` */15 * * * * (20251226020000_create_materialized_views_cache.sql)
- `refresh-hourly-metrics-cache` */5 * * * * (20251226000004_create_cache_views.sql)
- `refresh-risk-distribution` */30 * * * * (20251226020000_create_materialized_views_cache.sql)
- `weekly-cleanup-cron-logs` 0 4 * * 0 (20260109205309_5747a020-5d75-4401-a623-b5688143f754.sql)

## Integrações externas
- SDKs: CSV (papaparse), IndexedDB (idb), Lovable Cloud, Mapbox GL, Postgres (pg, scripts), Recharts, Supabase, Web Vitals, XLSX (export), i18next, jsPDF (export), react-query, zod, zustand
- serviços por edge: Lalamove API v3 (5), Notificações/Alertas (5), Dados externos (3), Bitrix24 (2), Manutenção/DDL (2), Motoristas (2), Fila de jobs (1), Lovable AI (custo por token) (1), Mapbox (1), Segredos/token (1)
- hosts mais citados: iecgydonctmabiijadsf.supabase.co, api.supabase.com, api.mapbox.com, www.google.com, maps.googleapis.com, supabase.com, api.resend.com, lalamove-v2.vercel.app, rest.lalamove.com, routes.googleapis.com, x.supabase.co, a.tile.openstreetmap.org, abc.supabase.co, addressvalidation.googleapis.com, ai.gateway.lovable.dev
- webhooks recebidos (verify_jwt=false): lalamove-webhook, llm-wh, mcp-query
- env de integração (só NOMES, nunca valores): BITRIX24_CLIENT_ID, BITRIX24_CLIENT_SECRET, BITRIX24_WEBHOOK_URL, EVOLUTION_API_KEY, EXTERNAL_SUPABASE_SERVICE_ROLE_KEY, EXTERNAL_SUPABASE_URL, GOOGLE_MAPS_API_KEY, LALAMOVE_API_KEY, LALAMOVE_API_SECRET, LALAMOVE_API_URL, LALAMOVE_BASE_URL, LALAMOVE_TRUSTED_IPS, LALAMOVE_UNIFIED_PROXY_KEY, LALAMOVE_UNIFIED_PROXY_URL, LOVABLE_API_KEY, MAPBOX_ACCESS_TOKEN, MAPBOX_SERVER_TOKEN, MAPBOX_TOKENS_API_TOKEN, MAPBOX_USERNAME, RESEND_API_KEY, SLACK_WEBHOOK_URL, SUPABASE_ANON_KEY, SUPABASE_PROJECT_REF, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_URL, ZAPP_CALLBACK_SECRET

## RBAC
- hierarquia: viewer=1 < operator=2 < manager=3 < admin=4
- rotas por papel: (público) (7), admin (10), manager (19), operator (7), viewer (13)
- rotas com MFA: /bitrix24, /external-data, /risk-rules, /settings/lalamove, /settings/maps, /settings/messaging, /settings/uapi, /webhooks
- guards: src/components/auth/ProtectedRoute.tsx
- enums de papel no banco: app_role: admin|manager|operator|viewer
- feature flags: realtime_map_updates, ai_route_optimization, driver_auto_evaluation, flag_inexistente

## Alertas (baseline.json → alertas)
- rotas_sem_arquivo: 0
- rotas_sem_protecao: 1 — ex.: /mfa-enroll
- menu_visivel_sem_acesso: 7 — ex.: Alertas -> /alerts (menu: todos; rota: operator), Avaliações -> /evaluations (menu: todos; rota: operator), Incidentes -> /incidents (menu: todos; rota: operator)
- componentes_ambiguos: 0
- menu_sem_destino: 0
- edges_orfas: 6 — ex.: apply-fixes, external-db-bridge, geo-admin
- edges_chamadas_sem_pasta: 0
- edges_sem_verify_jwt: 3 — ex.: lalamove-webhook, llm-wh, mcp-query
- tabelas_sem_rls: 0
- tabelas_usadas_sem_definicao: 4 — ex.: carriers, companies, customers
- tabelas_com_drift_migration_vs_types: 4 — ex.: geo_budget, geo_cache, message_templates
- rpcs_sem_definicao: 1 — ex.: exec
- componentes_orfaos: 5 — ex.: src/components/approvals/SwipeableApprovalCard.tsx, src/components/debug/AuditReportGenerator.tsx, src/components/ui/chart.tsx
- componentes_com_nome_duplicado: 5 — ex.: ExtendedFAB, MiniFAB, QuickActionsPanel
- scripts_orfaos: 3 — ex.: scripts/deploy-gateway.ps1, scripts/fix_corrupted_imports.py, scripts/fix_logs.py
- scripts_soltos_na_raiz: 29 — ex.: scripts/add-security-manage.ts, scripts/apply-dashboard-fixes.ts, scripts/apply-final-sql.ts
- env_usadas_nao_declaradas: 5 — ex.: DEV, PROD, VITE_APP_VERSION
- ciclos_de_import: 2
- possiveis_segredos_no_codigo: 1 — ex.: supabase/functions/geo-admin/rotation.test.ts:32

## Grafo de código (graphify)
- 9883 nós · 20482 arestas · 707 comunidades · grafo do commit `53d34963`
- comunidades maiores: cn (270), button.tsx (199), App.tsx (120), badge.tsx (107), ref_https (99), geo-gateway/index.ts (96), @tanstack/react-query (92), 4. Componentes, hooks, libs e estado — **revisado** (85), ref_node_path (85), send-notification/index.ts (82), dependencies (81), client.ts (79)
- símbolos mais chamados: cn() (src/lib/utils.ts), q() (scripts/supabase_snapshot/snapshot.py), GeoProviderError (supabase/functions/geo-gateway/providers/types.ts), uapiRequest() (supabase/functions/lalamove-uapi/index.ts), useAuth() (src/hooks/useAuth.tsx), .collect() (scripts/supabase_snapshot/test_snapshot.py), excluded_sql() (scripts/supabase_snapshot/snapshot.py), isLalamoveConfigured() (src/lib/lalamove-config.ts), .metadata() (scripts/supabase_snapshot/test_snapshot.py), header() (scripts/regras_negocio/generate.py), internalLogger() (supabase/functions/job-worker/index.ts), useFuseSearchWithMatches() (src/hooks/useFuseSearch.ts)

## Hotspots (arquivos mais alterados, 90 dias)
- docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md (39)
- package.json (34)
- package-lock.json (32)
- docs/planos/PLANO_FRONTEND_190_ETAPAS.md (26)
- .github/workflows/ci.yml (19)
- supabase/config.toml (17)
- docs/MAPBOX.md (13)
- docs/planos/PLANO_MENSAGERIA_MOTORISTAS_ZAPP_SMS_150_ETAPAS.md (13)
- supabase/functions/job-worker/index.ts (13)
- supabase/functions/send-notification/index.ts (12)
- docs/planos/PLANO_MAPBOX_100_ETAPAS.md (11)
- src/components/orders/NewOrderDialog.tsx (11)
- supabase/functions/_shared/schemas.ts (11)
- supabase/functions/geo-gateway/index.ts (11)
- docs/pendencias/_ordem.md (10)

## Workflows
- `apply-migrations.yml` — Apply Migrations (manual) (workflow_dispatch)
- `ci.yml` — CI/CD (pull_request, push)
- `contexto.yml` — Contexto para agentes de IA (10 min) (push, schedule, workflow_dispatch; cron 3 * * * *)
- `deploy-edges.yml` — Deploy Edge Functions (push, workflow_dispatch)
- `inventario-estado-semanal.yml` — Inventário do estado real (semanal) (schedule, workflow_dispatch; cron 37 9 * * 1)

## Scripts npm
- `dev`: `vite`
- `build`: `vite build`
- `build:dev`: `vite build --mode development`
- `lint`: `eslint .`
- `lint:i18n`: `node scripts/ci/check-i18n-parity.mjs`
- `lint:a11y`: `node scripts/ci/a11y-button-name-ratchet.mjs`
- `preview`: `vite preview`
- `test`: `vitest run`
- `test:coverage`: `vitest run --coverage`
- `test:e2e`: `playwright test`
- `test:e2e:ui`: `playwright test --ui`
- `test:e2e:report`: `playwright show-report`
- `seed`: `tsx scripts/seed-database.ts`
- `graph:setup`: `bash scripts/graphify/setup.sh`
- `graph:update`: `graphify update .`

## Comandos de verificação
- unit: npx vitest run <caminho>
- typecheck: npx tsc --noEmit -p tsconfig.app.json
- lint: npx eslint <arquivos>
- e2e: npx playwright test
- edges: deno test --allow-net --allow-env supabase/functions/_shared/contract.test.ts supabase/functions/lalamove-webhook/security.test.ts
- guards: node --test scripts/ci/*.unit.mjs

## Documentos (raiz e docs/)
- `.github/PULL_REQUEST_TEMPLATE.md` (20 linhas)
- `AGENTS.md` — AGENTS.md — Lalamove V2 (140 linhas)
- `CHANGELOG.md` — Changelog (486 linhas)
- `CLAUDE.md` (2 linhas)
- `README.md` — 🚀 Lalamove Intelligence (1462 linhas)
- `SECURITY_CHECKLIST.md` — Security Checklist - Lalamove Guardian (77 linhas)
- `docs/ACHADO_GATEWAY_PROXY_2026-11.md` — Achado: o `lalamove-gateway` aponta para um proxy que não existe (48 linhas)
- `docs/ANALISE_EXAUSTIVA_E_PLANO_INTEGRACAO_2026-11-21.md` — Lalamove V2 — Análise Exaustiva e Plano de Integração Completo (709 linhas)
- `docs/API_CONTRACTS.md` — 📑 Contratos de API — Webhooks & Edge Functions (214 linhas)
- `docs/API_REFERENCE.md` — 📘 API Reference - Lalamove Guardian (948 linhas)
- `docs/ARCHITECTURE.md` — 🏗️ Arquitetura - Lalamove Guardian (968 linhas)
- `docs/AUDITORIA_PRS_FECHADAS_2026-11.md` — Auditoria das PRs fechadas sem merge — 2026-11-21 (byte a byte) (67 linhas)
- `docs/AUDITORIA_TECNICA_2026-09.md` — 🔬 Auditoria Técnica — Lalamove V2 (223 linhas)
- `docs/CACHE_SYSTEM.md` — 📊 Sistema de Cache - Materialized Views (47 linhas)
- `docs/CONTRIBUTING.md` — 🤝 Contributing - Lalamove Guardian (110 linhas)
- `docs/CRON_JOBS.md` — ⏱️ Cron Jobs & Rotinas de Manutenção (130 linhas)
- `docs/DATA_DICTIONARY.md` — 📖 Dicionário de Dados — Lalamove Intelligence (33 linhas)
- `docs/DEPLOYMENT.md` — 🚀 Deployment - Lalamove Guardian (89 linhas)
- `docs/EDGE_DEPLOY_PIPELINE.md` — Pipeline de deploy das edge functions — 2026-11 (49 linhas)
- `docs/FUNCIONALIDADES_E_FERRAMENTAS.md` — 📋 Levantamento Completo de Funcionalidades e Ferramentas (725 linhas)
- `docs/GEO_CONTRACT.md` — Contrato de dados do motor geo (312 linhas)
- `docs/GEO_PENDENCIAS.md` — O que ficou desligado ou para depois (41 linhas)
- `docs/GEO_PROVIDERS.md` — Como adicionar um provedor de mapa (HERE, TomTom, …) (59 linhas)
- `docs/GOOGLE_MAPS.md` — Google Maps na Lalamove V2 (157 linhas)
- `docs/JOB_QUEUE_SYSTEM.md` — 📦 Sistema de Filas Assíncronas - Job Queue (578 linhas)
- `docs/LALAMOVE_API_V3.md` — Lalamove API v3 — Documentação Técnica Completa (Brasil) (635 linhas)
- `docs/LALAMOVE_FAILURE_SIMULATION.md` — Simulação exaustiva de cenários de falha — Lalamove (v3 + UAPI) (70 linhas)
- `docs/LALAMOVE_MASTER_ANALYSIS.md` — 🔬 Lalamove — Análise Mestra e Roteiro de Evolução (477 linhas)
- `docs/LALAMOVE_SCORECARD.md` — Scorecard de Conformidade Lalamove — 22 dimensões (39 linhas)
- `docs/LEVANTAMENTO_COMPLETO_FUNCIONALIDADES.md` — 📋 Levantamento Completo e Exaustivo de Funcionalidades (928 linhas)
- `docs/LOGGING_AND_HEALTH.md` — 📊 Logging & Health Checks (529 linhas)
- `docs/MAPBOX.md` — MAPBOX — Inventário e Referência (21/11/2026) (241 linhas)
- `docs/MIGRATION_RECONCILIATION_2026-11.md` — Reconciliação ledger × schema × repo — 2026-11-21 (70 linhas)
- `docs/PLANO_ESTADO_LALAMOVE_V2_2026-11-21.md` — Lalamove V2 — estado da sessão de 21/11/2026 (continuidade) (197 linhas)
- `docs/QUEUE_SYSTEM.md` — 🔄 Sistema de Filas Assíncronas (612 linhas)
- `docs/RUNBOOK_GOOGLE_MAPS.md` — RUNBOOK — Google Maps Platform (operação) (136 linhas)
- `docs/RUNBOOK_LALAMOVE.md` — Runbook — Integração Lalamove (v3 REST + UAPI) (126 linhas)
- `docs/RUNBOOK_MAPBOX.md` — RUNBOOK — Mapbox (operação) (78 linhas)
- `docs/SCREENING_SYSTEM.md` — 🔍 Sistema de Screening - Lalamove Guardian (717 linhas)
- `docs/SECURITY.md` — 🔒 Security - Lalamove Guardian (87 linhas)
- `docs/TROUBLESHOOTING.md` — 🔧 Troubleshooting - Lalamove Guardian (178 linhas)
- `docs/WEBHOOK_HANDLER.md` — 📡 Webhook Handler - Lalamove Guardian (142 linhas)
- `docs/audit_report.md` — 🏆 Relatório de Auditoria Enterprise - Lalamove Guardian (124 linhas)
- `lalamove_n8n_integration.md` — Integração n8n ↔ Lalamove Token Manager (141 linhas)
- `lalamove_order_history_full.md` — Lalamove Brasil — Histórico Completo de Pedidos (116 linhas)
- subpastas de docs/: docs/pendencias (20), docs/agentes (8), docs/planos (7), docs/qa (6), docs/adr (2), docs/backups (2), docs/contexto (2), docs/auditorias (1), docs/ci (1)
- CHANGELOG topo: [1.6.0] - 2026-11-22

## Últimos commits
- 2026-11-24 `53d3496` fix: historico de notificacoes mostra o mesmo rotulo de alerta da tela de Alertas (#354)
- 2026-11-24 `71cf6b0` fix: alerta de tipo novo nao quebra mais a tela de Alertas (#353)
- 2026-11-24 `65473ca` feat: M2 — cobranca sem resposta no prazo vira alerta interno ao operador (#352)
- 2026-11-24 `8d7ec0f` fix: retorno do Guardian expoe quantas confirmacoes (M2) foram pedidas (#351)
- 2026-11-24 `a741f0d` feat: M2 — o motor pede confirmacao ao motorista 2 min apos o aviso (#350)
- 2026-11-24 `520a9a2` docs: runbook de mensageria aponta o emissor real dos efeitos da resposta (#349)
- 2026-11-24 `49e4bc3` fix: topic unico em todo canal realtime de nome fixo (#348)
- 2026-11-24 `0e04753` fix: ledger reservado antes do envio ao motorista (#347)
- 2026-11-24 `3f160c3` feat: resposta do motorista vira acao no pedido (etapas 113 e 114) (#346)
- 2026-11-24 `5ae5aff` feat: aviso de chegada na coleta ao motorista (M4) (#345)
- 2026-11-24 `d882d05` feat: lembrete de pedido agendado e aviso de proxima parada (#344)
- 2026-11-24 `b77ccd9` feat: motor avisa o motorista em atraso de ETA e falta de comprovante (#343)
- 2026-11-24 `f242d42` fix: rota desligada no painel passa a valer no motor (#342)
- 2026-11-23 `5bfc969` fix: paginas de dados mostram erro e botao de tentar novamente (#341)
- 2026-11-23 `e01dfaa` feat: historico de notificacoes passa a ler o ledger do motor (#340)

## Arquivos deste diretório
- `docs/contexto/codigo/rotas.json`
- `docs/contexto/codigo/modulos.json`
- `docs/contexto/codigo/componentes.json`
- `docs/contexto/codigo/hooks.json`
- `docs/contexto/codigo/edge-functions.json`
- `docs/contexto/codigo/banco.json`
- `docs/contexto/codigo/rbac.json`
- `docs/contexto/codigo/ferramentas.json`
- `docs/contexto/codigo/scripts.json`
- `docs/contexto/codigo/testes.json`
- `docs/contexto/codigo/logica.json`
- `docs/contexto/codigo/grafo.json`
- `docs/contexto/codigo/grafo-arestas.json`
- `docs/contexto/codigo/convencoes.json`
- `docs/contexto/codigo/grafo-graphify.json`
- `docs/contexto/codigo/baseline.json`
- `docs/contexto/codigo/manifest.json` (commit, data, hashes, erros — único arquivo com data/hora)
