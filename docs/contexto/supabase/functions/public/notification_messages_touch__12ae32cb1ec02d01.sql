CREATE OR REPLACE FUNCTION public.notification_messages_touch()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $function$
