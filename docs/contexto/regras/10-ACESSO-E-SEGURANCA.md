# 10 · ACESSO E SEGURANÇA — quem pode o quê

> Gerado automaticamente por AI Context Sync v1.3.2 · commit `5672ef043a` · branch `main` · 2026-11-22 18:43 UTC
> Não edite à mão — regras humanas vão em `manual/`.

## Perfis / roles identificados

`admin`, `assistant`, `delivery_contact`, `denied`, `driver`, `granted`, `manager`, `operator`, `option`, `permission`, `role`, `service_role`, `string`, `user`, `viewer`

- Tabelas de perfil/permissão: `user_roles`, `permissions`, `role_permissions`
- Colunas de perfil: `user_roles.role` (app_role NOT NULL DEFAULT 'viewer'), `role_permissions.role` (app_role NOT NULL)
- Claims do JWT usados em políticas/funções: `aal`
- Funções usadas dentro de políticas RLS (a regra real está no corpo delas — veja `06`): `can_run_db_diagnostics`, `has_permission`, `has_role`, `uid`

## Matriz tabela × operação → quem pode (derivada das políticas RLS)

| Tabela | RLS | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `active_tracking` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') |
| `alert_configurations` | enabled | authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `alert_dedup` | enabled | public: has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') | — | — | — |
| `alerts` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') |
| `alerts_sent` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `audit_log` | enabled | public: auth.uid() IS NOT NULL | public: true | — | — |
| `auth.users` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `auth_logs` | enabled | public: auth.uid() = user_id<br>public: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') OR  | — | — |
| `bitrix24_activities` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `bitrix24_spa_sync` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) | — | — | — |
| `bitrix24_stage_mappings` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `bitrix24_sync` | enabled | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') |
| `bitrix24_tokens` | enabled | public: has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') |
| `blocked_ips` | enabled | public: public.has_role(auth.uid(), 'admin')<br>public: public.has_role(auth.uid(), 'manager') | public: public.has_role(auth.uid(), 'admin') | public: public.has_role(auth.uid(), 'admin') | public: public.has_role(auth.uid(), 'admin') |
| `cache_refresh_log` | enabled | — | — | — | — |
| `cache_status` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `contacts` | enabled | public: auth.uid() = owner_id | public: auth.uid() = owner_id | public: auth.uid() = owner_id | public: auth.uid() = owner_id |
| `contract_version_usage` | enabled | authenticated: public.has_role(auth.uid(), 'admin') | — | — | — |
| `contract_version_usage_monthly` | enabled | authenticated: public.has_role(auth.uid(), 'admin') | — | — | — |
| `cron_job_logs` | enabled | public: has_role(auth.uid(), 'admin'::app_role) | — | — | — |
| `delivery_metrics_cache` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `driver_approval_queue` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `driver_evaluations` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `driver_incidents` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `driver_locations` | enabled | authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)<br>authenticated: has_role(auth.uid(), 'operator'::app_role) AND EXISTS ( SELECT 1 FROM public.active_tracking at WHERE at.id = driver_location | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') |
| `driver_stats_cache` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `drivers` | enabled | authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)<br>authenticated: has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `drivers_safe_view` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `email_verifications` | enabled | public: auth.uid() = user_id | authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') |
| `feature_flags` | enabled | public: EXISTS ( SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.is_active = true )<br>authenticated: true | public: EXISTS ( SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.is_active = true ) | public: EXISTS ( SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.is_active = true ) | public: EXISTS ( SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.is_active = true ) |
| `fixture_route_curitiba` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `geo_blocks` | não encontrado | sem RLS | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') |
| `geo_budget` | enabled | — | — | — | — |
| `geo_cache` | enabled | — | — | — | — |
| `geo_defaults` | enabled | — | — | — | — |
| `geo_price_list` | enabled | — | — | — | — |
| `geo_settings` | enabled | — | — | — | — |
| `geo_usage` | enabled | public: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_permission(auth.uid(), 'maps.usage.read | — | — | — |
| `geo_usage_month` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `hourly_metrics_cache` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `ip_whitelist` | enabled | public: public.has_role(auth.uid(), 'admin')<br>public: public.has_role(auth.uid(), 'manager') | public: public.has_role(auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin') | public: public.has_role(auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin') | public: public.has_role(auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin') |
| `job_queue` | enabled | public: auth.role() = 'authenticated'<br>public: auth.role() = 'service_role'<br>public: auth.uid() = created_by OR auth.uid() IN ( SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin' )<br>service_role: true<br>authenticated: public.has_role(auth.uid(), 'admin'::app_role) | public: auth.role() = 'service_role'<br>public: auth.uid() IN ( SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin' )<br>service_role: true | public: auth.role() = 'service_role'<br>service_role: true | public: auth.role() = 'service_role'<br>service_role: true |
| `job_queue_processing_log` | enabled | — | — | — | — |
| `lalamove_order_replacements` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.ui | — | — | authenticated: public.has_role(auth.uid(), 'admin'::app_role) |
| `lalamove_orders` | enabled | authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)<br>authenticated: has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') |
| `lalamove_priority_fee_history` | enabled | public: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | public: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | — | — |
| `lalamove_rate_limits` | enabled | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | — | — |
| `lalamove_status_history` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `lalamove_stop_proofs` | enabled | authenticated: has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')<br>authenticated: has_role(auth.uid(),'operator') | authenticated: has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'operator') | authenticated: has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') | authenticated: has_role(auth.uid(),'admin') |
| `lalamove_stops` | enabled | authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)<br>authenticated: has_role(auth.uid(), 'operator'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `lalamove_uapi_sessions` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) |
| `lalamove_webhook_config` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) | authenticated: public.has_role(auth.uid(), 'admin'::app_role) |
| `login_attempts` | enabled | public: has_role(auth.uid(), 'admin'::app_role) | authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) | authenticated: has_role(auth.uid(), 'admin'::app_role) | public: has_role(auth.uid(), 'admin'::app_role) |
| `map_settings_overrides` | enabled | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id |
| `mcp_diagnostics_grants` | enabled | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') |
| `mfa_sessions` | enabled | authenticated: auth.uid() = user_id<br>public: auth.uid() = user_id | authenticated: auth.uid() = user_id<br>authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id<br>authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')<br>authenticated: auth.uid() = user_id |
| `new_device_alerts` | enabled | authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') |
| `notification_optouts` | enabled | authenticated: public.has_role(auth.uid(), 'admin'::public.app_role)<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin'::public.app_role)<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin'::public.app_role)<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin'::public.app_role)<br>service_role: true |
| `order_geo_events` | enabled | public: auth.role() = 'authenticated' | — | — | — |
| `orders_operator_view` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `orders_safe_view` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `password_reset_requests` | enabled | public: has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') | authenticated: user_email = (SELECT email FROM auth.users WHERE id = auth.uid()) | public: has_role(auth.uid(), 'admin') | — |
| `password_reset_tokens` | enabled | public: auth.uid() = user_id<br>public: auth.uid() = user_id | authenticated: auth.uid() = user_id | — | authenticated: public.has_role(auth.uid(), 'admin') |
| `permissions` | enabled | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') | authenticated: public.has_role(auth.uid(), 'admin') |
| `query_telemetry` | enabled | authenticated: has_role(auth.uid(), 'admin'::app_role)<br>authenticated: has_role(auth.uid(), 'manager'::app_role) | authenticated: has_role(auth.uid(), 'admin'::app_role)<br>authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_ | authenticated: has_role(auth.uid(), 'admin'::app_role) | authenticated: has_role(auth.uid(), 'admin'::app_role) |
| `rate_limit_logs` | enabled | public: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') OR  | — | — |
| `region_cache` | enabled | authenticated: true | authenticated: length(btrim(coord_key)) BETWEEN 1 AND 100 AND length(btrim(region)) BETWEEN 1 AND 200 | — | — |
| `report_presets` | enabled | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id |
| `risk_rules` | enabled | public: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role)<br>authenticated: public.has_role(auth.uid(), 'viewer'::app_role) | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |
| `role_permissions` | enabled | public: public.has_role(auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | public: public.has_role(auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin') | public: public.has_role(auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin') | public: public.has_role(auth.uid(), 'admin')<br>authenticated: public.has_role(auth.uid(), 'admin') |
| `runtime_error_logs` | enabled | authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) | authenticated: auth.uid() IS NOT NULL | authenticated: has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) | authenticated: has_role(auth.uid(), 'admin'::app_role) |
| `saved_filters` | enabled | public: auth.uid() = user_id | public: auth.uid() = user_id<br>public: auth.uid() = user_id | public: auth.uid() = user_id | public: auth.uid() = user_id |
| `security_test_logs` | enabled | authenticated: public.has_role(auth.uid(), 'admin') | — | — | — |
| `system_logs` | enabled | public: auth.uid() IS NOT NULL | public: true | — | — |
| `tracking_events` | enabled | public: auth.role() = 'authenticated'<br>public: auth.role() = 'authenticated' | public: auth.role() = 'authenticated' | — | — |
| `tracking_events_default` | enabled | public: auth.role() = 'authenticated' | — | — | — |
| `tracking_events_y2026m05` | enabled | public: auth.role() = 'authenticated' | — | — | — |
| `tracking_events_y2026m06` | enabled | public: auth.role() = 'authenticated' | — | — | — |
| `tracking_events_y2026m07` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `tracking_events_y2026m08` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `tracking_events_y2026m09` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `tracking_events_y2026m10` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `tracking_events_y2026m11` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `tracking_events_y2026m12` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `tracking_events_y2027m01` | não encontrado | sem RLS | sem RLS | sem RLS | sem RLS |
| `user_devices` | enabled | authenticated: auth.uid() = user_id<br>authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id<br>authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')<br>authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')<br>authenticated: auth.uid() = user_id |
| `user_passkeys` | enabled | authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') |
| `user_roles` | enabled | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')<br>authenticated: true<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin') AND public.is_aal2()<br>authenticated: true<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin') AND public.is_aal2()<br>authenticated: true<br>service_role: true | authenticated: public.has_role(auth.uid(), 'admin') AND public.is_aal2()<br>service_role: true |
| `webauthn_challenges` | enabled | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') | authenticated: auth.uid() = user_id<br>authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id | authenticated: auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') |
| `webhook_events` | enabled | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'viewer') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'operator') | authenticated: public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') | authenticated: public.has_role(auth.uid(), 'admin') |

