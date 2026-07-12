
REVOKE EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.rollup_contract_version_usage(integer) TO service_role;
