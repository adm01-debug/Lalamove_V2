-- Etapa 14 do plano Mapbox (docs/planos/PLANO_MAPBOX_100_ETAPAS.md): place_id com prefixo
-- de provedor (M8). As 3 colunas sao `text` livre; nada impede gravar um place_id sem saber
-- de qual provedor ele veio (Google Place ID e Mapbox mapbox_id tem formatos incompativeis).
--
-- ATENCAO — arquivo reescrito. A versao original desta migration (PR #198) criava constraints
-- com os nomes `*_prefix_check` e aceitava `lalamove:` apenas em `lalamove_stops`. Isso ficou
-- obsoleto quando a PR #199 passou a gravar `lalamove:<stopId>` tambem em
-- `lalamove_orders.pickup_place_id`/`delivery_place_id` (`lalamove-api/coordinates.ts`): a
-- coordenada do pedido vem da cotacao Lalamove, nao de um provedor de geocode, entao o prefixo
-- `lalamove:` e legitimo nas tres colunas.
--
-- Estado real de producao (verificado em 2026-11-22): as constraints ja existem com os nomes
-- `*_prefix_chk`, criadas por `20261123140000_geo_place_id_prefix_check.sql`, e aceitam
-- `mapbox|google|lalamove` nas 3 colunas. Este arquivo fica como no-op idempotente para o
-- ledger conseguir registrar a versao sem duplicar constraint nem inverter a regra.

DO $$
BEGIN
  -- Se as constraints equivalentes ainda nao existirem (banco novo, replay do zero),
  -- cria com o mesmo nome e mesma regra da 20261123140000.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lalamove_orders_pickup_place_id_prefix_chk') THEN
    ALTER TABLE public.lalamove_orders
      ADD CONSTRAINT lalamove_orders_pickup_place_id_prefix_chk
      CHECK (pickup_place_id IS NULL OR pickup_place_id ~ '^(mapbox|google|lalamove):');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lalamove_orders_delivery_place_id_prefix_chk') THEN
    ALTER TABLE public.lalamove_orders
      ADD CONSTRAINT lalamove_orders_delivery_place_id_prefix_chk
      CHECK (delivery_place_id IS NULL OR delivery_place_id ~ '^(mapbox|google|lalamove):');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lalamove_stops_place_id_prefix_chk') THEN
    ALTER TABLE public.lalamove_stops
      ADD CONSTRAINT lalamove_stops_place_id_prefix_chk
      CHECK (place_id IS NULL OR place_id ~ '^(mapbox|google|lalamove):');
  END IF;
END $$;
