REVOKE EXECUTE ON FUNCTION public.cleanup_old_region_cache(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_region_cache(integer) TO service_role;
