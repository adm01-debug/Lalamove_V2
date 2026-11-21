-- ============================================================================
-- geo_settings: modo `auto` + funcoes exclusivas do Mapbox (etapa 64 do plano Mapbox)
-- ----------------------------------------------------------------------------
-- 1. `auto` passa a ser aceito em provider/fallback_provider. O resolver do
--    geo-gateway (resolver.ts) ja implementa a regra: escolhe o provedor com
--    franquia gratuita sobrando para o SKU da funcao; empate -> mapbox;
--    nenhum com franquia -> o mais barato por 1.000.
-- 2. isochrone, optimization e tilequery existem no gateway e no front
--    (map-tools), mas nao podiam ser configuradas: o CHECK rejeitava a linha.
--    Sem linha em geo_settings o gateway cai em DEFAULT_SETTINGS; agora o
--    admin consegue ligar/desligar cada uma pela tela /settings/maps.
-- ============================================================================

ALTER TABLE public.geo_settings
  DROP CONSTRAINT IF EXISTS geo_settings_function_check;
ALTER TABLE public.geo_settings
  ADD CONSTRAINT geo_settings_function_check
  CHECK (function IN (
    'tiles','autocomplete','geocode','reverse','route','matrix','static',
    'snap','validate','isochrone','optimization','tilequery'
  ));

ALTER TABLE public.geo_settings
  DROP CONSTRAINT IF EXISTS geo_settings_provider_check;
ALTER TABLE public.geo_settings
  ADD CONSTRAINT geo_settings_provider_check
  CHECK (provider IN ('google','mapbox','auto','off'));

ALTER TABLE public.geo_settings
  DROP CONSTRAINT IF EXISTS geo_settings_fallback_provider_check;
ALTER TABLE public.geo_settings
  ADD CONSTRAINT geo_settings_fallback_provider_check
  CHECK (fallback_provider IN ('google','mapbox','auto','off'));

-- Linhas das tres funcoes que so o Mapbox atende. `on conflict` preserva
-- qualquer ajuste ja feito em producao.
INSERT INTO public.geo_settings (function, provider, fallback_provider, config) VALUES
  ('isochrone',    'mapbox', NULL, '{}'),
  ('optimization', 'mapbox', NULL, '{}'),
  ('tilequery',    'mapbox', NULL, '{}')
ON CONFLICT (function) DO NOTHING;

COMMENT ON COLUMN public.geo_settings.provider IS
  'google | mapbox | auto | off. auto = provedor com franquia gratuita sobrando para o SKU; empate -> mapbox.';
