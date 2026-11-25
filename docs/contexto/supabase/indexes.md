# Índices

Uso e tamanho em `stats.md`.

| tabela | índice | método | colunas | único | válido | predicado |
|---|---|---|---|---|---|---|
| public.active_tracking | active_tracking_order_id_key | btree | order_id | sim | sim |  |
| public.active_tracking | active_tracking_pkey | btree | id | sim | sim |  |
| public.active_tracking | idx_active_tracking_driver_id | btree | driver_id | não | sim |  |
| public.active_tracking | idx_tracking_status_active | btree | tracking_status | não | sim | `(tracking_status = 'ACTIVE'::text)` |
| public.alert_configurations | alert_configurations_alert_type_channel_key | btree | alert_type, channel | sim | sim |  |
| public.alert_configurations | alert_configurations_pkey | btree | id | sim | sim |  |
| public.alert_configurations | idx_alert_configurations_escalation_lookup | btree | alert_type, escalation_after_seconds | não | sim | `((is_enabled = true) AND (escalation_enabled = true))` |
| public.alert_dedup | alert_dedup_pkey | btree | dedup_key | sim | sim |  |
| public.alert_dedup | idx_alert_dedup_last_notified | btree | last_notified_at | não | sim |  |
| public.alert_dedup | idx_alert_dedup_suppressed | btree | last_notified_at | não | sim | `(suppressed_count > 0)` |
| public.alert_dedup | idx_alert_dedup_type_notified | btree | alert_type, last_notified_at | não | sim |  |
| public.alerts | alerts_pkey | btree | id | sim | sim |  |
| public.alerts | idx_alerts_created | btree | created_at | não | sim |  |
| public.alerts | idx_alerts_driver_active | btree | driver_id, created_at | não | sim | `((is_dismissed = false) AND (driver_id IS NOT NULL))` |
| public.alerts | idx_alerts_driver_id | btree | driver_id | não | sim |  |
| public.alerts | idx_alerts_not_dismissed | btree | is_dismissed, created_at | não | sim | `(is_dismissed = false)` |
| public.alerts | idx_alerts_order_active | btree | order_id, created_at | não | sim | `((is_dismissed = false) AND (order_id IS NOT NULL))` |
| public.alerts | idx_alerts_order_id | btree | order_id | não | sim |  |
| public.alerts | idx_alerts_pending_escalation | btree | severity, created_at | não | sim | `((acknowledged_at IS NULL) AND (escalated_at IS NULL) AND (is_dismissed = false))` |
| public.alerts | idx_alerts_severity | btree | severity | não | sim |  |
| public.alerts | idx_alerts_type | btree | type | não | sim |  |
| public.alerts | idx_alerts_unread | btree | is_read | não | sim | `(is_read = false)` |
| public.alerts_sent | alerts_sent_pkey | btree | id | sim | sim |  |
| public.alerts_sent | idx_alerts_sent_alert_id | btree | alert_id | não | sim |  |
| public.alerts_sent | idx_alerts_sent_channel_recent | btree | channel, sent_at | não | sim |  |
| public.alerts_sent | idx_alerts_sent_failed_retry | btree | created_at | não | sim | `(status = 'FAILED'::text)` |
| public.audit_log | audit_log_created_at_idx | btree | created_at | não | sim |  |
| public.audit_log | audit_log_pkey | btree | id | sim | sim |  |
| public.audit_log | audit_log_resource_idx | btree | resource_type, resource_id | não | sim |  |
| public.audit_log | audit_log_user_id_idx | btree | user_id | não | sim |  |
| public.auth_logs | auth_logs_pkey | btree | id | sim | sim |  |
| public.auth_logs | idx_auth_logs_created | btree | created_at | não | sim |  |
| public.auth_logs | idx_auth_logs_event_created | btree | event_type, created_at | não | sim |  |
| public.auth_logs | idx_auth_logs_failures | btree | created_at | não | sim | `(success = false)` |
| public.auth_logs | idx_auth_logs_user_created | btree | user_id, created_at | não | sim | `(user_id IS NOT NULL)` |
| public.bitrix24_activities | bitrix24_activities_pkey | btree | id | sim | sim |  |
| public.bitrix24_activities | idx_bitrix24_activities_order_id | btree | order_id | não | sim |  |
| public.bitrix24_spa_sync | bitrix24_spa_sync_pkey | btree | id | sim | sim |  |
| public.bitrix24_spa_sync | idx_bitrix24_spa_sync_spa | btree | spa_id | não | sim |  |
| public.bitrix24_spa_sync | uq_bitrix24_spa_sync_order | btree | order_id | sim | sim |  |
| public.bitrix24_stage_mappings | bitrix24_stage_mappings_lalamove_status_key | btree | lalamove_status | sim | sim |  |
| public.bitrix24_stage_mappings | bitrix24_stage_mappings_pkey | btree | id | sim | sim |  |
| public.bitrix24_sync | bitrix24_sync_order_id_key | btree | order_id | sim | sim |  |
| public.bitrix24_sync | bitrix24_sync_pkey | btree | id | sim | sim |  |
| public.bitrix24_tokens | bitrix24_tokens_pkey | btree | id | sim | sim |  |
| public.blocked_ips | blocked_ips_ip_address_key | btree | ip_address | sim | sim |  |
| public.blocked_ips | blocked_ips_pkey | btree | id | sim | sim |  |
| public.blocked_ips | idx_blocked_ips_expires | btree | expires_at | não | sim |  |
| public.cache_refresh_log | cache_refresh_log_pkey | btree | id | sim | sim |  |
| public.cache_refresh_log | idx_cache_refresh_log_running | btree | view_name | sim | sim | `(status = 'running'::text)` |
| public.cache_refresh_log | idx_cache_refresh_log_status | btree | status, refresh_started_at | não | sim |  |
| public.cache_refresh_log | idx_cache_refresh_log_view | btree | view_name, refresh_started_at | não | sim |  |
| public.contacts | contacts_owner_phone_unique | btree | owner_id, phone_e164 | sim | sim |  |
| public.contacts | contacts_pkey | btree | id | sim | sim |  |
| public.contacts | idx_contacts_name_trgm | gin | name | não | sim |  |
| public.contacts | idx_contacts_owner_last_used | btree | owner_id, last_used_at | não | sim |  |
| public.contacts | idx_contacts_owner_name | btree | owner_id | não | sim |  |
| public.contacts | idx_contacts_phone_trgm | gin | phone_e164 | não | sim |  |
| public.contract_version_usage | contract_version_usage_pkey | btree | id | sim | sim |  |
| public.contract_version_usage | contract_version_usage_unique | btree | contract_name, contract_version, usage_date | sim | sim |  |
| public.contract_version_usage | idx_contract_version_usage_date_cover | btree | usage_date, contract_name, contract_version, deprecated, request_count, last_seen_at | não | sim |  |
| public.contract_version_usage | idx_contract_version_usage_deprecated | btree | deprecated, usage_date | não | sim |  |
| public.contract_version_usage | idx_contract_version_usage_version | btree | contract_version, usage_date | não | sim |  |
| public.contract_version_usage_monthly | contract_version_usage_monthly_pkey | btree | id | sim | sim |  |
| public.contract_version_usage_monthly | contract_version_usage_monthly_unique | btree | contract_name, contract_version, usage_month | sim | sim |  |
| public.contract_version_usage_monthly | idx_contract_version_usage_monthly_month | btree | usage_month | não | sim |  |
| public.contract_version_usage_monthly | idx_contract_version_usage_monthly_month_cover | btree | usage_month, contract_version, request_count | não | sim |  |
| public.cron_job_logs | cron_job_logs_pkey | btree | id | sim | sim |  |
| public.cron_job_logs | idx_cron_job_logs_created_at | btree | created_at | não | sim |  |
| public.cron_job_logs | idx_cron_job_logs_job_name | btree | job_name, executed_at | não | sim |  |
| public.delivery_metrics_cache | idx_delivery_metrics_cache_date | btree | delivery_date | sim | sim |  |
| public.driver_approval_queue | driver_approval_queue_pkey | btree | id | sim | sim |  |
| public.driver_approval_queue | idx_approval_priority | btree | priority | não | sim |  |
| public.driver_approval_queue | idx_approvals_driver | btree | driver_id | não | sim |  |
| public.driver_approval_queue | idx_approvals_status | btree | status | não | sim |  |
| public.driver_approval_queue | idx_driver_approval_queue_order_id | btree | order_id | não | sim |  |
| public.driver_approval_queue | idx_driver_approval_queue_pending_priority | btree | priority, requested_at | não | sim | `(status = 'PENDING'::approval_status)` |
| public.driver_approval_queue | idx_driver_approval_queue_pending_recent | btree | requested_at | não | sim | `(status = 'PENDING'::approval_status)` |
| public.driver_approval_queue | idx_driver_approval_queue_status_reviewed | btree | status, reviewed_at | não | sim |  |
| public.driver_evaluations | driver_evaluations_pkey | btree | id | sim | sim |  |
| public.driver_evaluations | idx_driver_evaluations_approved | btree | approved | não | sim |  |
| public.driver_evaluations | idx_driver_evaluations_driver_id | btree | driver_id | não | sim |  |
| public.driver_evaluations | idx_driver_evaluations_evaluated_at | btree | evaluated_at | não | sim |  |
| public.driver_evaluations | idx_driver_evaluations_order_id | btree | order_id | não | sim |  |
| public.driver_evaluations | idx_driver_evaluations_requires_manual | btree | requires_manual | não | sim |  |
| public.driver_incidents | driver_incidents_pkey | btree | id | sim | sim |  |
| public.driver_incidents | idx_driver_incidents_driver_created | btree | driver_id, created_at | não | sim |  |
| public.driver_incidents | idx_driver_incidents_order_id | btree | order_id | não | sim |  |
| public.driver_incidents | idx_incidents_resolved | btree | resolved | não | sim | `(resolved = false)` |
| public.driver_incidents | idx_incidents_type | btree | type | não | sim |  |
| public.driver_locations | driver_locations_pkey | btree | id | sim | sim |  |
| public.driver_locations | idx_driver_locations_recorded | btree | recorded_at | não | sim |  |
| public.driver_locations | idx_driver_locations_tracking_recorded | btree | tracking_id, recorded_at | não | sim |  |
| public.driver_stats_cache | idx_driver_stats_cache_driver_id | btree | driver_id | sim | sim |  |
| public.drivers | drivers_lalamove_id_key | btree | lalamove_id | sim | sim |  |
| public.drivers | drivers_pkey | btree | id | sim | sim |  |
| public.drivers | idx_drivers_blacklisted | btree | blacklisted | não | sim | `(blacklisted = true)` |
| public.drivers | idx_drivers_risk_level | btree | risk_level | não | sim | `(risk_level IS NOT NULL)` |
| public.drivers | idx_drivers_risk_score | btree | risk_score | não | sim |  |
| public.drivers | idx_drivers_status | btree | status | não | sim |  |
| public.drivers | idx_drivers_whitelisted | btree | whitelisted | não | sim | `(whitelisted = true)` |
| public.email_verifications | email_verifications_pkey | btree | id | sim | sim |  |
| public.email_verifications | email_verifications_token_hash_key | btree | token_hash | sim | sim |  |
| public.feature_flags | feature_flags_name_key | btree | name | sim | sim |  |
| public.feature_flags | feature_flags_pkey | btree | id | sim | sim |  |
| public.geo_blocks | geo_blocks_country_code_key | btree | country_code | sim | sim |  |
| public.geo_blocks | geo_blocks_pkey | btree | id | sim | sim |  |
| public.geo_blocks | idx_geo_blocks_active | btree | is_blocked | não | sim | `(is_blocked = true)` |
| public.geo_blocks | idx_geo_blocks_blocked_by | btree | blocked_by | não | sim |  |
| public.geo_budget | geo_budget_pkey | btree | provider | sim | sim |  |
| public.geo_budget | geo_budget_updated_by_idx | btree | updated_by | não | sim |  |
| public.geo_cache | geo_cache_pkey | btree | key | sim | sim |  |
| public.geo_cache | idx_geo_cache_expires | btree | expires_at | não | sim |  |
| public.geo_defaults | geo_defaults_pkey | btree | id | sim | sim |  |
| public.geo_defaults | geo_defaults_updated_by_idx | btree | updated_by | não | sim |  |
| public.geo_price_list | geo_price_list_pkey | btree | provider, sku | sim | sim |  |
| public.geo_settings | geo_settings_pkey | btree | function | sim | sim |  |
| public.geo_settings | geo_settings_updated_by_idx | btree | updated_by | não | sim |  |
| public.geo_usage | geo_usage_pkey | btree | day, provider, function, sku | sim | sim |  |
| public.geo_usage | idx_geo_usage_month | btree | provider, day | não | sim |  |
| public.hourly_metrics_cache | idx_hourly_metrics_cache_hour | btree | hour | sim | sim |  |
| public.ip_whitelist | ip_whitelist_pkey | btree | id | sim | sim |  |
| public.job_queue | idx_job_queue_created_by | btree | created_by | não | sim |  |
| public.job_queue | idx_job_queue_monitoring | btree | type, status, created_at | não | sim |  |
| public.job_queue | idx_job_queue_pending | btree | next_retry_at, priority | não | sim | `(status = 'PENDING'::text)` |
| public.job_queue | idx_job_queue_status | btree | status | não | sim |  |
| public.job_queue | idx_job_queue_type | btree | type | não | sim |  |
| public.job_queue | job_queue_pkey | btree | id | sim | sim |  |
| public.job_queue | uq_job_queue_dedup_open | btree | dedup_key | sim | sim | `((dedup_key IS NOT NULL) AND (status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text])))` |
| public.job_queue_processing_log | idx_job_queue_processing_log_run_at | btree | run_at | não | sim |  |
| public.job_queue_processing_log | job_queue_processing_log_pkey | btree | id | sim | sim |  |
| public.lalamove_order_replacements | idx_order_replacements_new_id | btree | new_lalamove_id | não | sim |  |
| public.lalamove_order_replacements | idx_order_replacements_order_id | btree | order_id | não | sim |  |
| public.lalamove_order_replacements | idx_order_replacements_prev_id | btree | previous_lalamove_id | não | sim |  |
| public.lalamove_order_replacements | lalamove_order_replacements_pair_unique | btree | previous_lalamove_id, new_lalamove_id | sim | sim |  |
| public.lalamove_order_replacements | lalamove_order_replacements_pkey | btree | id | sim | sim |  |
| public.lalamove_orders | idx_lalamove_orders_cancellation_reason | btree | cancellation_reason | não | sim | `(cancellation_reason IS NOT NULL)` |
| public.lalamove_orders | idx_lalamove_orders_cancelled_at | btree | cancelled_at | não | sim | `(cancelled_at IS NOT NULL)` |
| public.lalamove_orders | idx_lalamove_orders_cancelled_by | btree | cancelled_by | não | sim | `(cancelled_by IS NOT NULL)` |
| public.lalamove_orders | idx_lalamove_orders_driver_status_updated | btree | driver_id, status, updated_at | não | sim |  |
| public.lalamove_orders | idx_lalamove_orders_open_status | btree | created_at | não | sim | `(status = ANY (ARRAY['PENDING'::order_status, 'MATCHED'::order_status, 'ON_GOING'::order_status, 'PICKED_UP'::order_status]))` |
| public.lalamove_orders | idx_lalamove_orders_source | btree | source | não | sim |  |
| public.lalamove_orders | idx_lalamove_orders_spa_id | btree | spa_id | não | sim | `(spa_id IS NOT NULL)` |
| public.lalamove_orders | idx_lalamove_orders_status_created | btree | status, created_at | não | sim |  |
| public.lalamove_orders | idx_orders_bitrix24 | btree | bitrix24_deal_id | não | sim | `(bitrix24_deal_id IS NOT NULL)` |
| public.lalamove_orders | idx_orders_cost_center | btree | cost_center | não | sim | `(cost_center IS NOT NULL)` |
| public.lalamove_orders | idx_orders_created | btree | created_at | não | sim |  |
| public.lalamove_orders | idx_orders_delivery_place_id | btree | delivery_place_id | não | sim | `(delivery_place_id IS NOT NULL)` |
| public.lalamove_orders | idx_orders_driver | btree | driver_id | não | sim |  |
| public.lalamove_orders | idx_orders_pickup_place_id | btree | pickup_place_id | não | sim | `(pickup_place_id IS NOT NULL)` |
| public.lalamove_orders | idx_orders_status | btree | status | não | sim |  |
| public.lalamove_orders | idx_orders_urgent | btree | is_urgent | não | sim | `(is_urgent = true)` |
| public.lalamove_orders | lalamove_orders_lalamove_id_key | btree | lalamove_id | sim | sim |  |
| public.lalamove_orders | lalamove_orders_pkey | btree | id | sim | sim |  |
| public.lalamove_priority_fee_history | idx_lalamove_priority_fee_history_changed_by | btree | changed_by | não | sim | `(changed_by IS NOT NULL)` |
| public.lalamove_priority_fee_history | idx_priority_fee_history_order | btree | order_id, created_at | não | sim |  |
| public.lalamove_priority_fee_history | lalamove_priority_fee_history_pkey | btree | id | sim | sim |  |
| public.lalamove_rate_limits | idx_lalamove_rate_limits_created | btree | created_at | não | sim |  |
| public.lalamove_rate_limits | idx_lalamove_rate_limits_endpoint_created | btree | endpoint, created_at | não | sim |  |
| public.lalamove_rate_limits | idx_lalamove_rate_limits_errors | btree | created_at | não | sim | `(status >= 400)` |
| public.lalamove_rate_limits | idx_lalamove_rate_limits_low_remaining | btree | created_at | não | sim | `((limit_remaining IS NOT NULL) AND (limit_remaining <= 10))` |
| public.lalamove_rate_limits | lalamove_rate_limits_pkey | btree | id | sim | sim |  |
| public.lalamove_status_history | idx_lalamove_status_history_order_created | btree | order_id, created_at | não | sim |  |
| public.lalamove_status_history | idx_lalamove_status_history_order_id | btree | order_id | não | sim |  |
| public.lalamove_status_history | lalamove_status_history_pkey | btree | id | sim | sim |  |
| public.lalamove_stop_proofs | idx_stop_proofs_delivered_at | btree | pod_delivered_at | não | sim | `(pod_delivered_at IS NOT NULL)` |
| public.lalamove_stop_proofs | idx_stop_proofs_order_id | btree | order_id | não | sim |  |
| public.lalamove_stop_proofs | idx_stop_proofs_pod_status | btree | pod_status | não | sim | `((pod_status IS NOT NULL) AND (pod_status <> 'NOT_REQUIRED'::text))` |
| public.lalamove_stop_proofs | idx_stop_proofs_pop_status | btree | pop_status | não | sim | `((pop_status IS NOT NULL) AND (pop_status <> 'NOT_REQUIRED'::text))` |
| public.lalamove_stop_proofs | lalamove_stop_proofs_pkey | btree | id | sim | sim |  |
| public.lalamove_stop_proofs | lalamove_stop_proofs_stop_unique | btree | stop_id | sim | sim |  |
| public.lalamove_stops | idx_lalamove_stops_order_id | btree | order_id | não | sim |  |
| public.lalamove_stops | idx_stops_pod_status | btree | pod_status | não | sim | `(pod_status <> 'NOT_REQUIRED'::text)` |
| public.lalamove_stops | lalamove_stops_pkey | btree | id | sim | sim |  |
| public.lalamove_stops | uq_lalamove_stops_order_stop_index | btree | order_id, stop_index | sim | sim |  |
| public.lalamove_uapi_sessions | idx_uapi_sessions_active | btree | is_active | sim | sim | `(is_active = true)` |
| public.lalamove_uapi_sessions | lalamove_uapi_sessions_pkey | btree | id | sim | sim |  |
| public.lalamove_uapi_snapshot | lalamove_uapi_snapshot_expires_at_idx | btree | expires_at | não | sim |  |
| public.lalamove_uapi_snapshot | lalamove_uapi_snapshot_pkey | btree | resource | sim | sim |  |
| public.lalamove_webhook_config | lalamove_webhook_config_pkey | btree | id | sim | sim |  |
| public.lalamove_webhook_config | lalamove_webhook_config_registered_by_idx | btree | registered_by | não | sim |  |
| public.lalamove_webhook_config | uq_webhook_config_active_env | btree | environment | sim | sim | `is_active` |
| public.login_attempts | idx_login_attempts_email | btree | email | não | sim |  |
| public.login_attempts | idx_login_attempts_ip_last_attempt | btree | ip_address, last_attempt_at | não | sim |  |
| public.login_attempts | idx_login_attempts_locked_until | btree | locked_until | não | sim |  |
| public.login_attempts | idx_login_attempts_suspicious | btree | is_suspicious | não | sim | `(is_suspicious = true)` |
| public.login_attempts | login_attempts_pkey | btree | id | sim | sim |  |
| public.map_settings_overrides | map_settings_overrides_pkey | btree | id | sim | sim |  |
| public.map_settings_overrides | map_settings_overrides_user_id_context_key_key | btree | user_id, context_key | sim | sim |  |
| public.mcp_diagnostics_grants | mcp_diagnostics_grants_pkey | btree | id | sim | sim |  |
| public.mcp_diagnostics_grants | mcp_diagnostics_grants_user_id_key | btree | user_id | sim | sim |  |
| public.message_templates | message_templates_active_key_idx | btree | key, channel | sim | sim | `is_active` |
| public.message_templates | message_templates_event_idx | btree | event, role, channel | não | sim | `is_active` |
| public.message_templates | message_templates_key_channel_version_key | btree | key, channel, version | sim | sim |  |
| public.message_templates | message_templates_pkey | btree | id | sim | sim |  |
| public.message_templates | message_templates_updated_by_idx | btree | updated_by | não | sim |  |
| public.messaging_settings | messaging_settings_pkey | btree | id | sim | sim |  |
| public.messaging_settings | messaging_settings_updated_by_idx | btree | updated_by | não | sim |  |
| public.messaging_usage | messaging_usage_day_idx | btree | day | não | sim |  |
| public.messaging_usage | messaging_usage_pkey | btree | day, channel, provider | sim | sim |  |
| public.mfa_sessions | idx_mfa_sessions_user | btree | user_id | não | sim |  |
| public.mfa_sessions | mfa_sessions_pkey | btree | id | sim | sim |  |
| public.new_device_alerts | idx_new_device_alerts_device_id | btree | device_id | não | sim |  |
| public.new_device_alerts | idx_new_device_alerts_user | btree | user_id, created_at | não | sim |  |
| public.new_device_alerts | new_device_alerts_pkey | btree | id | sim | sim |  |
| public.notification_messages | notification_messages_alert_id_idx | btree | alert_id | não | sim |  |
| public.notification_messages | notification_messages_client_message_id_key | btree | client_message_id | sim | sim | `(client_message_id IS NOT NULL)` |
| public.notification_messages | notification_messages_driver_created_idx | btree | driver_id, created_at | não | sim |  |
| public.notification_messages | notification_messages_fallback_of_idx | btree | fallback_of | não | sim |  |
| public.notification_messages | notification_messages_order_created_idx | btree | order_id, created_at | não | sim |  |
| public.notification_messages | notification_messages_pending_idx | btree | status | não | sim | `(status = ANY (ARRAY['queued'::text, 'sent'::text]))` |
| public.notification_messages | notification_messages_pkey | btree | id | sim | sim |  |
| public.notification_messages | notification_messages_provider_message_id_key | btree | provider, provider_message_id | sim | sim | `(provider_message_id IS NOT NULL)` |
| public.notification_messages | notification_messages_recipient_created_idx | btree | recipient_phone, created_at | não | sim |  |
| public.notification_optouts | notification_optouts_created_by_idx | btree | created_by | não | sim |  |
| public.notification_optouts | notification_optouts_pkey | btree | phone | sim | sim |  |
| public.notification_routes | notification_routes_event_idx | btree | event | não | sim | `is_enabled` |
| public.notification_routes | notification_routes_pkey | btree | event, role | sim | sim |  |
| public.notification_routes | notification_routes_updated_by_idx | btree | updated_by | não | sim |  |
| public.order_geo_events | idx_order_geo_events_alert_id | btree | alert_id | não | sim |  |
| public.order_geo_events | idx_order_geo_events_order | btree | order_id, triggered_at | não | sim |  |
| public.order_geo_events | order_geo_events_order_id_event_type_stop_index_key | btree | order_id, event_type, stop_index | sim | sim |  |
| public.order_geo_events | order_geo_events_pkey | btree | id | sim | sim |  |
| public.password_reset_requests | idx_password_reset_requests_reviewed_by | btree | reviewed_by | não | sim |  |
| public.password_reset_requests | password_reset_requests_pkey | btree | id | sim | sim |  |
| public.password_reset_tokens | idx_password_reset_tokens_cleanup | btree | expires_at | não | sim | `(used_at IS NULL)` |
| public.password_reset_tokens | idx_password_reset_tokens_lookup | btree | token_hash, expires_at | não | sim | `(used_at IS NULL)` |
| public.password_reset_tokens | password_reset_tokens_pkey | btree | id | sim | sim |  |
| public.password_reset_tokens | password_reset_tokens_token_hash_key | btree | token_hash | sim | sim |  |
| public.permissions | permissions_name_key | btree | name | sim | sim |  |
| public.permissions | permissions_pkey | btree | id | sim | sim |  |
| public.query_telemetry | idx_query_telemetry_created_at | btree | created_at | não | sim |  |
| public.query_telemetry | idx_query_telemetry_errors | btree | created_at | não | sim | `(severity = 'error'::text)` |
| public.query_telemetry | idx_query_telemetry_operation_created | btree | operation, created_at | não | sim |  |
| public.query_telemetry | idx_query_telemetry_rpc_created | btree | rpc_name, created_at | não | sim | `(rpc_name IS NOT NULL)` |
| public.query_telemetry | idx_query_telemetry_severity_created | btree | severity, created_at | não | sim |  |
| public.query_telemetry | idx_query_telemetry_slow | btree | duration_ms, created_at | não | sim | `(duration_ms >= 3000)` |
| public.query_telemetry | idx_query_telemetry_table_created | btree | table_name, created_at | não | sim | `(table_name IS NOT NULL)` |
| public.query_telemetry | query_telemetry_pkey | btree | id | sim | sim |  |
| public.rate_limit_logs | idx_rate_limit_logs_created | btree | created_at | não | sim |  |
| public.rate_limit_logs | idx_rate_limit_logs_ip_created | btree | ip_address, created_at | não | sim |  |
| public.rate_limit_logs | rate_limit_logs_pkey | btree | id | sim | sim |  |
| public.region_cache | region_cache_pkey | btree | coord_key | sim | sim |  |
| public.report_presets | idx_report_presets_user_id | btree | user_id | não | sim |  |
| public.report_presets | report_presets_pkey | btree | id | sim | sim |  |
| public.report_presets | report_presets_user_id_name_key | btree | user_id, name | sim | sim |  |
| public.risk_rules | idx_risk_rules_active | btree | is_active | não | sim | `(is_active = true)` |
| public.risk_rules | risk_rules_pkey | btree | id | sim | sim |  |
| public.role_permissions | idx_role_permissions_permission_id | btree | permission_id | não | sim |  |
| public.role_permissions | role_permissions_pkey | btree | id | sim | sim |  |
| public.role_permissions | role_permissions_role_permission_id_key | btree | role, permission_id | sim | sim |  |
| public.runtime_error_logs | idx_runtime_error_logs_created_at | btree | created_at | não | sim |  |
| public.runtime_error_logs | idx_runtime_error_logs_fingerprint | btree | fingerprint | não | sim |  |
| public.runtime_error_logs | idx_runtime_error_logs_fingerprint_created | btree | fingerprint, created_at | não | sim |  |
| public.runtime_error_logs | idx_runtime_error_logs_resolved | btree | resolved | não | sim |  |
| public.runtime_error_logs | idx_runtime_error_logs_severity | btree | severity | não | sim |  |
| public.runtime_error_logs | idx_runtime_error_logs_unresolved_recent | btree | created_at | não | sim | `(resolved = false)` |
| public.runtime_error_logs | runtime_error_logs_pkey | btree | id | sim | sim |  |
| public.security_test_logs | security_test_logs_pkey | btree | id | sim | sim |  |
| public.tracking_events | idx_tracking_driver_created | btree | driver_id, created_at | não | sim |  |
| public.tracking_events | idx_tracking_events_created_brin | brin | created_at | não | sim |  |
| public.tracking_events | idx_tracking_order_created | btree | order_id, created_at | não | sim |  |
| public.tracking_events | tracking_events_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_default | tracking_events_default_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_default | tracking_events_default_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_default | tracking_events_default_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_default | tracking_events_default_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2026m05 | tracking_events_y2026m05_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2026m05 | tracking_events_y2026m05_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2026m05 | tracking_events_y2026m05_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2026m05 | tracking_events_y2026m05_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2026m06 | tracking_events_y2026m06_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2026m06 | tracking_events_y2026m06_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2026m06 | tracking_events_y2026m06_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2026m06 | tracking_events_y2026m06_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2026m07 | tracking_events_y2026m07_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2026m07 | tracking_events_y2026m07_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2026m07 | tracking_events_y2026m07_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2026m07 | tracking_events_y2026m07_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2026m08 | tracking_events_y2026m08_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2026m08 | tracking_events_y2026m08_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2026m08 | tracking_events_y2026m08_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2026m08 | tracking_events_y2026m08_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2026m09 | tracking_events_y2026m09_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2026m09 | tracking_events_y2026m09_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2026m09 | tracking_events_y2026m09_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2026m09 | tracking_events_y2026m09_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2026m10 | tracking_events_y2026m10_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2026m10 | tracking_events_y2026m10_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2026m10 | tracking_events_y2026m10_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2026m10 | tracking_events_y2026m10_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2026m11 | tracking_events_y2026m11_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2026m11 | tracking_events_y2026m11_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2026m11 | tracking_events_y2026m11_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2026m11 | tracking_events_y2026m11_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2026m12 | tracking_events_y2026m12_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2026m12 | tracking_events_y2026m12_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2026m12 | tracking_events_y2026m12_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2026m12 | tracking_events_y2026m12_pkey | btree | id, created_at | sim | sim |  |
| public.tracking_events_y2027m01 | tracking_events_y2027m01_created_at_idx | brin | created_at | não | sim |  |
| public.tracking_events_y2027m01 | tracking_events_y2027m01_driver_id_created_at_idx | btree | driver_id, created_at | não | sim |  |
| public.tracking_events_y2027m01 | tracking_events_y2027m01_order_id_created_at_idx | btree | order_id, created_at | não | sim |  |
| public.tracking_events_y2027m01 | tracking_events_y2027m01_pkey | btree | id, created_at | sim | sim |  |
| public.user_devices | idx_user_devices_last_seen | btree | last_seen_at | não | sim |  |
| public.user_devices | user_devices_pkey | btree | id | sim | sim |  |
| public.user_devices | user_devices_user_id_device_fingerprint_key | btree | user_id, device_fingerprint | sim | sim |  |
| public.user_passkeys | idx_user_passkeys_user_id | btree | user_id | não | sim |  |
| public.user_passkeys | user_passkeys_credential_id_key | btree | credential_id | sim | sim |  |
| public.user_passkeys | user_passkeys_pkey | btree | id | sim | sim |  |
| public.user_roles | idx_user_roles_role | btree | role | não | sim |  |
| public.user_roles | idx_user_roles_user_id | btree | user_id | não | sim |  |
| public.user_roles | user_roles_pkey | btree | id | sim | sim |  |
| public.user_roles | user_roles_user_id_role_key | btree | user_id, role | sim | sim |  |
| public.webauthn_challenges | idx_webauthn_challenges_expires | btree | expires_at | não | sim |  |
| public.webauthn_challenges | webauthn_challenges_pkey | btree | id | sim | sim |  |
| public.webhook_events | idx_webhook_events_event_type_received_at | btree | event_type, received_at | não | sim |  |
| public.webhook_events | idx_webhook_events_idempotency_key | btree | idempotency_key | sim | sim | `(idempotency_key IS NOT NULL)` |
| public.webhook_events | idx_webhooks_order | btree | lalamove_order_id | não | sim |  |
| public.webhook_events | idx_webhooks_processed | btree | processed | não | sim | `(processed = false)` |
| public.webhook_events | idx_webhooks_received | btree | received_at | não | sim |  |
| public.webhook_events | idx_webhooks_type | btree | event_type | não | sim |  |
| public.webhook_events | webhook_events_pkey | btree | id | sim | sim |  |
