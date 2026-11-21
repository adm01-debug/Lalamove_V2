-- Fix: query_telemetry - INSERT reflete o gate real de diagnostico (can_run_db_diagnostics).
--
-- Contexto: a edge `mcp-query` autoriza via can_run_db_diagnostics (papel admin
-- OU grant ativo em mcp_diagnostics_grants). A policy INSERT de query_telemetry
-- exigia apenas admin/manager/operator, entao um usuario com APENAS grant de
-- diagnostico executava a operacao mas o INSERT fire-and-forget de telemetria era
-- barrado pelo RLS (auditoria incompleta).
--
-- Fix: alinhar a policy INSERT ao mesmo gate da edge, acrescentando
-- can_run_db_diagnostics(auth.uid()). Nao altera SELECT (admin/manager).
-- Idempotente e reversivel (DROP POLICY + recriar).
--
-- Validado em producao (2026-11-20): usuario grant-only executa list_tables via
-- edge (HTTP 200, 64 tabelas) e o INSERT de telemetria agora persiste (2 rows,
-- incluindo a chamada real com record_count=64, duration_ms=284).

DROP POLICY IF EXISTS "System can insert telemetry" ON public.query_telemetry;

CREATE POLICY "System can insert telemetry"
  ON public.query_telemetry FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'operator'::app_role) OR
    public.can_run_db_diagnostics(auth.uid())
  );