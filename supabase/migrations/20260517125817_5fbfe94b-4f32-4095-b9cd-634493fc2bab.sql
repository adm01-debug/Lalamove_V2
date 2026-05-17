-- Adicionar colunas de automação e controle do "Guardian"
ALTER TABLE public.lalamove_orders 
ADD COLUMN IF NOT EXISTS supplier_contact TEXT,
ADD COLUMN IF NOT EXISTS auto_notify_supplier BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stalled_threshold_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS route_deviation_threshold_minutes INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS requires_pod BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS pod_received BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.lalamove_orders.supplier_contact IS 'Telefone ou ID do fornecedor para notificações automáticas via WhatsApp/Bot';
COMMENT ON COLUMN public.lalamove_orders.auto_notify_supplier IS 'Se verdadeiro, o sistema enviará avisos automáticos ao fornecedor quando o motorista estiver a caminho';
COMMENT ON COLUMN public.lalamove_orders.stalled_threshold_minutes IS 'Tempo máximo (minutos) que o motorista pode ficar parado antes de disparar alerta';
COMMENT ON COLUMN public.lalamove_orders.route_deviation_threshold_minutes IS 'Tempo máximo (minutos) fora da rota antes de disparar alerta';
