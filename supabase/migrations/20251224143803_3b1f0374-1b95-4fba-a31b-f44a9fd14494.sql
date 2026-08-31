-- =============================================
-- ENUMS para o sistema de entregas Lalamove
-- =============================================

-- Status do pedido
CREATE TYPE public.order_status AS ENUM (
  'PENDING',
  'MATCHED',
  'ON_GOING',
  'PICKED_UP',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED'
);

-- Tipo de veículo
CREATE TYPE public.vehicle_type AS ENUM (
  'MOTORCYCLE',
  'CAR',
  'VAN',
  'TRUCK'
);

-- Status do motorista
CREATE TYPE public.driver_status AS ENUM (
  'APPROVED',
  'PENDING_APPROVAL',
  'BLOCKED',
  'WHITELIST',
  'BLACKLIST'
);

-- Tipo de incidente
CREATE TYPE public.incident_type AS ENUM (
  'ROUTE_DEVIATION',
  'LONG_STOP',
  'LATE_DELIVERY',
  'CUSTOMER_COMPLAINT',
  'DAMAGE',
  'OTHER'
);

-- Severidade do incidente
CREATE TYPE public.incident_severity AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- Tipo de alerta
CREATE TYPE public.alert_type AS ENUM (
  'DRIVER_BLOCKED',
  'ROUTE_DEVIATION',
  'DRIVER_STOPPED',
  'LATE_DELIVERY',
  'APPROVAL_REQUIRED',
  'ORDER_CANCELLED'
);

-- Severidade do alerta
CREATE TYPE public.alert_severity AS ENUM (
  'INFO',
  'WARNING',
  'CRITICAL'
);

-- Status de aprovação
CREATE TYPE public.approval_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

-- =============================================
-- TABELA: drivers (Motoristas)
-- =============================================
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lalamove_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'MOTORCYCLE',
  vehicle_plate TEXT,
  risk_score DECIMAL(3,1) DEFAULT 5.0 CHECK (risk_score >= 0 AND risk_score <= 10),
  status public.driver_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  total_deliveries INTEGER DEFAULT 0,
  completed_deliveries INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: lalamove_orders (Pedidos Lalamove)
-- =============================================
CREATE TABLE public.lalamove_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lalamove_id TEXT UNIQUE NOT NULL,
  internal_order_id TEXT,
  status public.order_status NOT NULL DEFAULT 'PENDING',
  pickup_address TEXT NOT NULL,
  pickup_latitude DECIMAL(10,8),
  pickup_longitude DECIMAL(11,8),
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'MOTORCYCLE',
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  tags TEXT[] DEFAULT '{}',
  quotation_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: lalamove_stops (Paradas dos pedidos)
-- =============================================
CREATE TABLE public.lalamove_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE CASCADE NOT NULL,
  stop_index INTEGER NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  contact_name TEXT,
  contact_phone TEXT,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: lalamove_status_history (Histórico de status)
-- =============================================
CREATE TABLE public.lalamove_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE CASCADE NOT NULL,
  status public.order_status NOT NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: driver_incidents (Incidentes de motoristas)
-- =============================================
CREATE TABLE public.driver_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE SET NULL,
  type public.incident_type NOT NULL,
  severity public.incident_severity NOT NULL DEFAULT 'LOW',
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: driver_approval_queue (Fila de aprovação)
-- =============================================
CREATE TABLE public.driver_approval_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE CASCADE NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'PENDING',
  risk_score DECIMAL(3,1) NOT NULL,
  risk_factors TEXT[] DEFAULT '{}',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  notes TEXT
);

-- =============================================
-- TABELA: active_tracking (Rastreamento ativo)
-- =============================================
CREATE TABLE public.active_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  current_latitude DECIMAL(10,8) NOT NULL,
  current_longitude DECIMAL(11,8) NOT NULL,
  heading DECIMAL(5,2) DEFAULT 0,
  speed DECIMAL(6,2) DEFAULT 0,
  is_on_route BOOLEAN DEFAULT true,
  is_stopped BOOLEAN DEFAULT false,
  stopped_since TIMESTAMPTZ,
  eta_minutes INTEGER,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: tracking_events (Eventos de rastreamento)
-- =============================================
CREATE TABLE public.tracking_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  heading DECIMAL(5,2),
  speed DECIMAL(6,2),
  event_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: alerts (Alertas)
