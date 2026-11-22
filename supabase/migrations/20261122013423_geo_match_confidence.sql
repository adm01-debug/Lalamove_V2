-- Etapa 13 do plano Mapbox (docs/planos/PLANO_MAPBOX_100_ETAPAS.md): coluna para guardar a
-- confiança do match de geocode (`GeoAddress.match_confidence`, ja calculada pelo provider
-- Mapbox em supabase/functions/geo-gateway/providers/mapbox.ts, mas ainda sem onde persistir).
--
-- Só a coluna: nenhum código grava nela ainda (wiring de persistência fica para quando o
-- resultado do geocode for salvo em lalamove_orders, fora do escopo desta etapa).

ALTER TABLE public.lalamove_orders
  ADD COLUMN IF NOT EXISTS geocode_match_confidence text;

COMMENT ON COLUMN public.lalamove_orders.geocode_match_confidence IS
  'Confiança do match de geocode (ex.: Mapbox match_code.confidence). Escala por provedor, não normalizada — ver supabase/functions/_shared/geo-precision.ts para a escala normalizada (geocode_precision).';
