# P-01 · RLS de query_telemetry grant-only (PR #92)

**Status:** CONCLUÍDO (2026-11-21)
**PR:** #92 (claude/fix-telemetria-grant-only-261120-1805) — MERGEADA squash `41ba75b`
**Origem:** teste e2e do mcp-query — quem tem só grant não loga auditoria

## Problema
A tabela query_telemetry registra auditoria de queries do mcp-query. A PR #92 altera o INSERT para exigir can_run_db_diagnostics (grant-only), fechando a lacuna onde um holder de grant não loga telemetria.

## Impacto no negócio
- Auditoria incompleta: ações de diagnóstico via edge mcp-query não ficam rastreadas.
- Sem merge, o risco de uso não auditado permanece.

## Resolução (2026-11-21)
- PR #92 mergeada em main (squash `41ba75b`), branch deletada.
- CI pós-merge no main: 9/9 jobs SUCCESS, incluindo o crítico `Deno Edge Function I/O Integration Tests`.
- Deploy de produção Vercel: READY no sha `41ba75b` (lalamove-v2.vercel.app HTTP 200).
- Migration aplicada: supabase/migrations/20261120180500_fix_telemetria_grant_only.sql.

## Validação
- CI PR #92: verde (jobs lint-and-typecheck, test, e2e, build, security, contract, edge-integration).
- Migration: supabase/migrations/20261120180500_fix_telemetria_grant_only.sql.
- Pós-merge: run 44899361523 no main = 9/9 SUCCESS; deploy de produção READY.
