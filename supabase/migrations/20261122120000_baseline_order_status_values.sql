-- ============================================================================
-- Baseline Lalamove V2 — parte 1/3: valores de enum order_status
-- ----------------------------------------------------------------------------
-- Contexto: o enum order_status (PENDING, MATCHED, ON_GOING, PICKED_UP,
-- COMPLETED, CANCELLED, REJECTED, EXPIRED) nao cobre os estados que a API v3
-- escreve no ciclo de vida do pedido (ASSIGNING_DRIVER, DELIVERING) nem o
-- estado local de cotacao (QUOTED). Hoje o INSERT pos-criacao em
-- lalamove_orders falha em silencio porque grava 'ASSIGNING_DRIVER'.
--
-- ADD VALUE IF NOT EXISTS pode rodar dentro de transacao no PG >= 12 desde que
-- o novo valor nao seja USADO na mesma transacao — por isso este arquivo so
-- adiciona valores e nao os referencia. Mantido separado das migrations que
-- usam os valores.
-- ============================================================================

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'QUOTED';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ASSIGNING_DRIVER';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'DELIVERING';
