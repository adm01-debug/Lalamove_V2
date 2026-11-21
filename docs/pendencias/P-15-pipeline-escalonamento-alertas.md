# P-15 · Pipeline de escalonamento de alertas morto desde o início

**Status:** PR #119 aberta (regra 8 — migration em produção). Dry-run validado em transação com `ROLLBACK`.
**Origem:** investigação do backlog de 1304 alertas não lidos em produção (2026-11-21).

## Sintoma

O cron `escalate-unacknowledged-alerts` roda a cada 5 minutos (`*/5 * * * *`) e tem **2016 execuções
registradas, todas "succeeded"**, mas em produção:

- `alerts`: 1319 linhas, **0 com `escalated_at`**, **0 com `escalation_level > 0`**
- `alerts_sent`: 0 linhas
- `alert_configurations`: **0 linhas**

Nenhum alerta foi escalado desde o início do sistema, e nada indicava isso: a edge function
`escalate-alerts/index.ts` responde HTTP 200 mesmo quando escala 0 alertas, então o cron parece saudável.

## Causa raiz (arquivo:linha)

`get_pending_escalations()` faz `INNER JOIN public.alert_configurations c ON c.alert_type = a.type AND
c.is_enabled = true AND c.escalation_enabled = true`. **Nenhuma migration do repositório jamais executou
`INSERT INTO alert_configurations`** — a tabela nasceu com 0 linhas e assim ficou. Com o `INNER JOIN`,
a função retornava 0 linhas em 100% das execuções.

Isso também contraria a regra de domínio escrita em `docs/agentes/regras-dominio.md:46-49`: "check-driver-alerts
gera, escalate-alerts escala e send-notification entrega. Alerta novo sem entrada de configuração nasce sem
como ser desligado." A tela `/alert-configurations` existia, mas como a tabela estava vazia, o operador
via empty state e **não tinha como criar** — os hooks `useCreateAlertConfiguration` (`src/hooks/useAlertConfigurations.ts:146`)
e `useDeleteAlertConfiguration` (`:165`) existiam e nunca eram importados (código morto).

## Defeitos secundários que apareceriam no primeiro escalonamento

1. **Sem limite de idade.** Ao habilitar uma configuração, os **1290 alertas `INTEGRATION_FAILURE`**
   históricos (`created_at` entre 2026-08-15 e 2026-11-21) entrariam na fila de uma só vez — flood de
   mensagens e custo de canal.
2. **Sem exigir destinatário.** `send-notification/index.ts` retorna antes de marcar `escalated_at` quando
   `configs.length === 0` ou quando a configuração não tem canal utilizável. Uma configuração com
   `escalation_enabled = true` e nenhum canal preenchido faria o alerta voltar para a fila a cada 5 minutos,
   para sempre.

## Correção (PR #119)

`supabase/migrations/20261121193000_fix_escalation_pipeline.sql`:

1. **Seed das 7 configurações** (`DRIVER_BLOCKED`, `ROUTE_DEVIATION`, `DRIVER_STOPPED`, `LATE_DELIVERY`,
   `APPROVAL_REQUIRED`, `ORDER_CANCELLED`, `INTEGRATION_FAILURE`) com `is_enabled = true` e
   `escalation_enabled = false`. Nada é enviado até o operador preencher destinatários.
   `ON CONFLICT (alert_type, channel) DO NOTHING` mantém idempotente.
2. **`get_pending_escalations()` com janela de 24h** e **exigência de canal com destinatário**.

Front: botão "Nova config.", CTA no empty state, `<Dialog>` de criação, botão de exclusão no card, e
labels/descrição/ícone de `INTEGRATION_FAILURE` (o tipo com 1290 alertas aparecia como enum cru).

## Validação

Dry-run em produção, em transação com `ROLLBACK` (Management API):

| verificação | resultado |
|---|---|
| migration executa sem erro (2 statements) | ok |
| `alert_configurations` após seed | 7 linhas |
| `get_pending_escalations()` após seed | 0 (correto: seed nasce desligada e sem canais) |
| candidatos com a janela de 24h | 3 de 1319 |
| candidatos **sem** a janela de 24h | 1290 (o flood que o limite evita) |
| rollback aplicado | `alert_configurations` = 0, função antiga preservada |

Local: `npx tsc --noEmit` exit 0 · `npm run lint` 0 erros (532 warnings pré-existentes) · `npm run build` 2.54s.
CI da PR #119: 10/10 verde (lint-and-typecheck, build, test, E2E, Deno Contract, security, Guarda AGENTS.md,
Vercel).

## Pendente do dono

1. Autorizar o apply (regra 8 — DDL em produção) e registrar `20261121193000` no ledger
   (`supabase_migrations.schema_migrations`, hoje com 168 entradas).
2. **Nenhum secret de canal existe em produção** (só `SUPABASE_*`, `MAPBOX_ACCESS_TOKEN`, `LALAMOVE_*`).
   Faltam `EVOLUTION_API_KEY`, `RESEND_API_KEY`, `SLACK_WEBHOOK_URL`. Sem eles, mesmo com as configurações
   criadas e o escalonamento ligado, `send-notification` não entrega — foi por isso que o seed nasce com
   `escalation_enabled = false`.