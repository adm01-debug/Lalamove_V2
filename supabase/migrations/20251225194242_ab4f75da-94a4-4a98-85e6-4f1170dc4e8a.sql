-- Criar enum para outcome de entrega
CREATE TYPE delivery_outcome AS ENUM (
  'SUCCESS',
  'FAILED', 
  'DAMAGED',
  'STOLEN',
  'LATE',
  'WRONG_ADDRESS',
  'CUSTOMER_UNAVAILABLE'
);

-- Criar enum para prioridade de aprovação
CREATE TYPE approval_priority AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
  'CRITICAL'
);

-- Adicionar campos extras na tabela drivers
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS failed_deliveries integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_deliveries integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_delay_minutes numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_delivery_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS first_seen_at timestamp with time zone DEFAULT now();

-- Adicionar campo outcome na tabela lalamove_orders
ALTER TABLE public.lalamove_orders
ADD COLUMN IF NOT EXISTS outcome delivery_outcome,
ADD COLUMN IF NOT EXISTS delay_minutes integer,
ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- Adicionar campo priority na tabela driver_approval_queue
ALTER TABLE public.driver_approval_queue
ADD COLUMN IF NOT EXISTS approval_priority approval_priority DEFAULT 'MEDIUM';

-- Criar tabela driver_evaluations
CREATE TABLE public.driver_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.lalamove_orders(id) ON DELETE SET NULL,
  
  -- Trigger
  triggered_by text NOT NULL DEFAULT 'SYSTEM',
  
  -- Decision
  approved boolean NOT NULL DEFAULT false,
  requires_manual boolean NOT NULL DEFAULT false,
  auto_blocked boolean NOT NULL DEFAULT false,
  
  -- Risk Analysis
  risk_score numeric NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'LOW',
  risk_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_reasons text[] DEFAULT '{}'::text[],
  
  -- Context
  total_deliveries integer DEFAULT 0,
  completed_deliveries integer DEFAULT 0,
  failure_rate numeric DEFAULT 0,
  incident_count integer DEFAULT 0,
  
  -- Recommendation
  recommendation text,
  action_required text,
  
  evaluated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_driver_evaluations_driver_id ON public.driver_evaluations(driver_id);
CREATE INDEX idx_driver_evaluations_order_id ON public.driver_evaluations(order_id);
CREATE INDEX idx_driver_evaluations_approved ON public.driver_evaluations(approved);
CREATE INDEX idx_driver_evaluations_requires_manual ON public.driver_evaluations(requires_manual);
CREATE INDEX idx_driver_evaluations_evaluated_at ON public.driver_evaluations(evaluated_at DESC);

-- Habilitar RLS
ALTER TABLE public.driver_evaluations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view evaluations"
ON public.driver_evaluations
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert evaluations"
ON public.driver_evaluations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role has full access to evaluations"
ON public.driver_evaluations
FOR ALL
USING (true)
WITH CHECK (true);