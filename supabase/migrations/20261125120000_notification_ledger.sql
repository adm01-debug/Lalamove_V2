-- ============================================================================
-- Etapa 73 do plano de mensageria: ledger notificacao_messages.
--
-- Por que existe: hoje o unico rastro de uma mensagem sao as linhas de
-- alerts_sent (alert_id NOT NULL, sem order_id, sem direction, sem status de
-- entrega, sem idempotencia). Nao da para responder:
--   - "o motorista do pedido X recebeu o briefing?" (sem order_id)
--   - "esse SMS foi entregue ou so enfileirado?" (sem delivered_at)
--   - "o callback do Zapp chegou duas vezes?" (sem client_message_id unico)
--   - "quanto gastei de SMS este mes?" (sem cost_cents/segments)
-- A edge zapp-callback (etapa 96) precisa desse destino para gravar
-- status e respostas, e o roteador (etapas 88-95) precisa dele para saber se
-- houve fallback e para idempotencia.
--
-- alerts_sent continua sendo escrita (etapa 97) ate a tela de historico
-- migrar; as duas convivem.
--
-- Idempotente: IF NOT EXISTS / CREATE OR REPLACE em tudo, para rodar tanto em
-- banco com drift quanto em db reset limpo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id            uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  order_id            uuid,
  driver_id           uuid,
  stop_id             uuid,
  event               text NOT NULL,
  role                text NOT NULL CHECK (role IN ('driver','pickup_contact','delivery_contact','internal')),
  direction           text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  channel             text NOT NULL CHECK (channel IN ('whatsapp','sms','email','slack','n8n')),
  provider            text,
  recipient_phone     text,
  client_message_id   text,
  provider_message_id text,
  template_key        text,
  template_version    int,
  body_preview        text,
  status              text NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','sent','delivered','read','failed','uncertain','expired','suppressed')),
  error_code          text,
  attempt             int NOT NULL DEFAULT 1,
  fallback_of         uuid REFERENCES public.notification_messages(id) ON DELETE SET NULL,
  cost_cents          int,
  segments            int,
  -- Etapa 96: o callback do Zapp manda occurred_at e sequence. Guardar os dois
  -- permite descartar entrega fora de ordem (read antes de delivered) sem
  -- perder o evento.
  provider_sequence   bigint,
  occurred_at         timestamptz,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  read_at             timestamptz,
  failed_at           timestamptz,
  expires_at          timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_messages IS
  'Etapa 73: ledger de mensagens (outbound e inbound) ao motorista e aos contatos. Substitui alerts_sent como fonte de timeline; alerts_sent continua sendo escrito ate a etapa 138 migrar a tela.';

-- Etapa 83: idempotencia do envio. client_message_id e o uuidv5 de
-- (order_id|event|role|telefone|seq) da etapa 89 - reprocessar o mesmo evento
-- nao duplica mensagem. Parcial porque inbound nao carrega client_message_id.
CREATE UNIQUE INDEX IF NOT EXISTS notification_messages_client_message_id_key
  ON public.notification_messages (client_message_id)
  WHERE client_message_id IS NOT NULL;

-- Um provider_message_id por provedor: o callback do Zapp chega com o id dele e
-- dois callbacks do mesmo id sao o mesmo evento, nao dois.
CREATE UNIQUE INDEX IF NOT EXISTS notification_messages_provider_message_id_key
  ON public.notification_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Etapa 83: timeline do pedido e fila de pendentes.
CREATE INDEX IF NOT EXISTS notification_messages_order_created_idx
  ON public.notification_messages (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_messages_pending_idx
  ON public.notification_messages (status)
  WHERE status IN ('queued','sent');

CREATE INDEX IF NOT EXISTS notification_messages_driver_created_idx
  ON public.notification_messages (driver_id, created_at DESC);

-- Etapa 95: limite de 6 mensagens/10 min por motorista e consulta por janela.
CREATE INDEX IF NOT EXISTS notification_messages_recipient_created_idx
  ON public.notification_messages (recipient_phone, created_at DESC);

-- ----------------------------------------------------------------------------
-- Etapa 74: maquina de estados
-- ----------------------------------------------------------------------------
-- Terminais: failed, uncertain, expired, suppressed e read. As transicoes
-- validas seguem a etapa 74; qualquer outra e rejeitada pela funcao, para que um
-- callback atrasado nao faca delivered voltar para queued.
CREATE OR REPLACE FUNCTION public.notification_status_transition_allowed(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT p_from = p_to OR CASE p_from
    WHEN 'queued'    THEN p_to IN ('sent','failed','uncertain','expired','suppressed')
    WHEN 'sent'      THEN p_to IN ('delivered','read','failed','uncertain','expired')
    WHEN 'delivered' THEN p_to IN ('read','failed')
    ELSE false   -- read/failed/uncertain/expired/suppressed sao finais
  END;
$$;

CREATE OR REPLACE FUNCTION public.notification_messages_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notification_messages_touch_trg ON public.notification_messages;
CREATE TRIGGER notification_messages_touch_trg
  BEFORE UPDATE ON public.notification_messages
  FOR EACH ROW EXECUTE FUNCTION public.notification_messages_touch();

-- ----------------------------------------------------------------------------
-- Etapa 82: RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.notification_messages ENABLE ROW LEVEL SECURITY;

-- operator e acima leem o ledger (timeline do pedido, historico do motorista).
DROP POLICY IF EXISTS "operator le ledger de mensagens" ON public.notification_messages;
CREATE POLICY "operator le ledger de mensagens" ON public.notification_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Escrita so por service_role: a edge e o job-worker sao os unicos autores.
-- Sem policy de INSERT/UPDATE para authenticated, RLS ja bloqueia por padrao; a
-- policy explicita abaixo existe so para deixar a intencao registrada.
DROP POLICY IF EXISTS "service role escreve ledger de mensagens" ON public.notification_messages;
CREATE POLICY "service role escreve ledger de mensagens" ON public.notification_messages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- Etapa 84: retencao (Z8) - 90 dias de corpo/midia, metadados para sempre
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_messages_scrub_bodies(p_keep_days int DEFAULT 90)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int;
BEGIN
  WITH alvo AS (
    UPDATE notification_messages
       SET body_preview = NULL,
           metadata = metadata - 'media_url'
     WHERE created_at < now() - make_interval(days => p_keep_days)
       AND (body_preview IS NOT NULL OR metadata ? 'media_url')
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM alvo;
  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.notification_messages_scrub_bodies(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_messages_scrub_bodies(int) TO service_role;

-- Agendamento do scrub so quando pg_cron existir (dev local sem a extensao nao
-- deve quebrar a migration).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification_messages_scrub_bodies') THEN
      PERFORM cron.unschedule('notification_messages_scrub_bodies');
    END IF;
    PERFORM cron.schedule(
      'notification_messages_scrub_bodies',
      '25 4 * * *',
      $cron$SELECT public.notification_messages_scrub_bodies(90)$cron$
    );
  END IF;
END $$;

-- Verificacao pos-apply:
--   select to_regclass('public.notification_messages');           -- notification_messages
--   select public.notification_status_transition_allowed('sent','delivered'); -- true
--   select public.notification_status_transition_allowed('read','sent');      -- false
--   select count(*) from pg_indexes where tablename='notification_messages';  -- 5