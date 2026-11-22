-- Testes das funcoes de geometria da geo_foundation (etapa 17 do plano
-- Google Maps). Roda com `psql -v ON_ERROR_STOP=1 -f` num Postgres 16 limpo:
-- cada assert levanta excecao quando falha, entao o exit code e o veredito.
--
-- Casos conhecidos:
--   Curitiba Centro -> Jardim Botanico              ~ 4.160 m geodesicos
--     (o plano cita 3,2 km porque la a referencia era a distancia de ROTA;
--      em linha reta entre as coordenadas acima da 4,16 km)
--   Ponto a 0.001 grau de latitude ao norte          ~ 111 m
--   Distancia de ponto a si mesmo                     = 0
--   Ponto sobre um segmento                          ~ 0 m
--   Ponto a 0.01 grau (~1,1 km) de um segmento       ~ 1.100 m
--   Polilinha com 2 vertices: menor distancia entre eles

\set ON_ERROR_STOP on

DO $test$
DECLARE
  d double precision;
  r record;
  seg double precision := 0.0;
  poly jsonb := '[{"lat":-25.4400,"lng":-49.2700},{"lat":-25.4500,"lng":-49.2700}]'::jsonb;
BEGIN
  -- 1. haversine: Centro de Curitiba -> Jardim Botanico (4,16 km geodesicos)
  d := public.geo_haversine_m(-25.4284, -49.2733, -25.4480, -49.2380);
  ASSERT d BETWEEN 4050 AND 4270, format('Centro->Jardim Botanico: esperado ~4160 m, veio %s', d);

  -- 2. haversine: 0.001 grau de latitude ~ 111 m
  d := public.geo_haversine_m(-25.4284, -49.2733, -25.4274, -49.2733);
  ASSERT d BETWEEN 105 AND 117, format('0.001 grau lat: esperado ~111 m, veio %s', d);

  -- 3. haversine: mesmo ponto = 0
  d := public.geo_haversine_m(-25.4284, -49.2733, -25.4284, -49.2733);
  ASSERT d = 0, format('mesmo ponto deve dar 0, veio %s', d);

  -- 4. ponto sobre o segmento = 0
  d := public.geo_point_to_segment_m(-25.4450, -49.2700, -25.4400, -49.2700, -25.4500, -49.2700);
  ASSERT d < 1, format('ponto sobre segmento deve dar ~0, veio %s', d);

  -- 5. ponto a 0.01 grau de longitude do segmento (~1.000 m nesta latitude)
  d := public.geo_point_to_segment_m(-25.4450, -49.2600, -25.4400, -49.2700, -25.4500, -49.2700);
  ASSERT d BETWEEN 900 AND 1100, format('ponto a 0.01 grau: esperado ~1000 m, veio %s', d);

  -- 6. polilinha de 2 vertices = menor distancia entre os dois segmentos
  d := public.geo_point_to_polyline_m(-25.4450, -49.2600, poly);
  ASSERT d BETWEEN 900 AND 1100, format('polilinha: esperado ~1000 m, veio %s', d);

  -- 7. polilinha vazia nao explode (devolve NULL)
  d := public.geo_point_to_polyline_m(-25.4450, -49.2600, '[]'::jsonb);
  ASSERT d IS NULL, format('polilinha vazia deve devolver NULL, veio %s', d);

  RAISE NOTICE 'geo_functions: 7 asserts OK';
END
$test$;
