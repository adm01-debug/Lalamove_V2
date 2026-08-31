
REVOKE EXECUTE ON FUNCTION public.get_contract_v1_sunset_readiness(integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_contract_v1_sunset_readiness(integer, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_contract_v1_sunset_readiness(integer, numeric) TO authenticated;