-- =============================================
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.alert_type NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'INFO',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: alerts_sent (Histórico de alertas enviados)
-- =============================================
CREATE TABLE public.alerts_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL, -- 'whatsapp', 'email', 'slack', 'sms', 'push'
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELA: alert_configurations (Configurações de alertas)
-- =============================================
CREATE TABLE public.alert_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type public.alert_type NOT NULL,
  channel TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  recipients TEXT[] DEFAULT '{}',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(alert_type, channel)
);

-- =============================================
-- INDEXES para melhor performance
-- =============================================
CREATE INDEX idx_orders_status ON public.lalamove_orders(status);
CREATE INDEX idx_orders_driver ON public.lalamove_orders(driver_id);
CREATE INDEX idx_orders_created ON public.lalamove_orders(created_at DESC);
CREATE INDEX idx_orders_lalamove_id ON public.lalamove_orders(lalamove_id);

CREATE INDEX idx_drivers_status ON public.drivers(status);
CREATE INDEX idx_drivers_risk_score ON public.drivers(risk_score);
CREATE INDEX idx_drivers_lalamove_id ON public.drivers(lalamove_id);

CREATE INDEX idx_incidents_driver ON public.driver_incidents(driver_id);
CREATE INDEX idx_incidents_type ON public.driver_incidents(type);

CREATE INDEX idx_approvals_status ON public.driver_approval_queue(status);
CREATE INDEX idx_approvals_driver ON public.driver_approval_queue(driver_id);

CREATE INDEX idx_tracking_order ON public.active_tracking(order_id);
CREATE INDEX idx_tracking_events_order ON public.tracking_events(order_id);
CREATE INDEX idx_tracking_events_created ON public.tracking_events(created_at DESC);

CREATE INDEX idx_alerts_type ON public.alerts(type);
CREATE INDEX idx_alerts_severity ON public.alerts(severity);
CREATE INDEX idx_alerts_unread ON public.alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_alerts_created ON public.alerts(created_at DESC);

-- =============================================
-- TRIGGERS para updated_at automático
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.lalamove_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alert_config_updated_at
  BEFORE UPDATE ON public.alert_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lalamove_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lalamove_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lalamove_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_configurations ENABLE ROW LEVEL SECURITY;

-- Políticas para leitura pública (sistema interno - todas as tabelas visíveis para usuários autenticados)
CREATE POLICY "Authenticated users can view drivers"
  ON public.drivers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view orders"
  ON public.lalamove_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view stops"
  ON public.lalamove_stops FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view status history"
  ON public.lalamove_status_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view incidents"
  ON public.driver_incidents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view approvals"
  ON public.driver_approval_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view tracking"
  ON public.active_tracking FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view tracking events"
  ON public.tracking_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view alerts"
  ON public.alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view alerts sent"
  ON public.alerts_sent FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view alert configs"
  ON public.alert_configurations FOR SELECT TO authenticated USING (true);

-- Políticas para operações de escrita (usuários autenticados podem modificar)
CREATE POLICY "Authenticated users can insert drivers"
  ON public.drivers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update drivers"
  ON public.drivers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert orders"
  ON public.lalamove_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
  ON public.lalamove_orders FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert stops"
  ON public.lalamove_stops FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert status history"
  ON public.lalamove_status_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert incidents"
  ON public.driver_incidents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can manage approvals"
  ON public.driver_approval_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage tracking"
  ON public.active_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert tracking events"
  ON public.tracking_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can manage alerts"
  ON public.alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage alerts sent"
  ON public.alerts_sent FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage alert configs"
  ON public.alert_configurations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas para service role (Edge Functions)
CREATE POLICY "Service role has full access to drivers"
  ON public.drivers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to orders"
  ON public.lalamove_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to stops"
  ON public.lalamove_stops FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to status history"
  ON public.lalamove_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to incidents"
  ON public.driver_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to approvals"
  ON public.driver_approval_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to tracking"
  ON public.active_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to tracking events"
  ON public.tracking_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to alerts"
  ON public.alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to alerts sent"
  ON public.alerts_sent FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to alert configs"
  ON public.alert_configurations FOR ALL TO service_role USING (true) WITH CHECK (true);