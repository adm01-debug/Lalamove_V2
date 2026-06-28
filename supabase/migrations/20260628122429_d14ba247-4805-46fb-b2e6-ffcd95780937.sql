-- Fix 1: Enable RLS on tracking_events partitions (parent policies apply once enabled)
ALTER TABLE public.tracking_events_default ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events_y2026m05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events_y2026m06 ENABLE ROW LEVEL SECURITY;

-- Fix 2: Enable RLS on security_test_logs and lock it down (audit/log table)
ALTER TABLE public.security_test_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.security_test_logs TO authenticated;
GRANT ALL ON public.security_test_logs TO service_role;

CREATE POLICY "Admins can view security test logs"
ON public.security_test_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));