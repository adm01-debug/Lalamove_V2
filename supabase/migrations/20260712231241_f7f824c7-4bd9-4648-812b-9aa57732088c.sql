CREATE TABLE public.report_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_presets TO authenticated;
GRANT ALL ON public.report_presets TO service_role;

ALTER TABLE public.report_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own report presets"
ON public.report_presets FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_report_presets_user_id ON public.report_presets (user_id);

CREATE TRIGGER update_report_presets_updated_at
BEFORE UPDATE ON public.report_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();