CREATE INDEX IF NOT EXISTS idx_contract_version_usage_monthly_month_cover
  ON public.contract_version_usage_monthly
  USING btree (usage_month)
  INCLUDE (contract_version, request_count);

ANALYZE public.contract_version_usage_monthly;