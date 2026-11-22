-- Schema minimo para exercitar as funcoes da geo_foundation (etapa 64 do plano
-- Google Maps) num Postgres 16 limpo. Espelha apenas as colunas que
-- `geo_evaluate_tracking`, `geo_emit_event` e `add_job` tocam — o objetivo e
-- testar a regra de negocio do trigger, nao replicar o schema de producao.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);

CREATE TYPE public.order_status AS ENUM (
  'PENDING','MATCHED','ON_GOING','PICKED_UP','COMPLETED','CANCELLED','REJECTED','EXPIRED');
CREATE TYPE public.alert_type AS ENUM (
  'DRIVER_BLOCKED','ROUTE_DEVIATION','DRIVER_STOPPED','LATE_DELIVERY','APPROVAL_REQUIRED','ORDER_CANCELLED',
  'DRIVER_APPROACHING_PICKUP','DRIVER_ARRIVED_PICKUP','DRIVER_APPROACHING_DELIVERY','DRIVER_ARRIVED_DELIVERY',
  'ETA_DELAY','SUPPLIER_DELAY_NOTICE','MISSING_POD','GEO_BUDGET_WARNING');
CREATE TYPE public.alert_severity AS ENUM ('INFO','WARNING','CRITICAL');

CREATE TABLE public.lalamove_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lalamove_id text UNIQUE NOT NULL,
  status public.order_status NOT NULL DEFAULT 'PENDING',
  lalamove_status text,
  pickup_address text NOT NULL DEFAULT '',
  pickup_latitude decimal(10,8),
  pickup_longitude decimal(11,8),
  delivery_address text NOT NULL DEFAULT '',
  delivery_latitude decimal(10,8),
  delivery_longitude decimal(11,8),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  share_link text,
  driver_name text,
  driver_plate text,
  supplier_contact text,
  auto_notify_supplier boolean DEFAULT false,
  -- colunas de 20261122130100_geo_foundation.sql
  pickup_contact_name        text,
  pickup_contact_phone       text,
  approach_radius_m          integer,
  approach_eta_min           integer,
  notify_delivery_contact    boolean
);

CREATE TABLE public.lalamove_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  stop_index integer NOT NULL,
  address text NOT NULL DEFAULT '',
  latitude decimal(10,8),
  longitude decimal(11,8),
  contact_name text,
  contact_phone text,
  place_id text,
  address_components jsonb,
  geocode_precision text
);

CREATE TABLE public.active_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  current_latitude decimal(10,8) NOT NULL,
  current_longitude decimal(11,8) NOT NULL,
  eta_minutes integer,
  last_updated timestamptz NOT NULL DEFAULT now(),
  -- colunas de metricas/rota criadas por 20261122130100_geo_foundation.sql
  expected_route           jsonb,
  tracking_status          text DEFAULT 'ACTIVE',
  is_on_route              boolean DEFAULT true,
  distance_to_route_m      numeric(10,1),
  distance_to_next_stop_m  numeric(10,1),
  next_stop_index          integer NOT NULL DEFAULT 0,
  near_stop_cycles         integer NOT NULL DEFAULT 0,
  off_route_cycles         integer NOT NULL DEFAULT 0
);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.alert_type NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'INFO',
  title text NOT NULL,
  message text NOT NULL,
  order_id uuid REFERENCES public.lalamove_orders(id) ON DELETE SET NULL,
  driver_id uuid,
  metadata jsonb DEFAULT '{}',
  escalated_at timestamptz,
  escalation_level integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fila de jobs: `geo_emit_event` enfileira o envio da notificacao via add_job.
CREATE TABLE public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);


-- order_geo_events: ledger idempotente de eventos geo (1 por pedido/evento/parada).
CREATE TABLE public.order_geo_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  event_type           public.alert_type NOT NULL,
  stop_index           integer NOT NULL DEFAULT 0,
  triggered_at         timestamptz NOT NULL DEFAULT now(),
  driver_lat           numeric(10,7),
  driver_lng           numeric(11,7),
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

-- geo_defaults: singleton com os parametros do trigger (valores de producao).
CREATE TABLE public.geo_defaults (
  id                        boolean PRIMARY KEY DEFAULT true CHECK (id),
  approach_radius_m         integer NOT NULL DEFAULT 500,
  approach_eta_min          integer NOT NULL DEFAULT 5,
  arrived_radius_m          integer NOT NULL DEFAULT 100,
  off_route_threshold_m     integer NOT NULL DEFAULT 300,
  notify_delivery_contact   boolean NOT NULL DEFAULT false
);
INSERT INTO public.geo_defaults (id) VALUES (true);

CREATE OR REPLACE FUNCTION public.add_job(
  p_job_type text, p_payload jsonb, p_priority integer DEFAULT 0, p_max_attempts integer DEFAULT 3,
  p_idempotency_key text DEFAULT NULL, p_metadata jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO job_queue (job_type, payload, priority, max_attempts, idempotency_key, metadata)
  VALUES (p_job_type, p_payload, p_priority, p_max_attempts, p_idempotency_key, p_metadata)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
