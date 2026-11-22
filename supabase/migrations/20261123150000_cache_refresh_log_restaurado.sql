-- Restaura o log de refresh de cache que existia em 20250102000002 e foi
-- silenciosamente perdido na 20261122090000 (PR #106).
--
-- Contexto: a 20250102000002 criava `cache_refresh_log` e uma `refresh_cache_view`
-- que gravava inicio/fim/duracao/erro de cada refresh. A 20261122090000 recriou a
-- funcao com CREATE OR REPLACE para adaptar as materialized views ao schema vivo,
-- mas nao recriou a tabela nem o logging — entao `cache_refresh_log` nunca passou a
-- existir em producao (confirmado por information_schema) e o historico de refreshes,
-- que a tela /cache-monitoring usava, ficou sem fonte.
--
-- Decisao de schema: a `unique_running_refresh UNIQUE (view_name, status)` do arquivo
-- original estava errada — ela impede mais de uma linha de `success` por view, logo o
-- SEGUNDO refresh bem-sucedido estourava 23505. Aqui o indice e parcial, so sobre
-- `running`, que e a intencao real: no maximo um refresh em andamento por view.

CREATE TABLE IF NOT EXISTS public.cache_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_name TEXT NOT NULL,
  refresh_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refresh_completed_at TIMESTAMPTZ,
  refresh_duration_ms INTEGER,
  row_count BIGINT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  error_message TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'system'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_refresh_log_running
  ON public.cache_refresh_log (view_name) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_cache_refresh_log_view
  ON public.cache_refresh_log (view_name, refresh_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_refresh_log_status
  ON public.cache_refresh_log (status, refresh_started_at DESC);

ALTER TABLE public.cache_refresh_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'cache_refresh_log'
       AND policyname = 'Admins read cache refresh log'
  ) THEN
    CREATE POLICY "Admins read cache refresh log" ON public.cache_refresh_log
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

GRANT SELECT ON public.cache_refresh_log TO authenticated;
GRANT ALL ON public.cache_refresh_log TO service_role;

-- Remove a sobrecarga de 1 argumento para que `refresh_cache_view()` continue
-- resolvendo sem ambiguidade e a versao com `p_triggered_by` a substitua.
DROP FUNCTION IF EXISTS public.refresh_cache_view(text);

CREATE OR REPLACE FUNCTION public.refresh_cache_view(
  p_view_name text DEFAULT NULL,
  p_triggered_by text DEFAULT 'system'
)
RETURNS TABLE(view_refreshed text, duration_ms integer, row_count bigint, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name TEXT;
  v_start TIMESTAMPTZ;
  v_dur INTEGER;
  v_count BIGINT;
  v_log_id UUID;
BEGIN
  IF p_view_name IS NULL THEN
    FOR v_name IN SELECT unnest(ARRAY['driver_stats_cache','delivery_metrics_cache','hourly_metrics_cache'])
    LOOP
      RETURN QUERY SELECT * FROM public.refresh_cache_view(v_name, p_triggered_by);
    END LOOP;
    RETURN;
  END IF;

  IF p_view_name NOT IN ('driver_stats_cache','delivery_metrics_cache','hourly_metrics_cache') THEN
    RETURN QUERY SELECT p_view_name, NULL::INTEGER, NULL::BIGINT, 'failed'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.cache_refresh_log (view_name, status, triggered_by)
  VALUES (p_view_name, 'running', p_triggered_by)
  RETURNING id INTO v_log_id;

  v_start := clock_timestamp();
  BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', p_view_name);
    v_dur := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER;
    EXECUTE format('SELECT COUNT(*) FROM %I', p_view_name) INTO v_count;

    UPDATE public.cache_refresh_log
       SET refresh_completed_at = clock_timestamp(),
           refresh_duration_ms = v_dur,
           row_count = v_count,
           status = 'success'
     WHERE id = v_log_id;

    RETURN QUERY SELECT p_view_name, v_dur, v_count, 'success'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cache_refresh_log
       SET refresh_completed_at = clock_timestamp(),
           status = 'failed',
           error_message = SQLERRM
     WHERE id = v_log_id;
    RETURN QUERY SELECT p_view_name, NULL::INTEGER, NULL::BIGINT, 'failed'::TEXT;
  END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_cache_view(text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_cache_view(text, text) FROM PUBLIC;

COMMENT ON TABLE public.cache_refresh_log IS 'Historico de refresh das materialized views de cache (inicio, fim, duracao, erro).';
COMMENT ON FUNCTION public.refresh_cache_view(text, text) IS 'Atualiza uma materialized view de cache (ou todas) e registra em cache_refresh_log.';

-- Contagem ao vivo de uma das views de cache (usada pela cache_status como fallback).
CREATE OR REPLACE FUNCTION public.cache_view_count(p_view text)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count bigint;
BEGIN
  IF p_view NOT IN ('driver_stats_cache','delivery_metrics_cache','hourly_metrics_cache') THEN
    RETURN 0;
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', p_view) INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cache_view_count(text) TO authenticated, service_role;

-- A `cache_status` em producao devolve `refresh_duration_ms` como NULL fixo, entao a
-- tela /cache-monitoring renderiza "nullms" para toda view (e o `row_count` vem de um
-- COUNT direto na materialized view a cada consulta). Com o historico de volta, a view
-- passa a reportar duracao e `row_count` do ultimo refresh bem-sucedido e so cai no
-- COUNT ao vivo quando ainda nao ha registro (views recem-criadas).
CREATE OR REPLACE VIEW public.cache_status AS
SELECT
  v.view_name,
  CASE WHEN lr.refresh_completed_at IS NULL
       THEN public.cache_view_count(v.view_name)
       ELSE lr.row_count
  END AS row_count,
  lr.refresh_completed_at AS last_refresh,
  lr.refresh_duration_ms,
  (lr.refresh_completed_at IS NULL
    OR lr.refresh_completed_at < now() - interval '1 hour') AS is_stale,
  CASE
    WHEN lr.refresh_completed_at IS NULL THEN 'never_refreshed'
    WHEN lr.refresh_completed_at < now() - interval '1 hour' THEN 'stale'
    ELSE 'success'
  END AS status
FROM (VALUES
  ('driver_stats_cache'),
  ('delivery_metrics_cache'),
  ('hourly_metrics_cache')
) AS v(view_name)
LEFT JOIN LATERAL (
  SELECT c.refresh_completed_at, c.refresh_duration_ms, c.row_count
    FROM public.cache_refresh_log c
   WHERE c.view_name = v.view_name AND c.status = 'success'
   ORDER BY c.refresh_completed_at DESC
   LIMIT 1
) AS lr ON TRUE;
