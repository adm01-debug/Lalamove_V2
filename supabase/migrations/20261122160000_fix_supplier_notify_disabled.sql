-- Corrige SUPPLIER_DELAY_NOTICE e DRIVER_ASSIGNED em alert_configurations: as duas linhas
-- existem com is_enabled=false, notify_whatsapp=false e message_template=NULL (nunca foram
-- preenchidas por um seed de verdade, só criadas pelo ADD VALUE do enum).
--
-- Isso bloqueia silenciosamente o envio: send-notification/index.ts:isChannelDisabled()
-- trata "existe linha em alert_configurations para este alert_type, mas nenhuma com
-- is_enabled=true" como "canal desabilitado pelo operador" e descarta o destinatário
-- ad-hoc (metadata.recipients) que o chamador já monta com o telefone certo:
--   - check-driver-alerts/index.ts:161-171 -> SUPPLIER_DELAY_NOTICE, to: order.supplier_contact
--   - lalamove-webhook/index.ts:426-432    -> DRIVER_ASSIGNED,       to: orderData.supplier_contact
-- Resultado hoje em produção: os dois avisos de WhatsApp ao fornecedor nunca saem, mesmo
-- com auto_notify_supplier=true e supplier_contact preenchido.
--
-- Fix: liga is_enabled/notify_whatsapp (destinatário = supplier_contact, D1) para o ad-hoc
-- recipient parar de ser descartado. whatsapp_numbers fica vazio de propósito: esses dois
-- tipos só notificam por destinatário ad-hoc por pedido, não por número fixo de config —
-- então o loop de alert_configurations (index.ts:270-276, notify_whatsapp && whatsappNumbers.length>0)
-- não dispara um segundo envio.
UPDATE public.alert_configurations
   SET is_enabled = true,
       notify_whatsapp = true,
       name = 'Aviso de atraso ao fornecedor',
       message_template = 'Olá, o motorista {{driver_name}} está parado há {{stopped_minutes}} min próximo à região de coleta/entrega do pedido {{order_ref}}.'
 WHERE alert_type = 'SUPPLIER_DELAY_NOTICE' AND channel = 'whatsapp';

UPDATE public.alert_configurations
   SET is_enabled = true,
       notify_whatsapp = true,
       name = 'Motorista designado',
       message_template = 'Olá! O motorista {{driver_name}} foi designado para a coleta do pedido {{order_ref}}. Ele está a caminho de {{pickup_address}}.'
 WHERE alert_type = 'DRIVER_ASSIGNED' AND channel = 'whatsapp';
