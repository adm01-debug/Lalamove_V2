-- bitrix24_sync: remove SELECT duplicado, mantém uma política limpa (admin/manager).
DROP POLICY IF EXISTS "Authorized roles can view bitrix sync" ON public.bitrix24_sync;
DROP POLICY IF EXISTS "Authorized roles can view sync data" ON public.bitrix24_sync;
CREATE POLICY "Authorized roles can view sync data"
  ON public.bitrix24_sync FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- webhook_events: consolida 3 políticas SELECT em uma (admin/manager/viewer).
DROP POLICY IF EXISTS "Authorized roles can view webhook events" ON public.webhook_events;
DROP POLICY IF EXISTS "Authorized roles can view webhooks" ON public.webhook_events;
DROP POLICY IF EXISTS "Viewers can view webhook events" ON public.webhook_events;
CREATE POLICY "Authorized roles can view webhook events"
  ON public.webhook_events FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'viewer')
  );