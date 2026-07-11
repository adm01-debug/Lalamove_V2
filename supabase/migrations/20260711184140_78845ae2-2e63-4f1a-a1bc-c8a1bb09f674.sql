
-- Verificações de geo/IP são enforcement de backend (edge/service_role),
-- não devem ser expostas a anon/authenticated na Data API.
REVOKE ALL ON FUNCTION public.is_country_blocked(text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_ip_blocked(inet)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_ip_whitelisted(inet)   FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_country_blocked(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(inet)      TO service_role;
GRANT EXECUTE ON FUNCTION public.is_ip_whitelisted(inet)  TO service_role;
