CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_ip_created ON public.rate_limit_logs USING btree (ip_address, created_at DESC);
DROP INDEX IF EXISTS public.idx_rate_limit_logs_ip;
DROP INDEX IF EXISTS public.idx_auth_logs_user;