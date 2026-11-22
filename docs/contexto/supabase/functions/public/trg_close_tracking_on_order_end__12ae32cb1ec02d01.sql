CREATE OR REPLACE FUNCTION public.trg_close_tracking_on_order_end()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text IN ('COMPLETED', 'CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED')
     AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM NEW.status::text) THEN
    PERFORM public.end_order_tracking(NEW.id, 'order_status:' || NEW.status::text);
  END IF;
  RETURN NEW;
END; $function$
