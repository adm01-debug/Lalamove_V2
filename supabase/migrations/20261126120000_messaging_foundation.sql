-- Etapas 75, 76, 77, 78, 79, 81, 82 e 83 do
-- docs/planos/PLANO_MENSAGERIA_MOTORISTAS_ZAPP_SMS_150_ETAPAS.md (Bloco 6).
--
-- Bloco 6 = o banco que o motor de comunicacao (Bloco 7) e os eventos M1-M12
-- (Bloco 8) precisam para existir. Sem estas tabelas o roteador le apenas as
-- rotas embutidas no codigo (DEFAULT_ROUTES), nao ha template aprovado para
-- enviar e o custo de SMS nao tem onde ser somado.
--
-- Idempotente: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING em
-- tudo, para rodar tanto em banco novo quanto no de producao. Nenhum DROP de
-- dado e nenhum ALTER destrutivo. Consumir estas tabelas no despacho e o
-- Bloco 7/8 (codigo da edge), nao esta migration.

-- Etapa 102 (dependencia) - novo tipo de alerta interno.
-- M2 (confirmacao com prazo) nao tem para onde escalar sem este tipo: o motorista
-- recebe o pedido e para de responder, e ninguem da operacao descobre.
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'DRIVER_NO_CONFIRMATION';

-- ── Etapa 75 - messaging_settings (linha unica) ─────────────────────────────
-- Configuracao viva da mensageria, uma linha so. whatsapp_provider='off' e o
-- kill switch; shadow_mode liga o modo sombra (etapa 145): tudo e decidido e
-- gravado, nada e enviado.
CREATE TABLE IF NOT EXISTS public.messaging_settings (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  whatsapp_provider   text NOT NULL DEFAULT 'zapp'
                        CHECK (whatsapp_provider IN ('zapp','evolution','off')),
  sms_provider        text NOT NULL DEFAULT 'none'
                        CHECK (sms_provider IN ('none','zenvia','comtele','twilio')),
  sms_fallback_after_min integer NOT NULL DEFAULT 10
                        CHECK (sms_fallback_after_min BETWEEN 0 AND 1440),
  monthly_budget_cents integer NOT NULL DEFAULT 0 CHECK (monthly_budget_cents >= 0),
  quiet_hours_by_role jsonb NOT NULL DEFAULT '{}'::jsonb,
  pilot_mode          boolean NOT NULL DEFAULT false,
  shadow_mode         boolean NOT NULL DEFAULT true,
  updated_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messaging_settings IS
  'Configuracao unica da mensageria (etapa 75). shadow_mode=true decide tudo e nao envia nada.';
COMMENT ON COLUMN public.messaging_settings.quiet_hours_by_role IS
  'Horario de silencio por papel. Motorista com pedido ativo e isento (Z9).';

INSERT INTO public.messaging_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ── Etapa 76 - message_templates ────────────────────────────────────────────
-- Um texto por (chave, canal). A variante SMS e linha propria (mesma chave,
-- channel='sms') porque tem limite de 160 caracteres e texto diferente.
CREATE TABLE IF NOT EXISTS public.message_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL,
  event       text NOT NULL,
  role        text NOT NULL DEFAULT 'driver'
                CHECK (role IN ('driver','supplier','customer','internal')),
  channel     text NOT NULL CHECK (channel IN ('whatsapp','sms')),
  version     integer NOT NULL DEFAULT 1 CHECK (version > 0),
  body        text NOT NULL CHECK (length(btrim(body)) > 0),
  variables   text[] NOT NULL DEFAULT '{}'::text[],
  max_length  integer CHECK (max_length IS NULL OR max_length > 0),
  is_active   boolean NOT NULL DEFAULT true,
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, channel, version)
);

COMMENT ON TABLE public.message_templates IS
  'Textos aprovados por evento x canal (etapas 76/77). O SMS tem linha propria por causa do limite de 160 caracteres.';

-- So uma versao ativa por (chave, canal): evita o despacho escolher texto antigo.
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_active_key_idx
  ON public.message_templates (key, channel) WHERE is_active;

