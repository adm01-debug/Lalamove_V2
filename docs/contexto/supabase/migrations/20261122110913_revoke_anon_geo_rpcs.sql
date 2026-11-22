revoke execute on function public.geo_audit_config() from public, anon, authenticated;
revoke execute on function public.geo_budget_status() from public, anon;
revoke execute on function public.geo_emit_event(uuid, uuid, alert_type, integer, numeric, numeric, numeric, integer, text, text, boolean, jsonb) from anon;
revoke execute on function public.geo_evaluate_tracking() from public, anon, authenticated;
revoke execute on function public.geo_usage_increment(text, text, text, integer) from public, anon, authenticated;
