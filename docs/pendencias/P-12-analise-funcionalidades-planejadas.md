# P-12 · Análise exaustiva: funcionalidades planejadas vs. implementadas

**Status:** CONCLUÍDO (2026-11-21) — veredito: **100% do planejado para a V2 está implementado**
**Origem:** pedido do dono "todas as funcionalidades planejadas para o sistema foram implementadas? faça uma analise exaustiva"
**Escopo:** V2 (parceira do Lalamove). P-02/P-03 (App Mobile / Chat) são V3 por decisão do dono.

## Fontes do "planejado" cruzadas com o real
- Plano: `docs/LEVANTAMENTO_COMPLETO_FUNCIONALIDADES.md` (15/03/2026, sem marcação de status), `docs/audit_report.md` (14/05/2026, checklist seção 5), `docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md` (auto-gerado).
- Real (código): árvore do main `c77f6cc` — `git ls-tree -r origin/main`.
- Real (banco): snapshot publicado na branch `contexto` (commit 4a63893, gerado ao vivo do Supabase produção em 2026-11-21): `docs/contexto/supabase/{tables.md,types-enums.md,views.md}`.

## Quantitativo — plano vs. real

| Item planejado | Plano (doc) | Real (evidência) |
|---|---|---|
| Páginas | 41 | 85+ em `src/pages/` (ex.: DashboardRedesigned, OrdersPage, DriversPage, ApprovalsPage, IncidentsPage, LiveMapPage, HeatmapPage, AlertsPage, SecurityDashboardPage, SystemHealthPage, SystemHealthExpandedPage, CacheStatusPage, CacheMonitoringPage, JobQueuePage, ErrorMonitoringPage, PerformanceDashboardPage, WebhooksPage, SettingsPage, UserPreferencesPage, Bitrix24Page, MFAVerifyPage, RolesPage, PermissionsPage, IPWhitelistPage, GeoBlockingPage, RateLimitDashboardPage, ReportsPage, AdvancedReportsPage, SLADashboardPage, SLODashboardPage, AnalyticsDashboardPage, DeliveryMetricsPage, MetricsPage, EvaluationsPage, RiskRulesPage, NotificationHistoryPage, AlertConfigurationsPage, LalamoveOperationsPage, LalamoveQuotaPage, LalamoveSettingsPage, UAPISettingsPage, ExternalDataPage, MapToolsPage, ContactsPage, AdminTelemetriaPage) |
| Hooks | 54 | 101 em `src/hooks/` |
| Edge Functions | 17 | 36 em `supabase/functions/` (incl. `_shared`; funções citadas no doc 18: bitrix24-process-queue, bitrix24-sync, check-driver-alerts, check-external-api, evaluate-driver, external-companies, get-mapbox-token, job-worker, lalamove-api, lalamove-webhook, llm-wh, new-device-alert, rotate-tokens, route-analyzer, send-notification, simulate-driver-movement, test-notification — todas presentes; extras: lalamove-gateway, lalamove-uapi, lalamove-token-refresh, mapbox-proxy, mcp-query, apply-fixes, external-db-bridge, escalate-alerts, seed-fix-rls) |
| Tabelas | 31+ | 65 em `docs/contexto/supabase/tables.md`, 100% com RLS ativo |
| Enums | 11 | 11/11 em `types-enums.md` (2 evoluíram: `app_role` = admin/manager/operator/viewer; `alert_type` = +INTEGRATION_FAILURE) |
| Idiomas | 3 | 3/3 `src/i18n/locales/{pt-BR,en,es}.json` |
| Views seguras | 3 | 3/3 `views.md`: `drivers_safe_view`, `orders_safe_view`, `orders_operator_view` (security_invoker) |
| Canais de notificação | 7 | 7 no `send-notification` (Email/WhatsApp/Slack/SMS/Push/Bitrix24/N8N) |

## Checklist da auditoria (`docs/audit_report.md` seção 5)
- 1.1 Auth ✓, 2.1 Webhook ✓, 2.2 HMAC ✓, 3.1 Risk Engine ✓, 3.2 IA Route Analyzer ✓, 4.1 Analytics ✓, 4.2 Exportação PDF/CSV ✓, 6.1 Bitrix24 ✓.
- 1.2 MFA "⚠️ Parcial" → **desatualizado**: implementado de ponta a ponta (hooks useMFA/useWebAuthn, MFAEnroll/MFASettings/MFAVerify, PasskeyLoginButton/PasskeySettings, rota `/mfa-verify`, guards requireMFA nas rotas sensíveis). Ver P-11.
- 5.1 App Mobile / 5.2 Chat → P-02/P-03 adiados para a V3 (decisão dono 2026-11-21).

## Componentes UI do doc 17.5 — todos presentes
CommandPaletteEnhanced, GlobalSearchAdvanced, keyboard-shortcuts-*, contextual-hints, data-refresh-indicator, hover-preview, highlight-match, search-help-tooltip, smart-breadcrumbs, undo-toast, accessible-card, activity-timeline, page-loader — todos verificados na árvore do main. Único desvio de nome: `InstallPrompt` (doc 15.1) não tem componente próprio; o fluxo `beforeinstallprompt`/`deferredPrompt.prompt()` está no `src/components/pwa/OfflineIndicator.tsx` (linhas 161-181).

## Scripts e CI (doc 21)
`scripts/backup.sh` ✓, `scripts/deploy.sh` (fluxo via CI+deploy Vercel) ✓, `scripts/health-check.sh` (substituído por SystemHealthPage + edge check-external-api) ✓, `scripts/pre-commit-secrets.sh` ✓, `.github/workflows/ci.yml` ✓ (+ contexto.yml, inventario-estado-semanal.yml).

## Conclusão
Nenhuma funcionalidade planejada para a V2 ficou sem implementar. Tudo que a auditoria marcou como pendente está coberto (MFA) ou é escopo V3 decidido pelo dono (P-02/P-03). O backlog P-01..P-11 está zerado para a V2 (único pendente humano: P-04 rotação de JWT_SECRET no painel).

## Lacuna não-funcional identificada (vira P-13)
~40 tabelas sem `COMMENT ON TABLE` (glossário auto-gerado `11-GLOSSARIO-E-LACUNAS.md` marca "sem COMMENT ON TABLE"). É documentação de schema, não funcionalidade. Vira P-13.
