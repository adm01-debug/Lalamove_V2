
DROP INDEX IF EXISTS public.idx_query_telemetry_severity;

CREATE INDEX IF NOT EXISTS idx_query_telemetry_severity_created
  ON public.query_telemetry (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_telemetry_table_created
  ON public.query_telemetry (table_name, created_at DESC)
  WHERE table_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_query_telemetry_rpc_created
  ON public.query_telemetry (rpc_name, created_at DESC)
  WHERE rpc_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_query_telemetry_slow
  ON public.query_telemetry (duration_ms DESC, created_at DESC)
  WHERE duration_ms >= 3000;

CREATE INDEX IF NOT EXISTS idx_query_telemetry_errors
  ON public.query_telemetry (created_at DESC)
  WHERE severity = 'error';
