-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX audit_log_user_id_idx ON audit_log(user_id);
CREATE INDEX audit_log_resource_idx ON audit_log(resource_type, resource_id);
CREATE INDEX audit_log_created_at_idx ON audit_log(created_at DESC);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Função helper
CREATE OR REPLACE FUNCTION create_audit_log(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_changes JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_log (
    user_id, action, resource_type, resource_id, changes
  ) VALUES (
    auth.uid(), p_action, p_resource_type, p_resource_id, p_changes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger exemplo para drivers
CREATE OR REPLACE FUNCTION audit_driver_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_audit_log(
    'driver.update',
    'driver',
    NEW.id,
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_drivers_trigger
  AFTER UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION audit_driver_changes();

COMMENT ON TABLE audit_log IS 'Registro de auditoria de ações';
