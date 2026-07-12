-- Habilita replicação completa e adiciona report_presets à publicação de realtime
ALTER TABLE public.report_presets REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'report_presets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.report_presets;
  END IF;
END $$;