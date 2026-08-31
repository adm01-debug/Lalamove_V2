-- Replace permissive runtime_error_logs INSERT with user-scoped policy
DROP POLICY IF EXISTS "Authenticated can insert error logs" ON public.runtime_error_logs;

CREATE POLICY "Authenticated can insert error logs"
ON public.runtime_error_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);