-- Etapa 56 do plano Google Maps: aviso de aproximacao tambem para a equipe interna.
--
-- O `geo_evaluate_tracking` ja grava `metadata.recipients` com o responsavel pela
-- coleta e o `send-notification` ja despacha canais ad-hoc e canais de
-- `alert_configurations`. O que faltava era a linha de configuracao: o seed de
-- `20261122130100_geo_foundation.sql` criava apenas a linha `whatsapp` com
-- `notify_whatsapp = true`, sem `notify_slack` e sem `slack_channels`. Resultado:
-- o grupo interno de logistica nunca recebia o aviso de aproximacao - so o
-- fornecedor, e so por WhatsApp.
--
-- `sendSlack` trata destinatario que nao comeca com `http` como "usa o webhook
-- padrao do ambiente" (`send-notification/index.ts:794`). Por isso o valor aqui e
-- o token logico `internal` e nao uma URL: o webhook real vive em
-- `SLACK_WEBHOOK_URL` (secret do projeto), e segredo nao entra em migration.
--
-- Idempotente: o UPDATE nao tem efeito colateral se rodar duas vezes e nao
-- sobrescreve uma lista de canais que o operador ja tenha configurado pela UI.

UPDATE public.alert_configurations
   SET notify_slack   = true,
       slack_channels = COALESCE(
                          NULLIF(slack_channels, '{}'::text[]),
                          ARRAY['internal']::text[]
                        ),
       updated_at     = now()
 WHERE alert_type IN ('DRIVER_APPROACHING_PICKUP', 'DRIVER_ARRIVED_PICKUP')
   AND channel = 'whatsapp';

-- Verificacao pos-apply:
--   select alert_type, channel, notify_whatsapp, notify_slack, slack_channels
--     from public.alert_configurations
--    where alert_type in ('DRIVER_APPROACHING_PICKUP','DRIVER_ARRIVED_PICKUP');
-- Esperado: notify_slack = true e slack_channels = {internal} nas duas linhas.