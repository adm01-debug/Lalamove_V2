-- Corrige o pipeline de escalonamento de alertas.
--
-- 1) alert_configurations nunca recebeu seed (nenhuma migration tinha INSERT),
--    e get_pending_escalations faz INNER JOIN nela. Resultado: a funcao retornava
--    0 linhas sempre, desde o inicio, e escalate-alerts rodava a cada 5 min sem
--    nunca escalar nada (0 alerts com escalated_at em producao).
-- 2) get_pending_escalations nao tinha limite de idade: ao habilitar uma
--    configuracao, TODOS os alertas historicos nao reconhecidos entrariam de uma
--    vez na fila de escalonamento.
-- 3) Nao havia garantia de que a configuracao tivesse algum destinatario: com
--    escalation_enabled = true e nenhum canal preenchido, send-notification
--    retorna antes de marcar escalated_at e o alerta voltaria para a fila a cada
--    execucao (loop infinito).

-- ── Seed das configuracoes por tipo de alerta ────────────────────────────────
-- Criadas desabilitadas para escalonamento e sem canais ligados: nada e enviado
-- ate o operador preencher destinatarios em /alert-configurations.
INSERT INTO public.alert_configurations
  (alert_type, channel, name, is_enabled, escalation_enabled, escalation_after_seconds, dedup_window_seconds)
VALUES
  ('DRIVER_BLOCKED',       'email', 'Motorista Bloqueado',   true, false, 900, 300),
  ('ROUTE_DEVIATION',      'email', 'Desvio de Rota',        true, false, 900, 300),
  ('DRIVER_STOPPED',       'email', 'Motorista Parado',      true, false, 900, 300),
  ('LATE_DELIVERY',        'email', 'Entrega Atrasada',      true, false, 900, 300),
  ('APPROVAL_REQUIRED',    'email', 'Aprovacao Necessaria',  true, false, 900, 300),
  ('ORDER_CANCELLED',      'email', 'Pedido Cancelado',      true, false, 900, 300),
  ('INTEGRATION_FAILURE',  'email', 'Falha de Integracao',   true, false, 900, 300)
ON CONFLICT (alert_type, channel) DO NOTHING;

-- ── Fila de escalonamento: janela limitada + exige destinatario ──────────────
CREATE OR REPLACE FUNCTION public.get_pending_escalations()
 RETURNS TABLE(alert_id uuid, alert_type alert_type, severity alert_severity, title text, message text, order_id uuid, driver_id uuid, created_at timestamp with time zone, escalation_after_seconds integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.type, a.severity, a.title, a.message, a.order_id, a.driver_id, a.created_at,
         COALESCE(c.escalation_after_seconds, 900)
  FROM public.alerts a
  JOIN public.alert_configurations c
    ON c.alert_type = a.type AND c.is_enabled = true AND c.escalation_enabled = true
  WHERE a.acknowledged_at IS NULL
    AND a.escalated_at IS NULL
    AND a.is_dismissed = false
    AND a.severity IN ('CRITICAL','WARNING')
    AND a.created_at < now() - make_interval(secs => COALESCE(c.escalation_after_seconds, 900))
    -- Nao escalar backlog historico: sem este limite, habilitar uma configuracao
    -- enfileira todos os alertas antigos nao reconhecidos de uma so vez.
    AND a.created_at > now() - interval '24 hours'
    -- Escalar so quando houver para onde entregar (evita reenvio infinito de
    -- alertas que send-notification nao consegue despachar).
    AND (
      (c.notify_whatsapp      AND COALESCE(array_length(c.whatsapp_numbers, 1), 0) > 0)
      OR (c.notify_email      AND COALESCE(array_length(c.email_addresses, 1), 0) > 0)
      OR (c.notify_slack      AND COALESCE(array_length(c.slack_channels, 1), 0) > 0)
      OR (c.notify_bitrix24_task AND COALESCE(array_length(c.bitrix24_user_ids, 1), 0) > 0)
      OR (c.notify_n8n_webhook AND c.n8n_webhook_url IS NOT NULL)
      OR (COALESCE(array_length(c.fallback_recipients, 1), 0) > 0)
    );
$function$;
