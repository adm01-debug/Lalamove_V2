# Lints de segurança e performance

Verificações objetivas feitas no catálogo. Um agente deve ler isto antes de propor mudanças em RLS, functions ou índices.

| severidade | código | objeto | detalhe |
|---|---|---|---|
| ALTA | view_security_definer | public.cache_status | View em public sem security_invoker: executa como owner e ignora RLS das tabelas base. |
| MÉDIA | rls_no_policies | public.geo_cache | RLS ligado sem policies: inacessível via API (só service_role). |
| MÉDIA | rls_no_policies | public.lalamove_uapi_statement_item | RLS ligado sem policies: inacessível via API (só service_role). |
| INFO | rpc_anon_executable | public.check_login_lockout_v2(p_email text, p_ip_address inet) | SECURITY DEFINER chamável via RPC por anon (sem login): roda com privilégios do owner. Confirme que é intencional (Supabase dá EXECUTE a anon por padrão; revogue se não for API pública). |
| INFO | rpc_anon_executable | public.record_failed_login_v2(p_email text, p_ip_address inet, p_user_agent text) | SECURITY DEFINER chamável via RPC por anon (sem login): roda com privilégios do owner. Confirme que é intencional (Supabase dá EXECUTE a anon por padrão; revogue se não for API pública). |
