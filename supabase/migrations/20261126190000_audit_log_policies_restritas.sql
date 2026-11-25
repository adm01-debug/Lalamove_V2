-- ============================================================================
-- Fecha `public.audit_log` para escrita/leitura de cliente.
--
-- Estado anterior (conferido em producao): duas policies para o role `public`,
-- sem qualificacao nenhuma — INSERT `with check (true)` e SELECT
-- `auth.uid() IS NOT NULL`. `authenticated` ainda tinha GRANT de UPDATE,
-- DELETE e TRUNCATE na tabela.
--
-- Quem realmente escreve nessa tabela sao tres produtores, todos como
-- SECURITY DEFINER (owner `postgres`, que ignora RLS):
--   * `public.geo_audit_config` — trigger de geo_settings, geo_budget e
--     geo_defaults;
--   * `public.create_audit_log` — RPC, e desde a 20261126150000 e
--     service_role-only;
--   * a edge function `geo-admin`, com service_role.
--
-- Nenhum arquivo em `src/` le ou escreve `audit_log` (o unico consumidor no
-- front e um texto explicativo em `MapsSettingsPage.tsx:984`), entao a
-- limitacao nao quebra tela nenhuma.
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================
BEGIN;

-- Least privilege na tabela: nenhuma policy existe para UPDATE/DELETE e o RLS
-- ja negaria as duas operacoes; TRUNCATE nem passa por RLS. Os grants eram
-- superficie sem uso.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.audit_log FROM authenticated;

-- INSERT: continua existindo um caminho autenticado, mas agora ele so pode
-- registrar evento em nome de si mesmo (`user_id = auth.uid()`), o que fecha a
-- forja de trilha por um usuario `viewer`/`operator`.
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT: a trilha de auditoria nao e para qualquer perfil. Antes, qualquer
-- usuario logado lia 100% dela. O painel que fala de auditoria
-- (`MapsSettingsPage.tsx:980`) e a rota `/security` (`src/App.tsx:159`) sao
-- admin-only.
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- Verificacao: falha alto e reverte se sobrou policy permissiva.
DO $$
DECLARE
  v_pol text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO v_pol
    FROM pg_policies
   WHERE tablename = 'audit_log'
     AND ( (cmd = 'INSERT' AND coalesce(with_check, 'true') = 'true')
        OR (cmd = 'SELECT' AND coalesce(qual, 'true') = 'true')
        OR roles::text[] && array['public','anon'] );
  IF v_pol IS NOT NULL THEN
    RAISE EXCEPTION 'policy permissiva sobrou em audit_log: %', v_pol;
  END IF;
END $$;

COMMIT;