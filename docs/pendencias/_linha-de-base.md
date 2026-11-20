# Linha de base de regressão — Lalamove V2

> Gerado em 2026-11-26 pelo agente · branch claude/chore-backlog-pendencias-261120-1930
> Fonte: Fase 0 do goal "Concluir funcionalidades pendentes".

## Comandos de validação (rodados nesta sessão, na branch de trabalho)

| Comando | Resultado | Evidência |
|---|---|---|
| npm run lint | 0 errors, 532 warnings (pré-existentes) | saída do ESLint 2026-11-26 |
| npx tsc --noEmit | exit 0 | — |
| CI PR #93 (8 jobs) | 100% success | run 44799594257 |

## Inventário do sistema (estado atual, com evidência)

- **Páginas**: 50+ em src/pages/; rotas em src/App.tsx:139-205 com RBAC via ProtectedRoute.
- **Edge functions**: 27 em supabase/functions/ (excluindo _shared).
- **Hooks**: 83 em src/hooks/.
- **Migrations**: 157 arquivos em supabase/migrations/ (42 com CREATE TABLE; 80 CREATE TABLE total, views/RPCs inclusive).
- **Banco real**: iecgydonctmabiijadsf (Supabase Cloud). Sem MCP desta sessão apontando para ele — consultas a produção = NÃO VERIFICADO. Fonte: docs/agentes/banco.md.
- **Tabelas reais conhecidas** (via OpenAPI PostgREST com secret key, sessões anteriores): drivers, lalamove_orders, lalamove_stops, lalamove_status_history, driver_incidents, driver_approval_queue, active_tracking, tracking_events, alerts, mcp_diagnostics_grants, query_telemetry + RPCs mcp_exec, mcp_introspect, can_run_db_diagnostics.

## Documentos de auditoria (origem do backlog)

| Documento | Papel | Data | Obs |
|---|---|---|---|
| docs/audit_report.md | checklist Implementado vs. Pendente (seção 5) | 14/05/2026 | Desatualizado: marca MFA "Parcial", mas useMFA.ts/MFAEnroll/MFASettings/MFAVerify/Passkey* existem (verificado 2026-11-26) |
| docs/LEVANTAMENTO_COMPLETO_FUNCIONALIDADES.md | inventário quantitativo | 15/03/2026 | sem marcação de status |
| docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md (branch contexto) | lacunas técnicas | 2026-11-20 | gerado automaticamente |
| docs/agentes/* | regras de domínio e banco | atual | autoritativo |

## Itens NÃO VERIFICADOS (motivo)

1. Estado real do banco de produção (tabelas/colunas/RLS/crons) — sem MCP do projeto; docs/contexto/supabase/ nunca foi gerado.
2. Deploy atual da edge mcp-query — v2 JWT deployada e validada em 2026-11-20; rotação de JWT_SECRET no painel é pendência aberta.
3. Status das 20 vulns de npm — PR #91 resolveu 14; restam web-vitals, vite (major), dompurify, source-map-js e outras.
