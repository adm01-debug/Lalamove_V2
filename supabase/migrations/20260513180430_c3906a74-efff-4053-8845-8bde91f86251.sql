-- Create feature flags table
CREATE TABLE public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT false NOT NULL,
    rules JSONB DEFAULT '{}'::jsonb, -- Para segmentação futura (ex: roles específicas)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Feature flags are viewable by all authenticated users"
ON public.feature_flags FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Feature flags can only be managed by admins"
ON public.feature_flags FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND ur.is_active = true
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed some initial flags
INSERT INTO public.feature_flags (name, description, is_enabled)
VALUES 
    ('ai_route_optimization', 'Habilita otimização de rotas baseada em IA', true),
    ('realtime_map_updates', 'Habilita atualizações do mapa em tempo real via Supabase Realtime', true),
    ('driver_auto_evaluation', 'Habilita avaliação automática de motoristas no checkout', false);
