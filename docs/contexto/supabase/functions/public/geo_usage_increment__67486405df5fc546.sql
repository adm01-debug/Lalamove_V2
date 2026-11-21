CREATE OR REPLACE FUNCTION public.geo_usage_increment(p_provider text, p_function text, p_sku text, p_count integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit    numeric(10,4);
  v_free    integer;
  v_used    bigint;
  v_billable integer;
  v_cost    numeric(12,4);
BEGIN
  SELECT unit_cost_per_1000, free_quota_month INTO v_unit, v_free
    FROM geo_price_list WHERE provider = p_provider AND sku = p_sku;
  IF v_unit IS NULL THEN v_unit := 0; v_free := 0; END IF;

  SELECT COALESCE(SUM(count),0) INTO v_used
    FROM geo_usage
   WHERE provider = p_provider AND sku = p_sku
     AND day >= date_trunc('month', CURRENT_DATE)::date;

  v_billable := GREATEST(0, (v_used + p_count) - GREATEST(v_used, v_free));
  v_cost := (v_billable::numeric / 1000.0) * v_unit;

  INSERT INTO geo_usage (day, provider, function, sku, count, est_cost_usd)
  VALUES (CURRENT_DATE, p_provider, p_function, p_sku, p_count, v_cost)
  ON CONFLICT (day, provider, function, sku) DO UPDATE
    SET count = geo_usage.count + EXCLUDED.count,
        est_cost_usd = geo_usage.est_cost_usd + EXCLUDED.est_cost_usd,
        updated_at = now();
END; $function$
