# 📋 Levantamento Completo e Exaustivo de Funcionalidades
## Lalamove Intelligence Hub - Promo Brindes

**Versão:** 2.0  
**Data:** 15 de março de 2026  
**Objetivo:** Documentar TODAS as funcionalidades existentes e planejadas do sistema

---

## 📌 Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Autenticação e Segurança](#2-autenticação-e-segurança)
3. [Dashboard Principal](#3-dashboard-principal)
4. [Gestão de Pedidos](#4-gestão-de-pedidos)
5. [Gestão de Motoristas](#5-gestão-de-motoristas)
6. [Sistema de Screening e Risco](#6-sistema-de-screening-e-risco)
7. [Fila de Aprovações](#7-fila-de-aprovações)
8. [Incidentes](#8-incidentes)
9. [Rastreamento e Mapas](#9-rastreamento-e-mapas)
10. [Sistema de Alertas e Notificações](#10-sistema-de-alertas-e-notificações)
11. [Métricas e Analytics](#11-métricas-e-analytics)
12. [Integrações Externas](#12-integrações-externas)
13. [Segurança Avançada](#13-segurança-avançada)
14. [Infraestrutura e Monitoramento](#14-infraestrutura-e-monitoramento)
15. [PWA e Experiência Mobile](#15-pwa-e-experiência-mobile)
16. [Internacionalização](#16-internacionalização)
17. [UI/UX e Design System](#17-uiux-e-design-system)
18. [Edge Functions (Backend)](#18-edge-functions-backend)
19. [Banco de Dados](#19-banco-de-dados)
20. [Documentação Existente](#20-documentação-existente)

---

## 1. Visão Geral do Sistema

O **Lalamove Intelligence Hub** é uma plataforma proprietária da **Promo Brindes** para gestão centralizada de entregas via Lalamove. Atua como hub inteligente para:

- **Triagem automática de motoristas** com scoring de risco (0-10)
- **Rastreamento em tempo real** com detecção de anomalias
- **Alertas multicanal** (WhatsApp, Email, Slack, SMS, Push, Bitrix24)
- **Dashboards analíticos** com métricas de performance
- **Integração CRM** com Bitrix24

### Stack Tecnológico

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| **Data** | TanStack React Query, Recharts, Mapbox GL JS |
| **Backend** | Lovable Cloud (Supabase), PostgreSQL, Deno Edge Functions |
| **Auth** | Supabase Auth, MFA (TOTP), WebAuthn/Passkeys |
| **PWA** | Service Worker, Push Notifications, Offline Storage |
| **i18n** | i18next (PT-BR, EN, ES) |

---

## 2. Autenticação e Segurança

### 2.1 Login e Registro
- **Página:** `/auth` → `AuthPage.tsx`
- Login com email/senha via Supabase Auth
- Registro com confirmação de email
- Indicador de força de senha (`PasswordStrengthIndicator.tsx`)
- Proteção de rotas (`ProtectedRoute.tsx`)
- Sessão persistente com refresh token

### 2.2 MFA (Autenticação Multi-Fator)
- **Hooks:** `useMFA.ts`
- **Componentes:** `MFAEnroll.tsx`, `MFAVerify.tsx`, `MFASettings.tsx`
- **Página:** `/mfa-verify` → `MFAVerifyPage.tsx`
- Enrollment de TOTP (Google Authenticator, Authy)
- Verificação de código TOTP no login
- Gerenciamento de fatores MFA nas configurações
- Sessões MFA registradas em `mfa_sessions`

### 2.3 WebAuthn / Passkeys
- **Hook:** `useWebAuthn.ts`
- **Componentes:** `PasskeyLoginButton.tsx`, `PasskeySettings.tsx`
- Login com biometria (impressão digital, Face ID)
- Registro e gerenciamento de chaves de segurança

### 2.4 Recuperação de Senha
- **Páginas:** `/forgot-password`, `/reset-password`
- Fluxo de reset via email
- Aprovação de reset por admin (`/password-reset-approvals`)
- Tokens de reset com expiração (`password_reset_tokens`)

### 2.5 Controle de Acesso (RBAC)
- **Hooks:** `useRole.ts`, `usePermissions.ts`
- **Páginas:** `/roles`, `/permissions`
- **Componente:** `PermissionGate.tsx`
- Roles: admin, moderator, user (enum `app_role`)
- Tabela `user_roles` separada (segurança)
- Permissões granulares por módulo e ação
- Security Definer function `has_role()`

### 2.6 Detecção de Dispositivos
- **Hook:** `useUserDevices.ts`, `useDeviceDetection.ts`
- **Componente:** `DeviceDetector.tsx`
- Registro de dispositivos em `user_devices`
- Alerta para novos dispositivos (`new_device_alerts`)
- Edge Function `new-device-alert` para notificação

### 2.7 Lockout de Login
- **Hook:** `useLoginLockout.ts`
- Controle de tentativas falhas (`login_attempts`)
- Bloqueio temporário após múltiplas falhas
- Registro de tentativas suspeitas

### 2.8 Logs de Autenticação
- **Hook:** `useAuthLogs.ts`
- Tabela `auth_logs` com IP, user agent, evento
- Auditoria completa de acessos

---

## 3. Dashboard Principal

### Página: `/` e `/dashboard` → `DashboardRedesigned.tsx`

### 3.1 Seção Hero
- **Componente:** `DashboardHeroSection.tsx`
- Métricas principais em destaque
- `HeroMetric.tsx` com animações

### 3.2 Cards de Métricas
- **Componente:** `MetricCard.tsx`
- Total de pedidos, entregas ativas, completadas hoje
- Aprovações pendentes, alertas, motoristas ativos
- Taxa de pontualidade, tempo médio de entrega
- Sparklines com tendência (`sparkline.tsx`)

### 3.3 Painel de Alertas
- **Componente:** `AlertsPanel.tsx`, `AlertActionCard.tsx`
- Alertas recentes com ações rápidas
- Severidade por cor (Info, Warning, Critical)

### 3.4 Fila de Aprovações
- **Componente:** `ApprovalQueue.tsx`
- Aprovações pendentes com score de risco
- `RiskScoreGauge.tsx` - medidor visual de risco

### 3.5 Tabela de Pedidos
- **Componente:** `OrdersTable.tsx`
- Pedidos recentes com status em tempo real

### 3.6 Mapa Ao Vivo (Preview)
- **Componente:** `LiveMapPlaceholder.tsx`
- Preview do mapa com entregas ativas

### 3.7 Chatbot de Rotas IA
- **Componente:** `AIRouteChatbot.tsx`
- Análise de rotas via IA (Lovable AI)
- Sugestões de otimização

---

## 4. Gestão de Pedidos

### Página: `/orders` → `OrdersPage.tsx`

### 4.1 Listagem e Filtros
- **Hook:** `useRecentOrders.ts`
- Filtros por status, data, motorista, veículo
- Busca por ID, cliente, endereço
- Paginação

### 4.2 Detalhes do Pedido
- **Componente:** `OrderDetailModal.tsx`
- Informações completas do pedido
- Histórico de status (`lalamove_status_history`)
- Paradas/stops (`lalamove_stops`)
- Link de rastreamento Lalamove
- Integração Bitrix24 (deal_id)

### 4.3 Buscar Pedido da Lalamove
- **Componente:** `FetchOrderDialog.tsx`
- Buscar pedido por ID na API Lalamove
- Importar para o sistema

### 4.4 Importação CSV
- **Componente:** `ImportCSVDialog.tsx`
- Upload de CSV com pedidos
- Validação e importação em lote

### 4.5 Campos Customizados
- `internal_order_id` - ID interno
- `internal_notes` - Notas internas
- `internal_status` - Status interno
- `cost_center` - Centro de custo
- `department` - Departamento
- `is_urgent` - Flag de urgência
- `custom_rating` - Avaliação customizada
- `tags` - Tags para categorização

---

## 5. Gestão de Motoristas

### Página: `/drivers` → `DriversPage.tsx`

### 5.1 CRUD de Motoristas
- **Hook:** `useDrivers.ts`
- Cadastro, edição, listagem
- Perfil completo com foto

### 5.2 Status de Motoristas
| Status | Descrição |
|--------|-----------|
| `APPROVED` | Aprovado para entregas |
| `PENDING_APPROVAL` | Aguardando aprovação |
| `BLOCKED` | Bloqueado |
| `WHITELIST` | Lista branca (bypass) |
| `BLACKLIST` | Lista negra (bloqueio permanente) |

### 5.3 Perfil do Motorista
- **Componente:** `DriverProfileModal.tsx`
- Dados pessoais e do veículo
- Métricas: entregas, taxa de sucesso, rating
- Score de risco atual
- Histórico de avaliações
- Incidentes registrados

### 5.4 Filtros Avançados
- **Componente:** `AdvancedFilters.tsx`
- Por status, tipo de veículo, score de risco
- Por rating, volume de entregas, atividade

### 5.5 Ações em Lote
- **Componente:** `BulkActions.tsx`
- Aprovar/bloquear múltiplos motoristas
- Adicionar a whitelist/blacklist em lote

### 5.6 Métricas por Motorista
- Total de entregas (`total_deliveries`)
- Entregas completas (`completed_deliveries`)
- Entregas falhadas (`failed_deliveries`)
- Entregas canceladas (`cancelled_deliveries`)
- Taxa de falha (`failure_rate`)
- Taxa de sucesso (`success_rate`)
- Rating médio (`rating`)
- Atraso médio em minutos (`avg_delay_minutes`)
- Dados externos (`external_rating`, `external_success_rate`, `external_total_deliveries`)

---

## 6. Sistema de Screening e Risco

### Documentação: `docs/SCREENING_SYSTEM.md`

### 6.1 Cálculo de Risco (6 Fatores)
| Fator | Peso | Escala |
|-------|------|--------|
| Taxa de Falha | 25% | 0-10 |
| Incidentes | 20% | 0-10 |
| Atraso Médio | 15% | 0-10 |
| Avaliação/Rating | 15% | 0-10 |
| Volume de Entregas | 10% | 0-10 |
| Recência | 15% | 0-10 |

### 6.2 Níveis de Risco
| Score | Nível | Ação |
|-------|-------|------|
| 0.0-2.5 | 🟢 LOW | Auto-aprovar |
| 2.5-5.0 | 🟡 MEDIUM | Aprovação manual |
| 5.0-7.5 | 🟠 HIGH | Aprovação manual urgente |
| 7.5-10.0 | 🔴 CRITICAL | Auto-bloquear |

### 6.3 Avaliação de Motorista
- **Hook:** `useEvaluateDriver.ts`
- **Edge Function:** `evaluate-driver`
- Trigger: Webhook, Manual, Cron
- Resultado salvo em `driver_evaluations`

### 6.4 Regras Customizadas
- **Página:** `/risk-rules` → `RiskRulesPage.tsx`
- **Hook:** `useRiskRules.ts`
- Tabela `risk_rules` com condições JSON
- Impacto positivo ou negativo no score
- Ativar/desativar regras

### 6.5 Histórico de Avaliações
- **Página:** `/evaluations` → `EvaluationsPage.tsx`
- **Hook:** `useDriverEvaluations.ts`
- Todas as avaliações com fatores detalhados
- Recomendações e ações necessárias

---

## 7. Fila de Aprovações

### Página: `/approvals` → `ApprovalsPage.tsx`

### 7.1 Fila de Aprovação
- **Hook:** `usePendingApprovals.ts`
- Aprovações pendentes ordenadas por prioridade
- Score de risco e fatores

### 7.2 Ações de Aprovação
- **Hook:** `useApprovalActionsEnhanced.ts`
- Aprovar com notas
- Rejeitar com motivo
- Adicionar à whitelist/blacklist

### 7.3 Prioridade de Aprovação
| Prioridade | Cor |
|------------|-----|
| LOW | Verde |
| MEDIUM | Amarelo |
| HIGH | Laranja |
| URGENT | Vermelho |
| CRITICAL | Vermelho pulsante |

### 7.4 Indicadores em Tempo Real
- **Componente:** `WaitingTimeCounter.tsx` - Tempo de espera
- **Componente:** `UrgencyIndicator.tsx` - Indicador de urgência
- **Hook:** `useApprovalRealtime.ts` - Realtime via Supabase

### 7.5 Card com Swipe (Mobile)
- **Componente:** `SwipeableApprovalCard.tsx`
- Swipe para aprovar/rejeitar no mobile

---

## 8. Incidentes

### Página: `/incidents` → `IncidentsPage.tsx`

### 8.1 Registro de Incidentes
- **Hook:** `useIncidents.ts`
- Tabela `driver_incidents`

### 8.2 Tipos de Incidentes
| Tipo | Descrição |
|------|-----------|
| `ROUTE_DEVIATION` | Desvio de rota |
| `LONG_STOP` | Parada prolongada |
| `LATE_DELIVERY` | Entrega atrasada |
| `CUSTOMER_COMPLAINT` | Reclamação do cliente |
| `DAMAGE` | Dano à carga |
| `OTHER` | Outros |

### 8.3 Severidade
- LOW, MEDIUM, HIGH, CRITICAL

### 8.4 Resolução
- Marcar como resolvido
- Notas de resolução
- URLs de evidência (`evidence_urls`)

---

## 9. Rastreamento e Mapas

### 9.1 Mapa Ao Vivo
- **Página:** `/map`, `/live-map` → `LiveMapPage.tsx`
- **Componente:** `LiveMap.tsx`
- Mapbox GL JS com token via Edge Function (`get-mapbox-token`)
- Posição dos motoristas em tempo real
- Filtros por tipo de veículo e status
- Supabase Realtime para atualizações

### 9.2 Mapa de Calor (Heatmap)
- **Página:** `/heatmap` → `HeatmapPage.tsx`
- **Hook:** `useDeliveryHeatmapData.ts`
- Densidade de coletas e entregas
- Filtro por período (7, 14, 30 dias)
- Tipos: Coletas, Entregas, Ambos

### 9.3 Tracking Ativo
- Tabela `active_tracking` com dados em tempo real
- Velocidade, heading, ETA
- Detecção de parada (`is_stopped`, `stopped_since`)
- Detecção de rota (`is_on_route`)
- Rota esperada vs real

### 9.4 Histórico de Localizações
- **Hook:** `useTrackingHistory.ts`
- Tabela `driver_locations`
- Precisão em metros, velocidade em km/h

### 9.5 Simulação de Movimento
- **Edge Function:** `simulate-driver-movement`
- Para testes e demonstrações

### 9.6 Análise de Rotas (IA)
- **Edge Function:** `route-analyzer`
- Análise via Lovable AI
- Sugestões de otimização

---

## 10. Sistema de Alertas e Notificações

### 10.1 Central de Alertas
- **Página:** `/alerts` → `AlertsPage.tsx`
- **Hook:** `useActiveAlerts.ts`
- **Componente:** `AlertsAdvanced.tsx`

### 10.2 Tipos de Alerta
| Tipo | Descrição |
|------|-----------|
| `DRIVER_BLOCKED` | Motorista bloqueado |
| `ROUTE_DEVIATION` | Desvio de rota detectado |
| `DRIVER_STOPPED` | Motorista parado |
| `LATE_DELIVERY` | Entrega atrasada |
| `APPROVAL_REQUIRED` | Aprovação necessária |
| `ORDER_CANCELLED` | Pedido cancelado |

### 10.3 Severidade
- **INFO** - Informativo
- **WARNING** - Atenção necessária
- **CRITICAL** - Ação imediata

### 10.4 Alertas Preditivos
- **Componente:** `PredictiveAlerts.tsx`
- **Componente:** `prediction-card.tsx`
- Previsão de problemas baseada em padrões

### 10.5 Configuração de Alertas
- **Página:** `/alert-configurations` → `AlertConfigurationsPage.tsx`
- **Hook:** `useAlertConfigurations.ts`
- Canais por tipo de alerta
- Templates de mensagem
- Intervalo mínimo entre alertas
- Condições personalizadas

### 10.6 Canais de Notificação
| Canal | Implementação |
|-------|---------------|
| **Email** | SMTP via Edge Function |
| **WhatsApp** | Evolution API |
| **Slack** | Webhook URL |
| **SMS** | Via provider |
| **Push** | Web Push API |
| **Bitrix24** | Tasks API |
| **N8N** | Webhook |

### 10.7 Push Notifications
- **Hook:** `usePushNotifications.ts`
- **Componente:** `PushNotificationSettings.tsx`
- Service Worker para push em background
- Permissão do navegador

### 10.8 Configurações de Som
- **Hook:** `useSoundSettings.ts`
- **Componente:** `SoundSettingsPanel.tsx`
- Sons diferentes por severidade
- Volume ajustável
- Web Audio API (`alertSounds.ts`)

### 10.9 Histórico de Notificações
- **Página:** `/notification-history` → `NotificationHistoryPage.tsx`
- **Hook:** `useNotificationHistory.ts`
- Tabela `alerts_sent`
- Status: Pendente, Enviado, Entregue, Erro
- Retry count e error message

### 10.10 Notificações de Segurança
- **Hook:** `useSecurityPushNotifications.ts`
- Alertas específicos de segurança

### 10.11 Preferências de Notificação
- **Componente:** `NotificationPreferences.tsx`
- Configuração por canal e tipo

---

## 11. Métricas e Analytics

### 11.1 Métricas Gerais
- **Página:** `/metrics` → `MetricsPage.tsx`
- **Hook:** `useMetrics.ts`
- Distribuição de risco dos motoristas
- Status dos motoristas (gráfico)
- KPIs de aprovações
- Estatísticas de incidentes

### 11.2 Métricas de Entregas
- **Página:** `/delivery-metrics` → `DeliveryMetricsPage.tsx`
- **Hook:** `useDeliveryMetrics.ts`
- Performance de entregas
- Taxa de sucesso/falha
- Tempo médio de entrega
- Análise por período

### 11.3 Dashboard SLA
- **Página:** `/sla` → `SLADashboardPage.tsx`
- **Hook:** `useSLAMetrics.ts`
- Indicadores de SLA
- Compliance de entregas
- Tempo de resposta

### 11.4 Dashboard de Analytics
- **Página:** `/analytics` → `AnalyticsDashboardPage.tsx`
- Visão consolidada de analytics
- Gráficos comparativos

### 11.5 Dashboard Stats (Cache)
- **Hook:** `useDashboardStats.ts`
- **Hook:** `useCachedStats.ts`
- Estatísticas com cache para performance

### 11.6 Relatórios
- **Página:** `/reports` → `ReportsPage.tsx`
- Geração de relatórios
- Exportação de dados

---

## 12. Integrações Externas

### 12.1 Lalamove API v3
- **Documentação:** `docs/LALAMOVE_API_V3.md`
- **Edge Function:** `lalamove-api` (proxy)
- **Edge Function:** `lalamove-webhook` (receptor)
- Assinatura HMAC-SHA256
- Endpoints: cotação, criação de pedido, status, cancelamento
- Webhook para atualizações de status

### 12.2 Bitrix24 CRM
- **Página:** `/bitrix24` → `Bitrix24Page.tsx`
- **Hook:** `useBitrix24.ts`
- **Edge Functions:** `bitrix24-sync`, `bitrix24-process-queue`
- OAuth2 com refresh token (`bitrix24_tokens`)
- Sincronização de deals
- Mapeamento de estágios (`bitrix24_stage_mappings`)
- Atividades/timeline (`bitrix24_activities`)
- Fila de processamento

### 12.3 Mapbox
- **Edge Function:** `get-mapbox-token`
- Mapas interativos (LiveMap, Heatmap)
- Geocoding

### 12.4 Empresas Externas
- **Edge Function:** `external-companies`
- Consulta de dados de empresas/motoristas

### 12.5 Lovable AI (LLM)
- **Edge Function:** `llm-wh`
- Análise de rotas
- Chatbot inteligente
- Modelos suportados sem API key

---

## 13. Segurança Avançada

### 13.1 Dashboard de Segurança
- **Página:** `/security` → `SecurityDashboardPage.tsx`
- Visão consolidada de segurança

### 13.2 IP Whitelist
- **Página:** `/ip-whitelist` → `IPWhitelistPage.tsx`
- Tabela `ip_whitelist`
- IPs autorizados com CIDR range
- Ativar/desativar regras

### 13.3 Geo-Blocking
- **Página:** `/geo-blocking` → `GeoBlockingPage.tsx`
- Tabela `geo_blocks`
- Bloqueio por país
- Tipo: permanente ou temporário

### 13.4 Rate Limiting
- **Página:** `/rate-limiting` → `RateLimitDashboardPage.tsx`
- **Hook:** `useRateLimiting.ts`
- Tabela `rate_limit_logs`
- Monitoramento de requisições por endpoint
- Bloqueio automático

### 13.5 IPs Bloqueados
- Tabela `blocked_ips`
- Bloqueio permanente ou temporário
- Contagem de tentativas
- Motivo do bloqueio

### 13.6 Verificação de Email
- Tabela `email_verifications`
- Token com expiração
- Verificação obrigatória

### 13.7 Row Level Security (RLS)
- Todas as tabelas com RLS ativado
- Function `has_role()` (SECURITY DEFINER)
- Políticas por role e permissão

---

## 14. Infraestrutura e Monitoramento

### 14.1 Saúde do Sistema
- **Página:** `/system-health` → `SystemHealthPage.tsx`
- **Hook:** `useSystemHealth.ts`
- Status de serviços: Database, Auth, Edge Functions, APIs externas

### 14.2 Saúde Expandida
- **Página:** `/system-health-expanded` → `SystemHealthExpandedPage.tsx`
- **Hook:** `useSystemHealthExpanded.ts`
- Diagnósticos detalhados
- Logs do sistema

### 14.3 Check de API Externa
- **Edge Function:** `check-external-api`
- Verificação de disponibilidade da Lalamove API

### 14.4 Cache e Views Materializadas
- **Página:** `/cache-status` → `CacheStatusPage.tsx`
- **Página:** `/cache-monitoring` → `CacheMonitoringPage.tsx`
- **Hook:** `useCacheViews.ts`
- Monitoramento de views materializadas
- Hit/miss ratio
- Tempo de atualização

### 14.5 Fila de Jobs
- **Página:** `/job-queue` → `JobQueuePage.tsx`
- **Hook:** `useJobQueue.ts`
- **Edge Function:** `job-worker`
- Jobs assíncronos com prioridade
- Status: Pendente, Processando, Concluído, Falhou
- Retry automático
- Documentação: `docs/JOB_QUEUE_SYSTEM.md`

### 14.6 Monitoramento de Erros
- **Página:** `/error-monitoring` → `ErrorMonitoringPage.tsx`
- **Hook:** `useErrorLogs.ts`
- **Service:** `errorMonitoring.ts`
- Captura e tracking de erros

### 14.7 Performance
- **Página:** `/performance` → `PerformanceDashboardPage.tsx`
- Web Vitals (`webVitals.ts`)
- Métricas de carregamento

### 14.8 Cron Jobs
- Tabela `cron_job_logs`
- Registro de execuções com duração e resultado
- **Edge Function:** `rotate-tokens` - Rotação de tokens OAuth

### 14.9 Webhooks
- **Página:** `/webhooks` → `WebhooksPage.tsx`
- **Hook:** `useWebhookEvents.ts`
- Log de eventos recebidos
- Payload raw, status de processamento

---

## 15. PWA e Experiência Mobile

### 15.1 Progressive Web App
- **Componente:** `OfflineIndicator.tsx`, `InstallPrompt`
- **Hook:** `useServiceWorker.ts`
- Service Worker (`public/sw.js`)
- Manifesto (`public/manifest.json`)
- Prompt de instalação

### 15.2 Offline
- **Hook:** `useOfflineStorage.ts`
- Indicador de status offline
- Armazenamento local

### 15.3 Mobile
- **Hook:** `use-mobile.tsx`
- **Componente:** `MobileBottomNav.tsx` - Navegação inferior
- **Componente:** `MobileSidebar.tsx` - Sidebar mobile
- **Componente:** `SwipeableApprovalCard.tsx` - Swipe para ações
- **Componente:** `pull-to-refresh.tsx` - Pull to refresh
- **Componente:** `swipeable-list.tsx` - Lista com swipe
- **Componente:** `floating-action-button.tsx` - FAB

---

## 16. Internacionalização (i18n)

### 16.1 Idiomas Suportados
- **Português (BR):** `src/i18n/locales/pt-BR.json`
- **Inglês:** `src/i18n/locales/en.json`
- **Espanhol:** `src/i18n/locales/es.json`

### 16.2 Seletor de Idioma
- **Componente:** `language-selector.tsx`
- Troca dinâmica sem reload

### 16.3 Configuração
- **Arquivo:** `src/i18n/index.ts`
- i18next + react-i18next

---

## 17. UI/UX e Design System

### 17.1 Temas
- **Hook:** `useTheme.ts`
- Modo claro e escuro
- Atalho de teclado para troca
- **Hook:** `useScheduledTheme.ts` - Tema agendado por horário

### 17.2 Design System (CSS Variables)
- Cores semânticas: `--primary`, `--secondary`, `--accent`, `--destructive`, `--success`, `--warning`, `--info`
- Cores estendidas: `--cyan`, `--violet`, `--rose`, `--amber`, `--emerald`
- Gradientes: `--gradient-primary`, `--gradient-success`, `--gradient-warning`, etc.
- Sombras: `--shadow-soft`, `--shadow-medium`, `--shadow-strong`, `--shadow-colored`
- Glows: `--glow-primary`, `--glow-accent`, `--glow-success`, etc.
- Fontes: Plus Jakarta Sans, JetBrains Mono, Inter

### 17.3 Animações
- Framer Motion (`motion.tsx`)
- `animate-fade-in`, `animate-fade-up`, `animate-scale-in`
- `animate-slide-in-right`, `animate-slide-in-left`
- `animate-pulse-glow`, `animate-float`, `animate-gradient`, `animate-shimmer`
- Micro-interações (`micro-interactions.tsx`)

### 17.4 Classes Utilitárias
- `.glass`, `.glass-strong` - Glassmorphism
- `.card-interactive`, `.card-glass`, `.card-gradient`
- `.mesh-gradient`, `.noise`, `.shimmer`
- `.border-gradient`, `.gradient-text`
- `.hover-lift`, `.focus-ring-glow`

### 17.5 Componentes UI Avançados
| Componente | Funcionalidade |
|------------|----------------|
| `CommandPaletteEnhanced.tsx` | Paleta de comandos (Cmd+K) |
| `GlobalSearchAdvanced.tsx` | Busca global avançada |
| `keyboard-shortcuts-help.tsx` | Ajuda de atalhos |
| `keyboard-shortcuts-modal.tsx` | Modal de atalhos |
| `contextual-hints.tsx` | Dicas contextuais |
| `data-refresh-indicator.tsx` | Indicador de refresh |
| `hover-preview.tsx` | Preview em hover |
| `highlight-match.tsx` | Destaque de busca |
| `search-help-tooltip.tsx` | Tooltip de ajuda de busca |
| `smart-breadcrumbs.tsx` | Breadcrumbs inteligentes |
| `undo-toast.tsx` | Toast com undo |
| `accessible-card.tsx` | Card acessível |
| `activity-timeline.tsx` | Timeline de atividades |
| `page-loader.tsx` | Loader de página |

### 17.6 Layout
| Componente | Funcionalidade |
|------------|----------------|
| `AppLayout.tsx` | Layout principal com sidebar |
| `Header.tsx` | Cabeçalho com busca e notificações |
| `Sidebar.tsx` | Menu lateral colapsável |
| `MobileSidebar.tsx` | Sidebar mobile |
| `MobileBottomNav.tsx` | Navegação inferior mobile |

### 17.7 Acessibilidade
- **Hook:** `useAccessibility.tsx`
- Cards acessíveis (`accessible-card.tsx`)
- Focus ring com glow

### 17.8 Sistema de Conquistas (Gamificação)
- **Hook:** `useAchievementsSystem.tsx`
- **Provider:** `AchievementsProvider`
- Gamificação para engajamento

### 17.9 Busca Avançada
- **Hook:** `useFuseSearch.ts` - Fuzzy search com Fuse.js
- **Hook:** `useDebouncedValue.ts` - Debounce para performance

### 17.10 Undo Global
- **Hook:** `useGlobalUndo.tsx`
- **Componente:** `undo-toast.tsx`
- Desfazer ações com toast

### 17.11 Prefetch
- **Hook:** `usePrefetch.ts`
- Pré-carregamento de dados

### 17.12 Error Boundary
- **Componente:** `ErrorBoundary.tsx`
- Captura de erros React com fallback

---

## 18. Edge Functions (Backend)

| Função | Descrição | JWT |
|--------|-----------|-----|
| `bitrix24-process-queue` | Processa fila de sync Bitrix24 | ❌ |
| `bitrix24-sync` | Sincroniza com Bitrix24 | ❌ |
| `check-driver-alerts` | Verifica alertas de motoristas | ❌ |
| `check-external-api` | Verifica APIs externas | ❌ |
| `evaluate-driver` | Avalia risco do motorista | ❌ |
| `external-companies` | Consulta empresas externas | - |
| `get-mapbox-token` | Retorna token Mapbox | ❌ |
| `job-worker` | Worker de jobs assíncronos | - |
| `lalamove-api` | Proxy para API Lalamove v3 | ❌ |
| `lalamove-webhook` | Processa webhooks Lalamove | ❌ |
| `llm-wh` | Webhook LLM / IA | - |
| `new-device-alert` | Alerta de novo dispositivo | ❌ |
| `rotate-tokens` | Rotaciona tokens OAuth | - |
| `route-analyzer` | Analisa rotas com IA | ❌ |
| `send-notification` | Envia notificações multicanal | ❌ |
| `simulate-driver-movement` | Simula movimento de motorista | ❌ |
| `test-notification` | Testa envio de notificação | - |

---

## 19. Banco de Dados

### 19.1 Tabelas Principais
| Tabela | Descrição |
|--------|-----------|
| `drivers` | Cadastro de motoristas com métricas |
| `lalamove_orders` | Pedidos Lalamove com campos customizados |
| `lalamove_stops` | Paradas/stops dos pedidos |
| `lalamove_status_history` | Histórico de mudanças de status |
| `driver_approval_queue` | Fila de aprovação de motoristas |
| `driver_evaluations` | Avaliações de risco |
| `driver_incidents` | Incidentes registrados |
| `driver_locations` | Histórico de posições GPS |
| `active_tracking` | Tracking ativo em tempo real |
| `alerts` | Alertas do sistema |
| `alerts_sent` | Notificações enviadas |
| `alert_configurations` | Configurações de alertas |
| `risk_rules` | Regras customizadas de risco |
| `webhook_events` | Eventos de webhook recebidos |
| `bitrix24_sync` | Sync com Bitrix24 |
| `bitrix24_tokens` | Tokens OAuth2 |
| `bitrix24_activities` | Atividades/timeline |
| `bitrix24_stage_mappings` | Mapeamento de estágios |
| `auth_logs` | Logs de autenticação |
| `login_attempts` | Tentativas de login |
| `mfa_sessions` | Sessões MFA |
| `user_devices` | Dispositivos dos usuários |
| `new_device_alerts` | Alertas de novos dispositivos |
| `password_reset_tokens` | Tokens de reset |
| `password_reset_requests` | Requisições de reset |
| `email_verifications` | Verificações de email |
| `permissions` | Permissões do sistema |
| `blocked_ips` | IPs bloqueados |
| `ip_whitelist` | IPs autorizados |
| `geo_blocks` | Bloqueios geográficos |
| `rate_limit_logs` | Logs de rate limiting |
| `cron_job_logs` | Logs de cron jobs |

### 19.2 Enums do Banco
| Enum | Valores |
|------|---------|
| `driver_status` | APPROVED, PENDING_APPROVAL, BLOCKED, WHITELIST, BLACKLIST |
| `order_status` | PENDING, MATCHED, ON_GOING, PICKED_UP, COMPLETED, CANCELLED, REJECTED, EXPIRED |
| `vehicle_type` | MOTORCYCLE, CAR, VAN, TRUCK |
| `alert_severity` | INFO, WARNING, CRITICAL |
| `alert_type` | DRIVER_BLOCKED, ROUTE_DEVIATION, DRIVER_STOPPED, LATE_DELIVERY, APPROVAL_REQUIRED, ORDER_CANCELLED |
| `approval_status` | PENDING, APPROVED, REJECTED |
| `approval_priority` | LOW, MEDIUM, HIGH, URGENT, CRITICAL |
| `incident_type` | ROUTE_DEVIATION, LONG_STOP, LATE_DELIVERY, CUSTOMER_COMPLAINT, DAMAGE, OTHER |
| `incident_severity` | LOW, MEDIUM, HIGH, CRITICAL |
| `delivery_outcome` | SUCCESS, FAILED, DAMAGED, STOLEN, LATE, WRONG_ADDRESS, CUSTOMER_UNAVAILABLE |
| `app_role` | admin, moderator, user |

### 19.3 Views
- `drivers_safe_view` - View segura de motoristas
- `orders_safe_view` - View segura de pedidos
- `orders_operator_view` - View para operadores

---

## 20. Documentação Existente

| Documento | Arquivo |
|-----------|---------|
| Arquitetura | `docs/ARCHITECTURE.md` |
| Referência de API | `docs/API_REFERENCE.md` |
| Sistema de Cache | `docs/CACHE_SYSTEM.md` |
| Contribuição | `docs/CONTRIBUTING.md` |
| Deploy | `docs/DEPLOYMENT.md` |
| Funcionalidades | `docs/FUNCIONALIDADES_E_FERRAMENTAS.md` |
| Fila de Jobs | `docs/JOB_QUEUE_SYSTEM.md` |
| Lalamove API v3 | `docs/LALAMOVE_API_V3.md` |
| Logging e Health | `docs/LOGGING_AND_HEALTH.md` |
| Sistema de Filas | `docs/QUEUE_SYSTEM.md` |
| Sistema de Screening | `docs/SCREENING_SYSTEM.md` |
| Segurança | `docs/SECURITY.md` |
| Troubleshooting | `docs/TROUBLESHOOTING.md` |
| Webhook Handler | `docs/WEBHOOK_HANDLER.md` |
| Checklist de Segurança | `SECURITY_CHECKLIST.md` |

---

## 21. Scripts e CI/CD

| Script | Descrição |
|--------|-----------|
| `scripts/backup.sh` | Backup do sistema |
| `scripts/deploy.sh` | Deploy automatizado |
| `scripts/health-check.sh` | Verificação de saúde |
| `scripts/pre-commit-secrets.sh` | Verificação de secrets no commit |
| `.github/workflows/ci.yml` | Pipeline de CI |

---

## 22. Configurações e Preferências

### 22.1 Configurações Gerais
- **Página:** `/settings` → `SettingsPage.tsx`

### 22.2 Preferências do Usuário
- **Página:** `/preferences` → `UserPreferencesPage.tsx`
- Tema, idioma, notificações
- Sons de alerta
- Atalhos de teclado

---

## 📊 Resumo Quantitativo

| Categoria | Quantidade |
|-----------|------------|
| **Páginas** | 41 |
| **Hooks customizados** | 54 |
| **Edge Functions** | 17 |
| **Tabelas no banco** | 31+ |
| **Enums** | 11 |
| **Idiomas** | 3 |
| **Canais de notificação** | 7 |
| **Integrações externas** | 7 |
| **Documentos técnicos** | 15 |

---

**Mantido por:** Equipe de Desenvolvimento - Promo Brindes  
**Última atualização:** 15/03/2026  
**Próxima revisão:** Q2 2026
