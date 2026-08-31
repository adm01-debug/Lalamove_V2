-- Migration: Saved Filters System
-- Permite usuários salvarem filtros personalizados em qualquer entidade

-- Tabela para salvar filtros por usuário
CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_filter_name_per_user UNIQUE (user_id, entity_type, name)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_entity ON saved_filters(entity_type);
CREATE INDEX IF NOT EXISTS idx_saved_filters_default ON saved_filters(user_id, entity_type, is_default) WHERE is_default = true;

-- RLS
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view own filters" ON saved_filters;
CREATE POLICY "Users can view own filters"
ON saved_filters FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own filters" ON saved_filters;
CREATE POLICY "Users can create own filters"
ON saved_filters FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own filters" ON saved_filters;
CREATE POLICY "Users can update own filters"
ON saved_filters FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own filters" ON saved_filters;
CREATE POLICY "Users can delete own filters"
ON saved_filters FOR DELETE
USING (auth.uid() = user_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_saved_filters_updated_at ON saved_filters;
CREATE TRIGGER update_saved_filters_updated_at
BEFORE UPDATE ON saved_filters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE saved_filters IS 'Armazena filtros salvos pelos usuários para diferentes entidades';
COMMENT ON COLUMN saved_filters.entity_type IS 'Tipo de entidade (ex: produtos, pedidos, colaboradores)';
COMMENT ON COLUMN saved_filters.filters IS 'Estrutura JSON do filtro';
COMMENT ON COLUMN saved_filters.is_default IS 'Se este é o filtro padrão para o usuário nesta entidade';