-- ── Etapa 78 - notification_routes ──────────────────────────────────────────
-- Tira as rotas de dentro do codigo (DEFAULT_ROUTES) e as torna dado editavel:
-- qual canal usar, em que ordem, e quando cair para o proximo.
CREATE TABLE IF NOT EXISTS public.notification_routes (
  event             text NOT NULL,
  role              text NOT NULL
                      CHECK (role IN ('driver','supplier','customer','internal')),
  channels          text[] NOT NULL DEFAULT '{}'::text[],
  fallback_after_min integer NOT NULL DEFAULT 0
                      CHECK (fallback_after_min BETWEEN 0 AND 1440),
  requires_reply    boolean NOT NULL DEFAULT false,
  reply_timeout_min integer CHECK (reply_timeout_min IS NULL OR reply_timeout_min > 0),
  is_enabled        boolean NOT NULL DEFAULT true,
  updated_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event, role)
);

COMMENT ON TABLE public.notification_routes IS
  'Rota evento x papel (etapa 78): canais em ordem, espera antes do fallback e se exige resposta.';

-- ── Etapa 79 - estado de canal do motorista ─────────────────────────────────
-- O que o callback do provedor sabe sobre o telefone do motorista. 'unknown' nao
-- bloqueia envio: so evita repetir tentativa em numero que ja falhou.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS whatsapp_status   text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS whatsapp_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_channel text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS last_reply_at     timestamptz;

