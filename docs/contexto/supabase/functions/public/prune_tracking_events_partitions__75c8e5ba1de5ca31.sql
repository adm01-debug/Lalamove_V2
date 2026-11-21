CREATE OR REPLACE FUNCTION public.prune_tracking_events_partitions(p_retention_months integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff   date := (date_trunc('month', now()) - (p_retention_months || ' month')::interval)::date;
  v_part     record;
  v_start    date;
  v_dropped  jsonb := '[]'::jsonb;
BEGIN
  FOR v_part IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE i.inhparent = 'public.tracking_events'::regclass
      AND c.relname ~ '^tracking_events_y[0-9]{4}m[0-9]{2}$'
  LOOP
    -- Deriva a data-início a partir do nome (tracking_events_yYYYYmMM).
    v_start := to_date(
      substring(v_part.relname from 'y([0-9]{4})m') ||
      substring(v_part.relname from 'm([0-9]{2})$'),
      'YYYYMM'
    );

    IF v_start < v_cutoff THEN
      EXECUTE format('DROP TABLE public.%I', v_part.relname);
      v_dropped := v_dropped || to_jsonb(v_part.relname);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'pruned_at', now(),
    'retention_months', p_retention_months,
    'cutoff', v_cutoff,
    'dropped_partitions', v_dropped
  );
END;
$function$
