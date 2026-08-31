
CREATE INDEX IF NOT EXISTS idx_contract_version_usage_date_cover
  ON public.contract_version_usage
  USING btree (usage_date)
  INCLUDE (contract_name, contract_version, deprecated, request_count, last_seen_at);

ANALYZE public.contract_version_usage;
