
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP INDEX IF EXISTS public.idx_drivers_lalamove_id;

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON public.contacts USING gin (phone_e164 gin_trgm_ops);
