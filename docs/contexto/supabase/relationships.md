# Relacionamentos (chaves estrangeiras)


| de | colunas | para | colunas | on delete | on update |
|---|---|---|---|---|---|
| public.active_tracking | driver_id | public.drivers | id | CASCADE | NO ACTION |
| public.active_tracking | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.alerts | driver_id | public.drivers | id | SET NULL | NO ACTION |
| public.alerts | order_id | public.lalamove_orders | id | SET NULL | NO ACTION |
| public.alerts_sent | alert_id | public.alerts | id | CASCADE | NO ACTION |
| public.audit_log | user_id | auth.users | id | SET NULL | NO ACTION |
| public.bitrix24_activities | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.bitrix24_spa_sync | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.bitrix24_sync | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.contacts | owner_id | auth.users | id | CASCADE | NO ACTION |
| public.driver_approval_queue | driver_id | public.drivers | id | CASCADE | NO ACTION |
| public.driver_approval_queue | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.driver_evaluations | driver_id | public.drivers | id | CASCADE | NO ACTION |
| public.driver_evaluations | order_id | public.lalamove_orders | id | SET NULL | NO ACTION |
| public.driver_incidents | driver_id | public.drivers | id | CASCADE | NO ACTION |
| public.driver_incidents | order_id | public.lalamove_orders | id | SET NULL | NO ACTION |
| public.driver_locations | tracking_id | public.active_tracking | id | CASCADE | NO ACTION |
| public.geo_blocks | blocked_by | auth.users | id | SET NULL | NO ACTION |
| public.geo_budget | updated_by | auth.users | id | NO ACTION | NO ACTION |
| public.geo_defaults | updated_by | auth.users | id | NO ACTION | NO ACTION |
| public.geo_settings | updated_by | auth.users | id | NO ACTION | NO ACTION |
| public.job_queue | created_by | auth.users | id | NO ACTION | NO ACTION |
| public.lalamove_order_replacements | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.lalamove_orders | cancelled_by | auth.users | id | SET NULL | NO ACTION |
| public.lalamove_orders | driver_id | public.drivers | id | SET NULL | NO ACTION |
| public.lalamove_priority_fee_history | changed_by | auth.users | id | SET NULL | NO ACTION |
| public.lalamove_priority_fee_history | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.lalamove_status_history | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.lalamove_stop_proofs | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.lalamove_stop_proofs | stop_id | public.lalamove_stops | id | CASCADE | NO ACTION |
| public.lalamove_stops | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.lalamove_webhook_config | registered_by | auth.users | id | NO ACTION | NO ACTION |
| public.map_settings_overrides | user_id | auth.users | id | CASCADE | NO ACTION |
| public.message_templates | updated_by | auth.users | id | SET NULL | NO ACTION |
| public.messaging_settings | updated_by | auth.users | id | SET NULL | NO ACTION |
| public.new_device_alerts | device_id | public.user_devices | id | CASCADE | NO ACTION |
| public.notification_messages | alert_id | public.alerts | id | SET NULL | NO ACTION |
| public.notification_messages | fallback_of | public.notification_messages | id | SET NULL | NO ACTION |
| public.notification_optouts | created_by | auth.users | id | SET NULL | NO ACTION |
| public.notification_routes | updated_by | auth.users | id | SET NULL | NO ACTION |
| public.order_geo_events | alert_id | public.alerts | id | SET NULL | NO ACTION |
| public.order_geo_events | order_id | public.lalamove_orders | id | CASCADE | NO ACTION |
| public.password_reset_requests | reviewed_by | auth.users | id | SET NULL | NO ACTION |
| public.report_presets | user_id | auth.users | id | CASCADE | NO ACTION |
| public.role_permissions | permission_id | public.permissions | id | CASCADE | NO ACTION |
| public.user_passkeys | user_id | auth.users | id | CASCADE | NO ACTION |


## Diagrama ER (Mermaid)

