CREATE OR REPLACE FUNCTION public.geo_point_to_polyline_m(plat double precision, plng double precision, polyline jsonb)
 RETURNS double precision
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n     integer;
  i     integer;
  best  double precision := NULL;
  d     double precision;
  a     jsonb; b jsonb;
BEGIN
  IF polyline IS NULL OR jsonb_typeof(polyline) <> 'array' THEN RETURN NULL; END IF;
  n := jsonb_array_length(polyline);
  IF n = 0 THEN RETURN NULL; END IF;
  IF n = 1 THEN
    a := polyline->0;
    RETURN geo_haversine_m(plat, plng, (a->>'lat')::double precision, (a->>'lng')::double precision);
  END IF;
  FOR i IN 0 .. n-2 LOOP
    a := polyline->i; b := polyline->(i+1);
    d := geo_point_to_segment_m(plat, plng,
           (a->>'lat')::double precision, (a->>'lng')::double precision,
           (b->>'lat')::double precision, (b->>'lng')::double precision);
    IF best IS NULL OR d < best THEN best := d; END IF;
  END LOOP;
  RETURN best;
END; $function$
