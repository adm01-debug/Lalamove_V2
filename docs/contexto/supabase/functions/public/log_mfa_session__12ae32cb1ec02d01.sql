CREATE OR REPLACE FUNCTION public.log_mfa_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.mfa_sessions (user_id, aal_level, ip_address, user_agent)
  VALUES (auth.uid(), auth.jwt() ->> 'aal', NULL, NULL);
  RETURN NEW;
END;
$function$
