-- Remove UPDATE `USING (true)` do cache compartilhado.
-- Justificativa: coord_key → region é determinístico. Uma vez gravado,
-- não deve mudar. Frontend agora usa upsert com ignoreDuplicates=true.
-- Manutenção administrativa continua possível via service_role.
DROP POLICY IF EXISTS "Authenticated users can update region cache" ON public.region_cache;