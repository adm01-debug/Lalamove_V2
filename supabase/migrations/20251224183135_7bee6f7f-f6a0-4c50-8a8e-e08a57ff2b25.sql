-- Create function to trigger Bitrix24 sync on status change
CREATE OR REPLACE FUNCTION public.trigger_bitrix24_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sync_record RECORD;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Check if this order has a Bitrix24 deal linked
    SELECT * INTO sync_record FROM bitrix24_sync WHERE order_id = NEW.id LIMIT 1;
    
    -- Also check if deal_id is set directly on the order
    IF sync_record IS NOT NULL OR NEW.bitrix24_deal_id IS NOT NULL THEN
      -- Insert a sync request that will be processed
      INSERT INTO bitrix24_sync (order_id, deal_id, sync_status, last_synced_at)
      VALUES (
        NEW.id, 
        COALESCE(sync_record.deal_id, NEW.bitrix24_deal_id),
        'pending',
        now()
      )
      ON CONFLICT (order_id) 
      DO UPDATE SET 
        sync_status = 'pending',
        last_synced_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on lalamove_orders for status changes
DROP TRIGGER IF EXISTS on_order_status_change_sync_bitrix24 ON lalamove_orders;
CREATE TRIGGER on_order_status_change_sync_bitrix24
  AFTER UPDATE OF status ON lalamove_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_bitrix24_sync();

-- Add unique constraint on order_id for upsert
ALTER TABLE bitrix24_sync DROP CONSTRAINT IF EXISTS bitrix24_sync_order_id_key;
ALTER TABLE bitrix24_sync ADD CONSTRAINT bitrix24_sync_order_id_key UNIQUE (order_id);