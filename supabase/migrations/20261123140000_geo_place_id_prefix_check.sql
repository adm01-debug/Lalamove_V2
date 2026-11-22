-- Etapa 14 do plano Mapbox (docs/planos/PLANO_MAPBOX_100_ETAPAS.md).
--
-- `lalamove_orders.pickup_place_id` / `delivery_place_id` e `lalamove_stops.place_id` sao
-- `text` livre, sem constraint. O formato combinado e `<provedor>:<id>`
-- (`mapbox:<mapbox_id>` em geo-gateway/providers/mapbox.ts, `lalamove:<stopId>` em
-- lalamove-api/coordinates.ts e no autocomplete do front). Sem CHECK nada impedia um valor
-- sem prefixo entrar: o registro fica ambiguo e a troca de provedor de geocode (etapa 72)
-- nao consegue decidir se pode reusar o id sem re-geocodificar.
--
-- Risco de falhar em linha existente: nulo. As tres colunas estao 100% NULL hoje
-- (verificado em 2026-11-22: 50 pedidos, 0 linhas em lalamove_stops) e o CHECK aceita NULL.
-- `pickup_place_id`/`delivery_place_id` passam a ser escritos por
-- lalamove-api/coordinates.ts:nesta mesma entrega.

DO $$
BEGIN
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
