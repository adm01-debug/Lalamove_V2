
CREATE TABLE public.query_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL DEFAULT 'select',
  table_name text,
  rpc_name text,
  duration_ms integer NOT NULL DEFAULT 0,
  record_count integer,
  query_limit integer,
  query_offset integer,
  count_mode text,
  severity text NOT NULL DEFAULT 'normal',
  error_message text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_query_telemetry_created_at ON public.query_telemetry (created_at DESC);
CREATE INDEX idx_query_telemetry_severity ON public.query_telemetry (severity);

ALTER TABLE public.query_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage telemetry"
  ON public.query_telemetry FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view telemetry"
  ON public.query_telemetry FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "System can insert telemetry"
  ON public.query_telemetry FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'operator'::app_role)
  );