DO $$
BEGIN
  ALTER TABLE public.drivers ADD CONSTRAINT drivers_whatsapp_status_check
    CHECK (whatsapp_status IN ('valid','invalid','unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.drivers ADD CONSTRAINT drivers_preferred_channel_check
    CHECK (preferred_channel IN ('auto','whatsapp','sms'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Etapa 81 - uso e custo ──────────────────────────────────────────────────
-- No modelo do geo_budget: soma por dia/canal/provedor, para o teto mensal (Z5)
-- e para o painel "Uso e custo" (etapa 137). Segmentos != mensagens: SMS longo
-- e cobrado por segmento.
CREATE TABLE IF NOT EXISTS public.messaging_usage (
  day         date NOT NULL,
  channel     text NOT NULL,
  provider    text NOT NULL,
  messages    integer NOT NULL DEFAULT 0 CHECK (messages >= 0),
  segments    integer NOT NULL DEFAULT 0 CHECK (segments >= 0),
  cost_cents  integer NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, channel, provider)
);

COMMENT ON TABLE public.messaging_usage IS
  'Consumo diario de mensageria por canal e provedor (etapa 81). Alimenta o teto mensal (Z5).';

CREATE INDEX IF NOT EXISTS messaging_usage_day_idx ON public.messaging_usage (day);
CREATE INDEX IF NOT EXISTS message_templates_event_idx
  ON public.message_templates (event, role, channel) WHERE is_active;
CREATE INDEX IF NOT EXISTS notification_routes_event_idx
  ON public.notification_routes (event) WHERE is_enabled;

-- Soma idempotente de consumo. SECURITY DEFINER: chamada só pelas edges com
-- service_role; nao ha policy de INSERT para authenticated.
CREATE OR REPLACE FUNCTION public.record_messaging_usage(
  p_channel     text,
  p_provider    text,
  p_messages    integer DEFAULT 1,
  p_segments    integer DEFAULT 1,
  p_cost_cents  integer DEFAULT 0,
  p_day         date DEFAULT NULL
)
RETURNS public.messaging_usage
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.messaging_usage;
BEGIN
  INSERT INTO messaging_usage (day, channel, provider, messages, segments, cost_cents)
  VALUES (
    COALESCE(p_day, (now() AT TIME ZONE 'America/Sao_Paulo')::date),
    p_channel, p_provider,
    GREATEST(COALESCE(p_messages, 0), 0),
    GREATEST(COALESCE(p_segments, 0), 0),
    GREATEST(COALESCE(p_cost_cents, 0), 0)
  )
  ON CONFLICT (day, channel, provider) DO UPDATE
    SET messages   = messaging_usage.messages   + EXCLUDED.messages,
        segments   = messaging_usage.segments   + EXCLUDED.segments,
        cost_cents = messaging_usage.cost_cents + EXCLUDED.cost_cents,
        updated_at = now()
  RETURNING * INTO v;
  RETURN v;
END; $$;

REVOKE ALL ON FUNCTION public.record_messaging_usage(text,text,integer,integer,integer,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_messaging_usage(text,text,integer,integer,integer,date) TO service_role;

-- Custo do mes corrente em centavos, para comparar com monthly_budget_cents.
CREATE OR REPLACE FUNCTION public.messaging_month_cost_cents(p_month date DEFAULT NULL)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(cost_cents), 0)::integer
    FROM messaging_usage
   WHERE day >= date_trunc('month', COALESCE(p_month, (now() AT TIME ZONE 'America/Sao_Paulo')::date))::date
     AND day <  (date_trunc('month', COALESCE(p_month, (now() AT TIME ZONE 'America/Sao_Paulo')::date)) + interval '1 month')::date;
$$;

REVOKE ALL ON FUNCTION public.messaging_month_cost_cents(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messaging_month_cost_cents(date) TO service_role, authenticated;

-- ── Etapa 82 - RLS ──────────────────────────────────────────────────────────
-- Padrao do repo: operator/manager/admin leem; admin edita configuracao; ledger e
-- somas de custo so sao escritos por service_role (edge).
ALTER TABLE public.messaging_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_usage     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipe le configuracao de mensageria" ON public.messaging_settings;
CREATE POLICY "equipe le configuracao de mensageria" ON public.messaging_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin edita configuracao de mensageria" ON public.messaging_settings;
CREATE POLICY "admin edita configuracao de mensageria" ON public.messaging_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service role gerencia configuracao de mensageria" ON public.messaging_settings;
CREATE POLICY "service role gerencia configuracao de mensageria" ON public.messaging_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "equipe le templates" ON public.message_templates;
CREATE POLICY "equipe le templates" ON public.message_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin edita templates" ON public.message_templates;
CREATE POLICY "admin edita templates" ON public.message_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service role gerencia templates" ON public.message_templates;
CREATE POLICY "service role gerencia templates" ON public.message_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "equipe le rotas de notificacao" ON public.notification_routes;
CREATE POLICY "equipe le rotas de notificacao" ON public.notification_routes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin edita rotas de notificacao" ON public.notification_routes;
CREATE POLICY "admin edita rotas de notificacao" ON public.notification_routes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service role gerencia rotas de notificacao" ON public.notification_routes;
CREATE POLICY "service role gerencia rotas de notificacao" ON public.notification_routes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "equipe le uso de mensageria" ON public.messaging_usage;
CREATE POLICY "equipe le uso de mensageria" ON public.messaging_usage
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service role escreve uso de mensageria" ON public.messaging_usage;
CREATE POLICY "service role escreve uso de mensageria" ON public.messaging_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Etapa 77 - seed dos templates M1-M12 (WhatsApp + SMS) ───────────────────
-- Textos redigidos a partir do catalogo da secao 4 do plano. Editaveis em
-- Admin > Mensageria (etapa 134): o que esta aqui e o ponto de partida.
INSERT INTO public.message_templates (key, event, role, channel, body, variables, max_length) VALUES
  ('M1_BRIEFING_ATRIBUICAO', 'DRIVER_ASSIGNED', 'driver', 'whatsapp', E'Promo Brindes - pedido {{order_number}}\nOla, {{driver_name}}! Voce foi designado para esta coleta.\n\nColeta: {{pickup_address}}\nJanela: {{pickup_window}}\nResponsavel: {{pickup_contact}}\nInstrucoes: {{pickup_notes}}\n\nRota: {{share_link}}\nPrecisa de ajuda? Responda a esta mensagem.', ARRAY['order_number', 'driver_name', 'pickup_address', 'pickup_window', 'pickup_contact', 'pickup_notes', 'share_link']::text[], NULL),
  ('M1_BRIEFING_ATRIBUICAO', 'DRIVER_ASSIGNED', 'driver', 'sms', E'Promo Brindes: pedido {{order_number}} designado. Coleta {{pickup_address}} {{pickup_window}}. Resp. {{pickup_contact}} {{share_link}}', ARRAY['order_number', 'pickup_address', 'pickup_window', 'pickup_contact', 'share_link']::text[], 160),
  ('M2_CONFIRMACAO_PRAZO', 'DRIVER_CONFIRMATION_DUE', 'driver', 'whatsapp', E'Promo Brindes: voce ja esta a caminho da coleta do pedido {{order_number}}?\n1 = sim\n2 = problema', ARRAY['order_number']::text[], NULL),
  ('M2_CONFIRMACAO_PRAZO', 'DRIVER_CONFIRMATION_DUE', 'driver', 'sms', E'Promo Brindes: ja esta a caminho do pedido {{order_number}}? 1=sim 2=problema', ARRAY['order_number']::text[], 160),
  ('M3_LOCALIZACAO_CONTATO', 'DRIVER_ASSIGNED', 'driver', 'whatsapp', E'Local da coleta: {{pickup_location_link}}\nContato do responsavel: {{pickup_contact}}', ARRAY['pickup_location_link', 'pickup_contact']::text[], NULL),
  ('M3_LOCALIZACAO_CONTATO', 'DRIVER_ASSIGNED', 'driver', 'sms', E'Promo Brindes: coleta do pedido {{order_number}} - {{pickup_location_link}} - contato {{pickup_contact}}', ARRAY['order_number', 'pickup_location_link', 'pickup_contact']::text[], 160),
  ('M4_CHEGADA_COLETA', 'DRIVER_ARRIVED_PICKUP', 'driver', 'whatsapp', E'Voce chegou na coleta do pedido {{order_number}}.\nProcure {{pickup_contact}}, confira {{volume_count}} volume(s) e a nota fiscal.\n\n1 = coletado\n2 = problema', ARRAY['order_number', 'pickup_contact', 'volume_count']::text[], NULL),
  ('M4_CHEGADA_COLETA', 'DRIVER_ARRIVED_PICKUP', 'driver', 'sms', E'Promo Brindes: chegou na coleta {{order_number}}. Procure {{pickup_contact}}, confira {{volume_count}} vol. 1=coletado 2=problema', ARRAY['order_number', 'pickup_contact', 'volume_count']::text[], 160),
  ('M5_POS_COLETA', 'ORDER_PICKED_UP', 'driver', 'whatsapp', E'Pedido {{order_number}} coletado.\n\nEntregar em: {{delivery_address}}\nRecebedor: {{delivery_contact}}\nHorario: {{delivery_window}}{{pod_requirement}}', ARRAY['order_number', 'delivery_address', 'delivery_contact', 'delivery_window', 'pod_requirement']::text[], NULL),
  ('M5_POS_COLETA', 'ORDER_PICKED_UP', 'driver', 'sms', E'Promo Brindes: pedido {{order_number}} coletado. Entrega {{delivery_address}} - {{delivery_contact}} {{delivery_window}}', ARRAY['order_number', 'delivery_address', 'delivery_contact', 'delivery_window']::text[], 160),
  ('M6_MULTIPARADAS', 'DRIVER_STOP_COMPLETED', 'driver', 'whatsapp', E'Proxima parada do pedido {{order_number}}:\n{{next_stop_address}}\nContato: {{next_stop_contact}}', ARRAY['order_number', 'next_stop_address', 'next_stop_contact']::text[], NULL),
  ('M6_MULTIPARADAS', 'DRIVER_STOP_COMPLETED', 'driver', 'sms', E'Promo Brindes: proxima parada {{order_number}} - {{next_stop_address}} - {{next_stop_contact}}', ARRAY['order_number', 'next_stop_address', 'next_stop_contact']::text[], 160),
  ('M7_PEDIDO_EDITADO', 'ORDER_EDITED', 'driver', 'whatsapp', E'Pedido {{order_number}} atualizado:\n{{change_summary}}\n\nResponda 1 para confirmar que viu.', ARRAY['order_number', 'change_summary']::text[], NULL),
  ('M7_PEDIDO_EDITADO', 'ORDER_EDITED', 'driver', 'sms', E'Promo Brindes: pedido {{order_number}} mudou. {{change_summary}} Responda 1', ARRAY['order_number', 'change_summary']::text[], 160),
  ('M8_CANCELAMENTO', 'ORDER_CANCELLED', 'driver', 'whatsapp', E'Pedido {{order_number}} cancelado. Nao siga para a coleta. - Promo Brindes', ARRAY['order_number']::text[], NULL),
  ('M8_CANCELAMENTO', 'ORDER_CANCELLED', 'driver', 'sms', E'Promo Brindes: pedido {{order_number}} cancelado. Nao siga para a coleta.', ARRAY['order_number']::text[], 160),
  ('M9_LEMBRETE_COMPROVANTE', 'MISSING_POD', 'driver', 'whatsapp', E'Falta o comprovante do pedido {{order_number}}. Envie a foto com o nome de quem recebeu.', ARRAY['order_number']::text[], NULL),
  ('M9_LEMBRETE_COMPROVANTE', 'MISSING_POD', 'driver', 'sms', E'Promo Brindes: envie a foto do comprovante do pedido {{order_number}} com o nome do recebedor.', ARRAY['order_number']::text[], 160),
  ('M10_CHECAGEM', 'ETA_DELAY', 'driver', 'whatsapp', E'Esta tudo bem com o pedido {{order_number}}?\n1 = transito\n2 = problema no veiculo\n3 = endereco errado', ARRAY['order_number']::text[], NULL),
  ('M10_CHECAGEM', 'ETA_DELAY', 'driver', 'sms', E'Promo Brindes: tudo bem no pedido {{order_number}}? 1=transito 2=veiculo 3=endereco', ARRAY['order_number']::text[], 160),
  ('M11_AGENDADO', 'ORDER_SCHEDULED_REMINDER', 'driver', 'whatsapp', E'Lembrete: coleta do pedido {{order_number}} em {{pickup_window}}.\nEndereco: {{pickup_address}}\nResponda 1 para confirmar.', ARRAY['order_number', 'pickup_window', 'pickup_address']::text[], NULL),
  ('M11_AGENDADO', 'ORDER_SCHEDULED_REMINDER', 'driver', 'sms', E'Promo Brindes: coleta {{order_number}} em {{pickup_window}} - {{pickup_address}}. Responda 1', ARRAY['order_number', 'pickup_window', 'pickup_address']::text[], 160),
  ('M12_ENCERRAMENTO', 'ORDER_COMPLETED', 'driver', 'whatsapp', E'Pedido {{order_number}} concluido. Obrigado, {{driver_name}}! - Promo Brindes', ARRAY['order_number', 'driver_name']::text[], NULL),
  ('M12_ENCERRAMENTO', 'ORDER_COMPLETED', 'driver', 'sms', E'Promo Brindes: pedido {{order_number}} concluido. Obrigado, {{driver_name}}!', ARRAY['order_number', 'driver_name']::text[], 160)
ON CONFLICT (key, channel, version) DO NOTHING;

-- ── Etapa 78 - seed das rotas do catalogo ───────────────────────────────────
-- ORDER_CANCELLED tem SMS primeiro: cancelamento nao pode depender de o motorista
-- abrir o WhatsApp (Z3). Os canais sao ordenados; o despacho tenta na ordem.
INSERT INTO public.notification_routes
  (event, role, channels, fallback_after_min, requires_reply, reply_timeout_min) VALUES
  ('DRIVER_ASSIGNED', 'driver', ARRAY['whatsapp', 'sms']::text[], 10, false, NULL),
  ('DRIVER_CONFIRMATION_DUE', 'driver', ARRAY['whatsapp']::text[], 0, true, 5),
  ('DRIVER_ARRIVED_PICKUP', 'driver', ARRAY['whatsapp']::text[], 0, true, 10),
  ('ORDER_PICKED_UP', 'driver', ARRAY['whatsapp', 'sms']::text[], 10, false, NULL),
  ('DRIVER_STOP_COMPLETED', 'driver', ARRAY['whatsapp']::text[], 0, false, NULL),
  ('ORDER_EDITED', 'driver', ARRAY['whatsapp', 'sms']::text[], 0, true, 10),
  ('ORDER_CANCELLED', 'driver', ARRAY['sms', 'whatsapp']::text[], 0, false, NULL),
  ('MISSING_POD', 'driver', ARRAY['whatsapp']::text[], 0, true, 15),
  ('ETA_DELAY', 'driver', ARRAY['whatsapp']::text[], 0, true, 10),
  ('DRIVER_STOPPED', 'driver', ARRAY['whatsapp']::text[], 0, true, 10),
  ('ROUTE_DEVIATION', 'driver', ARRAY['whatsapp']::text[], 0, true, 10),
  ('ORDER_SCHEDULED_REMINDER', 'driver', ARRAY['whatsapp', 'sms']::text[], 0, true, 10),
  ('ORDER_COMPLETED', 'driver', ARRAY['whatsapp']::text[], 0, false, NULL),
  ('DRIVER_NO_CONFIRMATION', 'internal', ARRAY['whatsapp']::text[], 0, false, NULL)
ON CONFLICT (event, role) DO NOTHING;
