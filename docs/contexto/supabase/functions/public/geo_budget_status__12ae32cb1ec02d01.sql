CREATE OR REPLACE FUNCTION public.geo_budget_status()
 RETURNS TABLE(provider text, spent_usd numeric, limit_usd numeric, pct numeric, blocked boolean, warn boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.provider,
         COALESCE(u.spent, 0)::numeric(12,4)                          AS spent_usd,
         b.monthly_limit_usd                                           AS limit_usd,
         CASE WHEN b.monthly_limit_usd > 0
              THEN ROUND(COALESCE(u.spent,0) / b.monthly_limit_usd * 100, 1)
              ELSE CASE WHEN COALESCE(u.spent,0) > 0 THEN 100 ELSE 0 END END AS pct,
         (b.hard_stop AND COALESCE(u.spent,0) >= b.monthly_limit_usd AND COALESCE(u.spent,0) > 0) AS blocked,
         (b.monthly_limit_usd > 0 AND COALESCE(u.spent,0) >= b.monthly_limit_usd * b.alert_at_pct / 100.0) AS warn
    FROM geo_budget b
    LEFT JOIN (SELECT provider, SUM(est_cost_usd) AS spent FROM geo_usage_month GROUP BY provider) u
      ON u.provider = b.provider;
$function$
