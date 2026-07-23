ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency_key ON public.webhook_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type_received_at ON public.webhook_events(event_type, received_at DESC);