```mermaid
erDiagram
    public_active_tracking {
        uuid id PK
        uuid order_id FK
        uuid driver_id FK
        numeric_10_8_ current_latitude
        numeric_11_8_ current_longitude
        numeric_5_2_ heading
        numeric_6_2_ speed
        boolean is_on_route
        boolean is_stopped
        timestamp_with_time_zone stopped_since
        integer eta_minutes
        timestamp_with_time_zone last_updated
        jsonb expected_route
        text tracking_status
        timestamp_with_time_zone tracking_started_at
        timestamp_with_time_zone tracking_ended_at
        jsonb alerts_sent
        numeric_10_7_ origin_lat
        numeric_10_7_ origin_lng
        numeric_10_7_ destination_lat
        numeric_10_7_ destination_lng
        timestamp_with_time_zone eta_updated_at
        text eta_provider
        text route_provider
        integer route_distance_m
        text _mais_colunas_
    }
    public_alert_configurations {
        uuid id PK
        alert_type alert_type
        text channel
        boolean is_enabled
        text__ recipients
        jsonb config
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
        text name
        text message_template
        integer min_interval_seconds
        boolean notify_whatsapp
        text__ whatsapp_numbers
        boolean notify_email
        text__ email_addresses
        boolean notify_slack
        text__ slack_channels
        boolean notify_sms
        text__ sms_numbers
        boolean notify_bitrix24_task
        integer__ bitrix24_user_ids
        boolean notify_n8n_webhook
        text n8n_webhook_url
        jsonb conditions
        text created_by
        text _mais_colunas_
    }
    public_alert_dedup {
        text dedup_key PK
        alert_type alert_type
        timestamp_with_time_zone first_seen_at
        timestamp_with_time_zone last_notified_at
        integer occurrence_count
        integer suppressed_count
    }
    public_alerts {
        uuid id PK
        alert_type type
        alert_severity severity
        text title
        text message
        uuid order_id FK
        uuid driver_id FK
        boolean is_read
        boolean is_dismissed
        jsonb metadata
        timestamp_with_time_zone created_at
        timestamp_with_time_zone acknowledged_at
        uuid acknowledged_by
        timestamp_with_time_zone escalated_at
        integer escalation_level
    }
    public_alerts_sent {
        uuid id PK
        uuid alert_id FK
        text channel
        text recipient
        text status
        timestamp_with_time_zone sent_at
        text error_message
        jsonb metadata
        timestamp_with_time_zone created_at
        timestamp_with_time_zone delivered_at
        integer retry_count
    }
    public_audit_log {
        uuid id PK
        uuid user_id FK
        text action
        text resource_type
        uuid resource_id
        jsonb changes
        text ip_address
        text user_agent
        timestamp_with_time_zone created_at
    }
    public_auth_logs {
        uuid id PK
        uuid user_id
        text event_type
        inet ip_address
        text user_agent
        boolean success
        text failure_reason
        jsonb metadata
        timestamp_with_time_zone created_at
    }
    public_bitrix24_activities {
        uuid id PK
        uuid order_id FK
        integer deal_id
        integer activity_id
        text activity_type
        text subject
        timestamp_with_time_zone created_at
    }
    public_bitrix24_spa_sync {
        uuid id PK
        uuid order_id FK
        integer spa_id
        integer category_id
        text last_stage
        timestamp_with_time_zone last_synced_at
        text last_error
        text sync_status
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_bitrix24_stage_mappings {
        uuid id PK
        text lalamove_status
        text bitrix_stage_id
        text bitrix_stage_name
        timestamp_with_time_zone created_at
    }
    public_bitrix24_sync {
        uuid id PK
        uuid order_id FK
        integer deal_id
        timestamp_with_time_zone last_synced_at
        text sync_status
        text last_error
        jsonb synced_fields
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_bitrix24_tokens {
        uuid id PK
        text access_token
        text refresh_token
        timestamp_with_time_zone expires_at
        text domain
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_blocked_ips {
        uuid id PK
        inet ip_address
        text reason
        uuid blocked_by
        timestamp_with_time_zone blocked_at
        timestamp_with_time_zone expires_at
        boolean is_permanent
        integer attempts_count
        timestamp_with_time_zone last_attempt_at
        jsonb metadata
        timestamp_with_time_zone created_at
    }
    public_cache_refresh_log {
        uuid id PK
        text view_name
        timestamp_with_time_zone refresh_started_at
        timestamp_with_time_zone refresh_completed_at
        integer refresh_duration_ms
        bigint row_count
        text status
        text error_message
        text triggered_by
    }
    public_contacts {
        uuid id PK
        uuid owner_id FK
        text name
        text phone_e164
        text address
        text kind
        integer usage_count
        timestamp_with_time_zone last_used_at
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_contract_version_usage {
        uuid id PK
        text contract_name
        text contract_version
        boolean deprecated
        date usage_date
        bigint request_count
        timestamp_with_time_zone last_seen_at
        timestamp_with_time_zone created_at
    }
    public_contract_version_usage_monthly {
        uuid id PK
        text contract_name
        text contract_version
        boolean deprecated
        date usage_month
        bigint request_count
        timestamp_with_time_zone last_seen_at
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_cron_job_logs {
        uuid id PK
        text job_name
        timestamp_with_time_zone executed_at
        timestamp_with_time_zone completed_at
        integer duration_ms
        jsonb result
        boolean success
        text error_message
        timestamp_with_time_zone created_at
    }
    public_driver_approval_queue {
        uuid id PK
        uuid driver_id FK
        uuid order_id FK
        approval_status status
        numeric_3_1_ risk_score
        text__ risk_factors
        timestamp_with_time_zone requested_at
        timestamp_with_time_zone reviewed_at
        uuid reviewed_by
        text notes
        text driver_name
        integer priority
        text decision_notes
        approval_priority approval_priority
    }
    public_driver_evaluations {
        uuid id PK
        uuid driver_id FK
        uuid order_id FK
        text triggered_by
        boolean approved
        boolean requires_manual
        boolean auto_blocked
        numeric risk_score
        text risk_level
        jsonb risk_factors
        text__ risk_reasons
        integer total_deliveries
        integer completed_deliveries
        numeric failure_rate
        integer incident_count
        text recommendation
        text action_required
        timestamp_with_time_zone evaluated_at
        timestamp_with_time_zone created_at
    }
    public_driver_incidents {
        uuid id PK
        uuid driver_id FK
        uuid order_id FK
        incident_type type
        incident_severity severity
        text description
        jsonb metadata
        timestamp_with_time_zone created_at
        text__ evidence_urls
        text reported_by
        boolean resolved
        text resolution_notes
        timestamp_with_time_zone resolved_at
    }
    public_driver_locations {
        bigint id PK
        uuid tracking_id FK
        numeric_10_7_ latitude
        numeric_10_7_ longitude
        numeric_5_2_ speed_kmh
        integer heading_degrees
        integer accuracy_meters
        boolean is_moving
        timestamp_with_time_zone recorded_at
    }
    public_drivers {
        uuid id PK
        text lalamove_id
        text name
        text phone
        text photo_url
        vehicle_type vehicle_type
        text vehicle_plate
        numeric_3_1_ risk_score
        driver_status status
        integer total_deliveries
        integer completed_deliveries
        numeric_2_1_ rating
        timestamp_with_time_zone last_active_at
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
        numeric_3_2_ external_rating
        integer external_total_deliveries
        numeric_5_2_ external_success_rate
        jsonb risk_reasons
        text risk_level
        boolean whitelisted
        boolean blacklisted
        text blacklist_reason
        text notes
        timestamp_with_time_zone last_evaluated_at
        text _mais_colunas_
    }
    public_email_verifications {
        uuid id PK
        uuid user_id
        text email
        text token_hash
        timestamp_with_time_zone verified_at
        timestamp_with_time_zone expires_at
        timestamp_with_time_zone created_at
    }
    public_feature_flags {
        uuid id PK
        text name
        text description
        boolean is_enabled
        jsonb rules
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_geo_blocks {
        uuid id PK
        text country_code
        text country_name
        boolean is_blocked
        text block_type
        text reason
        uuid blocked_by FK
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
        timestamp_with_time_zone expires_at
    }
    public_geo_budget {
        text provider PK
        numeric_10_2_ monthly_limit_usd
        boolean hard_stop
        integer alert_at_pct
        date warned_month
        uuid updated_by FK
        timestamp_with_time_zone updated_at
        date blocked_warned_month
    }
    public_geo_cache {
        text key PK
        text provider
        text function
        jsonb response
        timestamp_with_time_zone created_at
        timestamp_with_time_zone expires_at
    }
    public_geo_defaults {
        boolean id PK
        integer approach_radius_m
        integer approach_eta_min
        integer arrived_radius_m
        integer off_route_threshold_m
        boolean notify_delivery_contact
        time_without_time_zone quiet_hours_start
        time_without_time_zone quiet_hours_end
        text quiet_hours_tz
        uuid updated_by FK
        timestamp_with_time_zone updated_at
        integer late_tolerance_min
    }
    public_geo_price_list {
        text provider PK
        text sku PK
        integer free_quota_month
        numeric_10_4_ unit_cost_per_1000
        text note
        timestamp_with_time_zone updated_at
    }
    public_geo_settings {
        text function PK
        text provider
        text fallback_provider
        jsonb config
        uuid updated_by FK
        timestamp_with_time_zone updated_at
    }
    public_geo_usage {
        date day PK
        text provider PK
        text function PK
        text sku PK
        integer count
        numeric_12_4_ est_cost_usd
        timestamp_with_time_zone updated_at
    }
    public_ip_whitelist {
        uuid id PK
        inet ip_address
        text cidr_range
        text description
        uuid added_by
        boolean is_active
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_job_queue {
        uuid id PK
        text type
        jsonb payload
        text status
        integer attempts
        integer max_attempts
        text error_message
        text error_stack
        timestamp_with_time_zone next_retry_at
        timestamp_with_time_zone started_at
        timestamp_with_time_zone completed_at
        integer priority
        text dedup_key
        jsonb metadata
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
        uuid created_by FK
    }
    public_job_queue_processing_log {
        uuid id PK
        timestamp_with_time_zone run_at
        integer processed
        integer succeeded
        integer failed
        integer skipped
        integer duration_ms
        jsonb metadata
    }
    public_lalamove_order_replacements {
        uuid id PK
        uuid order_id FK
        text previous_lalamove_id
        text new_lalamove_id
        text reason
        jsonb raw_payload
        timestamp_with_time_zone created_at
    }
    public_lalamove_orders {
        uuid id PK
        text lalamove_id
        text internal_order_id
        order_status status
        text pickup_address
        numeric_10_8_ pickup_latitude
        numeric_11_8_ pickup_longitude
        text delivery_address
        numeric_10_8_ delivery_latitude
        numeric_11_8_ delivery_longitude
        text customer_name
        text customer_phone
        timestamp_with_time_zone scheduled_at
        timestamp_with_time_zone estimated_delivery
        timestamp_with_time_zone actual_delivery
        uuid driver_id FK
        vehicle_type vehicle_type
        numeric_10_2_ total_cost
        text currency
        text__ tags
        text quotation_id
        jsonb metadata
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
        integer bitrix24_deal_id
        text _mais_colunas_
    }
    public_lalamove_priority_fee_history {
        uuid id PK
        uuid order_id FK
        text lalamove_order_id
        numeric_10_2_ previous_fee
        numeric_10_2_ new_fee
        text currency
        text reason
        uuid changed_by FK
        timestamp_with_time_zone created_at
    }
    public_lalamove_rate_limits {
        uuid id PK
        text endpoint
        text method
        integer status
        smallint attempts
        integer limit_total
        integer limit_remaining
        timestamp_with_time_zone limit_reset_at
        numeric_5_2_ usage_ratio
        text request_id
        jsonb raw_headers
        timestamp_with_time_zone created_at
    }
    public_lalamove_status_history {
        uuid id PK
        uuid order_id FK
        text status
        text notes
        jsonb metadata
        timestamp_with_time_zone created_at
        text old_status
        text changed_by
        text change_reason
    }
    public_lalamove_stop_proofs {
        uuid id PK
        uuid stop_id FK
        uuid order_id FK
        text pod_status
        text pod_image_url
        timestamp_with_time_zone pod_delivered_at
        text pop_status
        text pop_image_url
        timestamp_with_time_zone pop_picked_up_at
        text delivery_code
        text delivery_code_status
        jsonb raw_payload
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_lalamove_stops {
        uuid id PK
        uuid order_id FK
        integer stop_index
        text address
        numeric_10_8_ latitude
        numeric_11_8_ longitude
        text contact_name
        text contact_phone
        timestamp_with_time_zone arrived_at
        timestamp_with_time_zone completed_at
        timestamp_with_time_zone created_at
        text pod_status
        text pod_image_url
        timestamp_with_time_zone pod_delivered_at
        text remarks
        text stop_id
        text place_id
        jsonb address_components
        text geocode_precision
        text geocode_match_confidence
    }
    public_lalamove_uapi_sessions {
        uuid id PK
        text access_token
        text refresh_token
        text user_fid
        integer ep_role
        integer city_id
        timestamp_with_time_zone token_obtained_at
        timestamp_with_time_zone token_expires_at
        timestamp_with_time_zone last_refreshed_at
        text refresh_method
        boolean is_active
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_lalamove_uapi_snapshot {
        text resource PK
        jsonb payload
        integer city_id
        timestamp_with_time_zone collected_at
        timestamp_with_time_zone expires_at
        text collected_by
        timestamp_with_time_zone updated_at
    }
    public_lalamove_webhook_config {
        uuid id PK
        text environment
        text url
        boolean is_active
        timestamp_with_time_zone registered_at
        uuid registered_by FK
        text notes
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_login_attempts {
        uuid id PK
        text email
        inet ip_address
        integer attempt_count
        timestamp_with_time_zone first_attempt_at
        timestamp_with_time_zone last_attempt_at
        timestamp_with_time_zone locked_until
        timestamp_with_time_zone created_at
        text user_agent
        boolean is_suspicious
        text block_reason
    }
    public_map_settings_overrides {
        uuid id PK
        uuid user_id FK
        text context_key
        integer geofence_radius
        integer off_route_threshold
        integer stopped_threshold
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_mcp_diagnostics_grants {
        uuid id PK
        uuid user_id
        text purpose
        boolean is_active
        uuid granted_by
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_message_templates {
        uuid id PK
        text key
        text event
        text role
        text channel
        integer version
        text body
        text__ variables
        integer max_length
        boolean is_active
        uuid updated_by FK
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_messaging_settings {
        boolean id PK
        text whatsapp_provider
        text sms_provider
        integer sms_fallback_after_min
        integer monthly_budget_cents
        jsonb quiet_hours_by_role
        boolean pilot_mode
        boolean shadow_mode
        uuid updated_by FK
        timestamp_with_time_zone updated_at
    }
    public_messaging_usage {
        date day PK
        text channel PK
        text provider PK
        integer messages
        integer segments
        integer cost_cents
        timestamp_with_time_zone updated_at
    }
    public_mfa_sessions {
        uuid id PK
        uuid user_id
        text factor_id
        boolean verified
        timestamp_with_time_zone verified_at
        timestamp_with_time_zone expires_at
        inet ip_address
        text user_agent
        timestamp_with_time_zone created_at
    }
    public_new_device_alerts {
        uuid id PK
        uuid user_id
        uuid device_id FK
        inet ip_address
        text user_agent
        boolean email_sent
        timestamp_with_time_zone sent_at
        timestamp_with_time_zone created_at
    }
    public_notification_messages {
        uuid id PK
        uuid alert_id FK
        uuid order_id
        uuid driver_id
        uuid stop_id
        text event
        text role
        text direction
        text channel
        text provider
        text recipient_phone
        text client_message_id
        text provider_message_id
        text template_key
        integer template_version
        text body_preview
        text status
        text error_code
        integer attempt
        uuid fallback_of FK
        integer cost_cents
        integer segments
        bigint provider_sequence
        timestamp_with_time_zone occurred_at
        timestamp_with_time_zone sent_at
        text _mais_colunas_
    }
    public_notification_optouts {
        text phone PK
        text reason
        uuid created_by FK
        timestamp_with_time_zone created_at
    }
    public_notification_routes {
        text event PK
        text role PK
        text__ channels
        integer fallback_after_min
        boolean requires_reply
        integer reply_timeout_min
        boolean is_enabled
        uuid updated_by FK
        timestamp_with_time_zone updated_at
    }
    public_order_geo_events {
        uuid id PK
        uuid order_id FK
        alert_type event_type
        integer stop_index
        timestamp_with_time_zone triggered_at
        numeric_10_7_ driver_lat
        numeric_10_7_ driver_lng
        numeric_10_1_ distance_m
        integer eta_min
        uuid alert_id FK
        uuid job_id
        timestamp_with_time_zone notified_at
        text notification_status
        jsonb payload
    }
    public_password_reset_requests {
        uuid id PK
        text user_email
        timestamp_with_time_zone requested_at
        text status
        uuid reviewed_by FK
        timestamp_with_time_zone reviewed_at
        text rejection_reason
        inet ip_address
        text user_agent
        timestamp_with_time_zone expires_at
        timestamp_with_time_zone created_at
    }
    public_password_reset_tokens {
        uuid id PK
        uuid user_id
        text token_hash
        timestamp_with_time_zone expires_at
        timestamp_with_time_zone used_at
        inet ip_address
        timestamp_with_time_zone created_at
    }
    public_permissions {
        uuid id PK
        text name
        text description
        text module
        text action
        timestamp_with_time_zone created_at
    }
    public_query_telemetry {
        uuid id PK
        text operation
        text table_name
        text rpc_name
        integer duration_ms
        integer record_count
        integer query_limit
        integer query_offset
        text count_mode
        text severity
        text error_message
        uuid user_id
        timestamp_with_time_zone created_at
    }
    public_rate_limit_logs {
        uuid id PK
        inet ip_address
        text endpoint
        uuid user_id
        integer request_count
        timestamp_with_time_zone window_start
        timestamp_with_time_zone window_end
        boolean blocked
        text user_agent
        text country_code
        timestamp_with_time_zone created_at
    }
    public_region_cache {
        text coord_key PK
        text region
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_report_presets {
        uuid id PK
        uuid user_id FK
        text name
        jsonb filters
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_risk_rules {
        uuid id PK
        text name
        text description
        jsonb condition
        numeric_4_2_ score_impact
        boolean is_active
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_role_permissions {
        uuid id PK
        app_role role
        uuid permission_id FK
        timestamp_with_time_zone created_at
    }
    public_runtime_error_logs {
        uuid id PK
        text error_id
        text error_name
        text error_message
        text stack_trace
        text component_stack
        text source
        text severity
        text url
        text user_agent
        uuid user_id
        text app_version
        text fingerprint
        integer occurrence_count
        timestamp_with_time_zone first_seen_at
        timestamp_with_time_zone last_seen_at
        jsonb metadata
        boolean resolved
        timestamp_with_time_zone resolved_at
        uuid resolved_by
        timestamp_with_time_zone created_at
    }
    public_security_test_logs {
        uuid id PK
        text test_name
        text table_name
        text role_tested
        text operation
        boolean success
        text error_message
        timestamp_with_time_zone created_at
    }
    public_tracking_events {
        uuid id
        uuid order_id
        uuid driver_id
        numeric latitude
        numeric longitude
        numeric heading
        numeric speed
        text event_type
        jsonb metadata
        timestamp_with_time_zone created_at
    }
    public_user_devices {
        uuid id PK
        uuid user_id
        text device_fingerprint
        inet ip_address
        text user_agent
        text browser
        text os
        text device_name
        boolean is_trusted
        timestamp_with_time_zone first_seen_at
        timestamp_with_time_zone last_seen_at
        text location_city
        text location_country
        timestamp_with_time_zone created_at
    }
    public_user_passkeys {
        uuid id PK
        uuid user_id FK
        text credential_id
        text public_key
        bigint counter
        text device_type
        boolean backed_up
        text__ transports
        text friendly_name
        timestamp_with_time_zone created_at
        timestamp_with_time_zone last_used_at
    }
    public_user_roles {
        uuid id PK
        uuid user_id
        app_role role
        uuid assigned_by
        timestamp_with_time_zone assigned_at
        timestamp_with_time_zone expires_at
        boolean is_active
        text notes
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }
    public_webauthn_challenges {
        uuid id PK
        uuid user_id
        text challenge
        text type
        timestamp_with_time_zone expires_at
        timestamp_with_time_zone created_at
    }
    public_webhook_events {
        uuid id PK
        text event_type
        text lalamove_order_id
        jsonb raw_payload
        boolean processed
        timestamp_with_time_zone processed_at
        text error_message
        timestamp_with_time_zone received_at
        text idempotency_key
    }
    public_drivers ||--o{ public_active_tracking : "active_tracking_driver_id_fkey"
    public_lalamove_orders ||--o{ public_active_tracking : "active_tracking_order_id_fkey"
    public_drivers ||--o{ public_alerts : "alerts_driver_id_fkey"
    public_lalamove_orders ||--o{ public_alerts : "alerts_order_id_fkey"
    public_alerts ||--o{ public_alerts_sent : "alerts_sent_alert_id_fkey"
    auth_users ||--o{ public_audit_log : "audit_log_user_id_fkey"
    public_lalamove_orders ||--o{ public_bitrix24_activities : "bitrix24_activities_order_id_fkey"
    public_lalamove_orders ||--o{ public_bitrix24_spa_sync : "bitrix24_spa_sync_order_id_fkey"
    public_lalamove_orders ||--o{ public_bitrix24_sync : "bitrix24_sync_order_id_fkey"
    auth_users ||--o{ public_contacts : "contacts_owner_id_fkey"
    public_drivers ||--o{ public_driver_approval_queue : "driver_approval_queue_driver_id_fkey"
    public_lalamove_orders ||--o{ public_driver_approval_queue : "driver_approval_queue_order_id_fkey"
    public_drivers ||--o{ public_driver_evaluations : "driver_evaluations_driver_id_fkey"
    public_lalamove_orders ||--o{ public_driver_evaluations : "driver_evaluations_order_id_fkey"
    public_drivers ||--o{ public_driver_incidents : "driver_incidents_driver_id_fkey"
    public_lalamove_orders ||--o{ public_driver_incidents : "driver_incidents_order_id_fkey"
    public_active_tracking ||--o{ public_driver_locations : "driver_locations_tracking_id_fkey"
    auth_users ||--o{ public_geo_blocks : "geo_blocks_blocked_by_fkey"
    auth_users ||--o{ public_geo_budget : "geo_budget_updated_by_fkey"
    auth_users ||--o{ public_geo_defaults : "geo_defaults_updated_by_fkey"
    auth_users ||--o{ public_geo_settings : "geo_settings_updated_by_fkey"
    auth_users ||--o{ public_job_queue : "job_queue_created_by_fkey"
    public_lalamove_orders ||--o{ public_lalamove_order_replacements : "lalamove_order_replacements_order_id_fkey"
    auth_users ||--o{ public_lalamove_orders : "lalamove_orders_cancelled_by_fkey"
    public_drivers ||--o{ public_lalamove_orders : "lalamove_orders_driver_id_fkey"
    auth_users ||--o{ public_lalamove_priority_fee_history : "lalamove_priority_fee_history_changed_by_fkey"
    public_lalamove_orders ||--o{ public_lalamove_priority_fee_history : "lalamove_priority_fee_history_order_id_fkey"
    public_lalamove_orders ||--o{ public_lalamove_status_history : "lalamove_status_history_order_id_fkey"
    public_lalamove_orders ||--o{ public_lalamove_stop_proofs : "lalamove_stop_proofs_order_id_fkey"
    public_lalamove_stops ||--o{ public_lalamove_stop_proofs : "lalamove_stop_proofs_stop_id_fkey"
    public_lalamove_orders ||--o{ public_lalamove_stops : "lalamove_stops_order_id_fkey"
    auth_users ||--o{ public_lalamove_webhook_config : "lalamove_webhook_config_registered_by_fkey"
    auth_users ||--o{ public_map_settings_overrides : "map_settings_overrides_user_id_fkey"
    auth_users ||--o{ public_message_templates : "message_templates_updated_by_fkey"
    auth_users ||--o{ public_messaging_settings : "messaging_settings_updated_by_fkey"
    public_user_devices ||--o{ public_new_device_alerts : "new_device_alerts_device_id_fkey"
    public_alerts ||--o{ public_notification_messages : "notification_messages_alert_id_fkey"
    public_notification_messages ||--o{ public_notification_messages : "notification_messages_fallback_of_fkey"
    auth_users ||--o{ public_notification_optouts : "notification_optouts_created_by_fkey"
    auth_users ||--o{ public_notification_routes : "notification_routes_updated_by_fkey"
    public_alerts ||--o{ public_order_geo_events : "order_geo_events_alert_id_fkey"
    public_lalamove_orders ||--o{ public_order_geo_events : "order_geo_events_order_id_fkey"
    auth_users ||--o{ public_password_reset_requests : "password_reset_requests_reviewed_by_fkey"
    auth_users ||--o{ public_report_presets : "report_presets_user_id_fkey"
    public_permissions ||--o{ public_role_permissions : "role_permissions_permission_id_fkey"
    auth_users ||--o{ public_user_passkeys : "user_passkeys_user_id_fkey"
```
