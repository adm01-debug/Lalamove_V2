-- Tabela de logs do sistema
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX system_logs_level_idx ON system_logs(level);
CREATE INDEX system_logs_source_idx ON system_logs(source);
CREATE INDEX system_logs_created_at_idx ON system_logs(created_at DESC);

-- RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_logs_select" ON system_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "system_logs_insert" ON system_logs
  FOR INSERT WITH CHECK (true);

-- Função de limpeza
CREATE OR REPLACE FUNCTION cleanup_old_system_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM system_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE system_logs IS 'Logs estruturados do sistema';
