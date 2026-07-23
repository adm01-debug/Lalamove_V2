-- Índices compostos para auditoria em auth_logs.
-- O índice em (created_at DESC) e (user_id) já existem; adicionamos composites
-- para acelerar drill-down por usuário e por tipo de evento na timeline.

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_created
  ON public.auth_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_logs_event_created
  ON public.auth_logs (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_logs_failures
  ON public.auth_logs (created_at DESC)
  WHERE success = false;