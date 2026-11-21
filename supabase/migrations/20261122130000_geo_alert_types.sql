-- ============================================================================
-- Geo (Google Maps / Mapbox) — Bloco 1, parte A: novos valores do enum alert_type
-- Arquivo separado: ADD VALUE nao pode ser usado na mesma transacao em que e criado.
-- Plano: claude/google-maps-x-lalamove-v2-plano-100-etapas-2026-11-21.md (etapa 16)
-- ============================================================================

ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'DRIVER_APPROACHING_PICKUP';
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'DRIVER_ARRIVED_PICKUP';
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'DRIVER_APPROACHING_DELIVERY';
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'DRIVER_ARRIVED_DELIVERY';
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'ETA_DELAY';
-- Tipos ja usados pelo codigo mas ausentes do enum (check-driver-alerts:58,162,225):
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'SUPPLIER_DELAY_NOTICE';
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'MISSING_POD';
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'GEO_BUDGET_WARNING';
