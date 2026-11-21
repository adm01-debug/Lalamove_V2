CREATE OR REPLACE FUNCTION public.increment_contract_usage(p_contract_name text, p_contract_version text, p_deprecated boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.contract_version_usage
    (contract_name, contract_version, deprecated, usage_date, request_count, last_seen_at)
  VALUES
    (p_contract_name, p_contract_version, p_deprecated, current_date, 1, now())
  ON CONFLICT (contract_name, contract_version, usage_date)
  DO UPDATE SET
    request_count = public.contract_version_usage.request_count + 1,
    last_seen_at  = now(),
    deprecated    = EXCLUDED.deprecated;
$function$