> `—` com RLS ligado = ninguém além de service_role. `sem RLS` = qualquer chave anon lê/escreve tudo.

## Onde o RLS é IGNORADO (service_role) — 122 arquivo(s)

- `scripts/ai-context/cenarios.mjs`
- `scripts/ai-context/gerar.mjs`
- `scripts/ai-context/gerar.unit.mjs`
- `scripts/apply-dashboard-fixes.ts`
- `scripts/apply-final-sql.ts`
- `scripts/apply-rls-fix.ts`
- `scripts/apply-rls-via-pg.ts`
- `scripts/apply-via-management-api.ts`
- `scripts/check-permissions.ts`
- `scripts/ci/check-bundle-secrets.mjs`
- `scripts/ci/check-bundle-secrets.unit.mjs`
- `scripts/ci/check-pr-workflow-secrets.unit.mjs`
- `scripts/ci/vercel-env-baseline.mjs`
- `scripts/ci/vercel-env-baseline.unit.mjs`
- `scripts/db-audit/check-grants-fresh.mjs`
- `scripts/db-audit/check-grants-fresh.test.mjs`
- `scripts/db-audit/grants-baseline.sql`
- `scripts/db-audit/register-migration.test.mjs`
- `scripts/diagnose-rpc.ts`
- `scripts/eslint/no-secret-compare.js`
- `scripts/fix-admin-role-active.ts`
- `scripts/fix-dashboard-via-api.ts`
- `scripts/fix-rpc-functions.ts`
- `scripts/inventario/gerar-banco.mjs`
- `scripts/list-tables-v2.ts`
- `scripts/list-tables.ts`
- `scripts/regras_negocio/generate.py`
- `scripts/seed-contacts.ts`
- `scripts/seed-database.ts`
- `scripts/set-user-admin.ts`
- `scripts/supabase_snapshot/snapshot.py`
- `scripts/test-after-fix.ts`
- `scripts/test-user-permissions.ts`
- `supabase/functions/_shared/telemetry.ts`
- `supabase/functions/apply-fixes/index.ts`
- `supabase/functions/bitrix24-process-queue/index.ts`
- `supabase/functions/bitrix24-sync/index.ts`
- `supabase/functions/check-driver-alerts/index.ts`
- `supabase/functions/escalate-alerts/index.ts`
- `supabase/functions/evaluate-driver/index.ts`
- `supabase/functions/external-companies/index.ts`
- `supabase/functions/external-db-bridge/index.ts`
- `supabase/functions/geo-gateway/index.ts`
- `supabase/functions/geo-gateway/metering.ts`
- `supabase/functions/job-worker/index.ts`
- `supabase/functions/lalamove-api/geocode-fallback.test.ts`
- `supabase/functions/lalamove-api/geocode-fallback.ts`
- `supabase/functions/lalamove-api/index.ts`
- `supabase/functions/lalamove-gateway/index.ts`
- `supabase/functions/lalamove-gateway/route.test.ts`
- `supabase/functions/lalamove-token-refresh/index.ts`
- `supabase/functions/lalamove-uapi/index.ts`
- `supabase/functions/lalamove-webhook/index.ts`
- `supabase/functions/llm-wh/index.ts`
- `supabase/functions/new-device-alert/index.ts`
- `supabase/functions/rotate-tokens/index.ts`
- `supabase/functions/route-analyzer/index.ts`
- `supabase/functions/seed-fix-rls/index.ts`
- `supabase/functions/send-notification/index.ts`
- `supabase/functions/simulate-driver-movement/index.ts`
- `supabase/functions/test-notification/index.ts`
- `supabase/migrations/20251224143803_3b1f0374-1b95-4fba-a31b-f44a9fd14494.sql`
- `supabase/migrations/20251226000003_create_job_queue.sql`
- `supabase/migrations/20251226010000_create_job_queue_system.sql`
- `supabase/migrations/20251226010001_configure_pg_cron.sql`
- `supabase/migrations/20251226020000_create_materialized_views_cache.sql`
- `supabase/migrations/20260315151153_789547cf-e79d-4291-8123-61567f7973e1.sql`
- `supabase/migrations/20260628122429_d14ba247-4805-46fb-b2e6-ffcd95780937.sql`
- `supabase/migrations/20260711184027_e973dd91-92eb-4403-bb93-065601d4ec41.sql`
- `supabase/migrations/20260711184057_d6d0f25c-fc2c-42de-8d74-9808acd92b19.sql`
- `supabase/migrations/20260711184140_78845ae2-2e63-4f1a-a1bc-c8a1bb09f674.sql`
- `supabase/migrations/20260711192431_6df39da5-eab7-41bd-8d4e-f6f7ad4e777e.sql`
- `supabase/migrations/20260711192632_782b3feb-4233-4a31-85ae-def6a74cec82.sql`
- `supabase/migrations/20260711194632_e6def1eb-1b3c-487f-978f-b0774a8201af.sql`
- `supabase/migrations/20260712191718_936be1d2-95d1-4a12-95c0-77802fd64e45.sql`
- `supabase/migrations/20260712195355_29d8addb-637f-453a-a340-408fab3d621b.sql`
- `supabase/migrations/20260712195426_4e8118ed-6c2f-468d-b9c8-97fe03b68699.sql`
- `supabase/migrations/20260712200200_f26229c4-ce82-4a11-852d-d8ecbe008bd7.sql`
- `supabase/migrations/20260712203139_ac2eea0c-120f-43d8-8143-3e934e000937.sql`
- `supabase/migrations/20260712210005_0d0643ec-c577-49fe-ac52-754f22ba4313.sql`
- `supabase/migrations/20260712210038_deb4d82e-1532-4439-9a20-077335b54d85.sql`
- `supabase/migrations/20260712210401_7554d7e4-c7b0-45ec-8e62-f80b19fc5442.sql`
- `supabase/migrations/20260712210434_a522499f-88f7-4ebe-a1c3-dfb7c871bbc7.sql`
- `supabase/migrations/20260712210528_5bf7c8cd-b3b0-4d52-a28d-d35509eb61e3.sql`
- `supabase/migrations/20260712210653_6e89d2ad-c5be-4089-8af5-661a47ae8899.sql`
- `supabase/migrations/20260712210839_a6eba501-0f18-4cb0-b05b-6165c838d372.sql`
- `supabase/migrations/20260712221144_f9eda2dc-4805-4cce-b99b-e3d2826ca6cb.sql`
- `supabase/migrations/20260712221208_4c54c437-4070-405c-9a74-a94618f2dad6.sql`
- `supabase/migrations/20260712221542_22951b4b-037d-40f6-8a89-3bd46e8c7049.sql`
- `supabase/migrations/20260712231241_f7f824c7-4bd9-4648-812b-9aa57732088c.sql`
- `supabase/migrations/20260713105232_bcde1a1f-2639-4851-a868-1c9f2fbf028f.sql`
- `supabase/migrations/20260713110319_357ba0d5-076c-4a09-a46e-2816d7df2703.sql`
- `supabase/migrations/20260713110813_492a40d2-76f6-4742-b8bf-402a9a4fa170.sql`
- `supabase/migrations/20260715141724_4ed09f90-e325-4765-8e86-4a609bf02b58.sql`
- `supabase/migrations/20260715164406_77606d9a-be67-4be6-b857-f0e760d12491.sql`
- `supabase/migrations/20260715180743_121a06c6-5bc9-4f5e-94f2-f2d8e7a11c4d.sql`
- `supabase/migrations/20260715184538_b9d1dde2-5dfd-41f8-87f9-e4017f5a2acf.sql`
- `supabase/migrations/20260723122332_c21c9304-eed8-478e-a96e-274111e49528.sql`
- `supabase/migrations/20260723130425_76481d2c-7b89-4ed7-9e3c-b89a98051ac3.sql`
- `supabase/migrations/20260723131806_a3854e60-0935-4d4c-be8a-51b57157d413.sql`
- `supabase/migrations/20260723133439_622ac986-0c37-4560-84ca-de587b0496cc.sql`
- `supabase/migrations/20260723135010_e3a23b59-7351-4ad8-afaf-6c2a3af32f23.sql`
- `supabase/migrations/20260723174310_cda85f06-6820-474f-ba32-909ff8ce703d.sql`
- `supabase/migrations/20260723174521_e57bfc01-fd6e-45e2-b2bb-a4464a64c800.sql`
- `supabase/migrations/20260723174804_fdc57530-908c-4784-9758-01d59f616f3b.sql`
- `supabase/migrations/20260726162225_ee473b1b-27ac-43c6-9548-ad89eede55d5.sql`
- `supabase/migrations/20260813124905_c5b09dca-c763-4783-a303-91433b536b1c.sql`
- `supabase/migrations/20260813125422_795480be-987b-45ae-8e7f-e81ab020ce23.sql`
- `supabase/migrations/20260828000001_seed_fix_rls.sql`
- `supabase/migrations/20260828000002_dashboard_fixes.sql`
- `supabase/migrations/20260828000003_comprehensive_rls_fix.sql`
- `supabase/migrations/20260902000000_harden_revoke_anon_grants.sql`
- `supabase/migrations/20261121192500_restore_audit_log.sql`
- `supabase/migrations/20261121194500_geo_jobs_scheduler.sql`
- `supabase/migrations/20261122090000_cache_system_backend.sql`
- `supabase/migrations/20261122120200_job_queue_system.sql`
- `supabase/migrations/20261122130100_geo_foundation.sql`
- `supabase/migrations/20261122150100_fix_public_rls_bypass.sql`
- `supabase/migrations/20261123120000_geo_budget_cron.sql`
- `supabase/migrations/20261123150000_cache_refresh_log_restaurado.sql`
- `supabase/migrations/20261123160000_job_queue_processing_log.sql`
- `supabase/migrations/20261123200000_optout_and_tracking_end.sql`

