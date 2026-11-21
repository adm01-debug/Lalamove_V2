# Changelog

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.6.0] - 2026-11-22

### Adicionado
- **Camada geo com Google e Mapbox selecionáveis por função**: `geo_settings` define provedor
  principal e fallback por função (autocomplete, geocode, reverse, route, matrix, static, snap,
  isochrone, optimization, tilequery) e o `geo-gateway` resolve a chamada, mede uso em `geo_usage`,
  aplica cache por SKU e respeita orçamento mensal.
- **Failover de provedor em runtime**: provedor primário fora do ar, com chave ausente ou com
  orçamento estourado cai para o fallback sem reiniciar nada.
- **Coordenadas reais do pedido**: a coordenada persistida vem de `stops[].coordinates` da
  cotação Lalamove (`geocode_provider='lalamove'`), inclusive no backfill de pedidos antigos.
- **Ferramentas de mapa (`/map-tools`) unificadas no gateway**: as 9 telas (directions, matrix,
  isochrone, optimization, map matching, static image, tilequery, geocode, reverse) passaram a usar
  o `geo-gateway`, com perfil `driving-traffic`/`driving`/`walking`/`cycling` respeitado.

### Corrigido
- **`/map` não quebra mais no StrictMode** e as camadas voltam a renderizar.
- **Rodapé de atribuição Mapbox** saiu da área de scroll e aparece fixo no autocomplete.
- **Perfil silenciosamente trocado**: `route` e `matrix` do gateway forçavam `driving-traffic`;
  agora honram o perfil pedido pela tela.
- **Map Matching incompleto**: `snap` devolve distância, duração e geometria corrigida.
- **Retenção indevida**: `lalamove_orders` com `geocode_provider='mapbox'` → 0 registros.

---

## [1.5.0] - 2025-06-25

### Adicionado
- **Contador de Tempo de Espera**: Componente `WaitingTimeCounter` que mostra em tempo real há quanto tempo cada aprovação está pendente
  - Atualização a cada segundo
  - Urgência visual progressiva (normal → atenção → urgente → crítico pulsante)
  - Thresholds: <5min normal, 5-15min atenção, 15-30min urgente, >30min crítico

### Melhorado
- Página de Aprovações agora exibe o contador de tempo junto com a data/hora da solicitação

---

## [1.4.0] - 2025-06-24

### Adicionado
- **Push Notifications Nativas**: Sistema completo de notificações push no navegador
  - Service Worker para recebimento de notificações
  - Solicitação de permissão do usuário
  - Notificações ricas com ações clicáveis
  - Deep links para página de aprovações
  - Hook `usePushNotifications` para gerenciamento

- **Sistema de Sons de Alerta**: Alertas sonoros configuráveis por tipo
  - Web Audio API para geração de sons
  - 4 tipos de som (info, warning, critical, approval)
  - Volume ajustável (0-100%)
  - Teste de sons individual
  - Persistência em localStorage
  - Hook `useSoundSettings` para configuração

- **Página de Configurações Expandida**: Nova seção para gerenciar notificações
  - Toggle para habilitar/desabilitar push notifications
  - Toggle para habilitar/desabilitar sons
  - Controle de volume com slider
  - Botões de teste para cada tipo de som
  - Status de permissão do navegador

### Melhorado
- `RealtimeAlerts` agora integra sons e push notifications
- Hook `useApprovalRealtime` dispara notificações automaticamente

---

## [1.3.0] - 2025-06-23

### Adicionado
- **Edge Function `evaluate-driver`**: Avaliação automatizada de motoristas
  - Cálculo de score de risco baseado em múltiplos fatores
  - Decisão automática (aprovar/bloquear/manual)
  - Integração com fila de aprovações
  - Suporte a whitelist/blacklist

- **Edge Function `test-notification`**: Endpoint para testes de push notifications

- **Hook `useEvaluateDriver`**: Integração frontend com avaliação de motoristas
  - Mutation para chamar edge function
  - Feedback via toasts
  - Invalidação automática de queries

