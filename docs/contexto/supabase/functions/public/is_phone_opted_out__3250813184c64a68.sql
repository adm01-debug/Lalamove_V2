CREATE OR REPLACE FUNCTION public.is_phone_opted_out(p_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text := public.normalize_br_phone(p_phone);
BEGIN
  IF length(v_norm) < 10 THEN RETURN false; END IF;   -- telefone invalido nao bloqueia
  RETURN EXISTS (
    SELECT 1 FROM notification_optouts
    WHERE public.normalize_br_phone(phone) = v_norm
  );
END; $function$
