ALTER TABLE public.login_attempts
  ADD CONSTRAINT login_attempts_attempt_count_non_negative
  CHECK (attempt_count >= 0);

ALTER TABLE public.rate_limit_logs
  ADD CONSTRAINT rate_limit_logs_request_count_non_negative
  CHECK (request_count IS NULL OR request_count >= 0);