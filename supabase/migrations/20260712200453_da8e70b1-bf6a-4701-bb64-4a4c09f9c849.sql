-- 1) Substitui a política permissiva em todas as tabelas de tracking_events.
DO $$
DECLARE
  v_tbl text;
BEGIN
  FOR v_tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname='public' AND tablename LIKE 'tracking_events%'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Allow authenticated users to view tracking" ON public.%I',
      v_tbl
    );
    EXECUTE format(
      'CREATE POLICY "Operational roles can view tracking" ON public.%I
         FOR SELECT USING (
           public.has_role(auth.uid(), ''admin'')
           OR public.has_role(auth.uid(), ''manager'')
           OR public.has_role(auth.uid(), ''operator'')
           OR public.has_role(auth.uid(), ''viewer'')
         )',
      v_tbl
    );
  END LOOP;
END $$;

-- 2) Atualiza a função de provisionamento de partições para gerar a política correta.
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
  IF to_regclass(v_qualified) IS NOT NULL THEN
    RETURN format('partition %s already exists', v_part_name);
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM public.tracking_events_default WHERE created_at >= %L AND created_at < %L',
    v_start, v_end
  ) INTO v_default_rows;

  IF v_default_rows > 0 THEN
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
    EXECUTE format(
      'CREATE TABLE %s PARTITION OF public.tracking_events FOR VALUES FROM (%L) TO (%L)',
      v_qualified, v_start, v_end
    );
  END IF;

  -- RLS + política restrita por papéis operacionais (espelha o pai corrigido).
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_qualified);
  EXECUTE format(
    'CREATE POLICY "Operational roles can view tracking" ON %s FOR SELECT USING (
       public.has_role(auth.uid(), ''admin'')
       OR public.has_role(auth.uid(), ''manager'')
       OR public.has_role(auth.uid(), ''operator'')
       OR public.has_role(auth.uid(), ''viewer'')
     )',
    v_qualified
  );

  RETURN format('partition %s created (moved %s rows from default)', v_part_name, v_default_rows);
END;
$function$;