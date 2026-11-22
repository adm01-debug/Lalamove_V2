-- Etapa 14 do plano Mapbox (docs/planos/PLANO_MAPBOX_100_ETAPAS.md): place_id com prefixo
-- de provedor (M8). Hoje pickup_place_id/delivery_place_id/lalamove_stops.place_id sao
-- text livre; nada impede gravar um place_id sem saber de qual provedor ele veio (Google
-- Place ID e Mapbox mapbox_id tem formatos incompativeis entre si).
--
-- lalamove_stops.place_id tem um terceiro prefixo alem de google:/mapbox: — `lalamove:`,
-- gravado por supabase/functions/lalamove-api/coordinates.ts:69 (`place_id: `lalamove:${c.stopId}``)
-- quando a coordenada vem direto da cotação Lalamove (M2, etapa 17), nao de autocomplete.
-- pickup_place_id/delivery_place_id em lalamove_orders ficam so com google:/mapbox: porque
-- nenhum codigo atual escreve `lalamove:` nelas (verificado: nenhum arquivo em src/ ou
-- supabase/functions/ referencia essas duas colunas fora de types.ts gerado).
--
-- Verificado em produção antes desta migration (2026-11-22): lalamove_orders tem 50 linhas,
-- as duas colunas 100% NULL (nenhuma escrita hoje); lalamove_stops tem 0 linhas — o CHECK
-- abaixo valida contra os dados existentes sem risco de quebrar nada.

ALTER TABLE public.lalamove_orders
  ADD CONSTRAINT lalamove_orders_pickup_place_id_prefix_check
    CHECK (pickup_place_id IS NULL OR pickup_place_id ~ '^(google|mapbox):'),
  ADD CONSTRAINT lalamove_orders_delivery_place_id_prefix_check
    CHECK (delivery_place_id IS NULL OR delivery_place_id ~ '^(google|mapbox):');

ALTER TABLE public.lalamove_stops
  ADD CONSTRAINT lalamove_stops_place_id_prefix_check
    CHECK (place_id IS NULL OR place_id ~ '^(google|mapbox|lalamove):');
