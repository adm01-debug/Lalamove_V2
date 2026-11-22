-- Fecha RPC SECURITY DEFINER executável por anon (achado do audit de 22/11/2026, aprovado pelo dono):
-- geo_usage_increment, geo_budget_status, geo_emit_event, geo_audit_config, geo_evaluate_tracking
-- tinham EXECUTE para anon (e para PUBLIC, que cascata para anon/authenticated) via PostgREST RPC,
-- permitindo chamador não autenticado forjar contadores de uso/orçamento e emitir alertas falsos de
-- pedido/motorista (geo_emit_event). authenticated mantém geo_budget_status (painel admin,
-- src/hooks/useGeoAdmin.ts); os outros não têm chamador em authenticated nem anon no código.
--
-- Aplicada diretamente em produção via MCP (apply_migration) em 2026-11-22, registrada no ledger
-- como versão 20261122110913 -- este arquivo foi renomeado para bater com essa versão e não duplicar
-- o drift relatado no audit (git x supabase_migrations.schema_migrations).

revoke execute on function public.geo_audit_config() from public, anon, authenticated;
revoke execute on function public.geo_budget_status() from public, anon;
revoke execute on function public.geo_emit_event(uuid, uuid, alert_type, integer, numeric, numeric, numeric, integer, text, text, boolean, jsonb) from anon;
revoke execute on function public.geo_evaluate_tracking() from public, anon, authenticated;
revoke execute on function public.geo_usage_increment(text, text, text, integer) from public, anon, authenticated;
