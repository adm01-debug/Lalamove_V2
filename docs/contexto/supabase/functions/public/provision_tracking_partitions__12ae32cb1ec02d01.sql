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
$function$
