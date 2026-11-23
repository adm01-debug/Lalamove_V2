CREATE OR REPLACE FUNCTION public.messaging_month_cost_cents(p_month date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(cost_cents), 0)::integer
    FROM messaging_usage
   WHERE day >= date_trunc('month', COALESCE(p_month, (now() AT TIME ZONE 'America/Sao_Paulo')::date))::date
     AND day <  (date_trunc('month', COALESCE(p_month, (now() AT TIME ZONE 'America/Sao_Paulo')::date)) + interval '1 month')::date;
$function$
