-- ============================================
-- PARTE 2: CAMPOS ADICIONAIS EM TABELAS EXISTENTES
-- ============================================

-- LALAMOVE_ORDERS - Campos de integração Bitrix24 e operacionais
ALTER TABLE public.lalamove_orders 
ADD COLUMN IF NOT EXISTS bitrix24_deal_id INTEGER,
ADD COLUMN IF NOT EXISTS cost_center TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS internal_status TEXT,
ADD COLUMN IF NOT EXISTS share_link TEXT,
ADD COLUMN IF NOT EXISTS distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS custom_rating NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- LALAMOVE_STOPS - Campos de POD (Proof of Delivery)
ALTER TABLE public.lalamove_stops 
ADD COLUMN IF NOT EXISTS pod_status TEXT DEFAULT 'NOT_REQUIRED',
ADD COLUMN IF NOT EXISTS pod_image_url TEXT,
ADD COLUMN IF NOT EXISTS pod_delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- LALAMOVE_STATUS_HISTORY - Campos de auditoria
ALTER TABLE public.lalamove_status_history 
ADD COLUMN IF NOT EXISTS old_status TEXT,
ADD COLUMN IF NOT EXISTS changed_by TEXT DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- ACTIVE_TRACKING - Campos de rota esperada e status
ALTER TABLE public.active_tracking 
ADD COLUMN IF NOT EXISTS expected_route JSONB,
ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS tracking_ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS alerts_sent JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS origin_lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS origin_lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS destination_lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS destination_lng NUMERIC(10, 7);

-- DRIVERS - Campos de avaliação externa e whitelist/blacklist separados
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS external_rating NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS external_total_deliveries INTEGER,
ADD COLUMN IF NOT EXISTS external_success_rate NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS risk_reasons JSONB,
ADD COLUMN IF NOT EXISTS risk_level TEXT,
ADD COLUMN IF NOT EXISTS whitelisted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blacklisted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blacklist_reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;

-- DRIVER_INCIDENTS - Campos de resolução e evidências
ALTER TABLE public.driver_incidents 
ADD COLUMN IF NOT EXISTS evidence_urls TEXT[],
ADD COLUMN IF NOT EXISTS reported_by TEXT,
ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- DRIVER_APPROVAL_QUEUE - Campos de prioridade e decisão
ALTER TABLE public.driver_approval_queue 
ADD COLUMN IF NOT EXISTS driver_name TEXT,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS decision_notes TEXT;

-- ALERT_CONFIGURATIONS - Campos de throttling e múltiplos canais
ALTER TABLE public.alert_configurations 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS message_template TEXT,
ADD COLUMN IF NOT EXISTS min_interval_seconds INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_numbers TEXT[],
ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_addresses TEXT[],
ADD COLUMN IF NOT EXISTS notify_slack BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS slack_channels TEXT[],
ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sms_numbers TEXT[],
ADD COLUMN IF NOT EXISTS notify_bitrix24_task BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bitrix24_user_ids INTEGER[],
ADD COLUMN IF NOT EXISTS notify_n8n_webhook BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS conditions JSONB,
ADD COLUMN IF NOT EXISTS created_by TEXT;

-- ALERTS_SENT - Campos de retry e entrega
ALTER TABLE public.alerts_sent 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- ============================================
-- ÍNDICES ADICIONAIS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_bitrix24 ON public.lalamove_orders(bitrix24_deal_id) WHERE bitrix24_deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_urgent ON public.lalamove_orders(is_urgent) WHERE is_urgent = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_cost_center ON public.lalamove_orders(cost_center) WHERE cost_center IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stops_pod_status ON public.lalamove_stops(pod_status) WHERE pod_status != 'NOT_REQUIRED';

CREATE INDEX IF NOT EXISTS idx_tracking_status_active ON public.active_tracking(tracking_status) WHERE tracking_status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_drivers_risk_level ON public.drivers(risk_level) WHERE risk_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drivers_whitelisted ON public.drivers(whitelisted) WHERE whitelisted = TRUE;
CREATE INDEX IF NOT EXISTS idx_drivers_blacklisted ON public.drivers(blacklisted) WHERE blacklisted = TRUE;

CREATE INDEX IF NOT EXISTS idx_incidents_resolved ON public.driver_incidents(resolved) WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_approval_priority ON public.driver_approval_queue(priority DESC);

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON COLUMN public.lalamove_orders.bitrix24_deal_id IS 'ID do deal no Bitrix24 para integração';
COMMENT ON COLUMN public.lalamove_orders.is_urgent IS 'Indica se o pedido é urgente/prioritário';
COMMENT ON COLUMN public.lalamove_stops.pod_status IS 'Status do comprovante de entrega: NOT_REQUIRED, PENDING, COMPLETED, FAILED';
COMMENT ON COLUMN public.drivers.risk_level IS 'Nível de risco calculado: LOW, MEDIUM, HIGH, CRITICAL';
COMMENT ON COLUMN public.alert_configurations.min_interval_seconds IS 'Intervalo mínimo entre alertas do mesmo tipo (throttling)';