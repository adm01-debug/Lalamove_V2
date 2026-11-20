# Regras de negócio (resumo para executar pendências)

> Compilado da Fase 0. Fonte autoritativa: docs/agentes/regras-dominio.md e docs/contexto/regras/07-REGRAS-DE-NEGOCIO.md.

## Papéis e MFA
- Roles: admin > manager > operator > viewer (numérico em src/components/auth/ProtectedRoute.tsx: viewer 1 < operator 2 < manager 3 < admin 4). requiredRole="operator" libera operator+manager+admin.
- Toda rota nova: requiredRole explícito em src/App.tsx + entrada em src/components/layout/sidebar-config.ts — senão a tela não é acessível no menu.
- requireMFA obrigatório em 6 rotas (risk-rules, webhooks, bitrix24, settings/uapi, settings/lalamove, external-data). Quem mexe em segredo/webhook/integração passa por MFA.
- Autorização de dado é RLS, não front (docs/adr/001-rls-first-architecture.md).

## Score de risco do motorista
- Pesos fixos: falha 25%, incidentes 20%, atraso médio 15%, avaliação 15%, recência 15%, volume 10% -> score 0-10; faixas LOW 0-2,5 / MEDIUM 2,5-5 / HIGH 5-7,5 / CRITICAL 7,5-10.
- Mudar peso/faixa muda edge evaluate-driver + UI + /risk-rules juntos, no mesmo PR.

## Fila de aprovações
- driver_approval_queue com contador de espera: <5min normal, 5-15 atenção, 15-30 urgente, >30 crítico (WaitingTimeCounter.tsx:37-49).
- Ações duplicadas em useApprovalActions e useApprovalActionsEnhanced — conferir qual a tela usa antes de corrigir.

## Alertas
- check-driver-alerts gera, escalate-alerts escala, send-notification entrega (WhatsApp/e-mail/Slack/Bitrix24/n8n). Canal novo = secret novo na edge, nunca VITE_*.
- Alerta novo sem entrada em alert_configurations nasce sem como ser desligado.

## Rastreamento
- GPS em tracking_events particionada por mês (pg_cron: provision dia 1 00:05, prune dia 2 00:20, retenção 6 meses).
- simulate-driver-movement escreve dado FALSO com service_role, só dev (verify_jwt=true). Nunca contra produção.

## i18n
- 3 locales: pt-BR, en, es. Texto novo nos três arquivos, nunca hardcoded.

## Banco
- Sem MCP do iecgydonctmabiijadsf nesta sessão: afirmação sobre produção = NÃO VERIFICADO.
- DDL: arquivo em supabase/migrations/ -> PR -> merge em main -> deploy -> apply (o merge É o apply via Lovable). Idempotência obrigatória. Nada de DDL a partir de branch aberta.
- Destrutivo/segredos/rotação: só com o dono.
