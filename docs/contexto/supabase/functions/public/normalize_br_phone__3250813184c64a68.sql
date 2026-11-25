CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  d text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
BEGIN
  IF length(d) > 11 AND left(d, 2) = '55' THEN d := substr(d, 3); END IF;
  IF length(d) = 11 AND substr(d, 3, 1) = '9' THEN
    d := substr(d, 1, 2) || substr(d, 4);
  END IF;
  RETURN d;
END; $function$
