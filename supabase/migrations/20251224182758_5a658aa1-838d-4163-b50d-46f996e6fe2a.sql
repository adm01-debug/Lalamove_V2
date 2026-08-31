-- Create table to store Bitrix24 sync status and mapping
CREATE TABLE public.bitrix24_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  deal_id INTEGER NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  synced_fields JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to store Bitrix24 activities created
CREATE TABLE public.bitrix24_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  deal_id INTEGER NOT NULL,
  activity_id INTEGER NOT NULL,
  activity_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for Bitrix24 OAuth tokens
CREATE TABLE public.bitrix24_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for stage mappings
CREATE TABLE public.bitrix24_stage_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lalamove_status TEXT NOT NULL UNIQUE,
  bitrix_stage_id TEXT NOT NULL,
  bitrix_stage_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bitrix24_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitrix24_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitrix24_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitrix24_stage_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view sync data" ON public.bitrix24_sync FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sync data" ON public.bitrix24_sync FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view activities" ON public.bitrix24_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activities" ON public.bitrix24_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view tokens" ON public.bitrix24_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tokens" ON public.bitrix24_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view stage mappings" ON public.bitrix24_stage_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage stage mappings" ON public.bitrix24_stage_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default stage mappings
INSERT INTO public.bitrix24_stage_mappings (lalamove_status, bitrix_stage_id, bitrix_stage_name) VALUES
  ('PENDING', 'NEW', 'Novo'),
  ('MATCHED', 'PREPARATION', 'Em Preparação'),
  ('ON_GOING', 'EXECUTING', 'Em Andamento'),
  ('PICKED_UP', 'EXECUTING', 'Coletado'),
  ('COMPLETED', 'WON', 'Concluído'),
  ('CANCELLED', 'LOSE', 'Cancelado'),
  ('REJECTED', 'LOSE', 'Rejeitado'),
  ('EXPIRED', 'LOSE', 'Expirado');

-- Add trigger for updated_at
CREATE TRIGGER update_bitrix24_sync_updated_at
BEFORE UPDATE ON public.bitrix24_sync
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bitrix24_tokens_updated_at
BEFORE UPDATE ON public.bitrix24_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();