- **Tabela `driver_evaluations`**: Histórico completo de avaliações
  - Score, nível, fatores de risco
  - Recomendação e ação requerida
  - Vínculo com pedido e motorista

### Melhorado
- `RiskCalculatorService` com pesos configuráveis
- `DriverEvaluatorService` com fluxo completo de avaliação

---

## [1.2.0] - 2025-06-22

### Adicionado
- **Sistema de Alertas Multicanal**: Notificações em múltiplos canais
  - Push Notifications
  - Email
  - SMS
  - WhatsApp
  - Slack
  - Bitrix24 Tasks
  - n8n Webhooks

- **Edge Function `send-notification`**: Dispatcher de notificações multicanal

- **Tabela `alert_configurations`**: Configuração de alertas por tipo
  - Canais habilitados por tipo de alerta
  - Templates de mensagem
  - Intervalo mínimo entre alertas
  - Destinatários por canal

- **Tabela `alerts_sent`**: Log de alertas enviados
  - Status de entrega
  - Contagem de retentativas
  - Mensagens de erro

- **Página `AlertConfigurationsPage`**: Interface para configurar alertas
  - CRUD de configurações
  - Toggle por canal
  - Teste de envio

### Melhorado
- Dashboard agora mostra alertas ativos em tempo real
- Hook `useActiveAlerts` com suporte a realtime

---

## [1.1.0] - 2025-06-21

### Adicionado
- **Integração Bitrix24**: Sincronização com CRM
  - OAuth2 flow para autenticação
  - Sincronização de deals
  - Mapeamento de estágios Lalamove → Bitrix24
  - Criação de atividades
  - Edge Functions: `bitrix24-sync`, `bitrix24-process-queue`

- **Tabelas Bitrix24**:
  - `bitrix24_tokens`: Armazenamento de tokens OAuth
  - `bitrix24_sync`: Status de sincronização por pedido
  - `bitrix24_stage_mappings`: Mapeamento de estágios
  - `bitrix24_activities`: Atividades criadas

- **Página `Bitrix24Page`**: Interface de configuração da integração
  - Status da conexão
  - Mapeamento de estágios
  - Histórico de sincronização

- **Hook `useBitrix24`**: Gerenciamento da integração

---

## [1.0.0] - 2025-06-20

### Adicionado
- **Dashboard Principal**: Visão geral do sistema
  - Cards de estatísticas (pedidos, entregas, aprovações, alertas)
  - Tabela de pedidos recentes
  - Mini fila de aprovações
  - Painel de alertas
  - Placeholder do mapa

- **Mapa em Tempo Real**: Visualização de motoristas
  - Integração Mapbox GL JS
  - Marcadores de motoristas
  - Rotas esperadas vs atuais
  - Edge Function `get-mapbox-token`

- **Mapa de Calor**: Densidade de entregas por região
  - Heatmap layer do Mapbox
  - Filtros por período
  - Hook `useDeliveryHeatmapData`

- **Análise de Rotas com IA**: Chatbot para análise
  - Integração Lovable AI (Gemini 2.5 Flash)
  - Edge Function `route-analyzer`
  - Detecção de desvios
  - Previsão de atrasos
  - Componente `AIRouteChatbot`

### Infraestrutura
- Configuração inicial do projeto React + Vite + TypeScript
- Integração Supabase (PostgreSQL + Realtime + Edge Functions)
- Configuração Tailwind CSS + shadcn/ui
- React Query para gerenciamento de estado servidor
- React Router para navegação

---

## [0.9.0] - 2025-06-19

### Adicionado
- **Fila de Aprovações**: Gestão de motoristas pendentes
  - Página `ApprovalsPage` com lista de aprovações
  - Componente `ApprovalQueue` para dashboard
  - Filtros por status e prioridade
  - Ações de aprovar/rejeitar
  - Whitelist/Blacklist rápido

