CREATE INDEX IF NOT EXISTS idx_driver_approval_queue_pending_recent
  ON public.driver_approval_queue (requested_at DESC)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_driver_approval_queue_pending_priority
  ON public.driver_approval_queue (priority DESC, requested_at DESC)
  WHERE status = 'PENDING';