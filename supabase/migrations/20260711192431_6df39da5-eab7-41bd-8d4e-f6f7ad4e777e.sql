-- ============================================================
-- Automação de partições mensais de tracking_events (RLS-safe)
-- Autor: DB Engineering — RLS-First Architecture
-- ============================================================

-- Função idempotente: cria a partição do mês informado (se ausente),
-- movendo linhas presas na partição DEFAULT quando necessário,
-- e aplicando a política RLS de SELECT idêntica ao pai.
CREATE OR REPLACE FUNCTION public.ensure_tracking_events_partition(p_month date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start        date := date_trunc('month', p_month)::date;
  v_end          date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_part_name    text := format('tracking_events_y%sm%s',
                                 to_char(v_start, 'YYYY'), to_char(v_start, 'MM'));
  v_qualified    text := format('public.%I', v_part_name);
  v_default_rows bigint := 0;
BEGIN
  -- Já existe? Nada a fazer (idempotência).
  IF to_regclass(v_qualified) IS NOT NULL THEN
    RETURN format('partition %s already exists', v_part_name);
  END IF;

  -- Verifica se há linhas do intervalo presas na partição DEFAULT.
  EXECUTE format(
    'SELECT count(*) FROM public.tracking_events_default WHERE created_at >= %L AND created_at < %L',
    v_start, v_end
  ) INTO v_default_rows;

  IF v_default_rows > 0 THEN
    -- Desanexa o DEFAULT, cria a nova partição, migra as linhas e reanexa.
    EXECUTE 'ALTER TABLE public.tracking_events DETACH PARTITION public.tracking_events_default';

    EXECUTE format(
      'CREATE TABLE %s PARTITION OF public.tracking_events FOR VALUES FROM (%L) TO (%L)',
      v_qualified, v_start, v_end
    );

    EXECUTE format(
      'WITH moved AS (DELETE FROM public.tracking_events_default WHERE created_at >= %L AND created_at < %L RETURNING *)
       INSERT INTO %s SELECT * FROM moved',
      v_start, v_end, v_qualified
    );

    EXECUTE 'ALTER TABLE public.tracking_events ATTACH PARTITION public.tracking_events_default DEFAULT';
  ELSE
    -- Caminho simples: sem colisão com DEFAULT.
    EXECUTE format(
      'CREATE TABLE %s PARTITION OF public.tracking_events FOR VALUES FROM (%L) TO (%L)',
      v_qualified, v_start, v_end
    );
  END IF;

  -- Aplica RLS + política de SELECT espelhando o pai.
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_qualified);
  EXECUTE format(
    'CREATE POLICY "Allow authenticated users to view tracking" ON %s FOR SELECT USING (auth.role() = ''authenticated'')',
    v_qualified
  );

  RETURN format('partition %s created (moved %s rows from default)', v_part_name, v_default_rows);
END;
$function$;

-- Restringe execução ao service_role (uso interno/manutenção).
REVOKE EXECUTE ON FUNCTION public.ensure_tracking_events_partition(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_tracking_events_partition(date) TO service_role;

-- Orquestrador: garante o mês atual e os próximos 2 meses (buffer proativo).
CREATE OR REPLACE FUNCTION public.provision_tracking_partitions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_i int;
BEGIN
  FOR v_i IN 0..2 LOOP
    v_results := v_results || to_jsonb(
      public.ensure_tracking_events_partition((date_trunc('month', now()) + (v_i || ' month')::interval)::date)
    );
  END LOOP;
  RETURN jsonb_build_object('provisioned_at', now(), 'results', v_results);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.provision_tracking_partitions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tracking_partitions() TO service_role;

-- Backfill imediato: fecha o gap atual (julho/2026 em diante).
SELECT public.provision_tracking_partitions();

-- Agendamento mensal via pg_cron: dia 1 às 00:05 UTC.
SELECT cron.schedule(
  'provision-tracking-partitions',
  '5 0 1 * *',
  $$SELECT public.provision_tracking_partitions();$$
);