- **Hook `usePendingApprovals`**: Busca e gestão de aprovações
- **Hook `useApprovalRealtime`**: Subscriptions realtime

- **Tabela `driver_approval_queue`**: Fila de aprovações
  - Score e fatores de risco
  - Prioridade (LOW → CRITICAL)
  - Status (PENDING/APPROVED/REJECTED)
  - Notas de decisão

### Melhorado
- `ApprovalService` com métodos completos de gestão

---

## [0.8.0] - 2025-06-18

### Adicionado
- **Gestão de Incidentes**: Registro e resolução
  - Página `IncidentsPage`
  - Tipos: ROUTE_DEVIATION, LONG_STOP, LATE_DELIVERY, CUSTOMER_COMPLAINT, DAMAGE, OTHER
  - Severidades: LOW, MEDIUM, HIGH, CRITICAL
  - Workflow de resolução

- **`IncidentService`**: Lógica de negócio para incidentes
  - Criação com recálculo automático de risco
  - Resolução com notas
  - Estatísticas por motorista

- **Tabela `driver_incidents`**: Armazenamento de incidentes
  - Vínculo com motorista e pedido
  - URLs de evidências
  - Metadados

- **Hook `useIncidents`**: CRUD de incidentes

---

## [0.7.0] - 2025-06-17

### Adicionado
- **Regras de Risco Customizáveis**: Interface para criar regras
  - Página `RiskRulesPage`
  - Condições em JSON
  - Impacto no score configurável
  - Ativação/desativação

- **Tabela `risk_rules`**: Armazenamento de regras
  - Nome e descrição
  - Condição (JSONB)
  - Impacto no score
  - Flag is_active

- **Hook `useRiskRules`**: CRUD de regras

### Melhorado
- `RiskCalculatorService` considera regras customizadas

---

## [0.6.0] - 2025-06-16

### Adicionado
- **Gestão de Motoristas**: CRUD completo
  - Página `DriversPage` com lista e filtros
  - Detalhes do motorista
  - Histórico de entregas
  - Histórico de incidentes

- **Página de Avaliações**: Histórico de avaliações
  - `EvaluationsPage` com timeline
  - Filtros por motorista, período, resultado

- **Hook `useDrivers`**: CRUD de motoristas
- **Hook `useDriverEvaluations`**: Histórico de avaliações

### Melhorado
- Tabela `drivers` com campos adicionais
  - `external_rating`, `external_success_rate`, `external_total_deliveries`
  - `whitelisted`, `blacklisted`, `blacklist_reason`
  - `first_seen_at`, `last_evaluated_at`

---

## [0.5.0] - 2025-06-15

### Adicionado
- **Rastreamento em Tempo Real**: Monitoramento GPS
  - Edge Function `simulate-driver-movement` para testes
  - Edge Function `check-driver-alerts` para detecção de anomalias
  - Detecção de desvio de rota
  - Detecção de paradas prolongadas

- **Tabela `active_tracking`**: Rastreamento ativo
  - Posição atual (lat/lng)
  - Velocidade e direção
  - Rota esperada
  - Flags is_on_route, is_stopped
  - ETA dinâmico

- **Tabela `driver_locations`**: Histórico de posições
- **Tabela `tracking_events`**: Eventos de rastreamento

- **Hook `useTrackingHistory`**: Histórico de rastreamento

---

## [0.4.0] - 2025-06-14

### Adicionado
- **Integração Lalamove**: Comunicação com API
  - Edge Function `lalamove-api` (proxy autenticado)
  - Edge Function `lalamove-webhook` (receptor de webhooks)
  - Autenticação HMAC-SHA256
  - Suporte a cotações e pedidos

- **Tabela `webhook_events`**: Log de webhooks recebidos
  - Payload raw
  - Status de processamento
  - Mensagens de erro

- **Tabela `lalamove_status_history`**: Histórico de status
- **Tabela `lalamove_stops`**: Paradas do pedido

