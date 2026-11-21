-- ============================================================================
-- Baseline Lalamove V2 — parte 2/3: colunas, indices e tabelas de integracao
-- ----------------------------------------------------------------------------
-- Idempotente e nao-destrutivo (IF NOT EXISTS / CREATE OR REPLACE / DROP .. IF
-- EXISTS). Nenhum DROP de dado. Prepara o schema para o fluxo real:
-- cotacao -> pedido -> webhook -> POD -> Bitrix24 SPA 1690.
-- ============================================================================

-- ── lalamove_orders: campos que o fluxo precisa ─────────────────────────
ALTER TABLE public.lalamove_orders
  ADD COLUMN IF NOT EXISTS service_type          text,            -- 14 serviceTypes BR (LALAGO, CAR, VAN, TRUCK330, ...)
  ADD COLUMN IF NOT EXISTS lalamove_status       text,            -- status cru da Lalamove (ASSIGNING_DRIVER, ON_GOING, ...)
  ADD COLUMN IF NOT EXISTS quotation_expires_at  timestamptz,     -- expiracao da cotacao (~5 min)
  ADD COLUMN IF NOT EXISTS driver_lalamove_id    text,            -- driverId v3 (numerico) OU driver_fid UAPI — ID da Lalamove, nao o UUID local
  ADD COLUMN IF NOT EXISTS driver_name           text,
  ADD COLUMN IF NOT EXISTS driver_phone          text,
  ADD COLUMN IF NOT EXISTS driver_plate          text,
  ADD COLUMN IF NOT EXISTS source                text DEFAULT 'painel',  -- painel | bitrix24 | uapi_import | externo
  ADD COLUMN IF NOT EXISTS spa_id                integer,         -- id do item no SPA 1690 do Bitrix24
  ADD COLUMN IF NOT EXISTS spa_category_id       integer;         -- funil (730 automatico, 1406 manual, ...)

-- CHECK do service_type apenas quando preenchido (nao quebra linhas legadas nulas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lalamove_orders_service_type_chk'
  ) THEN
    ALTER TABLE public.lalamove_orders
      ADD CONSTRAINT lalamove_orders_service_type_chk
      CHECK (service_type IS NULL OR service_type IN (
        'LALAGO','LALAPRO','LALAGOFOUR','CAR','CARFOURH','HATCHBACK','HATCHFOURH',
        'UV_FIORINO','UV_4H','VAN','VANFOURH','TRUCK330','TRUCK3_5T','TRUCK_6H'
      )) NOT VALID;   -- NOT VALID: nao varre as 50 linhas de seed existentes
  END IF;
END $$;

-- Pedido imediato nao tem scheduled_at; deixa de ser obrigatorio.
ALTER TABLE public.lalamove_orders ALTER COLUMN scheduled_at DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lalamove_orders_spa_id
  ON public.lalamove_orders (spa_id) WHERE spa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lalamove_orders_source
  ON public.lalamove_orders (source);

-- ── lalamove_stops: stopId da cotacao + unicidade por parada ────────────────
ALTER TABLE public.lalamove_stops
  ADD COLUMN IF NOT EXISTS stop_id text;   -- stopId retornado pela cotacao v3 (19 digitos)

-- unicidade (order_id, stop_index) habilita upsert idempotente de POD/POP
CREATE UNIQUE INDEX IF NOT EXISTS uq_lalamove_stops_order_stop_index
  ON public.lalamove_stops (order_id, stop_index);

-- ── lalamove_status_history: aceitar estados operacionais fora do enum ──────
-- O webhook grava DRIVER_CHANGED, FAILED, POD_DELIVERED etc. O enum estrito
-- derruba esses inserts. Widening enum -> text e nao-destrutivo.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='lalamove_status_history' AND column_name='status') = 'USER-DEFINED' THEN
    ALTER TABLE public.lalamove_status_history
      ALTER COLUMN status TYPE text USING status::text;
  END IF;
END $$;

-- ── lalamove_webhook_config: a URL registrada na Lalamove (GET /v3/webhook = 405) ──
CREATE TABLE IF NOT EXISTS public.lalamove_webhook_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment   text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox','production')),
  url           text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  registered_at timestamptz NOT NULL DEFAULT now(),
  registered_by uuid REFERENCES auth.users(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_config_active_env
  ON public.lalamove_webhook_config (environment) WHERE is_active;

ALTER TABLE public.lalamove_webhook_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage webhook config" ON public.lalamove_webhook_config;
CREATE POLICY "Admins manage webhook config" ON public.lalamove_webhook_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ── bitrix24_spa_sync: SPA 1690 (crm.item.*), substitui o modelo de deals ───
CREATE TABLE IF NOT EXISTS public.bitrix24_spa_sync (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  spa_id         integer NOT NULL,
  category_id    integer,
  last_stage     text,
  last_synced_at timestamptz,
  last_error     text,
  sync_status    text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','success','error')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bitrix24_spa_sync_order ON public.bitrix24_spa_sync (order_id);
CREATE INDEX IF NOT EXISTS idx_bitrix24_spa_sync_spa ON public.bitrix24_spa_sync (spa_id);

ALTER TABLE public.bitrix24_spa_sync ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manager view spa sync" ON public.bitrix24_spa_sync;
CREATE POLICY "Admin manager view spa sync" ON public.bitrix24_spa_sync
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

COMMENT ON TABLE public.lalamove_webhook_config IS 'URL de webhook registrada na Lalamove por ambiente (GET /v3/webhook retorna 405, mantemos o registro).';
COMMENT ON TABLE public.bitrix24_spa_sync IS 'Sincronizacao do pedido com o SPA 1690 do Bitrix24 (crm.item.*). Substitui bitrix24_sync (modelo de deals).';
COMMENT ON COLUMN public.lalamove_orders.driver_lalamove_id IS 'ID do motorista NA Lalamove (driverId v3 numerico ou driver_fid UAPI) — nunca o UUID da tabela drivers.';
COMMENT ON COLUMN public.lalamove_orders.service_type IS 'serviceType BR da v3 (14 valores). vehicle_type (enum de 4) passa a ser derivado deste.';