## Funções SQL `SECURITY DEFINER` (rodam com privilégio do dono, ignoram RLS)

- `acknowledge_alert`
- `cache_view_count`
- `can_run_db_diagnostics`
- `check_login_lockout`
- `check_login_lockout_v2`
- `claim_alert_notification`
- `cleanup_expired_tokens`
- `cleanup_old_audit_logs`
- `cleanup_old_cron_logs`
- `cleanup_old_login_attempts`
- `cleanup_old_observability_logs`
- `cleanup_old_region_cache`
- `cleanup_old_system_logs`
- `cleanup_processing_logs`
- `clear_login_attempts`
- `create_audit_log`
- `end_order_tracking`
- `ensure_tracking_events_partition`
- `geo_audit_config`
- `geo_budget_notify_if_needed`
- `geo_budget_status`
- `geo_emit_event`
- `geo_evaluate_tracking`
- `geo_usage_increment`
- `get_active_uapi_token`
- `get_contract_v1_sunset_readiness`
- `get_cron_jobs_health`
- `get_cron_jobs_status`
- `get_current_user_role`
- `get_pending_escalations`
- `get_user_permissions`
- `get_user_roles`
- `has_permission`
- `has_role`
- `increment_contract_usage`
- `invalidate_old_tokens`
- `is_aal2`
- `is_ip_blocked`
- `is_ip_whitelisted`
- `is_known_device`
- `is_phone_opted_out`
- `is_token_valid`
- `log_mfa_session`
- `mcp_introspect`
- `notify_lalamove_quota_low`
- `notify_webhook_security_event`
- `pause_cron_job`
- `process_job_queue`
- `provision_tracking_partitions`
- `prune_tracking_events_partitions`
- `record_failed_login`
- `record_failed_login_v2`
- `refresh_cache_view`
- `refresh_geo_jobs`
- `resume_cron_job`
- `rollup_contract_version_usage`
- `run_daily_cleanup`
- `run_daily_cleanup_with_logging`
- `run_rls_security_audit`
- `sanitize_auth_log_metadata`
- `set_token_expiration`
- `trg_close_tracking_on_order_end`
- `trigger_bitrix24_sync`
- `use_reset_token`

