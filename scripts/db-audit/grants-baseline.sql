-- Regenera scripts/db-audit/grants-baseline.json a partir do banco de destino.
-- Uso:
--   psql "$DESTINO_URL" -X -v ON_ERROR_STOP=1 -At \
--     -f scripts/db-audit/grants-baseline.sql > scripts/db-audit/grants-baseline.json
--
-- Snapshot de EXECUTE por role para toda funcao publica, mais SELECT de `anon`
-- em toda tabela/view publica. Serve de baseline diffavel: detecta qualquer
-- novo GRANT a anon/authenticated introduzido sem migration explicita, e
-- qualquer REVOKE aplicado antes do codigo (que derruba login/tela em
-- producao). Neste repo ha migration de endurecimento de ACL
-- (20260902000000_harden_revoke_anon_grants.sql), o que torna o baseline mais
-- util ainda: ele prova que o REVOKE continua valendo.
SELECT jsonb_pretty(jsonb_build_object(
  'generated_at', to_char(now(), 'YYYY-MM-DD'),
  'how_to_regenerate', 'scripts/db-audit/grants-baseline.sql',
  'note', 'Regenerar apos qualquer GRANT/REVOKE e revisar o diff antes de commitar.',
  'anon_execute', (
    -- ORDER BY posicional nao funciona dentro de agregacao (ordenava pela
    -- constante 1 = ordem indefinida); a expressao explicita torna o array
    -- deterministico entre regeneracoes (E10/gate de paridade tripla).
    SELECT coalesce(jsonb_agg(format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) ORDER BY format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid))), '[]'::jsonb)
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'authenticated_execute_count', (
    SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'service_role_execute_count', (
    SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'anon_table_select', (
    SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m')
      AND has_table_privilege('anon', c.oid, 'SELECT')
  )
));
