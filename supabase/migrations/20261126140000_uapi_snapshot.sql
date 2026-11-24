-- Snapshot das respostas da UAPI do Lalamove, usado quando o gateway recusa a
-- chamada direta.
--
-- Contexto (24/11/2026): `br-uapi.lalamove.com` passou a exigir assinatura por
-- requisicao (`x-sign-js` + `x-javascript-fingerprinting`, geradas por runtime
-- do proprio site) e responde `ret: 10010 "Gateway signature error"` para todo
-- cliente de servidor — inclusive a edge `lalamove-uapi`. A mesma chamada feita
-- de dentro de uma pagina de `web.lalamove.com` responde `ret: 0` (verificado em
-- 24/11/2026 com `wallet_balance`, `wallet_flow_list`, `coupon_list_web`,
-- `get_fleet`, `get_user_info` e `order_list_new`). Sem assinatura, o painel
-- ficou sem carteira, extrato, cupons e frota: nenhuma funcao Deno consegue
-- assinar a requisicao.
--
-- Solucao: o coletor Chromium (scripts/uapi-collector/collect.mjs) captura as
-- respostas dentro do contexto do navegador e grava nesta tabela; a edge
-- `lalamove-uapi` le esta tabela APENAS quando a chamada direta falha
-- (`ret != 0`). Quando o gateway voltar a aceitar a chamada direta, ela tem
-- precedencia e esta tabela passa a ser apenas auditoria do ultimo estado
-- conhecido.
--
-- Idempotente: IF NOT EXISTS / DROP POLICY IF EXISTS em tudo. Nenhum DROP de
-- dado e nenhum ALTER destrutivo.

CREATE TABLE IF NOT EXISTS public.lalamove_uapi_snapshot (
  -- Chave do metodo UAPI (`wallet_balance`, `wallet_flow_list`, ...). Para os
  -- metodos que variam por argumento, o sufixo carrega o argumento decisivo:
  -- `get_fleet:1` (favoritos) e `get_fleet:2` (bloqueados).
  resource      text PRIMARY KEY,
  -- Resposta crua do portal (`{ ret, data, msg }`), no mesmo formato que a edge
  -- devolve ao front. `ret` e gravado junto para o consumidor nao precisar
  -- inventar o envelope.
  payload       jsonb NOT NULL,
  city_id       integer,
  collected_at  timestamptz NOT NULL DEFAULT now(),
  -- Depois disto o dado e velho demais para servir: melhor erro explicito no
  -- painel do que saldo/extrato desatualizado se passando por atual.
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '6 hours',
  collected_by  text NOT NULL DEFAULT 'browser-collector',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lalamove_uapi_snapshot IS
  'Ultimo estado conhecido das respostas UAPI capturadas por navegador; fallback da edge lalamove-uapi quando o gateway assinado recusa a chamada direta (ret 10010).';
COMMENT ON COLUMN public.lalamove_uapi_snapshot.expires_at IS
  'Apos esta data a linha nao e servida pela edge; o painel recebe o erro do gateway.';

CREATE INDEX IF NOT EXISTS lalamove_uapi_snapshot_expires_at_idx
  ON public.lalamove_uapi_snapshot (expires_at);

ALTER TABLE public.lalamove_uapi_snapshot ENABLE ROW LEVEL SECURITY;

-- Leitura para a equipe (o painel tambem pode exibir o dado diretamente) e
-- escrita exclusiva do coletor via service_role (que ja ignora RLS).
DROP POLICY IF EXISTS "equipe le snapshot uapi" ON public.lalamove_uapi_snapshot;
CREATE POLICY "equipe le snapshot uapi" ON public.lalamove_uapi_snapshot
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operator'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "service role escreve snapshot uapi" ON public.lalamove_uapi_snapshot;
CREATE POLICY "service role escreve snapshot uapi" ON public.lalamove_uapi_snapshot
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);