CREATE OR REPLACE FUNCTION public.geo_point_to_segment_m(plat double precision, plng double precision, alat double precision, alng double precision, blat double precision, blng double precision)
 RETURNS double precision
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  k    double precision := cos(radians(plat));
  v_ax double precision := (alng - plng) * k;
  v_ay double precision := (alat - plat);
  v_bx double precision := (blng - plng) * k;
  v_by double precision := (blat - plat);
  v_dx double precision;
  v_dy double precision;
  len2 double precision;
  t    double precision;
  cx   double precision;
  cy   double precision;
BEGIN
  v_dx := v_bx - v_ax; v_dy := v_by - v_ay;
  len2 := v_dx*v_dx + v_dy*v_dy;
  IF len2 = 0 THEN
    RETURN geo_haversine_m(plat, plng, alat, alng);
  END IF;
  t := GREATEST(0, LEAST(1, -(v_ax*v_dx + v_ay*v_dy) / len2));
  cx := v_ax + t*v_dx; cy := v_ay + t*v_dy;
  RETURN geo_haversine_m(plat, plng, plat + cy, plng + cx / k);
END; $function$