- **Página `WebhooksPage`**: Visualização de eventos
- **Hook `useWebhookEvents`**: Listagem de eventos

---

## [0.3.0] - 2025-06-13

### Adicionado
- **Sistema de Alertas**: Notificações internas
  - Tabela `alerts` para armazenamento
  - Tipos: DRIVER_BLOCKED, ROUTE_DEVIATION, DRIVER_STOPPED, LATE_DELIVERY, APPROVAL_REQUIRED, ORDER_CANCELLED
  - Severidades: INFO, WARNING, CRITICAL

- **Página `AlertsPage`**: Lista de alertas
  - Filtros por tipo e severidade
  - Marcar como lido/dispensado

- **Componente `AlertsPanel`**: Painel no dashboard
- **Componente `RealtimeAlerts`**: Subscriptions realtime
- **Hook `useActiveAlerts`**: Alertas não dispensados

---

## [0.2.0] - 2025-06-12

### Adicionado
- **Gestão de Pedidos**: CRUD completo
  - Página `OrdersPage` com tabela paginada
  - Filtros por status, data, motorista
  - Modal de detalhes `OrderDetailModal`

- **Tabela `lalamove_orders`**: Pedidos Lalamove
  - Status, endereços, coordenadas
  - Custo, moeda, tags
  - Vínculo com motorista
  - Outcome da entrega

- **Tabela `drivers`**: Motoristas
  - Dados pessoais e veículo
  - Métricas de performance
  - Score de risco

- **Hooks de dados**:
  - `useRecentOrders`
  - `useDashboardStats`
  - `useDeliveryMetrics`
  - `useSLAMetrics`
  - `useMetrics`

---

## [0.1.0] - 2025-06-11

### Adicionado
- **Estrutura Inicial do Projeto**
  - Setup React 18 + Vite + TypeScript
  - Configuração Tailwind CSS
  - Instalação shadcn/ui (49 componentes)
  - Configuração React Router
  - Configuração React Query

- **Layout Base**:
  - `AppLayout` com estrutura principal
  - `Sidebar` com navegação
  - `Header` com busca e perfil

- **Autenticação**:
  - `AuthPage` com login/registro
  - Hook `useAuth` com Supabase Auth
  - Proteção de rotas

- **Páginas Placeholder**:
  - Dashboard, Orders, Drivers, etc.
  - Página 404 (NotFound)

- **Tipos Base** (`src/types/index.ts`):
  - Order, Driver, Alert
  - Enums de status

- **Serviços Base**:
  - `RiskCalculatorService`
  - `DriverEvaluatorService`
  - `ApprovalService`
  - `IncidentService`

- **Utilitários**:
  - `cn()` para classes condicionais
  - Mock data para desenvolvimento

---

## Legenda

- **Adicionado**: Novas funcionalidades
- **Alterado**: Mudanças em funcionalidades existentes
- **Depreciado**: Funcionalidades que serão removidas
- **Removido**: Funcionalidades removidas
- **Corrigido**: Correções de bugs
- **Segurança**: Correções de vulnerabilidades

---

## Roadmap

### Próximas Versões

#### [1.6.0] - Planejado
- [ ] Relatórios exportáveis (CSV/PDF)
- [ ] Filtros avançados por período
- [ ] Dashboard de analytics

#### [1.7.0] - Planejado
- [ ] App mobile (PWA)
- [ ] Notificações offline
- [ ] Modo escuro

#### [2.0.0] - Planejado
- [ ] Multi-tenancy
- [ ] Roles e permissões granulares
- [ ] API pública documentada
- [ ] Webhooks de saída

---

## Contribuidores

- **Lovable** - Plataforma de desenvolvimento
- **Claude (Anthropic)** - Assistente IA para desenvolvimento

---

## Links

- [Repositório](https://github.com/your-repo/lalamove-intelligence)
- [Documentação](./README.md)
- [Lovable](https://lovable.dev)
