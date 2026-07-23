
DROP INDEX IF EXISTS public.idx_contacts_name_trgm;
DROP INDEX IF EXISTS public.idx_contacts_phone_trgm;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON public.contacts USING gin (phone_e164 extensions.gin_trgm_ops);