## Edge functions públicas (sem JWT — qualquer um chama)

- `lalamove-uapi`
- `mcp-query`
- `lalamove-webhook`
- `llm-wh`

## Rotas protegidas no front

| Rota | Guard | Roles | Arquivo |
|---|---|---|---|
| /${n | ProtectedRoute | operator | `scripts/ui-audit/layout-guard.unit.mjs` |
| /${pick([ | ProtectedRoute |  | `scripts/ai-context/cenarios.mjs` |
| /alert-configurations | ProtectedRoute | manager | `src/App.tsx` |
| /alerts | ProtectedRoute | operator | `src/App.tsx` |
| /analytics | ProtectedRoute | viewer | `src/App.tsx` |
| /approvals | ProtectedRoute | manager | `src/App.tsx` |
| /bitrix24 | ProtectedRoute | manager | `src/App.tsx` |
| /cache-monitoring | ProtectedRoute | manager | `src/App.tsx` |
| /cache-status | ProtectedRoute | manager | `src/App.tsx` |
| /contacts | ProtectedRoute | operator | `src/App.tsx` |
| /delivery-metrics | ProtectedRoute | viewer | `src/App.tsx` |
| /drivers | ProtectedRoute | operator | `src/App.tsx` |
| /error-monitoring | ProtectedRoute | manager | `src/App.tsx` |
| /evaluations | ProtectedRoute | operator | `src/App.tsx` |
| /external-data | ProtectedRoute | manager | `src/App.tsx` |
| /geo-blocking | ProtectedRoute | admin | `src/App.tsx` |
| /heatmap | ProtectedRoute | viewer | `src/App.tsx` |
| /incidents | ProtectedRoute | operator | `src/App.tsx` |
| /ip-whitelist | ProtectedRoute | admin | `src/App.tsx` |
| /job-queue | ProtectedRoute | manager | `src/App.tsx` |
| /lalamove-operacoes | ProtectedRoute | operator | `src/App.tsx` |
| /lalamove-quota | ProtectedRoute | admin | `src/App.tsx` |
| /live-map | ProtectedRoute | viewer | `src/App.tsx` |
| /map | ProtectedRoute | viewer | `src/App.tsx` |
| /map-tools | ProtectedRoute | manager | `src/App.tsx` |
| /metrics | ProtectedRoute | viewer | `src/App.tsx` |
| /notification-history | ProtectedRoute | viewer | `src/App.tsx` |
| /orders | ProtectedRoute | operator | `scripts/ai-context/gerar.unit.mjs` |
| /orders | ProtectedRoute | operator | `src/App.tsx` |
| /password-reset-approvals | ProtectedRoute | admin | `src/App.tsx` |
| /performance | ProtectedRoute | manager | `src/App.tsx` |
| /permissions | ProtectedRoute | admin | `src/App.tsx` |
| /preferences | ProtectedRoute | viewer | `src/App.tsx` |
| /profile | ProtectedRoute |  | `src/App.tsx` |
| /protected | ProtectedRoute |  | `src/components/auth/ProtectedRoute.test.tsx` |
| /rate-limiting | ProtectedRoute | admin | `src/App.tsx` |
| /reports | ProtectedRoute | viewer | `src/App.tsx` |
| /reports/advanced | ProtectedRoute | viewer | `src/App.tsx` |
| /risk-rules | ProtectedRoute | manager | `src/App.tsx` |
| /roles | ProtectedRoute | admin | `scripts/ai-context/gerar.unit.mjs` |
| /roles | ProtectedRoute | admin | `src/App.tsx` |
| /s | ProtectedRoute |  | `scripts/ai-context/cenarios.mjs` |
| /security | ProtectedRoute | admin | `src/App.tsx` |
| /settings | ProtectedRoute |  | `scripts/ai-context/gerar.unit.mjs` |
| /settings | ProtectedRoute | manager | `src/App.tsx` |
| /settings/lalamove | ProtectedRoute | manager | `src/App.tsx` |
| /settings/maps | ProtectedRoute | manager | `src/App.tsx` |
| /settings/uapi | ProtectedRoute | manager | `src/App.tsx` |
| /sla | ProtectedRoute | viewer | `src/App.tsx` |
| /slo | ProtectedRoute | manager | `src/App.tsx` |
| /system-health | ProtectedRoute | manager | `src/App.tsx` |
| /system-health-expanded | ProtectedRoute | manager | `src/App.tsx` |
| /telemetria | ProtectedRoute | admin | `src/App.tsx` |
| /webhooks | ProtectedRoute | manager | `scripts/ai-context/gerar.unit.mjs` |
| /webhooks | ProtectedRoute | manager | `src/App.tsx` |
| /x | Protected |  | `scripts/ui-audit/layout-guard.mjs` |
| /{t | ProtectedRoute | manager | `scripts/ai-context/cenarios.mjs` |

Guards usados: Protected, ProtectedRoute

Middleware matcher (Next.js): nenhum

## Grants / Revokes (agrupados por role e privilégio)

| Ação | Para/De | Privilégios | Objetos |
|---|---|---|---|
| grant | anon | all | `public`, `public` |
| grant | anon, authenticated, service_role | execute | `check_login_lockout_v2`, `record_failed_login_v2` |
| grant | authenticated | all | `public`, `public` |
| grant | authenticated | execute | `refresh_cache_view`, `is_aal2`, `log_mfa_session`, `get_cron_jobs_health`, `get_contract_v1_sunset_readiness`, `get_contract_v1_sunset_readiness`, `acknowledge_alert`, `mcp_introspect`, `can_run_db_diagnostics` |
| grant | authenticated | select | `drivers_safe_view`, `orders_safe_view`, `orders_operator_view`, `security_test_logs`, `contract_version_usage`, `contract_version_usage_monthly`, `alert_dedup`, `lalamove_order_replacements`, `lalamove_rate_limits`, `cache_refresh_log`, `job_queue_processing_log` |
| grant | authenticated | select, insert | `lalamove_rate_limits`, `lalamove_priority_fee_history` |
| grant | authenticated | select, insert, update | `region_cache` |
| grant | authenticated | select, insert, update, delete | `report_presets`, `lalamove_stop_proofs`, `contacts`, `mcp_diagnostics_grants` |
| grant | authenticated, anon | execute | `get_driver_stats_cached`, `get_delivery_metrics_cached`, `get_hourly_metrics_cached`, `get_top_drivers_by_metric`, `cache_status` |
| grant | authenticated, anon | select | `mv_driver_stats`, `mv_delivery_metrics`, `mv_hourly_metrics` |
| grant | authenticated, anon, service_role | select | `driver_stats_cache`, `delivery_metrics_cache`, `hourly_metrics_cache`, `cache_status` |
| grant | authenticated, service_role | execute | `get_driver_stats`, `get_top_drivers`, `get_hourly_stats`, `get_risk_distribution`, `get_user_permissions`, `get_user_roles`, `has_permission`, `is_aal2`, `get_user_permissions`, `get_user_roles`, `has_role`, `has_permission`, `has_role`, `create_audit_log`, `refresh_cache_view` … +5 |
| grant | authenticated, service_role | select | `driver_stats_cache`, `delivery_hourly_stats_cache`, `risk_level_distribution_cache`, `cache_status` |
| grant | service_role | all | `security_test_logs`, `contract_version_usage`, `contract_version_usage_monthly`, `alert_dedup`, `report_presets`, `region_cache`, `lalamove_stop_proofs`, `lalamove_order_replacements`, `lalamove_rate_limits`, `lalamove_priority_fee_history`, `contacts`, `lalamove_rate_limits`, `mcp_diagnostics_grants`, `cache_refresh_log`, `job_queue_processing_log` |
| grant | service_role | execute | `process_job_queue`, `get_cron_jobs_status`, `monitor_queue_health`, `refresh_all_caches`, `cleanup_expired_tokens`, `cleanup_old_cron_logs`, `cleanup_old_login_attempts`, `run_daily_cleanup`, `run_daily_cleanup_with_logging`, `run_rls_security_audit`, `get_active_uapi_token`, `is_known_device`, `is_country_blocked`, `is_ip_blocked`, `is_ip_whitelisted` … +31 |
| grant | service_role, authenticated | execute | `normalize_br_phone`, `is_phone_opted_out`, `end_order_tracking` |
| revoke | PUBLIC | all | `mcp_introspect`, `can_run_db_diagnostics`, `create_audit_log`, `refresh_geo_jobs`, `geo_budget_notify_if_needed`, `normalize_br_phone`, `is_phone_opted_out`, `end_order_tracking` |
| revoke | PUBLIC | execute | `is_aal2`, `log_mfa_session`, `get_contract_v1_sunset_readiness`, `rollup_contract_version_usage`, `rollup_contract_version_usage`, `clear_login_attempts`, `get_user_permissions`, `get_user_roles`, `has_role`, `has_permission`, `has_role`, `check_login_lockout_v2`, `record_failed_login_v2`, `refresh_cache_view`, `refresh_cache_view` |
| revoke | PUBLIC, anon | all | `get_user_permissions`, `get_user_roles`, `has_permission`, `is_aal2`, `get_cron_jobs_health` |
| revoke | PUBLIC, anon, authenticated | all | `cleanup_expired_tokens`, `cleanup_old_cron_logs`, `cleanup_old_login_attempts`, `run_daily_cleanup`, `run_daily_cleanup_with_logging`, `run_rls_security_audit`, `get_active_uapi_token`, `is_known_device`, `invalidate_old_tokens`, `sanitize_auth_log_metadata`, `set_token_expiration`, `trigger_bitrix24_sync`, `log_mfa_session`, `is_country_blocked`, `is_ip_blocked` … +10 |
| revoke | PUBLIC, anon, authenticated | execute | `ensure_tracking_events_partition`, `provision_tracking_partitions`, `prune_tracking_events_partitions`, `cleanup_old_region_cache`, `check_login_lockout`, `record_failed_login`, `has_role`, `has_permission`, `is_aal2`, `get_user_roles`, `is_token_valid`, `use_reset_token`, `notify_lalamove_quota_low`, `notify_webhook_security_event`, `cleanup_old_audit_logs` |
| revoke | PUBLIC, authenticated | execute | `geo_emit_event` |
| revoke | anon | all | `mcp_introspect`, `can_run_db_diagnostics` |
| revoke | anon | all privileges | `public`, `public` |
| revoke | anon | execute | `get_contract_v1_sunset_readiness`, `rollup_contract_version_usage`, `rollup_contract_version_usage`, `get_cron_jobs_health`, `get_contract_v1_sunset_readiness`, `get_contract_v1_sunset_readiness`, `get_cron_jobs_health`, `get_active_uapi_token`, `get_user_permissions`, `get_user_roles`, `is_aal2`, `is_known_device`, `clear_login_attempts`, `clear_login_attempts`, `has_role` … +1 |
| revoke | anon | select | `drivers_safe_view`, `orders_safe_view`, `orders_operator_view` |
| revoke | anon, authenticated | execute | `cleanup_old_login_attempts`, `cleanup_expired_tokens`, `cleanup_old_cron_logs`, `run_daily_cleanup`, `run_daily_cleanup_with_logging`, `run_rls_security_audit`, `test_rls_policies`, `provision_tracking_partitions`, `prune_tracking_events_partitions`, `ensure_tracking_events_partition`, `rollup_contract_version_usage`, `increment_contract_usage`, `update_updated_at_column`, `trigger_bitrix24_sync`, `invalidate_old_tokens` … +21 |
| revoke | anon, public | execute | `claim_alert_notification`, `get_pending_escalations`, `acknowledge_alert`, `claim_alert_notification` |
| revoke | authenticated | all | `drivers_safe_view`, `orders_safe_view`, `orders_operator_view` |
| revoke | authenticated | execute | `rollup_contract_version_usage`, `clear_login_attempts`, `clear_login_attempts` |
| revoke | authenticated, anon, public | execute | `claim_alert_notification`, `get_pending_escalations` |
| revoke | public | all | `increment_contract_usage` |
| revoke | public, anon | execute | `geo_budget_status` |
| revoke | public, anon, authenticated | execute | `geo_audit_config`, `geo_evaluate_tracking`, `geo_usage_increment` |

## Riscos de acesso detectados

| Tabela | Problema | Arquivos |
|---|---|---|
| `cache_status` | acessada do front (1 arquivo(s)) sem RLS (não encontrado) | `src/hooks/useCacheViews.ts` |
| `delivery_metrics_cache` | acessada do front (1 arquivo(s)) sem RLS (não encontrado) | `src/hooks/useCachedStats.ts` |
| `driver_stats_cache` | acessada do front (1 arquivo(s)) sem RLS (não encontrado) | `src/hooks/useCachedStats.ts` |
| `geo_blocks` | acessada do front (1 arquivo(s)) sem RLS (não encontrado) | `src/pages/GeoBlockingPage.tsx` |
| `geo_budget` | RLS ligado sem nenhuma política → só service_role acessa | `src/hooks/useGeoAdmin.ts` |
| `geo_cache` | RLS ligado sem nenhuma política → só service_role acessa |  |
| `geo_defaults` | RLS ligado sem nenhuma política → só service_role acessa | `src/hooks/useGeoAdmin.ts` |
| `geo_price_list` | RLS ligado sem nenhuma política → só service_role acessa | `src/hooks/useGeoAdmin.ts` |
| `geo_settings` | RLS ligado sem nenhuma política → só service_role acessa | `src/hooks/useGeoAdmin.ts`<br>`src/hooks/useMapProviderPolicy.ts` |
| `geo_usage_month` | acessada do front (1 arquivo(s)) sem RLS (não encontrado) | `src/hooks/useGeoAdmin.ts` |
| `hourly_metrics_cache` | acessada do front (1 arquivo(s)) sem RLS (não encontrado) | `src/hooks/useCachedStats.ts` |

## Multi-tenancy

_nenhuma coluna de tenant identificada — sistema single-tenant ou isolamento por usuário (auth.uid())_

## Soft delete (registros 'apagados' continuam na tabela — filtre!)

| Tabela | Coluna |
|---|---|
| `risk_rules` | `is_active` |
| `user_roles` | `is_active` |
| `ip_whitelist` | `is_active` |
| `lalamove_uapi_sessions` | `is_active` |
| `mcp_diagnostics_grants` | `is_active` |
| `lalamove_webhook_config` | `is_active` |

## Auditoria (colunas de rastreio)

| Tabela | Colunas |
|---|---|
| `saved_filters` | `created_at`, `updated_at` |
| `drivers` | `created_at`, `updated_at` |
| `lalamove_orders` | `created_at`, `updated_at` |
| `lalamove_stops` | `created_at` |
| `lalamove_status_history` | `created_at` |
| `driver_incidents` | `created_at` |
| `alerts` | `created_at` |
| `alerts_sent` | `created_at` |
| `alert_configurations` | `created_at`, `created_by`, `updated_at` |
| `risk_rules` | `created_at`, `updated_at` |
| `bitrix24_sync` | `created_at`, `updated_at` |
| `bitrix24_activities` | `created_at` |
| `bitrix24_tokens` | `created_at`, `updated_at` |
| `bitrix24_stage_mappings` | `created_at` |
| `driver_evaluations` | `created_at` |
| `system_logs` | `created_at` |
| `audit_log` | `created_at` |
| `job_queue` | `created_at`, `created_by`, `updated_at` |
| `user_roles` | `created_at`, `updated_at` |
| `permissions` | `created_at` |
| `role_permissions` | `created_at` |
| `rate_limit_logs` | `created_at` |
| `blocked_ips` | `created_at` |
| `ip_whitelist` | `created_at`, `updated_at` |
| `mfa_sessions` | `created_at` |
| `auth_logs` | `created_at` |
| `password_reset_tokens` | `created_at` |
| `email_verifications` | `created_at` |
| `user_devices` | `created_at` |
| `new_device_alerts` | `created_at` |
| `user_passkeys` | `created_at` |
| `webauthn_challenges` | `created_at` |
| `password_reset_requests` | `created_at` |
| `login_attempts` | `created_at` |
| `cron_job_logs` | `created_at` |
| `runtime_error_logs` | `created_at` |
| `lalamove_uapi_sessions` | `created_at`, `updated_at` |
| `query_telemetry` | `created_at` |
| `feature_flags` | `created_at`, `updated_at` |
| `security_test_logs` | `created_at` |
| `tracking_events` | `created_at` |
| `map_settings_overrides` | `created_at`, `updated_at` |
| `contract_version_usage` | `created_at` |
| `contract_version_usage_monthly` | `created_at`, `updated_at` |
| `report_presets` | `created_at`, `updated_at` |
| `region_cache` | `created_at`, `updated_at` |
| `lalamove_stop_proofs` | `created_at`, `updated_at` |
| `lalamove_order_replacements` | `created_at` |
| `lalamove_rate_limits` | `created_at` |
| `lalamove_priority_fee_history` | `created_at` |
| `contacts` | `created_at`, `updated_at` |
| `mcp_diagnostics_grants` | `created_at`, `updated_at` |
| `lalamove_webhook_config` | `created_at`, `updated_at` |
| `bitrix24_spa_sync` | `created_at`, `updated_at` |
| `geo_settings` | `updated_at`, `updated_by` |
| `geo_defaults` | `updated_at`, `updated_by` |
| `geo_price_list` | `updated_at` |
| `geo_usage` | `updated_at` |
| `geo_budget` | `updated_at`, `updated_by` |
| `geo_cache` | `created_at` |
| `notification_optouts` | `created_at`, `created_by` |
| `geo_blocks` | `created_at`, `updated_at` |
| `tracking_events_default` | `created_at` |
| `tracking_events_y2026m05` | `created_at` |
| `tracking_events_y2026m06` | `created_at` |
| `tracking_events_y2026m07` | `created_at` |
| `tracking_events_y2026m08` | `created_at` |
| `tracking_events_y2026m09` | `created_at` |
| `tracking_events_y2026m10` | `created_at` |
| `tracking_events_y2026m11` | `created_at` |
| `tracking_events_y2026m12` | `created_at` |
| `tracking_events_y2027m01` | `created_at` |
| `drivers_safe_view` | `created_at`, `updated_at` |
| `orders_operator_view` | `created_at`, `updated_at` |
| `orders_safe_view` | `created_at`, `updated_at` |

## Dados pessoais / sensíveis (LGPD — cuidado em logs, exports, prompts de IA)

| Tabela | Coluna |
|---|---|
| `drivers` | `phone` |
| `lalamove_stops` | `address` |
| `lalamove_stops` | `latitude` |
| `lalamove_stops` | `longitude` |
| `driver_locations` | `latitude` |
| `driver_locations` | `longitude` |
| `audit_log` | `ip_address` |
| `rate_limit_logs` | `ip_address` |
| `blocked_ips` | `ip_address` |
| `ip_whitelist` | `ip_address` |
| `mfa_sessions` | `ip_address` |
| `auth_logs` | `ip_address` |
| `password_reset_tokens` | `ip_address` |
| `email_verifications` | `email` |
| `user_devices` | `ip_address` |
| `new_device_alerts` | `ip_address` |
| `password_reset_requests` | `ip_address` |
| `login_attempts` | `email` |
| `login_attempts` | `ip_address` |
| `tracking_events` | `latitude` |
| `tracking_events` | `longitude` |
| `contacts` | `address` |
| `notification_optouts` | `phone` |
| `tracking_events_default` | `latitude` |
| `tracking_events_default` | `longitude` |
| `tracking_events_y2026m05` | `latitude` |
| `tracking_events_y2026m05` | `longitude` |
| `tracking_events_y2026m06` | `latitude` |
| `tracking_events_y2026m06` | `longitude` |
| `tracking_events_y2026m07` | `latitude` |
| `tracking_events_y2026m07` | `longitude` |
| `tracking_events_y2026m08` | `latitude` |
| `tracking_events_y2026m08` | `longitude` |
| `tracking_events_y2026m09` | `latitude` |
| `tracking_events_y2026m09` | `longitude` |
| `tracking_events_y2026m10` | `latitude` |
| `tracking_events_y2026m10` | `longitude` |
| `tracking_events_y2026m11` | `latitude` |
| `tracking_events_y2026m11` | `longitude` |
| `tracking_events_y2026m12` | `latitude` |
| `tracking_events_y2026m12` | `longitude` |
| `tracking_events_y2027m01` | `latitude` |
| `tracking_events_y2027m01` | `longitude` |
| `driver_stats_cache` | `phone` |
| `drivers_safe_view` | `phone` |

## Colunas de dinheiro (tipo importa: numeric ✅ / float ❌)

| Tabela | Coluna | Tipo |
|---|---|---|
| `drivers` | `total_deliveries` | `INTEGER` |
| `lalamove_orders` | `cost_center` | `string` |
| `lalamove_orders` | `custom_rating` | `number` |
| `lalamove_orders` | `customer_name` | `string` |
| `lalamove_orders` | `customer_phone` | `string` |
| `lalamove_orders` | `total_cost` | `number` |
| `driver_evaluations` | `total_deliveries` | `integer` |
| `delivery_metrics_cache` | `total_orders` | `number` |
| `delivery_metrics_cache` | `total_value` | `number` |
| `driver_stats_cache` | `total_deliveries` | `number` |
| `drivers_safe_view` | `total_deliveries` | `number` |
| `hourly_metrics_cache` | `total_orders` | `number` |
| `hourly_metrics_cache` | `total_value` | `number` |
| `orders_operator_view` | `cost_center` | `string` |
| `orders_operator_view` | `custom_rating` | `number` |
| `orders_operator_view` | `customer_name` | `string` |
| `orders_operator_view` | `customer_phone` | `string` |
| `orders_operator_view` | `total_cost` | `number` |
| `orders_safe_view` | `cost_center` | `string` |
| `orders_safe_view` | `custom_rating` | `number` |
| `orders_safe_view` | `customer_name` | `string` |
| `orders_safe_view` | `customer_phone` | `string` |
| `orders_safe_view` | `total_cost` | `number` |
