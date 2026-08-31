ALTER TABLE public.active_tracking
  ADD CONSTRAINT active_tracking_eta_non_negative
  CHECK (eta_minutes IS NULL OR eta_minutes >= 0);