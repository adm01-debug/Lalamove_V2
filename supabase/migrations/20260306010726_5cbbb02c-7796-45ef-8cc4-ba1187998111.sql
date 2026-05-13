
-- Create error_logs table for runtime error monitoring
CREATE TABLE public.runtime_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_id text NOT NULL,
  error_name text NOT NULL,
  error_message text NOT NULL,
  stack_trace text,
  component_stack text,
  source text NOT NULL DEFAULT 'unknown',
  severity text NOT NULL DEFAULT 'error',
  url text,
  user_agent text,
  user_id uuid,
  app_version text,
  fingerprint text,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast fingerprint lookups (deduplication)
CREATE INDEX idx_runtime_error_logs_fingerprint ON public.runtime_error_logs(fingerprint);
CREATE INDEX idx_runtime_error_logs_created_at ON public.runtime_error_logs(created_at DESC);
CREATE INDEX idx_runtime_error_logs_severity ON public.runtime_error_logs(severity);
CREATE INDEX idx_runtime_error_logs_resolved ON public.runtime_error_logs(resolved);

-- Enable RLS
ALTER TABLE public.runtime_error_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and managers can view error logs
CREATE POLICY "Admins managers can view error logs"
ON public.runtime_error_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Any authenticated user can insert (errors happen for everyone)
CREATE POLICY "Authenticated can insert error logs"
ON public.runtime_error_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anon insert too (errors before login)
CREATE POLICY "Anon can insert error logs"
ON public.runtime_error_logs
FOR INSERT
TO anon
WITH CHECK (true);

-- Admins can update (resolve errors)
CREATE POLICY "Admins can update error logs"
ON public.runtime_error_logs
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Admins can delete old error logs
CREATE POLICY "Admins can delete error logs"
ON public.runtime_error_logs
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for error monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.runtime_error_logs;
