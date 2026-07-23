
-- Contatos reutilizáveis por usuário para reduzir erros de digitação e reaproveitar telefones formatados
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  address TEXT,
  kind TEXT NOT NULL DEFAULT 'both' CHECK (kind IN ('sender','recipient','both')),
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_phone_e164_format CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT contacts_owner_phone_unique UNIQUE (owner_id, phone_e164)
);

CREATE INDEX idx_contacts_owner_last_used ON public.contacts (owner_id, last_used_at DESC);
CREATE INDEX idx_contacts_owner_name ON public.contacts (owner_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own contacts"
  ON public.contacts FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
