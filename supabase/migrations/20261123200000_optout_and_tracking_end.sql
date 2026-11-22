-- Etapas 60 (opt-out) e 61 (encerramento do tracking) do
-- docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md.
--
-- Etapa 60: a tabela notification_optouts nunca foi criada e send-notification
-- nao consultava descadastro — quem pedia para parar de receber avisos
-- continuava recebendo em cada aproximacao/chegada do motorista.
--
-- Etapa 61: pedido COMPLETED/CANCELLED/REJECTED/EXPIRED deixava active_tracking
-- em ACTIVE. O job-worker continuava chamando geo-gateway route a cada ciclo
-- para pedido encerrado (custo Mapbox sem uso) e eventos deferred continuavam
-- pendentes. O webhook agora encerra o tracking e cancela os deferred.

-- ── Etapa 60 — opt-out por telefone ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_optouts (
  phone      text PRIMARY KEY,
  reason     text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_optouts IS
  'Telefones que pediram para nao receber avisos geo (etapa 60). send-notification consulta antes de enviar.';

ALTER TABLE public.notification_optouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin gerencia opt-outs" ON public.notification_optouts;
CREATE POLICY "admin gerencia opt-outs" ON public.notification_optouts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service role escreve opt-outs" ON public.notification_optouts;
CREATE POLICY "service role escreve opt-outs" ON public.notification_optouts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Consulta usada por send-notification. Normaliza para digitos e compara o
-- sufixo, porque o mesmo telefone chega com e sem +55 / formatacao / nono digito
-- (o JID do WhatsApp pode variar). Definir como SECURITY DEFINER deixa a edge
-- checar sem depender de policy.
-- Normaliza celular brasileiro para DDD + 8 digitos: tira DDI 55, tira o nono
-- digito quando presente e ignora formatacao. Sem isso, o mesmo numero chega
-- como 41999998888 (com nono), 4199998888 (sem) e 5541999998888 (com DDI), e
-- uma comparacao literal deixaria o descadastro vazar.
CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE
  d text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
BEGIN
  IF length(d) > 11 AND left(d, 2) = '55' THEN d := substr(d, 3); END IF;
  IF length(d) = 11 AND substr(d, 3, 1) = '9' THEN
    d := substr(d, 1, 2) || substr(d, 4);
  END IF;
  RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.is_phone_opted_out(p_phone text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_norm text := public.normalize_br_phone(p_phone);
BEGIN
  IF length(v_norm) < 10 THEN RETURN false; END IF;   -- telefone invalido nao bloqueia
  RETURN EXISTS (
    SELECT 1 FROM notification_optouts
    WHERE public.normalize_br_phone(phone) = v_norm
  );
END; $$;

REVOKE ALL ON FUNCTION public.normalize_br_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_br_phone(text) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.is_phone_opted_out(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_phone_opted_out(text) TO service_role, authenticated;

-- ── Etapa 61 — encerramento do tracking ─────────────────────────────────────
-- Fecha o tracking ativo do pedido e cancela eventos deferred pendentes. Chamada
-- pela edge `lalamove-webhook` em COMPLETED/CANCELLED/REJECTED/EXPIRED, e pelo
-- job-worker quando encontra tracking orfao de pedido encerrado.
CREATE OR REPLACE FUNCTION public.end_order_tracking(
  p_order_id uuid,
  p_reason text DEFAULT 'order_closed'
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ended integer := 0;
  v_cancelled integer := 0;
BEGIN
  IF p_order_id IS NULL THEN RETURN 0; END IF;

  UPDATE active_tracking
     SET tracking_status = 'ended',
         tracking_ended_at = COALESCE(tracking_ended_at, now()),
         last_updated = now()
   WHERE order_id = p_order_id
     AND COALESCE(tracking_status, 'ACTIVE') <> 'ended';
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  -- Eventos que ficaram esperando a janela de horario nunca devem sair depois
  -- que o pedido acabou.
  UPDATE order_geo_events
     SET notification_status = 'skipped'
   WHERE order_id = p_order_id
     AND notification_status = 'deferred';
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  IF v_ended > 0 OR v_cancelled > 0 THEN
    RAISE LOG 'end_order_tracking(%): % tracking(s) encerrado(s), % evento(s) cancelado(s) [%]',
      p_order_id, v_ended, v_cancelled, p_reason;
  END IF;
  RETURN v_ended;
END; $$;

REVOKE ALL ON FUNCTION public.end_order_tracking(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_order_tracking(uuid, text) TO service_role, authenticated;

COMMENT ON FUNCTION public.end_order_tracking(uuid, text) IS
  'Encerra active_tracking e cancela eventos deferred do pedido (etapa 61).';

-- Rede de seguranca: qualquer pedido que entre em estado final encerra o
-- tracking, independente do caminho (webhook, edicao manual, reconciliacao).
CREATE OR REPLACE FUNCTION public.trg_close_tracking_on_order_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status::text IN ('COMPLETED', 'CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED')
     AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM NEW.status::text) THEN
    PERFORM public.end_order_tracking(NEW.id, 'order_status:' || NEW.status::text);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_close_tracking_on_order_end ON public.lalamove_orders;
CREATE TRIGGER trg_close_tracking_on_order_end
  AFTER INSERT OR UPDATE OF status ON public.lalamove_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_close_tracking_on_order_end();