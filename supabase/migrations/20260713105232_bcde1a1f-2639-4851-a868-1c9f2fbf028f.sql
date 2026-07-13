CREATE TABLE public.region_cache (
  coord_key TEXT NOT NULL PRIMARY KEY,
  region TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.region_cache TO authenticated;
GRANT ALL ON public.region_cache TO service_role;

ALTER TABLE public.region_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read region cache"
  ON public.region_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert region cache"
  ON public.region_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update region cache"
  ON public.region_cache FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_region_cache_updated_at
  BEFORE UPDATE ON public.region_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();