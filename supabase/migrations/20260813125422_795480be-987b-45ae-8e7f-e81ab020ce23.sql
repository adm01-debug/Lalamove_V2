CREATE TABLE public.mcp_diagnostics_grants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  purpose text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_diagnostics_grants TO authenticated;
GRANT ALL ON public.mcp_diagnostics_grants TO service_role;

ALTER TABLE public.mcp_diagnostics_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage diagnostics grants"
  ON public.mcp_diagnostics_grants
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_mcp_diagnostics_grants_updated_at
  BEFORE UPDATE ON public.mcp_diagnostics_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Verificador de capacidade: admin OU conta de serviço explicitamente concedida.
CREATE OR REPLACE FUNCTION public.can_run_db_diagnostics(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND _user_id = auth.uid()
     AND (
       public.has_role(_user_id, 'admin')
       OR EXISTS (
         SELECT 1 FROM public.mcp_diagnostics_grants g
         WHERE g.user_id = _user_id AND g.is_active = true
       )
     );
$$;

REVOKE ALL ON FUNCTION public.can_run_db_diagnostics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_run_db_diagnostics(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_run_db_diagnostics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_run_db_diagnostics(uuid) TO service_role;

-- Troca o guard de mcp_introspect: admin OU grant de diagnóstico.
CREATE OR REPLACE FUNCTION public.mcp_introspect(p_operation text, p_params jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_schema text := COALESCE(NULLIF(p_params->>'schema',''), 'public');
  v_table  text := NULLIF(p_params->>'table','');
  v_column text := NULLIF(p_params->>'column','');
  v_filter text := NULLIF(p_params->>'filter','');
  v_limit  int  := LEAST(GREATEST(COALESCE((p_params->>'limit')::int, 20), 1), 200);
  v_result jsonb;
BEGIN
  IF NOT public.can_run_db_diagnostics(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: requer papel admin ou concessão de diagnóstico'
      USING ERRCODE = '42501';
  END IF;

  IF v_schema NOT IN ('public') THEN
    RAISE EXCEPTION 'Schema não permitido: %', v_schema USING ERRCODE = '42501';
  END IF;

  IF p_operation = 'connection_info' THEN
    SELECT jsonb_build_object(
      'database', current_database(),
      'pg_version', current_setting('server_version'),
      'server_time', now()
    ) INTO v_result;

  ELSIF p_operation = 'list_tables' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = v_schema AND c.relkind IN ('r','p')
      ORDER BY c.relname LIMIT 500) t;

  ELSIF p_operation = 'list_columns' THEN
    IF v_table IS NULL THEN RAISE EXCEPTION 'Parâmetro "table" obrigatório'; END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT column_name, data_type, is_nullable, column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = v_schema AND table_name = v_table
      ORDER BY ordinal_position) t;

  ELSIF p_operation = 'list_views' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT table_name, view_definition FROM information_schema.views
      WHERE table_schema = v_schema ORDER BY table_name) t;

  ELSIF p_operation = 'list_enums' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT ty.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
      FROM pg_type ty JOIN pg_enum e ON ty.oid = e.enumtypid
      JOIN pg_namespace n ON ty.typnamespace = n.oid
      WHERE n.nspname = v_schema GROUP BY ty.typname ORDER BY ty.typname) t;

  ELSIF p_operation = 'list_extensions' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT extname AS name, extversion AS version FROM pg_extension ORDER BY extname) t;

  ELSIF p_operation = 'list_indexes' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT i.relname AS index_name, tbl.relname AS table_name,
             ix.indisunique AS is_unique, pg_get_indexdef(i.oid) AS definition
      FROM pg_class tbl
      JOIN pg_index ix ON tbl.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      WHERE ns.nspname = v_schema AND (v_table IS NULL OR tbl.relname = v_table)
      ORDER BY tbl.relname, i.relname LIMIT 300) t;

  ELSIF p_operation = 'list_functions' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT p.proname AS name,
             CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
             pg_get_function_result(p.oid) AS return_type
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = v_schema ORDER BY p.proname LIMIT 300) t;

  ELSIF p_operation = 'list_triggers' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT trigger_name, event_object_table, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = v_schema AND (v_table IS NULL OR event_object_table = v_table)
      ORDER BY event_object_table, trigger_name LIMIT 200) t;

  ELSIF p_operation = 'list_policies' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = v_schema AND (v_table IS NULL OR tablename = v_table)
      ORDER BY tablename, policyname LIMIT 300) t;

  ELSIF p_operation = 'constraints' THEN
    IF v_table IS NULL THEN RAISE EXCEPTION 'Parâmetro "table" obrigatório'; END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT constraint_name, constraint_type, table_name
      FROM information_schema.table_constraints
      WHERE table_schema = v_schema AND table_name = v_table
      ORDER BY constraint_type, constraint_name) t;

  ELSIF p_operation = 'relationships' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT kcu.table_name AS from_table, kcu.column_name AS from_col,
             ccu.table_name AS to_table, ccu.column_name AS to_col
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = v_schema
      ORDER BY kcu.table_name LIMIT 300) t;

  ELSIF p_operation = 'sequences' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT sequence_name, start_value, minimum_value, maximum_value, increment
      FROM information_schema.sequences
      WHERE sequence_schema = v_schema ORDER BY sequence_name) t;

  ELSIF p_operation = 'migrations' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT version, name FROM supabase_migrations.schema_migrations
      ORDER BY version DESC LIMIT 50) t;

  ELSIF p_operation = 'db_stats' THEN
    SELECT jsonb_build_object(
      'db_size', pg_size_pretty(pg_database_size(current_database())),
      'connections', (SELECT count(*) FROM pg_stat_activity),
      'cache_hit_pct', (SELECT round(sum(blks_hit)*100.0/NULLIF(sum(blks_hit+blks_read),0),2)
                          FROM pg_stat_database WHERE datname = current_database()),
      'checked_at', now()
    ) INTO v_result;

  ELSIF p_operation = 'active_queries' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT pid, state, wait_event_type, wait_event, query_start,
             (now() - query_start) AS duration
      FROM pg_stat_activity
      WHERE state <> 'idle' AND datname = current_database()
      ORDER BY (now() - query_start) DESC NULLS LAST LIMIT 20) t;

  ELSIF p_operation = 'slow_queries' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT query, calls, round(mean_exec_time::numeric,2) AS avg_ms,
             round(max_exec_time::numeric,2) AS max_ms, rows
      FROM extensions.pg_stat_statements
      WHERE query NOT LIKE '%pg_stat%'
      ORDER BY mean_exec_time DESC LIMIT v_limit) t;

  ELSIF p_operation = 'locks' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT l.pid, l.locktype, l.relation::regclass::text AS table_name, l.mode, l.granted
      FROM pg_locks l WHERE l.relation IS NOT NULL
      ORDER BY l.granted, table_name LIMIT 100) t;

  ELSIF p_operation = 'disk_usage' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT relname AS table_name,
             pg_size_pretty(pg_total_relation_size(relid)) AS total,
             pg_size_pretty(pg_relation_size(relid)) AS data
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC LIMIT v_limit) t;

  ELSIF p_operation = 'table_bloat' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT schemaname, relname AS table_name, n_dead_tup AS dead_tuples,
             last_autovacuum, last_autoanalyze
      FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT v_limit) t;

  ELSIF p_operation = 'index_usage' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT relname AS table_name, indexrelname AS index_name, idx_scan AS scans,
             pg_size_pretty(pg_relation_size(indexrelid)) AS size
      FROM pg_stat_user_indexes
      WHERE (v_table IS NULL OR relname = v_table)
      ORDER BY idx_scan DESC LIMIT 100) t;

  ELSIF p_operation = 'seq_scans' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT schemaname, relname AS table_name, seq_scan, idx_scan, n_live_tup
      FROM pg_stat_user_tables WHERE seq_scan > 0
      ORDER BY seq_scan DESC LIMIT v_limit) t;

  ELSIF p_operation = 'duplicate_indexes' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT indrelid::regclass::text AS table_name,
             array_agg(indexrelid::regclass::text) AS indexes
      FROM pg_index GROUP BY indrelid, indkey HAVING count(*) > 1 LIMIT 50) t;

  ELSIF p_operation = 'column_stats' THEN
    IF v_table IS NULL OR v_column IS NULL THEN
      RAISE EXCEPTION 'Parâmetros "table" e "column" obrigatórios';
    END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT attname AS column_name, n_distinct, correlation, null_frac
      FROM pg_stats
      WHERE schemaname = v_schema AND tablename = v_table AND attname = v_column) t;

  ELSIF p_operation = 'pg_settings' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_result FROM (
      SELECT name, setting, unit, category, short_desc
      FROM pg_settings
      WHERE (v_filter IS NULL OR name LIKE '%' || v_filter || '%')
      ORDER BY name LIMIT 100) t;

  ELSE
    RAISE EXCEPTION 'Operação não permitida: %', p_operation USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;