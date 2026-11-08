# Regras de domínio que o código não deixa óbvio — referência para agentes

Ler quando mexer em papéis/MFA, aprovações, score de risco, alertas, fila de jobs, cache ou rastreamento.

## Papéis e MFA (RBAC)

- Papéis: `admin | manager | operator | viewer` (`src/hooks/usePermissions.ts:6`), **com hierarquia
  numérica** em `src/components/auth/ProtectedRoute.tsx` (`viewer 1 < operator 2 < manager 3 < admin 4`):
  `requiredRole="operator"` libera operator, manager e admin. Não reimplemente a comparação em componente;
  use `ProtectedRoute` ou `usePermissions`.
- A rota é a fonte de verdade da autorização de tela: toda rota nova entra em `src/App.tsx` com
  `requiredRole` explícito — sem isso a tela fica aberta para qualquer sessão autenticada — e no menu
  (`src/components/layout/sidebar-config.ts`, lido por `Sidebar.tsx` e `MobileSidebar.tsx`), senão a tela
  existe e ninguém chega nela.
- `requireMFA` hoje está em **seis** rotas (`/risk-rules`, `/webhooks`, `/bitrix24`, `/settings/uapi`,
  `/settings/lalamove`, `/external-data`): sem fator verificado, o `ProtectedRoute` manda para
  `/mfa-verify`. Quem mexe em segredo, webhook ou integração externa passa por MFA — mantenha a regra ao
  criar tela equivalente.
- `/profile` só exige sessão; `/` e `/dashboard` renderizam o mesmo `DashboardRedesigned`.
- Autorização de dado é **RLS**, não o front (`docs/adr/001-rls-first-architecture.md`). Tela nova sem
  policy correspondente = feature pela metade.
- O fluxo pré-login (lockout de login, reset de senha, MFA) depende de RPCs `SECURITY DEFINER` com
  `EXECUTE` para `anon` — ver `docs/agentes/banco.md`. Os quatro specs de E2E existentes cobrem exatamente
  esse perímetro (`e2e/login-lockout.e2e.ts`, `mfa.e2e.ts`, `password-reset.e2e.ts`, `rbac.e2e.ts`).

## Score de risco do motorista

Seis entradas com peso fixo (`README.md` > Cálculo do Score de Risco): taxa de falha **25%**, contagem de
incidentes **20%**, atraso médio **15%**, avaliação **15%**, recência da última entrega **15%**, volume de
entregas **10%** → score 0–10 e faixa `LOW 0–2,5 · MEDIUM 2,5–5 · HIGH 5–7,5 · CRITICAL 7,5–10`.
Mudar peso ou faixa = mudar o cálculo (edge `evaluate-driver`), o que a UI mostra e o que as regras de
`/risk-rules` disparam: os três juntos, no mesmo PR, ou o número da tela deixa de bater com o alerta.

## Fila de aprovações

- A fila (`driver_approval_queue`) tem **contador de espera** com urgência progressiva — limites de
  `WaitingTimeCounter`: < 5 min normal, 5–15 min atenção, 15–30 min urgente, > 30 min crítico
  (`src/components/approvals/WaitingTimeCounter.tsx:37-49`; `CHANGELOG.md`, 1.5.0). Mexeu no limiar? Mexa
  no texto e na cor junto, senão "crítico" na tela deixa de significar o mesmo que no alerta.
- Aprovação/rejeição tem realtime (`useApprovalRealtime`) e ações duplicadas em dois hooks
  (`useApprovalActions` e `useApprovalActionsEnhanced`) — confira **qual** a tela usa antes de corrigir
  comportamento; alterar o errado não muda nada na UI.

## Alertas e notificações

- `check-driver-alerts` gera, `escalate-alerts` escala e `send-notification` entrega
  (WhatsApp/e-mail/Slack/Bitrix24/n8n). Canal novo = secret novo na edge, nunca `VITE_*`.
- Há agrupamento de alerta (`useAlertGrouping`) e configuração por tipo (`/alert-configurations`,
  `alert_configurations`): alerta novo sem entrada de configuração nasce sem como ser desligado.
- `new-device-alert` dispara em login de dispositivo novo — não é alerta de entrega; não misture na mesma
  tabela de operação.

## Rastreamento, fila de jobs e cache

- GPS entra em `tracking_events`, **particionada por mês**, e em `active_tracking`; as partições são
  criadas e podadas por `pg_cron` (`docs/CRON_JOBS.md`, `docs/adr/002-driver-locations-partitioning.md`).
  Query de histórico sem filtro de data varre todas as partições.
- `simulate-driver-movement` escreve rastreamento **falso** com `service_role` e existe só para dev
  (`verify_jwt = true` justamente para ninguém injetar posição de fora). Nunca rode contra produção para
  "ver a tela funcionando".
- Trabalho assíncrono vai para a fila do banco (`job_queue` + edge `job-worker`): ver
  `docs/JOB_QUEUE_SYSTEM.md` e `docs/QUEUE_SYSTEM.md` antes de criar outra fila. Integração Bitrix24 tem a
  própria fila (`bitrix24-process-queue`).
- Há cache de views/estatística (`useCacheViews`, `useCachedStats`, telas `/cache-status` e
  `/cache-monitoring`, `docs/CACHE_SYSTEM.md`): número "errado" na tela costuma ser cache, não cálculo —
  confira a origem antes de corrigir a conta.
- Chamada externa passa por `src/utils/circuitBreaker.ts`: erro que "desaparece" pode ser circuito aberto,
  não sucesso.

## UI e idioma

- i18n real com três locales (`src/i18n/locales/pt-BR.json`, `en.json`, `es.json`): texto novo entra nos
  três arquivos, não hardcoded no componente.
- O produto é operado em **pt-BR**; mensagem de erro e rótulo de tela em português.
