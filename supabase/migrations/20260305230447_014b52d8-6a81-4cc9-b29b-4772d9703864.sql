-- Add unique constraint on lalamove_id for upsert support
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lalamove_orders_lalamove_id_key'
  ) THEN
    ALTER TABLE public.lalamove_orders ADD CONSTRAINT lalamove_orders_lalamove_id_key UNIQUE (lalamove_id);
  END IF;
END $$;