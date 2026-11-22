-- Etapa 13 do plano de 100 etapas (Mapbox): o mapeamento de `accuracy` para a escala
-- interna `exact|high|medium|low` já existe em `_shared/geo-precision.ts` (coberto por
-- teste), mas o valor BRUTO de confiança que o provedor devolve era descartado — a coluna
-- `geocode_match_confidence` que o plano pede nunca foi criada. Sem ela não há como
-- auditar depois por que um endereço caiu em `medium` (rooftop vs interpolação de malha).
--
-- Guardamos o valor cru do provedor:
--   Mapbox v6  -> `properties.match_code.confidence` (ex.: "exact", "high", "low")
--   Google v4  -> `geometry.location_type` (ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER)
--   Lalamove   -> "LALAMOVE" (coordenada veio da cotação, é permanente)

ALTER TABLE public.lalamove_orders
  ADD COLUMN IF NOT EXISTS geocode_match_confidence text

ALTER TABLE public.lalamove_stops
  ADD COLUMN IF NOT EXISTS geocode_match_confidence text

COMMENT ON COLUMN public.lalamove_orders.geocode_match_confidence IS
  'Etapa 13: confiança bruta do provedor de geocode (Mapbox match_code.confidence / Google location_type / LALAMOVE). Complementa geocode_precision (escala normalizada).'

COMMENT ON COLUMN public.lalamove_stops.geocode_match_confidence IS
  'Etapa 13: confiança bruta do provedor de geocode da parada.'
