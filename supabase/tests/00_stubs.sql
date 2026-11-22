-- Stubs do schema de produção, apenas o necessário para exercitar o trigger
-- geo_evaluate_tracking() fora do Supabase. Os tipos seguem o DDL real:
--  - lalamove_orders/active_tracking: 20251224143803 (DECIMAL(10,8)/(11,8))
--  - order_geo_events: 20261122130100_geo_foundation.sql:248
--  - job_queue: 20261122120200_job_queue_system.sql:17
-- Este arquivo NÃO é migration: vive em supabase/tests e só é carregado por run.sh.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- auth.uid() existe no Supabase; aqui devolve NULL (nenhum usuario logado no teste).
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.alert_type AS ENUM (
    'DRIVER_APPROACHING_PICKUP','DRIVER_ARRIVED_PICKUP',
    'DRIVER_APPROACHING_DELIVERY','DRIVER_ARRIVED_DELIVERY',
    'LATE_DELIVERY','ETA_DELAY','OFF_ROUTE','ROUTE_REPLANNED',
    'INTEGRATION_FAILURE','NO_DRIVER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.geo_defaults (
  id                       boolean PRIMARY KEY DEFAULT true CHECK (id),
  approach_radius_m        integer NOT NULL DEFAULT 500,
  approach_eta_min         integer NOT NULL DEFAULT 10,
  arrived_radius_m         integer NOT NULL DEFAULT 100,
  off_route_threshold_m    integer NOT NULL DEFAULT 50,
  notify_delivery_contact  boolean NOT NULL DEFAULT true,
  late_tolerance_min       integer NOT NULL DEFAULT 15
);

CREATE TABLE IF NOT EXISTS public.lalamove_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lalamove_id text,
  lalamove_status text,
  status text,
  pickup_latitude  DECIMAL(10,8),
  pickup_longitude DECIMAL(11,8),
  delivery_latitude  DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),
  pickup_address text,
  delivery_address text,
  scheduled_at timestamptz,
  share_link text,
  driver_name text,
  driver_plate text,
  pickup_contact_name text,
  pickup_contact_phone text,
  supplier_contact text,
  auto_notify_supplier boolean DEFAULT false,
  approach_radius_m integer,
  approach_eta_min integer,
  notify_delivery_contact boolean
);

CREATE TABLE IF NOT EXISTS public.lalamove_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  stop_index integer NOT NULL DEFAULT 0,
  latitude  DECIMAL(10,8),
  longitude DECIMAL(11,8),
  contact_name text,
  contact_phone text,
  arrived_at timestamptz,
  UNIQUE (order_id, stop_index)
);

CREATE TABLE IF NOT EXISTS public.active_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  current_latitude  DECIMAL(10,8) NOT NULL,
  current_longitude DECIMAL(11,8) NOT NULL,
  heading DECIMAL(5,2),
  speed   DECIMAL(6,2),
  eta_minutes integer,
  last_updated timestamptz NOT NULL DEFAULT now(),
  expected_route jsonb,
  tracking_status text DEFAULT 'ACTIVE',
  tracking_started_at timestamptz,
  tracking_ended_at timestamptz,
  distance_to_route_m   numeric(10,1),
  distance_to_next_stop_m numeric(10,1),
  next_stop_index integer NOT NULL DEFAULT 0,
  near_stop_cycles integer NOT NULL DEFAULT 0,
  off_route_cycles integer NOT NULL DEFAULT 0,
  is_on_route boolean,
  route_computed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.alert_type NOT NULL,
  severity text NOT NULL DEFAULT 'INFO',
  title text NOT NULL,
  message text NOT NULL,
  order_id uuid,
  driver_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_geo_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.lalamove_orders(id) ON DELETE CASCADE,
  event_type public.alert_type NOT NULL,
  stop_index integer NOT NULL DEFAULT 0,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  driver_lat numeric(10,7),
  driver_lng numeric(10,7),
  distance_m numeric(10,1),
  eta_min integer,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  job_id uuid,
  notified_at timestamptz,
  notification_status text NOT NULL DEFAULT 'queued'
    CHECK (notification_status IN ('queued','deferred','sent','failed','no_recipient','skipped','cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (order_id, event_type, stop_index)
);

CREATE TABLE IF NOT EXISTS public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  dedup_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_queue_dedup_open
  ON public.job_queue (dedup_key)
  WHERE dedup_key IS NOT NULL AND status IN ('PENDING','PROCESSING');

INSERT INTO public.geo_defaults (id) VALUES (true) ON CONFLICT DO NOTHING;