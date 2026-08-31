-- Fix login_attempts: restrict UPDATE to admin only
DROP POLICY IF EXISTS "Authorized roles can update login attempts" ON public.login_attempts;

CREATE POLICY "Admins can update login attempts"
ON public.login_attempts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix login_attempts: restrict INSERT to admin/manager/system
DROP POLICY IF EXISTS "System can insert login attempts" ON public.login_attempts;

CREATE POLICY "System can insert login attempts"
ON public.login_attempts
FOR INSERT
WITH CHECK (
  (auth.uid() IS NULL) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Fix runtime_error_logs: remove anon wide-open insert
DROP POLICY IF EXISTS "Anon can insert error logs" ON public.runtime_error_logs;
DROP POLICY IF EXISTS "Authenticated can insert error logs" ON public.runtime_error_logs;

CREATE POLICY "Authenticated can insert error logs"
ON public.runtime_error_logs
FOR INSERT
TO authenticated
WITH CHECK (true);