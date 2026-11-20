# P-01 · RLS de query_telemetry grant-only (PR #92)

**Status:** PR aberta aguardando merge (regra 8: DDL em produção)
**PR:** #92 (claude/fix-telemetria-grant-only-261120-1805)
**Origem:** teste e2e do mcp-query — quem tem só grant não loga auditoria

## Problema
A tabela query_telemetry registra auditoria de queries do mcp-query. A PR #92 altera o INSERT para exigir can_run_db_diagnostics (grant-only), fechando a lacuna onde um holder de grant não loga telemetria.

## Impacto no negócio
- Auditoria incompleta: ações de diagnóstico via edge mcp-query não ficam rastreadas.
- Sem merge, o risco de uso não auditado permanece.

## Decisão pendente do dono
- Merge da PR #92 (DDL produção, regra 8). CI está 100% verde (validado).

## Validação
- CI PR #92: verde (jobs lint-and-typecheck, test, e2e, build, security, contract, edge-integration).
- Migration: supabase/migrations/20261120180500_fix_telemetria_grant_only.sql.
