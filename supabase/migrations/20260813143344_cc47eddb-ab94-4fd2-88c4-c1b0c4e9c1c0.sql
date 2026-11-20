-- Índices redundantes: todos duplicam um UNIQUE constraint existente
-- ou um índice idêntico em partição.

-- 1. blocked_ips: idx_blocked_ips_ip duplica blocked_ips_ip_address_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_blocked_ips_ip;

-- 2. geo_blocks: idx_geo_blocks_country duplica geo_blocks_country_code_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_geo_blocks_country;

-- 3. lalamove_orders: idx_orders_lalamove_id duplica lalamove_orders_lalamove_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_orders_lalamove_id;

-- 4. user_devices: idx_user_devices_user_fingerprint duplica user_devices_user_id_device_fingerprint_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_user_devices_user_fingerprint;

-- 5. user_passkeys: idx_user_passkeys_credential_id duplica user_passkeys_credential_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_user_passkeys_credential_id;

-- 6. tracking_events_y2026m10: dropa o BRIN duplicado que NÃO é requerido pelo índice particionado pai.
-- O índice tracking_events_y2026m10_created_at_idx é requerido por idx_tracking_events_created_brin (ONLY),
-- portanto removemos tracking_events_y2026m10_created_brin, que é idêntico e sem dependências.
DROP INDEX IF EXISTS public.tracking_events_y2026m10_created_brin;