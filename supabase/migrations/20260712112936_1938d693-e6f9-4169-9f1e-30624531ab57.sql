ALTER TABLE public.driver_approval_queue
  ADD CONSTRAINT driver_approval_queue_risk_score_range CHECK (risk_score >= 0 AND risk_score <= 100),
  ADD CONSTRAINT driver_approval_queue_priority_non_negative CHECK (priority IS NULL OR priority >= 0);