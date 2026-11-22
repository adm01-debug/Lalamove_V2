-- ============================================================================
-- Aviso proativo de orcamento geo (Google/Mapbox) antes do bloqueio
--
-- Hoje a unica reacao a orcamento existe em runtime: o resolver do geo-gateway
-- (supabase/functions/geo-gateway/resolver.ts) bloqueia chamadas com HTTP 429
-- quando geo_budget_status().blocked fica true (gasto >= 100% do limite
-- mensal). Nada avisa ANTES disso. Nenhum cron/job chamava
-- geo_budget_status() periodicamente (conferido em cron.job e em
-- supabase/functions/job-worker/ antes desta migration).
--
-- Esta migration fecha essa lacuna com um job pg_cron puramente SQL (sem HTTP,
-- sem secret nova): a cada 6h chama geo_budget_notify_if_needed(), que roda
-- geo_budget_status() por provedor e, ao cruzar o limiar configurado
-- (geo_budget.alert_at_pct, default 80%) ou o bloqueio (100%, hard_stop),
-- grava em alerts e enfileira via add_job('notification', ...) — o mesmo
-- caminho que geo_emit_event() ja usa; o dispatcher existente
-- (process_job_queue, cron a cada minuto) entrega ao job-worker/
-- send-notification sem nenhum componente novo.
--
-- Frequencia 6/6h: orcamento e um acumulado mensal que varia pouco de hora a
-- hora: 4 verificacoes por dia avisam bem antes do fechamento do mes sem
-- cron/chamada extra desnecessaria.
--
-- Idempotencia (2 avisos possiveis por provedor por mes, cada um 1x):
--   - geo_budget.warned_month         -> aviso WARNING ao cruzar alert_at_pct%
--                                        (coluna ja criada em
--                                        20261122130100_geo_foundation.sql
--                                        para este fim exato)
--   - geo_budget.blocked_warned_month -> aviso CRITICAL ao cruzar 100%/bloqueio
--                                        (coluna nova desta migration)
-- Cada aviso "reivindica" o direito de alertar com um UPDATE ... WHERE
-- warned_month < mes_atual ... RETURNING, atomico — mesmo espirito do
-- INSERT ... ON CONFLICT DO NOTHING ... RETURNING de order_geo_events /
-- geo_emit_event (so segue quem conseguir reivindicar; corrida concorrente
-- entre execucoes do cron nao duplica o aviso).
-- ============================================================================

ALTER TABLE public.geo_budget
  ADD COLUMN IF NOT EXISTS blocked_warned_month date;  -- mes em que o aviso CRITICAL (100%/bloqueio) ja foi emitido

CREATE OR REPLACE FUNCTION public.geo_budget_notify_if_needed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  v_claimed  boolean;
  v_alert_id uuid;
  v_title    text;
  v_message  text;
  v_count    integer := 0;
BEGIN
  FOR r IN SELECT * FROM geo_budget_status() LOOP

    -- 1) Aviso WARNING ao cruzar o limiar configurado (default 80%) --------
    IF r.warn AND NOT r.blocked THEN
      v_claimed := false;
      UPDATE geo_budget
         SET warned_month = date_trunc('month', now())::date,
             updated_at = now()
       WHERE provider = r.provider
         AND (warned_month IS NULL OR warned_month < date_trunc('month', now())::date)
      RETURNING true INTO v_claimed;

      IF COALESCE(v_claimed, false) THEN
        v_title   := format('Orcamento de mapas: %s em %s%%', r.provider, r.pct);
        v_message := format(
          'Uso do provedor %s atingiu %s%% do orcamento mensal (US$ %s de US$ %s).',
          r.provider, r.pct, r.spent_usd, r.limit_usd);

        INSERT INTO alerts (type, severity, title, message, metadata)
        VALUES ('GEO_BUDGET_WARNING', 'WARNING', v_title, v_message,
                jsonb_build_object('provider', r.provider, 'pct', r.pct, 'spent_usd', r.spent_usd,
                                    'limit_usd', r.limit_usd, 'blocked', false, 'source', 'geo_budget_cron'))
        RETURNING id INTO v_alert_id;

        PERFORM add_job(
          'notification',
          jsonb_build_object(
            'alert_id', v_alert_id, 'type', 'GEO_BUDGET_WARNING', 'severity', 'WARNING',
            'title', v_title, 'message', v_message,
            'metadata', jsonb_build_object('provider', r.provider, 'pct', r.pct,
                                            'spent_usd', r.spent_usd, 'limit_usd', r.limit_usd)),
          5, 3,
          'geo_budget:' || r.provider || ':' || to_char(now(), 'YYYYMM') || ':warn',
          jsonb_build_object('source', 'geo_budget_cron'));

        v_count := v_count + 1;
      END IF;
    END IF;

    -- 2) Aviso CRITICAL ao cruzar o bloqueio (100%, hard_stop) --------------
    IF r.blocked THEN
      v_claimed := false;
      UPDATE geo_budget
         SET blocked_warned_month = date_trunc('month', now())::date,
             updated_at = now()
       WHERE provider = r.provider
         AND (blocked_warned_month IS NULL OR blocked_warned_month < date_trunc('month', now())::date)
      RETURNING true INTO v_claimed;

      IF COALESCE(v_claimed, false) THEN
        v_title   := format('Orcamento de mapas BLOQUEADO: %s', r.provider);
        v_message := format(
          'O provedor %s atingiu %s%% do orcamento mensal (US$ %s de US$ %s) - chamadas novas '
          'estao bloqueadas (HTTP 429) ate o fechamento do mes ou aumento do limite.',
          r.provider, r.pct, r.spent_usd, r.limit_usd);

        INSERT INTO alerts (type, severity, title, message, metadata)
        VALUES ('GEO_BUDGET_WARNING', 'CRITICAL', v_title, v_message,
                jsonb_build_object('provider', r.provider, 'pct', r.pct, 'spent_usd', r.spent_usd,
                                    'limit_usd', r.limit_usd, 'blocked', true, 'source', 'geo_budget_cron'))
        RETURNING id INTO v_alert_id;

        PERFORM add_job(
          'notification',
          jsonb_build_object(
            'alert_id', v_alert_id, 'type', 'GEO_BUDGET_WARNING', 'severity', 'CRITICAL',
            'title', v_title, 'message', v_message,
            'metadata', jsonb_build_object('provider', r.provider, 'pct', r.pct,
                                            'spent_usd', r.spent_usd, 'limit_usd', r.limit_usd)),
          4, 3,
          'geo_budget:' || r.provider || ':' || to_char(now(), 'YYYYMM') || ':blocked',
          jsonb_build_object('source', 'geo_budget_cron'));

        v_count := v_count + 1;
      END IF;
    END IF;

  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.geo_budget_notify_if_needed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geo_budget_notify_if_needed() TO service_role;

COMMENT ON FUNCTION public.geo_budget_notify_if_needed() IS
  'Roda geo_budget_status() por provedor e emite GEO_BUDGET_WARNING (alerts + job notification) '
  '1x por mes ao cruzar alert_at_pct% (WARNING) e 1x ao cruzar o bloqueio 100% (CRITICAL). '
  'Agendada via pg_cron a cada 6h (job geo-budget-notify).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'geo-budget-notify') THEN
      PERFORM cron.unschedule('geo-budget-notify');
    END IF;
    PERFORM cron.schedule(
      'geo-budget-notify',
      '0 */6 * * *',
      $cron$SELECT public.geo_budget_notify_if_needed();$cron$
    );
  END IF;
END $$;
