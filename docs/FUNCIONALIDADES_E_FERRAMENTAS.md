# 📋 Levantamento Completo de Funcionalidades e Ferramentas
## Lalamove Guardian - Sistema de Gestão de Entregas

**Versão:** 1.0  
**Data:** 31 de dezembro de 2025

---

## 📌 Índice

1. [Stack Tecnológico](#stack-tecnológico)
2. [Páginas e Módulos](#páginas-e-módulos)
3. [Funcionalidades por Categoria](#funcionalidades-por-categoria)
4. [Componentes UI](#componentes-ui)
5. [Hooks Personalizados](#hooks-personalizados)
6. [Edge Functions (Backend)](#edge-functions-backend)
7. [Integrações Externas](#integrações-externas)
8. [Sistema de Design](#sistema-de-design)
9. [Banco de Dados](#banco-de-dados)
10. [Segurança](#segurança)

---

## 🛠️ Stack Tecnológico

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **React** | 18.3.1 | Framework principal |
| **TypeScript** | 5.x | Tipagem estática |
| **Vite** | 5.x | Build tool e dev server |
| **Tailwind CSS** | 3.x | Estilização utility-first |
| **shadcn/ui** | Latest | Biblioteca de componentes |
| **Framer Motion** | 12.x | Animações e transições |
| **React Router DOM** | 6.30.1 | Roteamento SPA |
| **TanStack Query** | 5.83.0 | Gerenciamento de estado server-side |
| **Recharts** | 2.15.4 | Gráficos e visualizações |
| **Mapbox GL** | 3.17.0 | Mapas interativos |
| **Lucide React** | 0.462.0 | Ícones |
| **date-fns** | 3.6.0 | Manipulação de datas |
| **Zod** | 3.25.76 | Validação de schemas |
| **React Hook Form** | 7.61.1 | Gerenciamento de formulários |

### Backend (Lovable Cloud/Supabase)
| Tecnologia | Uso |
|------------|-----|
| **Supabase** | BaaS (Database, Auth, Realtime, Edge Functions) |
| **PostgreSQL** | Banco de dados relacional |
| **Deno** | Runtime para Edge Functions |
| **Row Level Security (RLS)** | Políticas de segurança por linha |

### Fontes
| Fonte | Uso |
|-------|-----|
| **Plus Jakarta Sans** | Fonte principal sans-serif |
| **JetBrains Mono** | Fonte monospace para código |
| **Inter** | Fonte secundária |

---

## 📄 Páginas e Módulos

### 1. Dashboard Principal (`/`, `/dashboard`)
**Arquivo:** `src/pages/DashboardRedesigned.tsx`
- Visão geral do sistema
- Cards de métricas em tempo real
- Gráficos de performance
- Alertas recentes
- Fila de aprovações pendentes

### 2. Pedidos (`/orders`)
**Arquivo:** `src/pages/OrdersPage.tsx`
- Listagem de pedidos Lalamove
- Filtros por status, data, motorista
- Detalhes do pedido em modal
- Histórico de status
- Integração com Bitrix24

### 3. Motoristas (`/drivers`)
**Arquivo:** `src/pages/DriversPage.tsx`
- Cadastro e listagem de motoristas
- Status: Aprovado, Pendente, Bloqueado, Whitelist, Blacklist
- Métricas por motorista (entregas, taxa de sucesso, rating)
- Avaliação de risco automática

### 4. Aprovações (`/approvals`)
**Arquivo:** `src/pages/ApprovalsPage.tsx`
- Fila de aprovação de motoristas
- Score de risco calculado
- Fatores de risco detalhados
- Ações: Aprovar, Rejeitar, Adicionar notas
- Contador de tempo de espera em tempo real

### 5. Incidentes (`/incidents`)
**Arquivo:** `src/pages/IncidentsPage.tsx`
- Registro de incidentes por motorista
- Tipos: Desvio de rota, Parada longa, Atraso, Reclamação, Dano
- Severidade: Baixa, Média, Alta, Crítica
- Resolução e notas

### 6. Métricas Gerais (`/metrics`)
**Arquivo:** `src/pages/MetricsPage.tsx`
- Gráficos de distribuição de risco
- Status dos motoristas
- KPIs de aprovações
- Estatísticas de incidentes

### 7. Métricas de Entregas (`/delivery-metrics`)
**Arquivo:** `src/pages/DeliveryMetricsPage.tsx`
- Performance de entregas
- Taxa de sucesso/falha
- Tempo médio de entrega
- Análise por período

### 8. Mapa ao Vivo (`/map`, `/live-map`)
**Arquivo:** `src/pages/LiveMapPage.tsx`
- Rastreamento em tempo real de entregas
- Posição dos motoristas no mapa
- Filtros por tipo de veículo e status
- Simulação de movimento para testes
- Realtime via Supabase

### 9. Mapa de Calor (`/heatmap`)
**Arquivo:** `src/pages/HeatmapPage.tsx`
- Visualização de densidade de entregas
- Filtro por período (7, 14, 30 dias)
- Tipos: Coletas, Entregas, Ambos
- Estatísticas por região

### 10. Alertas (`/alerts`)
**Arquivo:** `src/pages/AlertsPage.tsx`
- Central de alertas do sistema
- Severidade: Info, Warning, Critical
- Tipos: Motorista bloqueado, Desvio de rota, Parada, Atraso, Aprovação necessária, Cancelamento
- Marcar como lido/dispensado

### 11. Configuração de Alertas (`/alert-configurations`)
**Arquivo:** `src/pages/AlertConfigurationsPage.tsx`
- Configuração de regras de alerta
- Canais: Email, SMS, WhatsApp, Slack, Bitrix24, N8N Webhook
- Templates de mensagem
- Intervalo mínimo entre alertas
- Condições personalizadas

### 12. Histórico de Notificações (`/notification-history`)
**Arquivo:** `src/pages/NotificationHistoryPage.tsx`
- Log de todas as notificações enviadas
- Status: Pendente, Enviado, Entregue, Erro
- Detalhes de erro
- Reenvio de notificações

### 13. Dashboard SLA (`/sla`)
**Arquivo:** `src/pages/SLADashboardPage.tsx`
- Indicadores de SLA
- Métricas de tempo de resposta
- Compliance de entregas

### 14. Regras de Risco (`/risk-rules`)
**Arquivo:** `src/pages/RiskRulesPage.tsx`
- Configuração de regras de cálculo de risco
- Condições em JSON
- Impacto no score
- Ativar/desativar regras

### 15. Avaliações (`/evaluations`)
**Arquivo:** `src/pages/EvaluationsPage.tsx`
- Histórico de avaliações de motoristas
- Score de risco, fatores, recomendações
- Resultados: Aprovado, Manual, Bloqueado
- Estatísticas agregadas

### 16. Webhooks (`/webhooks`)
**Arquivo:** `src/pages/WebhooksPage.tsx`
- Log de eventos de webhook recebidos
- Payload raw
- Status de processamento
- Erros

### 17. Bitrix24 (`/bitrix24`)
**Arquivo:** `src/pages/Bitrix24Page.tsx`
- Integração com CRM Bitrix24
- Sincronização de deals
- Mapeamento de estágios
- Tokens OAuth2

### 18. Cache Monitor (`/cache-monitoring`)
**Arquivo:** `src/pages/CacheMonitoringPage.tsx`
- Monitoramento de cache do sistema
- Views materializadas
- Tempo de atualização

### 19. Status do Cache (`/cache-status`)
**Arquivo:** `src/pages/CacheStatusPage.tsx`
- Status detalhado do cache
- Hit/miss ratio

### 20. Fila de Jobs (`/job-queue`)
**Arquivo:** `src/pages/JobQueuePage.tsx`
- Monitoramento de jobs assíncronos
- Status: Pendente, Processando, Concluído, Falhou
- Retry de jobs
- Prioridade

### 21. Saúde do Sistema (`/system-health`)
**Arquivo:** `src/pages/SystemHealthPage.tsx`
- Status geral do sistema
- Conexões com serviços externos
- Métricas de performance

### 22. Saúde Expandida (`/system-health-expanded`)
**Arquivo:** `src/pages/SystemHealthExpandedPage.tsx`
- Visão detalhada da saúde
- Logs de sistema
- Diagnósticos

### 23. Relatórios (`/reports`)
**Arquivo:** `src/pages/ReportsPage.tsx`
- Geração de relatórios
- Exportação de dados

### 24. Configurações (`/settings`)
**Arquivo:** `src/pages/SettingsPage.tsx`
- Configurações gerais do sistema
- Preferências do usuário

### 25. Autenticação (`/auth`)
**Arquivo:** `src/pages/AuthPage.tsx`
- Login e registro
- Autenticação via Supabase Auth

---

## 🎯 Funcionalidades por Categoria

### 🔐 Autenticação e Autorização
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| Login/Registro | Supabase Auth | `useAuth.tsx` |
| Sessão persistente | Supabase Session | `useAuth.tsx` |
| Proteção de rotas | React Router + AuthProvider | `App.tsx` |
| Row Level Security | PostgreSQL RLS | Migrations |

### 🚗 Gestão de Motoristas
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| CRUD motoristas | Supabase + React Query | `useDrivers.ts` |
| Whitelist/Blacklist | Database flags | `DriversPage.tsx` |
| Avaliação de risco | `RiskCalculatorService` | `RiskCalculatorService.ts` |
| Avaliação automática | Edge Function | `evaluate-driver/index.ts` |
| Histórico de avaliações | Database | `useDriverEvaluations.ts` |

### 📦 Gestão de Pedidos
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| Listagem de pedidos | Supabase + React Query | `useRecentOrders.ts` |
| Detalhes do pedido | Modal Dialog | `OrderDetailModal.tsx` |
| Histórico de status | Database table | `lalamove_status_history` |
| Tracking ativo | Supabase Realtime | `useTrackingHistory.ts` |

### 🗺️ Rastreamento e Mapas
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| Mapa ao vivo | Mapbox GL JS | `LiveMap.tsx` |
| Heatmap de entregas | Mapbox Heatmap Layer | `HeatMap.tsx` |
| Tracking em tempo real | Supabase Realtime | `LiveMapPage.tsx` |
| Simulação de movimento | Edge Function | `simulate-driver-movement/index.ts` |
| Análise de rota | Edge Function | `route-analyzer/index.ts` |

### ⚠️ Sistema de Alertas
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| Alertas em tempo real | Supabase Realtime | `RealtimeAlerts.tsx` |
| Toast de alertas | Sonner + Custom Hook | `RealtimeAlertToast.tsx` |
| Configuração de alertas | Database + UI | `useAlertConfigurations.ts` |
| Som de notificação | Web Audio API | `alertSounds.ts` |
| Histórico de notificações | Database | `useNotificationHistory.ts` |
| Envio multicanal | Edge Function | `send-notification/index.ts` |
| Verificação de alertas | Edge Function | `check-driver-alerts/index.ts` |

### 📊 Métricas e Analytics
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| Dashboard stats | Supabase Queries | `useDashboardStats.ts` |
| Métricas de entrega | Supabase Queries | `useDeliveryMetrics.ts` |
| SLA metrics | Custom calculations | `useSLAMetrics.ts` |
| Gráficos | Recharts | `MetricsPage.tsx` |
| Sparklines | Custom component | `sparkline.tsx` |

### 🔄 Integrações
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| Lalamove API | Edge Function Proxy | `lalamove-api/index.ts` |
| Lalamove Webhook | Edge Function | `lalamove-webhook/index.ts` |
| Bitrix24 Sync | Edge Function | `bitrix24-sync/index.ts` |
| Bitrix24 Queue | Edge Function | `bitrix24-process-queue/index.ts` |
| Token Rotation | Edge Function | `rotate-tokens/index.ts` |

### 🔧 Infraestrutura
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| Cache views | Supabase Materialized Views | `useCacheViews.ts` |
| Job queue | Database + Edge Function | `useJobQueue.ts` |
| Job worker | Edge Function | `job-worker/index.ts` |
| System health | Custom monitoring | `useSystemHealth.ts` |
| External API check | Edge Function | `check-external-api/index.ts` |

### 🎨 UI/UX
| Funcionalidade | Ferramenta/Tecnologia | Arquivo |
|----------------|----------------------|---------|
| Tema claro/escuro | CSS Variables + Hook | `useTheme.ts` |
| Atalho de teclado tema | Keyboard Event | `useTheme.ts` |
| Layout responsivo | Tailwind CSS | `AppLayout.tsx` |
| Sidebar colapsável | Framer Motion | `Sidebar.tsx` |
| Animações | Framer Motion | `motion.tsx` |
| Toasts/Notificações | Sonner + shadcn | `sonner.tsx` |
| Detecção mobile | Custom Hook | `use-mobile.tsx` |

---

## 🧩 Componentes UI (shadcn/ui + Custom)

### Componentes Base (shadcn/ui)
| Componente | Arquivo | Uso |
|------------|---------|-----|
| Accordion | `accordion.tsx` | Conteúdo expansível |
| Alert | `alert.tsx` | Mensagens de alerta |
| Alert Dialog | `alert-dialog.tsx` | Diálogos de confirmação |
| Avatar | `avatar.tsx` | Imagens de perfil |
| Badge | `badge.tsx` | Etiquetas e status |
| Breadcrumb | `breadcrumb.tsx` | Navegação hierárquica |
| Button | `button.tsx` | Botões com variantes |
| Calendar | `calendar.tsx` | Seleção de datas |
| Card | `card.tsx` | Containers de conteúdo |
| Carousel | `carousel.tsx` | Slider de conteúdo |
| Chart | `chart.tsx` | Configuração de gráficos |
| Checkbox | `checkbox.tsx` | Caixas de seleção |
| Collapsible | `collapsible.tsx` | Conteúdo retrátil |
| Command | `command.tsx` | Paleta de comandos |
| Context Menu | `context-menu.tsx` | Menu de contexto |
| Dialog | `dialog.tsx` | Modais |
| Drawer | `drawer.tsx` | Gavetas laterais |
| Dropdown Menu | `dropdown-menu.tsx` | Menus dropdown |
| Form | `form.tsx` | Formulários com validação |
| Hover Card | `hover-card.tsx` | Cards em hover |
| Input | `input.tsx` | Campos de entrada |
| Input OTP | `input-otp.tsx` | Entrada de código OTP |
| Label | `label.tsx` | Rótulos de formulário |
| Menubar | `menubar.tsx` | Barra de menu |
| Navigation Menu | `navigation-menu.tsx` | Menu de navegação |
| Pagination | `pagination.tsx` | Paginação |
| Popover | `popover.tsx` | Popovers |
| Progress | `progress.tsx` | Barras de progresso |
| Radio Group | `radio-group.tsx` | Grupos de radio |
| Resizable | `resizable.tsx` | Painéis redimensionáveis |
| Scroll Area | `scroll-area.tsx` | Áreas com scroll |
| Select | `select.tsx` | Dropdowns de seleção |
| Separator | `separator.tsx` | Separadores |
| Sheet | `sheet.tsx` | Painéis laterais |
| Sidebar | `sidebar.tsx` | Sidebar component |
| Skeleton | `skeleton.tsx` | Loading placeholders |
| Slider | `slider.tsx` | Controles deslizantes |
| Switch | `switch.tsx` | Toggle switches |
| Table | `table.tsx` | Tabelas |
| Tabs | `tabs.tsx` | Abas |
| Textarea | `textarea.tsx` | Áreas de texto |
| Toast | `toast.tsx` | Notificações toast |
| Toggle | `toggle.tsx` | Botões toggle |
| Toggle Group | `toggle-group.tsx` | Grupos de toggle |
| Tooltip | `tooltip.tsx` | Dicas de ferramenta |

### Componentes Customizados
| Componente | Arquivo | Uso |
|------------|---------|-----|
| Activity Timeline | `activity-timeline.tsx` | Timeline de atividades |
| Empty State | `empty-state.tsx` | Estados vazios |
| Heatmap Chart | `heatmap-chart.tsx` | Gráfico de calor |
| Live Badge | `live-badge.tsx` | Badge animado "ao vivo" |
| Motion | `motion.tsx` | Wrapper de animações |
| Prediction Card | `prediction-card.tsx` | Cards de previsão |
| Quick Filters | `quick-filters.tsx` | Filtros rápidos |
| Sparkline | `sparkline.tsx` | Mini gráficos de linha |

### Componentes de Layout
| Componente | Arquivo | Uso |
|------------|---------|-----|
| AppLayout | `layout/AppLayout.tsx` | Layout principal |
| Header | `layout/Header.tsx` | Cabeçalho com notificações |
| Sidebar | `layout/Sidebar.tsx` | Menu lateral |
| NavLink | `NavLink.tsx` | Links de navegação |
| ErrorBoundary | `ErrorBoundary.tsx` | Tratamento de erros |

### Componentes de Dashboard
| Componente | Arquivo | Uso |
|------------|---------|-----|
| AI Route Chatbot | `dashboard/AIRouteChatbot.tsx` | Chatbot de rotas |
| Alert Action Card | `dashboard/AlertActionCard.tsx` | Card de ação de alerta |
| Alerts Panel | `dashboard/AlertsPanel.tsx` | Painel de alertas |
| Approval Queue | `dashboard/ApprovalQueue.tsx` | Fila de aprovações |
| Live Map Placeholder | `dashboard/LiveMapPlaceholder.tsx` | Placeholder do mapa |
| Metric Card | `dashboard/MetricCard.tsx` | Cards de métricas |
| Orders Table | `dashboard/OrdersTable.tsx` | Tabela de pedidos |
| Risk Score Gauge | `dashboard/RiskScoreGauge.tsx` | Medidor de risco |
| Stats Card | `dashboard/StatsCard.tsx` | Cards de estatísticas |

### Componentes de Mapa
| Componente | Arquivo | Uso |
|------------|---------|-----|
| Live Map | `map/LiveMap.tsx` | Mapa ao vivo |
| Heat Map | `map/HeatMap.tsx` | Mapa de calor |

### Componentes de Notificação
| Componente | Arquivo | Uso |
|------------|---------|-----|
| Realtime Alerts | `notifications/RealtimeAlerts.tsx` | Alertas em tempo real |
| Realtime Alert Toast | `notifications/RealtimeAlertToast.tsx` | Toast de alertas |

### Componentes de Aprovação
| Componente | Arquivo | Uso |
|------------|---------|-----|
| Waiting Time Counter | `approvals/WaitingTimeCounter.tsx` | Contador de espera |

---

## 🪝 Hooks Personalizados

| Hook | Arquivo | Funcionalidade |
|------|---------|----------------|
| `useAuth` | `useAuth.tsx` | Autenticação e sessão |
| `useTheme` | `useTheme.ts` | Tema claro/escuro com atalho |
| `useMobile` | `use-mobile.tsx` | Detecção de dispositivo móvel |
| `useToast` | `use-toast.ts` | Sistema de notificações |
| `useActiveAlerts` | `useActiveAlerts.ts` | Alertas ativos |
| `useAlertConfigurations` | `useAlertConfigurations.ts` | Configurações de alerta |
| `useApprovalRealtime` | `useApprovalRealtime.ts` | Aprovações em tempo real |
| `useBitrix24` | `useBitrix24.ts` | Integração Bitrix24 |
| `useCacheViews` | `useCacheViews.ts` | Views de cache |
| `useCachedStats` | `useCachedStats.ts` | Estatísticas em cache |
| `useDashboardStats` | `useDashboardStats.ts` | Stats do dashboard |
| `useDeliveryHeatmapData` | `useDeliveryHeatmapData.ts` | Dados do heatmap |
| `useDeliveryMetrics` | `useDeliveryMetrics.ts` | Métricas de entrega |
| `useDriverEvaluations` | `useDriverEvaluations.ts` | Avaliações de motoristas |
| `useDrivers` | `useDrivers.ts` | CRUD de motoristas |
| `useEvaluateDriver` | `useEvaluateDriver.ts` | Avaliação de motorista |
| `useIncidents` | `useIncidents.ts` | Gestão de incidentes |
| `useJobQueue` | `useJobQueue.ts` | Fila de jobs |
| `useMetrics` | `useMetrics.ts` | Métricas gerais |
| `useNotificationHistory` | `useNotificationHistory.ts` | Histórico de notificações |
| `usePendingApprovals` | `usePendingApprovals.ts` | Aprovações pendentes |
| `usePushNotifications` | `usePushNotifications.ts` | Push notifications |
| `useRecentOrders` | `useRecentOrders.ts` | Pedidos recentes |
| `useRiskRules` | `useRiskRules.ts` | Regras de risco |
| `useSLAMetrics` | `useSLAMetrics.ts` | Métricas de SLA |
| `useSoundSettings` | `useSoundSettings.ts` | Configurações de som |
| `useSystemHealth` | `useSystemHealth.ts` | Saúde do sistema |
| `useSystemHealthExpanded` | `useSystemHealthExpanded.ts` | Saúde expandida |
| `useTestNotification` | `useTestNotification.ts` | Teste de notificações |
| `useTrackingHistory` | `useTrackingHistory.ts` | Histórico de tracking |
| `useWebhookEvents` | `useWebhookEvents.ts` | Eventos de webhook |

---

## ⚡ Edge Functions (Backend)

| Função | Diretório | Funcionalidade |
|--------|-----------|----------------|
| `bitrix24-process-queue` | `supabase/functions/` | Processa fila de sync Bitrix24 |
| `bitrix24-sync` | `supabase/functions/` | Sincroniza com Bitrix24 |
| `check-driver-alerts` | `supabase/functions/` | Verifica alertas de motoristas |
| `check-external-api` | `supabase/functions/` | Verifica APIs externas |
| `evaluate-driver` | `supabase/functions/` | Avalia risco do motorista |
| `get-mapbox-token` | `supabase/functions/` | Retorna token Mapbox |
| `job-worker` | `supabase/functions/` | Worker de jobs assíncronos |
| `lalamove-api` | `supabase/functions/` | Proxy para API Lalamove |
| `lalamove-webhook` | `supabase/functions/` | Processa webhooks Lalamove |
| `rotate-tokens` | `supabase/functions/` | Rotaciona tokens OAuth |
| `route-analyzer` | `supabase/functions/` | Analisa rotas |
| `send-notification` | `supabase/functions/` | Envia notificações multicanal |
| `simulate-driver-movement` | `supabase/functions/` | Simula movimento de motorista |
| `test-notification` | `supabase/functions/` | Testa envio de notificação |

---

## 🔌 Integrações Externas

| Serviço | Uso | Autenticação |
|---------|-----|--------------|
| **Lalamove API** | API de entregas | HMAC-SHA256 |
| **Bitrix24** | CRM e gestão de deals | OAuth2 |
| **Mapbox** | Mapas e geocoding | API Key |
| **WhatsApp (Evolution API)** | Notificações | API Key |
| **Slack** | Notificações | Webhook URL |
| **Email (SMTP)** | Notificações | SMTP credentials |
| **N8N** | Automações via webhook | Webhook URL |

---

## 🎨 Sistema de Design

### Cores Semânticas (CSS Variables)
```css
--background          /* Fundo principal */
--foreground          /* Texto principal */
--card                /* Fundo de cards */
--card-foreground     /* Texto em cards */
--primary             /* Cor primária (azul) */
--secondary           /* Cor secundária */
--muted               /* Elementos silenciados */
--accent              /* Cor de destaque (roxo) */
--destructive         /* Erros e exclusões */
--success             /* Sucesso */
--warning             /* Avisos */
--info                /* Informações */
--border              /* Bordas */
--ring                /* Foco/anel */
```

### Cores Estendidas
```css
--cyan                /* Ciano */
--violet              /* Violeta */
--rose                /* Rosa */
--amber               /* Âmbar */
--emerald             /* Esmeralda */
```

### Gradientes
```css
--gradient-primary      /* Primário → Accent */
--gradient-success      /* Verde → Esmeralda */
--gradient-warning      /* Âmbar → Laranja */
--gradient-destructive  /* Vermelho → Rosa */
--gradient-info         /* Azul → Ciano */
--gradient-dark         /* Dark gradient */
--gradient-card         /* Background de card */
--gradient-glass        /* Efeito glass */
```

### Sombras
```css
--shadow-soft          /* Sombra suave */
--shadow-medium        /* Sombra média */
--shadow-strong        /* Sombra forte */
--shadow-colored       /* Sombra colorida (primary) */
--shadow-inner-glow    /* Brilho interno */
```

### Glows
```css
--glow-primary         /* Brilho primário */
--glow-accent          /* Brilho accent */
--glow-success         /* Brilho sucesso */
--glow-warning         /* Brilho aviso */
--glow-destructive     /* Brilho erro */
--glow-info            /* Brilho info */
```

### Animações Disponíveis
| Classe | Efeito |
|--------|--------|
| `animate-fade-in` | Fade in |
| `animate-fade-up` | Fade com slide up |
| `animate-scale-in` | Scale in |
| `animate-slide-in-right` | Slide da direita |
| `animate-slide-in-left` | Slide da esquerda |
| `animate-pulse-glow` | Pulso com glow |
| `animate-float` | Flutuação |
| `animate-gradient` | Gradiente animado |
| `animate-shimmer` | Efeito shimmer |
| `animate-spin-slow` | Rotação lenta |

### Classes Utilitárias
| Classe | Efeito |
|--------|--------|
| `.glass` | Glassmorphism |
| `.glass-strong` | Glassmorphism forte |
| `.glow-primary` | Glow primário |
| `.card-interactive` | Card com hover |
| `.card-glass` | Card glassmorphism |
| `.card-gradient` | Card com gradiente |
| `.mesh-gradient` | Background mesh |
| `.noise` | Textura de ruído |
| `.shimmer` | Efeito shimmer |
| `.border-gradient` | Borda com gradiente |
| `.gradient-text` | Texto com gradiente |
| `.hover-lift` | Elevação em hover |
| `.focus-ring-glow` | Foco com glow |

---

## 🗄️ Banco de Dados

### Tabelas Principais
| Tabela | Descrição |
|--------|-----------|
| `drivers` | Cadastro de motoristas |
| `lalamove_orders` | Pedidos do Lalamove |
| `lalamove_stops` | Paradas dos pedidos |
| `lalamove_status_history` | Histórico de status |
| `driver_approval_queue` | Fila de aprovação |
| `driver_evaluations` | Avaliações de risco |
| `driver_incidents` | Incidentes registrados |
| `driver_locations` | Histórico de localizações |
| `active_tracking` | Tracking ativo |
| `tracking_events` | Eventos de tracking |
| `alerts` | Alertas do sistema |
| `alerts_sent` | Notificações enviadas |
| `alert_configurations` | Configurações de alerta |
| `risk_rules` | Regras de risco |
| `webhook_events` | Eventos de webhook |
| `bitrix24_sync` | Sync com Bitrix24 |
| `bitrix24_tokens` | Tokens OAuth |
| `bitrix24_activities` | Atividades Bitrix24 |
| `bitrix24_stage_mappings` | Mapeamento de estágios |

### Enums
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

---

## 🔒 Segurança

### Implementações
| Feature | Implementação |
|---------|---------------|
| **Autenticação** | Supabase Auth |
| **RLS (Row Level Security)** | Todas as tabelas |
| **HMAC Webhook Validation** | Lalamove webhooks |
| **OAuth2** | Bitrix24 integration |
| **Secrets Management** | Supabase Secrets |
| **Rate Limiting** | 100 req/min webhooks |
| **IP Whitelist** | Lalamove AWS IPs |
| **Auto-confirm emails** | Configurado via auth |

### Secrets Configurados
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LALAMOVE_API_KEY`
- `LALAMOVE_API_SECRET`
- `LALAMOVE_BASE_URL`
- `MAPBOX_ACCESS_TOKEN`
- `LOVABLE_API_KEY`

---

## 📝 Scripts e Automações

| Script | Localização | Uso |
|--------|-------------|-----|
| `backup.sh` | `scripts/` | Backup do sistema |
| `deploy.sh` | `scripts/` | Deploy automatizado |
| `health-check.sh` | `scripts/` | Verificação de saúde |
| `pre-commit-secrets.sh` | `scripts/` | Verificação de secrets |

### CI/CD
| Arquivo | Uso |
|---------|-----|
| `.github/workflows/ci.yml` | Pipeline de CI |
| `.husky/pre-commit` | Hook de pre-commit |

---

## 📚 Documentação

| Documento | Localização |
|-----------|-------------|
| Architecture | `docs/ARCHITECTURE.md` |
| API Reference | `docs/API_REFERENCE.md` |
| Cache System | `docs/CACHE_SYSTEM.md` |
| Contributing | `docs/CONTRIBUTING.md` |
| Deployment | `docs/DEPLOYMENT.md` |
| Job Queue | `docs/JOB_QUEUE_SYSTEM.md` |
| Logging & Health | `docs/LOGGING_AND_HEALTH.md` |
| Queue System | `docs/QUEUE_SYSTEM.md` |
| Screening System | `docs/SCREENING_SYSTEM.md` |
| Security | `docs/SECURITY.md` |
| Troubleshooting | `docs/TROUBLESHOOTING.md` |
| Webhook Handler | `docs/WEBHOOK_HANDLER.md` |

---

## 🎯 Resumo de Tecnologias

### Frontend
- React 18 + TypeScript
- Vite (build)
- Tailwind CSS (estilização)
- shadcn/ui (componentes)
- Framer Motion (animações)
- React Query (data fetching)
- React Router (roteamento)
- Recharts (gráficos)
- Mapbox GL (mapas)

### Backend
- Supabase (BaaS)
- PostgreSQL (database)
- Deno (edge functions)
- RLS (segurança)

### Integrações
- Lalamove API
- Bitrix24 CRM
- Mapbox
- WhatsApp (Evolution API)
- Slack
- Email SMTP
- N8N Webhooks

---

**Mantido por:** Equipe de Desenvolvimento  
**Última atualização:** 31/12/2025
