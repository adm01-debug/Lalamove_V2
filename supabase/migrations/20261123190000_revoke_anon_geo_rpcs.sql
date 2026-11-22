-- Fecha RPC SECURITY DEFINER executável por anon (achado do audit de 22/11/2026, aprovado pelo dono).
-- Reaplicado aqui, depois de `20261122130100_geo_foundation.sql` (quem cria as 5 funcoes), porque a
-- versao original (`20261122110913_revoke_anon_geo_rpcs.sql`) ficava ANTES na ordem de migrations e
-- quebrava banco novo (`supabase db reset`). Idempotente: REVOKE de privilegio ja ausente nao falha.
--
-- geo_usage_increment, geo_budget_status, geo_emit_event, geo_audit_config, geo_evaluate_tracking
-- tinham EXECUTE para anon (e para PUBLIC, que cascata para anon/authenticated) via PostgREST RPC,
-- permitindo chamador não autenticado forjar contadores de uso/orçamento e emitir alertas falsos de
-- pedido/motorista (geo_emit_event). authenticated mantém geo_budget_status (painel admin,
-- src/hooks/useGeoAdmin.ts); os outros não têm chamador em authenticated nem anon no código.
-- geo_evaluate_tracking é trigger (active_tracking -> order_geo_events), não chamada por RPC.

revoke execute on function public.geo_audit_config() from public, anon, authenticated;
revoke execute on function public.geo_budget_status() from public, anon;
revoke execute on function public.geo_emit_event(uuid, uuid, alert_type, integer, numeric, numeric, numeric, integer, text, text, boolean, jsonb) from anon;
revoke execute on function public.geo_evaluate_tracking() from public, anon, authenticated;
revoke execute on function public.geo_usage_increment(text, text, text, integer) from public, anon, authenticated;
