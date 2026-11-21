CREATE OR REPLACE FUNCTION public.get_active_uapi_token()
 RETURNS TABLE(access_token text, refresh_token text, user_fid text, token_age_hours numeric, needs_refresh boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    s.access_token,
    s.refresh_token,
    s.user_fid,
    EXTRACT(EPOCH FROM (now() - s.token_obtained_at)) / 3600 AS token_age_hours,
    EXTRACT(EPOCH FROM (now() - s.token_obtained_at)) / 3600 > 20 AS needs_refresh
  FROM public.lalamove_uapi_sessions s
  WHERE s.is_active = true
  LIMIT 1;
$function$
