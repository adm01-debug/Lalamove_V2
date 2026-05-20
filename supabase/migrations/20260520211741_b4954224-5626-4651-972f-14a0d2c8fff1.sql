-- Tabela para persistir configurações por contexto
CREATE TABLE IF NOT EXISTS public.map_settings_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    context_key TEXT NOT NULL, -- Ex: "region:norte", "type:motorcycle"
    geofence_radius INTEGER,
    off_route_threshold INTEGER,
    stopped_threshold INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, context_key)
);

-- Ativar RLS
ALTER TABLE public.map_settings_overrides ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can manage their own settings overrides"
ON public.map_settings_overrides
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_map_settings_overrides_updated_at
    BEFORE UPDATE ON public.map_settings_overrides
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();