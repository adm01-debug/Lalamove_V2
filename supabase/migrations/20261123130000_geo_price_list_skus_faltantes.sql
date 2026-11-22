-- Precos ausentes em geo_price_list: SKUs que o codigo ja cobra/usa mas que ficaram
-- fora do seed de 20261122130100. Sem linha aqui, geo_usage_increment cai no
-- `IF v_unit IS NULL THEN v_unit := 0` e todo chamada e contabilizada como custo ZERO.
--
-- Fontes: mapbox.com/pricing (2026-11) e docs/MAPBOX.md:42
-- (geocoding_permanent = US$ 5,00/1k, sem faixa gratis).

INSERT INTO public.geo_price_list (provider, sku, free_quota_month, unit_cost_per_1000, note) VALUES
  -- usado por useRegionResolver.ts:192 (`persist: true`) — reverse permanente.
  ('mapbox','geocoding_permanent', 0,     5.00, 'Geocoding v6 permanent (retido no banco, sem faixa gratis)'),
  -- actions `isochrone` e `tilequery` do geo-gateway (resolver.PRIMARY_SKU).
  ('mapbox','isochrone',           0,     2.00, 'Isochrone API (por requisicao)'),
  ('mapbox','tilequery',           0,     2.00, 'Tilequery API (por requisicao)')
ON CONFLICT (provider, sku) DO UPDATE
  SET free_quota_month   = EXCLUDED.free_quota_month,
      unit_cost_per_1000 = EXCLUDED.unit_cost_per_1000,
      note               = EXCLUDED.note,
      updated_at         = now();
