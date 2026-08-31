-- ============================================
-- PARTE 1: NOVAS TABELAS
-- ============================================

-- Tabela de log de webhooks recebidos do Lalamove
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  lalamove_order_id TEXT,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de regras de risco configuráveis
CREATE TABLE public.risk_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  condition JSONB NOT NULL,
  score_impact NUMERIC(4, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de histórico detalhado de localizações do motorista
CREATE TABLE public.driver_locations (
  id BIGSERIAL PRIMARY KEY,
  tracking_id UUID NOT NULL REFERENCES public.active_tracking(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  speed_kmh NUMERIC(5, 2),
  heading_degrees INTEGER,
  accuracy_meters INTEGER,
  is_moving BOOLEAN DEFAULT TRUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA NOVAS TABELAS
-- ============================================

CREATE INDEX idx_webhooks_type ON public.webhook_events(event_type);
CREATE INDEX idx_webhooks_order ON public.webhook_events(lalamove_order_id);
CREATE INDEX idx_webhooks_received ON public.webhook_events(received_at DESC);
CREATE INDEX idx_webhooks_processed ON public.webhook_events(processed) WHERE processed = FALSE;

CREATE INDEX idx_risk_rules_active ON public.risk_rules(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_driver_locations_tracking ON public.driver_locations(tracking_id);
CREATE INDEX idx_driver_locations_recorded ON public.driver_locations(recorded_at DESC);

-- ============================================
-- RLS PARA NOVAS TABELAS
-- ============================================

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Webhook events - apenas leitura para autenticados, escrita via service role
CREATE POLICY "Authenticated users can view webhook events"
  ON public.webhook_events FOR SELECT
  USING (true);

CREATE POLICY "Service role has full access to webhook events"
  ON public.webhook_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- Risk rules - leitura para todos autenticados, escrita para admins (via service role)
CREATE POLICY "Authenticated users can view risk rules"
  ON public.risk_rules FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage risk rules"
  ON public.risk_rules FOR ALL
  USING (true)
  WITH CHECK (true);

-- Driver locations - leitura para autenticados, escrita via tracking system
CREATE POLICY "Authenticated users can view driver locations"
  ON public.driver_locations FOR SELECT
  USING (true);

CREATE POLICY "Service role has full access to driver locations"
  ON public.driver_locations FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TRIGGER PARA UPDATED_AT
-- ============================================

CREATE TRIGGER update_risk_rules_updated_at
  BEFORE UPDATE ON public.risk_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DADOS INICIAIS - REGRAS DE RISCO PADRÃO
-- ============================================

INSERT INTO public.risk_rules (name, description, condition, score_impact, is_active) VALUES
('Baixo número de entregas', 'Motorista com menos de 50 entregas', 
 '{"field": "total_deliveries", "operator": "<", "value": 50}'::jsonb, 2.0, TRUE),
 
('Avaliação baixa', 'Motorista com avaliação inferior a 4.0', 
 '{"field": "rating", "operator": "<", "value": 4.0}'::jsonb, 2.5, TRUE),
 
('Motorista novo', 'Motorista cadastrado há menos de 30 dias', 
 '{"field": "days_since_registration", "operator": "<", "value": 30}'::jsonb, 1.5, TRUE),
 
('Incidentes anteriores', 'Motorista com incidentes registrados', 
 '{"field": "incident_count", "operator": ">", "value": 0}'::jsonb, 3.0, TRUE),

('Taxa de conclusão baixa', 'Taxa de conclusão inferior a 90%', 
 '{"field": "completion_rate", "operator": "<", "value": 90}'::jsonb, 2.0, TRUE);

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE public.webhook_events IS 'Log completo de todos webhooks recebidos do Lalamove';
COMMENT ON TABLE public.risk_rules IS 'Regras configuráveis para cálculo de risk score dos motoristas';
COMMENT ON TABLE public.driver_locations IS 'Histórico detalhado de posições GPS dos motoristas';