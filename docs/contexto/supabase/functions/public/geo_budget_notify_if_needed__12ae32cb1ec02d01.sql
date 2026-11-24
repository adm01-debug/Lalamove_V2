CREATE OR REPLACE FUNCTION public.geo_budget_notify_if_needed()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
