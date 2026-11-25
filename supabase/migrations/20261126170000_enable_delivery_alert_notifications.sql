-- Religar os alertas que nasceram desligados e que hoje morrem em silencio.
--
-- Causa raiz: send-notification/index.ts:487 (isChannelDisabled) devolve true quando
-- existem linhas em alert_configurations para o tipo mas nenhuma com
-- is_enabled = true AND notify_<canal> = true. Nesse caso o destinatario ad-hoc montado
-- pelo trigger (20261122130100_geo_foundation.sql:477, v_meta.recipients) e descartado e
-- nada sai -- mesmo com telefone valido do contato do pedido.
--
-- Impacto provado em producao:
--   * DRIVER_APPROACHING_DELIVERY e DRIVER_ARRIVED_DELIVERY foram semeados com
--     is_enabled = false (20261122130100:544-546), enquanto os equivalentes de COLETA
--     (DRIVER_APPROACHING_PICKUP / DRIVER_ARRIVED_PICKUP) foram semeados true. Resultado:
--     o aviso de aproximacao/chegada ao contato de ENTREGA nunca saiu; o de coleta sai.
--   * ORDER_CANCELLED, DRIVER_BLOCKED, APPROVAL_REQUIRED e LATE_DELIVERY tem a mesma
--     linha desligada (a tabela nasceu com is_enabled DEFAULT false em 20260513180430 e
--     essas linhas nunca foram ligadas).
--
-- Esta migration liga is_enabled/notify_whatsapp. whatsapp_numbers e email_addresses
-- ficam vazios de proposito: por tipo, o destinatario e o ad-hoc do pedido
-- (metadata.recipients). Preencher um numero fixo aqui faria o mesmo aviso sair para um
-- telefone errado. Para os tipos internos (cancelamento, bloqueio, aprovacao) ainda e
-- preciso definir o WhatsApp/e-mail da operacao; ate la o alerta continua sendo criado e
-- visivel no painel, so nao sai por canal externo.
--
-- message_template fica intocado (NULL nesses tipos): sem template, o send-notification
-- usa a mensagem montada pelo trigger (que ja traz id do pedido e motivo) em vez de
-- renderizar um texto com {{placeholders}} sem valor.
--
-- INTEGRATION_FAILURE fica desligado de proposito: e o alerta de assinatura do webhook e
-- varreduras externas na URL publica geram ruido (93 ocorrencias ate 24/11, ver #359).
-- O alerta continua sendo criado e visivel no painel.
UPDATE public.alert_configurations
   SET is_enabled = true,
       notify_whatsapp = true,
       updated_at = now()
 WHERE channel = 'whatsapp'
   AND is_enabled = false
   AND alert_type IN (
         'DRIVER_APPROACHING_DELIVERY',
         'DRIVER_ARRIVED_DELIVERY',
         'ORDER_CANCELLED',
         'DRIVER_BLOCKED',
         'APPROVAL_REQUIRED',
         'LATE_DELIVERY'
       );