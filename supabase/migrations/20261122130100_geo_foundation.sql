-- ============================================================================
-- Geo (Google Maps / Mapbox) — Bloco 1, parte B: fundacao de dados
-- Plano: claude/google-maps-x-lalamove-v2-plano-100-etapas-2026-11-21.md (etapas 11-20)
--
-- Cria:
--   geo_settings        provedor por funcao (google|mapbox|off) + fallback
--   geo_price_list      tabela de precos (cota gratis/mes + custo por 1.000)
--   geo_usage           uso diario por provedor/funcao/sku + custo estimado
--   geo_budget          orcamento mensal por provedor + RPC geo_budget_status()
--   geo_cache           cache de respostas (TTL por funcao) + cron de limpeza
--   order_geo_events    eventos geograficos por pedido (idempotente)
--   colunas             lalamove_orders / lalamove_stops / active_tracking
--   funcoes SQL         haversine, ponto->segmento, ponto->polyline
--   trigger             geo_evaluate_tracking() em active_tracking (metricas + eventos)
-- Nao usa PostGIS (decisao D8).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. geo_settings — provedor por funcao
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_settings (
  function          text PRIMARY KEY
                    CHECK (function IN ('tiles','autocomplete','geocode','reverse','route','matrix','static','snap','validate')),
  provider          text NOT NULL CHECK (provider IN ('google','mapbox','off')),
  fallback_provider text CHECK (fallback_provider IN ('google','mapbox','off')),
  config            jsonb NOT NULL DEFAULT '{}'::jsonb,   -- ex.: {"approach_radius_m":500,"approach_eta_min":5,"quiet_hours":{"start":"07:00","end":"20:00"}}
  updated_by        uuid REFERENCES auth.users(id),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Seed conforme decisao D6 (mapa Mapbox; autocomplete/geocode/rota/matrix/static Google; snap/validate off)
INSERT INTO public.geo_settings (function, provider, fallback_provider, config) VALUES
  ('tiles',        'mapbox', 'google', '{}'),
  ('autocomplete', 'google', 'mapbox', '{"region":"br","bias":{"lat":-25.4284,"lng":-49.2733,"radius_m":60000}}'),
  ('geocode',      'google', 'mapbox', '{"region":"br"}'),
  ('reverse',      'google', 'mapbox', '{}'),
  ('route',        'google', 'mapbox', '{"travel_mode":"DRIVE"}'),
  ('matrix',       'google', 'mapbox', '{"refresh_seconds":60,"refresh_moved_m":300,"traffic_when_eta_le_min":15}'),
  ('static',       'google', 'mapbox', '{}'),
  ('snap',         'off',    NULL,     '{}'),
  ('validate',     'off',    NULL,     '{}')
ON CONFLICT (function) DO NOTHING;

-- Parametros globais de geofence/notificacao (D3, D4, D5) — linha unica
CREATE TABLE IF NOT EXISTS public.geo_defaults (
  id                        boolean PRIMARY KEY DEFAULT true CHECK (id),  -- singleton
  approach_radius_m         integer NOT NULL DEFAULT 500,
  approach_eta_min          integer NOT NULL DEFAULT 5,
  arrived_radius_m          integer NOT NULL DEFAULT 100,
  off_route_threshold_m     integer NOT NULL DEFAULT 300,
  notify_delivery_contact   boolean NOT NULL DEFAULT false,
  quiet_hours_start         time    NOT NULL DEFAULT '07:00',
  quiet_hours_end           time    NOT NULL DEFAULT '20:00',
  quiet_hours_tz            text    NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_by                uuid REFERENCES auth.users(id),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.geo_defaults (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. geo_price_list + geo_usage — medicao de custo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_price_list (
  provider             text NOT NULL CHECK (provider IN ('google','mapbox')),
  sku                  text NOT NULL,
  free_quota_month     integer NOT NULL DEFAULT 0,
  unit_cost_per_1000   numeric(10,4) NOT NULL,   -- USD, primeira faixa (0-100k)
  note                 text,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, sku)
);

-- Fonte: developers.google.com/maps/billing-and-pricing/pricing (atualizado 2026-11-12) e mapbox.com/pricing
INSERT INTO public.geo_price_list (provider, sku, free_quota_month, unit_cost_per_1000, note) VALUES
  ('google','dynamic_maps',                 10000,  7.00, 'Maps JavaScript - map load (Essentials)'),
  ('google','static_maps',                  10000,  2.00, 'Static Maps (Essentials)'),
  ('google','places_autocomplete_request',  10000,  2.83, 'Autocomplete por requisicao (Essentials)'),
  ('google','places_autocomplete_session',  0,      0.00, 'Sessao de autocomplete: gratis; cobra o Place Details'),
  ('google','place_details_essentials',     10000,  5.00, 'Place Details (location, formattedAddress, addressComponents)'),
  ('google','place_details_ids_only',       0,      0.00, 'IDs only: gratis ilimitado'),
  ('google','geocoding',                    10000,  5.00, 'Geocoding v4 forward/reverse (Essentials)'),
  ('google','address_validation',           5000,  17.00, 'Address Validation (Pro)'),
  ('google','routes_compute_routes',        10000,  5.00, 'Compute Routes Essentials'),
  ('google','routes_compute_routes_pro',    5000,  10.00, 'Compute Routes Pro (TRAFFIC_AWARE / departureTime now)'),
  ('google','routes_compute_routes_ent',    1000,  15.00, 'Compute Routes Enterprise (2 rodas / veiculo grande)'),
  ('google','routes_matrix',                10000,  5.00, 'Route Matrix Essentials (por elemento)'),
  ('google','routes_matrix_pro',            5000,  10.00, 'Route Matrix Pro (por elemento)'),
  ('google','roads_nearest_road',           5000,  10.00, 'Roads Nearest Road (Pro)'),
  ('mapbox','map_load',                     50000,  5.00, 'Map Loads GL JS'),
  ('mapbox','static_image',                 50000,  1.00, 'Static Images'),
  ('mapbox','geocoding_temporary',          100000, 0.75, 'Geocoding v6 temporary'),
  ('mapbox','searchbox_session',            2500,  11.50, 'Search Box API sessions'),
  ('mapbox','directions',                   100000, 2.00, 'Directions API'),
  ('mapbox','matrix',                       100000, 2.00, 'Matrix API (por elemento)'),
  ('mapbox','map_matching',                 100000, 2.00, 'Map Matching API'),
  ('mapbox','optimization',                 100000, 2.00, 'Optimization API')
ON CONFLICT (provider, sku) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.geo_usage (
  day            date NOT NULL,
  provider       text NOT NULL CHECK (provider IN ('google','mapbox')),
  function       text NOT NULL,
  sku            text NOT NULL,
  count          integer NOT NULL DEFAULT 0,
  est_cost_usd   numeric(12,4) NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, provider, function, sku)
);
CREATE INDEX IF NOT EXISTS idx_geo_usage_month ON public.geo_usage (provider, day);

-- Incrementa uso e custo estimado (considera cota gratis do mes por sku)
CREATE OR REPLACE FUNCTION public.geo_usage_increment(
  p_provider text, p_function text, p_sku text, p_count integer DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit    numeric(10,4);
  v_free    integer;
  v_used    bigint;
  v_billable integer;
  v_cost    numeric(12,4);
BEGIN
  SELECT unit_cost_per_1000, free_quota_month INTO v_unit, v_free
    FROM geo_price_list WHERE provider = p_provider AND sku = p_sku;
  IF v_unit IS NULL THEN v_unit := 0; v_free := 0; END IF;

  SELECT COALESCE(SUM(count),0) INTO v_used
    FROM geo_usage
   WHERE provider = p_provider AND sku = p_sku
     AND day >= date_trunc('month', CURRENT_DATE)::date;

  v_billable := GREATEST(0, (v_used + p_count) - GREATEST(v_used, v_free));
  v_cost := (v_billable::numeric / 1000.0) * v_unit;

  INSERT INTO geo_usage (day, provider, function, sku, count, est_cost_usd)
  VALUES (CURRENT_DATE, p_provider, p_function, p_sku, p_count, v_cost)
  ON CONFLICT (day, provider, function, sku) DO UPDATE
    SET count = geo_usage.count + EXCLUDED.count,
        est_cost_usd = geo_usage.est_cost_usd + EXCLUDED.est_cost_usd,
        updated_at = now();
END; $$;

-- ----------------------------------------------------------------------------
-- 3. geo_budget — orcamento mensal por provedor (D11)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_budget (
  provider           text PRIMARY KEY CHECK (provider IN ('google','mapbox')),
  monthly_limit_usd  numeric(10,2) NOT NULL DEFAULT 0,
  hard_stop          boolean NOT NULL DEFAULT true,
  alert_at_pct       integer NOT NULL DEFAULT 80 CHECK (alert_at_pct BETWEEN 1 AND 100),
  warned_month       date,                       -- mes em que GEO_BUDGET_WARNING ja foi emitido
  updated_by         uuid REFERENCES auth.users(id),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.geo_budget (provider, monthly_limit_usd) VALUES ('google', 50.00), ('mapbox', 0.00)
ON CONFLICT (provider) DO NOTHING;

CREATE OR REPLACE VIEW public.geo_usage_month WITH (security_invoker = true) AS
SELECT provider, function, sku,
       SUM(count)        AS count,
       SUM(est_cost_usd) AS est_cost_usd
  FROM public.geo_usage
 WHERE day >= date_trunc('month', CURRENT_DATE)::date
 GROUP BY provider, function, sku;

CREATE OR REPLACE FUNCTION public.geo_budget_status()
RETURNS TABLE (provider text, spent_usd numeric, limit_usd numeric, pct numeric, blocked boolean, warn boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.provider,
         COALESCE(u.spent, 0)::numeric(12,4)                          AS spent_usd,
         b.monthly_limit_usd                                           AS limit_usd,
         CASE WHEN b.monthly_limit_usd > 0
              THEN ROUND(COALESCE(u.spent,0) / b.monthly_limit_usd * 100, 1)
              ELSE CASE WHEN COALESCE(u.spent,0) > 0 THEN 100 ELSE 0 END END AS pct,
         (b.hard_stop AND COALESCE(u.spent,0) >= b.monthly_limit_usd AND COALESCE(u.spent,0) > 0) AS blocked,
         (b.monthly_limit_usd > 0 AND COALESCE(u.spent,0) >= b.monthly_limit_usd * b.alert_at_pct / 100.0) AS warn
    FROM geo_budget b
    LEFT JOIN (SELECT provider, SUM(est_cost_usd) AS spent FROM geo_usage_month GROUP BY provider) u
      ON u.provider = b.provider;
$$;

-- ----------------------------------------------------------------------------
-- 4. geo_cache — cache de respostas de provedor
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_cache (
  key         text PRIMARY KEY,            -- sha256(provider|function|request normalizado)
  provider    text NOT NULL,
  function    text NOT NULL,
  response    jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_geo_cache_expires ON public.geo_cache (expires_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'geo-cache-prune') THEN
      PERFORM cron.unschedule('geo-cache-prune');
    END IF;
    PERFORM cron.schedule('geo-cache-prune', '15 3 * * *', $cron$DELETE FROM public.geo_cache WHERE expires_at < now()$cron$);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Colunas de endereco/contato/geofence nos pedidos e paradas
-- ----------------------------------------------------------------------------
ALTER TABLE public.lalamove_orders
  ADD COLUMN IF NOT EXISTS pickup_place_id              text,
  ADD COLUMN IF NOT EXISTS delivery_place_id            text,
  ADD COLUMN IF NOT EXISTS pickup_address_components    jsonb,
  ADD COLUMN IF NOT EXISTS delivery_address_components  jsonb,
  ADD COLUMN IF NOT EXISTS geocode_provider             text,
  ADD COLUMN IF NOT EXISTS geocode_precision            text,      -- ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE | LALAMOVE
  ADD COLUMN IF NOT EXISTS requires_address_review      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_contact_name          text,
  ADD COLUMN IF NOT EXISTS pickup_contact_phone         text,      -- E.164 (+55...)
  ADD COLUMN IF NOT EXISTS approach_radius_m            integer,   -- NULL = usa geo_defaults
  ADD COLUMN IF NOT EXISTS approach_eta_min             integer,   -- NULL = usa geo_defaults
  ADD COLUMN IF NOT EXISTS notify_delivery_contact      boolean;   -- NULL = usa geo_defaults

CREATE INDEX IF NOT EXISTS idx_orders_pickup_place_id   ON public.lalamove_orders (pickup_place_id)   WHERE pickup_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_place_id ON public.lalamove_orders (delivery_place_id) WHERE delivery_place_id IS NOT NULL;

ALTER TABLE public.lalamove_stops
  ADD COLUMN IF NOT EXISTS place_id            text,
  ADD COLUMN IF NOT EXISTS address_components  jsonb,
  ADD COLUMN IF NOT EXISTS geocode_precision   text;

-- ----------------------------------------------------------------------------
-- 6. active_tracking — metricas de rota/ETA
-- ----------------------------------------------------------------------------
ALTER TABLE public.active_tracking
  ADD COLUMN IF NOT EXISTS eta_updated_at           timestamptz,
  ADD COLUMN IF NOT EXISTS eta_provider             text,
  ADD COLUMN IF NOT EXISTS route_provider           text,
  ADD COLUMN IF NOT EXISTS route_distance_m         integer,
  ADD COLUMN IF NOT EXISTS route_duration_s         integer,
  ADD COLUMN IF NOT EXISTS route_computed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS distance_to_route_m      numeric(10,1),
  ADD COLUMN IF NOT EXISTS distance_to_next_stop_m  numeric(10,1),
  ADD COLUMN IF NOT EXISTS next_stop_index          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS near_stop_cycles         integer NOT NULL DEFAULT 0,   -- ciclos consecutivos dentro de arrived_radius_m
  ADD COLUMN IF NOT EXISTS off_route_cycles         integer NOT NULL DEFAULT 0;   -- ciclos consecutivos fora da rota

-- ----------------------------------------------------------------------------
-- 7. order_geo_events — 1 disparo por evento/pedido
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_geo_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  event_type           public.alert_type NOT NULL,
  stop_index           integer NOT NULL DEFAULT 0,
  triggered_at         timestamptz NOT NULL DEFAULT now(),
  driver_lat           numeric(10,7),
  driver_lng           numeric(10,7),
  distance_m           numeric(10,1),
  eta_min              integer,
  alert_id             uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  job_id               uuid,
  notified_at          timestamptz,
  notification_status  text NOT NULL DEFAULT 'queued'
                       CHECK (notification_status IN ('queued','deferred','sent','failed','no_recipient','skipped','cancelled')),
  payload              jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (order_id, event_type, stop_index)
);
CREATE INDEX IF NOT EXISTS idx_order_geo_events_order ON public.order_geo_events (order_id, triggered_at DESC);

-- job_queue: novos tipos de job usados pelos blocos 3 e 4 (geo_backfill, route_plan, eta_refresh)
ALTER TABLE public.job_queue DROP CONSTRAINT IF EXISTS job_queue_type_check;
ALTER TABLE public.job_queue ADD CONSTRAINT job_queue_type_check
  CHECK (type IN ('webhook','notification','evaluation','bitrix_sync','email','whatsapp','slack','lalamove_sync','pod_fetch',
                  'geo_backfill','route_plan','eta_refresh'));

-- ----------------------------------------------------------------------------
-- 8. Funcoes de geometria (sem PostGIS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.geo_haversine_m(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 2 * 6371008.8 * asin( LEAST(1.0, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

-- Distancia (m) do ponto P ao segmento AB, em projecao equiretangular local (suficiente para raios urbanos)
CREATE OR REPLACE FUNCTION public.geo_point_to_segment_m(
  plat double precision, plng double precision,
  alat double precision, alng double precision,
  blat double precision, blng double precision)
RETURNS double precision LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
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
END; $$;

-- Menor distancia (m) do ponto a uma polyline JSONB: [{"lat":..,"lng":..}, ...]
CREATE OR REPLACE FUNCTION public.geo_point_to_polyline_m(
  plat double precision, plng double precision, polyline jsonb)
RETURNS double precision LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
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
END; $$;

-- ----------------------------------------------------------------------------
-- 9. Trigger: metricas + eventos geograficos a cada posicao nova
--    BEFORE UPDATE para gravar as metricas na propria linha; eventos sao INSERTs idempotentes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.geo_emit_event(
  p_order_id uuid, p_driver_id uuid, p_event public.alert_type, p_stop_index integer,
  p_lat numeric, p_lng numeric, p_distance_m numeric, p_eta_min integer,
  p_title text, p_message text, p_enqueue boolean, p_metadata jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id uuid;
  v_alert_id uuid;
  v_job_id   uuid;
BEGIN
  INSERT INTO order_geo_events (order_id, event_type, stop_index, driver_lat, driver_lng, distance_m, eta_min, payload,
                                notification_status)
  VALUES (p_order_id, p_event, p_stop_index, p_lat, p_lng, p_distance_m, p_eta_min, p_metadata,
          CASE WHEN p_enqueue THEN 'queued' ELSE 'skipped' END)
  ON CONFLICT (order_id, event_type, stop_index) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN RETURN NULL; END IF;   -- ja disparado

  INSERT INTO alerts (type, severity, title, message, order_id, driver_id, metadata)
  VALUES (p_event, 'INFO', p_title, p_message, p_order_id, p_driver_id,
          p_metadata || jsonb_build_object('geo_event_id', v_event_id, 'distance_m', p_distance_m, 'eta_min', p_eta_min))
  RETURNING id INTO v_alert_id;

  IF p_enqueue THEN
    v_job_id := add_job(
      'notification',
      jsonb_build_object(
        'alert_id', v_alert_id, 'type', p_event::text, 'severity', 'INFO',
        'title', p_title, 'message', p_message,
        'order_id', p_order_id, 'driver_id', p_driver_id,
        'metadata', p_metadata || jsonb_build_object('geo_event_id', v_event_id, 'distance_m', p_distance_m, 'eta_min', p_eta_min)
      ),
      3, 3,
      'geo:' || p_order_id::text || ':' || p_event::text || ':' || p_stop_index::text,
      jsonb_build_object('source', 'geo_trigger'));
  END IF;

  UPDATE order_geo_events SET alert_id = v_alert_id, job_id = v_job_id WHERE id = v_event_id;
  RETURN v_event_id;
END; $$;

CREATE OR REPLACE FUNCTION public.geo_evaluate_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o             record;
  d             record;
  v_status      text;
  v_stop_lat    double precision;
  v_stop_lng    double precision;
  v_last_index  integer;
  v_dist        double precision;
  v_radius      integer;
  v_eta_min     integer;
  v_arrived_m   integer;
  v_off_m       integer;
  v_notify_del  boolean;
  v_meta        jsonb;
  v_driver_name text;
BEGIN
  -- so posicoes novas de tracking ativo
  IF NEW.tracking_status IS DISTINCT FROM 'ACTIVE' THEN RETURN NEW; END IF;
  IF NEW.current_latitude IS NULL OR NEW.current_longitude IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.current_latitude = OLD.current_latitude AND NEW.current_longitude = OLD.current_longitude
     AND NEW.eta_minutes IS NOT DISTINCT FROM OLD.eta_minutes
     AND NEW.next_stop_index = OLD.next_stop_index THEN
    RETURN NEW;   -- nada relevante mudou
  END IF;

  SELECT * INTO d FROM geo_defaults WHERE id = true;

  SELECT id, status::text AS status_enum, lalamove_status, lalamove_id,
         pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude,
         pickup_address, delivery_address, scheduled_at, share_link,
         driver_name, driver_plate, pickup_contact_name, pickup_contact_phone, supplier_contact, auto_notify_supplier,
         approach_radius_m, approach_eta_min, notify_delivery_contact
    INTO o
    FROM lalamove_orders WHERE id = NEW.order_id;
  IF o.id IS NULL THEN RETURN NEW; END IF;

  v_status     := COALESCE(o.lalamove_status, o.status_enum);
  v_radius     := COALESCE(o.approach_radius_m, d.approach_radius_m);
  v_eta_min    := COALESCE(o.approach_eta_min,  d.approach_eta_min);
  v_arrived_m  := d.arrived_radius_m;
  v_off_m      := d.off_route_threshold_m;
  v_notify_del := COALESCE(o.notify_delivery_contact, d.notify_delivery_contact);
  v_driver_name := COALESCE(o.driver_name, 'o motorista');

  -- ultima parada (entrega): maior stop_index em lalamove_stops, senao 1
  SELECT COALESCE(MAX(stop_index), 1) INTO v_last_index FROM lalamove_stops WHERE order_id = o.id;

  -- coordenada da proxima parada: lalamove_stops[next_stop_index] -> fallback colunas do pedido
  SELECT latitude, longitude INTO v_stop_lat, v_stop_lng
    FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1;
  IF v_stop_lat IS NULL THEN
    IF NEW.next_stop_index = 0 THEN
      v_stop_lat := o.pickup_latitude;   v_stop_lng := o.pickup_longitude;
    ELSE
      v_stop_lat := o.delivery_latitude; v_stop_lng := o.delivery_longitude;
    END IF;
  END IF;

  -- metricas
  IF v_stop_lat IS NOT NULL AND v_stop_lng IS NOT NULL THEN
    v_dist := geo_haversine_m(NEW.current_latitude, NEW.current_longitude, v_stop_lat, v_stop_lng);
    NEW.distance_to_next_stop_m := round(v_dist::numeric, 1);
    IF v_dist <= v_arrived_m THEN
      NEW.near_stop_cycles := COALESCE(OLD.near_stop_cycles, 0) + 1;
    ELSE
      NEW.near_stop_cycles := 0;
    END IF;
  ELSE
    v_dist := NULL;
    NEW.distance_to_next_stop_m := NULL;
  END IF;

  IF NEW.expected_route IS NOT NULL THEN
    NEW.distance_to_route_m := round(geo_point_to_polyline_m(NEW.current_latitude, NEW.current_longitude, NEW.expected_route)::numeric, 1);
    IF NEW.distance_to_route_m IS NOT NULL THEN
      NEW.is_on_route := NEW.distance_to_route_m <= v_off_m;
      NEW.off_route_cycles := CASE WHEN NEW.is_on_route THEN 0 ELSE COALESCE(OLD.off_route_cycles, 0) + 1 END;
    END IF;
  END IF;

  IF v_dist IS NULL THEN RETURN NEW; END IF;   -- sem coordenada da parada nao ha evento

  v_meta := jsonb_build_object(
    'order_ref', o.lalamove_id, 'driver_name', o.driver_name, 'driver_plate', o.driver_plate,
    'share_link', o.share_link, 'pickup_address', o.pickup_address, 'delivery_address', o.delivery_address,
    'recipients', CASE
        WHEN NEW.next_stop_index = 0 THEN jsonb_build_array(jsonb_build_object(
            'role', 'pickup_contact', 'channel', 'whatsapp',
            'name', COALESCE(o.pickup_contact_name, o.supplier_contact),
            'to',   COALESCE(o.pickup_contact_phone, (SELECT contact_phone FROM lalamove_stops WHERE order_id = o.id AND stop_index = 0 LIMIT 1))))
        ELSE jsonb_build_array(jsonb_build_object(
            'role', 'delivery_contact', 'channel', 'whatsapp',
            'name', (SELECT contact_name  FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1),
            'to',   (SELECT contact_phone FROM lalamove_stops WHERE order_id = o.id AND stop_index = NEW.next_stop_index LIMIT 1)))
      END);

  -- ---------------- COLETA (next_stop_index = 0) ----------------
  IF NEW.next_stop_index = 0 AND v_status IN ('ON_GOING','MATCHED','ASSIGNING_DRIVER') THEN
    IF v_dist <= v_radius OR (NEW.eta_minutes IS NOT NULL AND NEW.eta_minutes <= v_eta_min) THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'DRIVER_APPROACHING_PICKUP', 0,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Motorista se aproximando da coleta',
        format('%s (%s) chega em ~%s min para retirar o pedido %s.', v_driver_name, COALESCE(o.driver_plate,'-'),
               COALESCE(NEW.eta_minutes::text, GREATEST(1, round(v_dist/400))::text), COALESCE(o.lalamove_id, o.id::text)),
        true, v_meta);
    END IF;
    IF NEW.near_stop_cycles >= 2 THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'DRIVER_ARRIVED_PICKUP', 0,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Motorista chegou na coleta',
        format('%s (%s) chegou ao local de coleta do pedido %s.', v_driver_name, COALESCE(o.driver_plate,'-'), COALESCE(o.lalamove_id, o.id::text)),
        true, v_meta || '{"always_send":true}'::jsonb);
    END IF;
  END IF;

  -- ---------------- ENTREGA (ultima parada) ----------------
  IF NEW.next_stop_index >= 1 AND NEW.next_stop_index = v_last_index AND v_status IN ('PICKED_UP','ON_GOING') THEN
    IF v_dist <= v_radius OR (NEW.eta_minutes IS NOT NULL AND NEW.eta_minutes <= v_eta_min) THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'DRIVER_APPROACHING_DELIVERY', NEW.next_stop_index,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Motorista se aproximando da entrega',
        format('%s (%s) chega em ~%s min com o pedido %s.', v_driver_name, COALESCE(o.driver_plate,'-'),
               COALESCE(NEW.eta_minutes::text, GREATEST(1, round(v_dist/400))::text), COALESCE(o.lalamove_id, o.id::text)),
        v_notify_del, v_meta);
    END IF;
    IF NEW.near_stop_cycles >= 2 THEN
      PERFORM geo_emit_event(o.id, NEW.driver_id, 'DRIVER_ARRIVED_DELIVERY', NEW.next_stop_index,
        NEW.current_latitude, NEW.current_longitude, NEW.distance_to_next_stop_m, NEW.eta_minutes,
        'Motorista chegou na entrega',
        format('%s (%s) chegou ao local de entrega do pedido %s.', v_driver_name, COALESCE(o.driver_plate,'-'), COALESCE(o.lalamove_id, o.id::text)),
        v_notify_del, v_meta || '{"always_send":true}'::jsonb);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_active_tracking_geo ON public.active_tracking;
CREATE TRIGGER trg_active_tracking_geo
  BEFORE INSERT OR UPDATE OF current_latitude, current_longitude, eta_minutes, next_stop_index
  ON public.active_tracking
  FOR EACH ROW EXECUTE FUNCTION public.geo_evaluate_tracking();

-- ----------------------------------------------------------------------------
-- 10. alert_configurations — linhas para os novos tipos (canal whatsapp; dedup por (alert_type, channel))
-- ----------------------------------------------------------------------------
INSERT INTO public.alert_configurations (alert_type, channel, is_enabled, name, message_template, min_interval_seconds, notify_whatsapp)
VALUES
  ('DRIVER_APPROACHING_PICKUP',   'whatsapp', true,  'Motorista se aproximando da coleta',
   'Olá {{pickup_contact_name}}, o motorista {{driver_name}} ({{driver_plate}}) chega em ~{{eta_min}} min para retirar o pedido {{order_ref}}. Acompanhe: {{share_link}}', 300, true),
  ('DRIVER_ARRIVED_PICKUP',       'whatsapp', true,  'Motorista chegou na coleta',
   'O motorista {{driver_name}} ({{driver_plate}}) chegou para retirar o pedido {{order_ref}}.', 300, true),
  ('DRIVER_APPROACHING_DELIVERY', 'whatsapp', false, 'Motorista se aproximando da entrega',
   'Olá {{delivery_contact_name}}, o motorista {{driver_name}} ({{driver_plate}}) chega em ~{{eta_min}} min com o pedido {{order_ref}}. Acompanhe: {{share_link}}', 300, true),
  ('DRIVER_ARRIVED_DELIVERY',     'whatsapp', false, 'Motorista chegou na entrega',
   'O motorista {{driver_name}} ({{driver_plate}}) chegou com o pedido {{order_ref}}.', 300, true),
  ('ETA_DELAY',                   'whatsapp', true,  'Atraso previsto',
   'O pedido {{order_ref}} deve atrasar: previsão de chegada em {{eta_min}} min (agendado {{scheduled_at}}).', 600, true),
  ('GEO_BUDGET_WARNING',          'slack',    true,  'Orçamento de mapas',
   'Uso do provedor {{provider}} atingiu {{pct}}% do orçamento mensal (US$ {{spent}} de {{limit}}).', 3600, false)
ON CONFLICT (alert_type, channel) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 11. RLS, grants, updated_at, auditoria
-- ----------------------------------------------------------------------------
ALTER TABLE public.geo_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_defaults      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_price_list    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_usage         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_budget        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_geo_events  ENABLE ROW LEVEL SECURITY;

-- leitura: autenticados; escrita: admin (mesmo padrao de feature_flags)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['geo_settings','geo_defaults','geo_price_list','geo_budget'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_read_authenticated" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "%1$s_read_authenticated" ON public.%1$s FOR SELECT USING (auth.role() = ''authenticated'')', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_admin_all" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "%1$s_admin_all" ON public.%1$s FOR ALL USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;

-- uso e eventos: leitura manager+ (uso) / operator+ (eventos); escrita so service_role
DROP POLICY IF EXISTS "geo_usage_read_manager" ON public.geo_usage;
CREATE POLICY "geo_usage_read_manager" ON public.geo_usage FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "order_geo_events_read" ON public.order_geo_events;
CREATE POLICY "order_geo_events_read" ON public.order_geo_events FOR SELECT
  USING (auth.role() = 'authenticated');

-- cache: nenhuma policy para authenticated (so service_role, que ignora RLS)

GRANT SELECT ON public.geo_settings, public.geo_defaults, public.geo_price_list, public.geo_budget,
                public.geo_usage, public.geo_usage_month, public.order_geo_events TO authenticated;
GRANT INSERT, UPDATE ON public.geo_settings, public.geo_defaults, public.geo_price_list, public.geo_budget TO authenticated; -- filtrado por RLS admin
GRANT ALL ON public.geo_settings, public.geo_defaults, public.geo_price_list, public.geo_usage, public.geo_budget,
             public.geo_cache, public.order_geo_events TO service_role;
GRANT EXECUTE ON FUNCTION public.geo_budget_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.geo_usage_increment(text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.geo_haversine_m(double precision, double precision, double precision, double precision) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.geo_point_to_polyline_m(double precision, double precision, jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.geo_emit_event(uuid, uuid, public.alert_type, integer, numeric, numeric, numeric, integer, text, text, boolean, jsonb) FROM PUBLIC, authenticated;

DROP TRIGGER IF EXISTS update_geo_settings_updated_at ON public.geo_settings;
CREATE TRIGGER update_geo_settings_updated_at BEFORE UPDATE ON public.geo_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_geo_budget_updated_at ON public.geo_budget;
CREATE TRIGGER update_geo_budget_updated_at BEFORE UPDATE ON public.geo_budget
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_geo_defaults_updated_at ON public.geo_defaults;
CREATE TRIGGER update_geo_defaults_updated_at BEFORE UPDATE ON public.geo_defaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auditoria de configuracao (etapa 91): antes/depois em audit_log
CREATE OR REPLACE FUNCTION public.geo_audit_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, changes)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, gen_random_uuid(),
          jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)));
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_geo_settings_audit ON public.geo_settings;
CREATE TRIGGER trg_geo_settings_audit AFTER INSERT OR UPDATE OR DELETE ON public.geo_settings
  FOR EACH ROW EXECUTE FUNCTION public.geo_audit_config();
DROP TRIGGER IF EXISTS trg_geo_budget_audit ON public.geo_budget;
CREATE TRIGGER trg_geo_budget_audit AFTER INSERT OR UPDATE OR DELETE ON public.geo_budget
  FOR EACH ROW EXECUTE FUNCTION public.geo_audit_config();
DROP TRIGGER IF EXISTS trg_geo_defaults_audit ON public.geo_defaults;
CREATE TRIGGER trg_geo_defaults_audit AFTER UPDATE ON public.geo_defaults
  FOR EACH ROW EXECUTE FUNCTION public.geo_audit_config();

COMMENT ON TABLE  public.geo_settings     IS 'Provedor de mapas por funcao (google|mapbox|off) com fallback. Admin edita em /settings/maps.';
COMMENT ON TABLE  public.geo_defaults     IS 'Parametros globais de geofence/notificacao (raio, ETA, horario silencioso).';
COMMENT ON TABLE  public.geo_usage        IS 'Uso diario de APIs de mapa por provedor/funcao/sku com custo estimado (USD).';
COMMENT ON TABLE  public.geo_budget       IS 'Orcamento mensal por provedor; geo_budget_status() informa bloqueio/aviso.';
COMMENT ON TABLE  public.geo_cache        IS 'Cache de respostas de geocode/rota/static por hash de request (TTL por funcao).';
COMMENT ON TABLE  public.order_geo_events IS 'Eventos geograficos por pedido (aproximando/chegou coleta e entrega, atraso) — 1 por (pedido, evento, parada).';
COMMENT ON FUNCTION public.geo_evaluate_tracking() IS 'Trigger em active_tracking: calcula distancia a proxima parada e a rota, is_on_route, e emite eventos geo idempotentes.';
