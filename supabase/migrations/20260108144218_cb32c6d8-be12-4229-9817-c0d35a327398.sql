-- =====================================================
-- MIGRAÇÃO: Remover política de service role redundante
-- =====================================================

-- WEBHOOK_EVENTS - remover service role policy
DROP POLICY IF EXISTS "Service role has full access to webhook events" ON public.webhook_events;