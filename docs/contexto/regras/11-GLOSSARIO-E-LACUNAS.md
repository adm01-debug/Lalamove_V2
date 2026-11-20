# 11 · GLOSSÁRIO, DADOS DE REFERÊNCIA E LACUNAS

> Gerado automaticamente por AI Context Sync v1.3.2 · commit `a8335551c7` · branch `main` · 2026-11-20 20:13 UTC
> Não edite à mão — regras humanas vão em `manual/`.

## Glossário do domínio (entidades do sistema)

| Termo | Significado / valores | Tamanho | Origem |
|---|---|---|---|
| `active_tracking` | _(sem COMMENT ON TABLE — significado não documentado)_ | 21 colunas | migration |
| `alert_configurations` | _(sem COMMENT ON TABLE — significado não documentado)_ | 33 colunas | migration |
| `alert_dedup` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `alerts` | _(sem COMMENT ON TABLE — significado não documentado)_ | 15 colunas | migration |
| `alerts_sent` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `audit_log` | Registro de auditoria de ações | 9 colunas | migration |
| `auth_logs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `bitrix24_activities` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `bitrix24_stage_mappings` | _(sem COMMENT ON TABLE — significado não documentado)_ | 5 colunas | migration |
| `bitrix24_sync` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `bitrix24_tokens` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `blocked_ips` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `cache_refresh_log` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `contacts` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `contract_version_usage` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `contract_version_usage_monthly` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `cron_job_logs` | Histórico de execuções dos cron jobs do sistema. | 9 colunas | migration |
| `driver_approval_queue` | _(sem COMMENT ON TABLE — significado não documentado)_ | 14 colunas | migration |
| `driver_evaluations` | _(sem COMMENT ON TABLE — significado não documentado)_ | 19 colunas | migration |
| `driver_incidents` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `driver_locations` | Histórico detalhado de posições GPS dos motoristas | 9 colunas | migration |
| `drivers` | _(sem COMMENT ON TABLE — significado não documentado)_ | 32 colunas | migration |
| `drivers_safe_view` | _(sem COMMENT ON TABLE — significado não documentado)_ | 32 colunas | types.ts |
| `email_verifications` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `entity_versions` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `feature_flags` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `geo_blocks` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | types.ts |
| `ip_whitelist` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `job_queue` | Fila de jobs assíncronos para processamento em background | 16 colunas | migration |
| `job_queue_processing_log` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `lalamove_order_replacements` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `lalamove_orders` | _(sem COMMENT ON TABLE — significado não documentado)_ | 49 colunas | migration |
| `lalamove_priority_fee_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `lalamove_rate_limits` | _(sem COMMENT ON TABLE — significado não documentado)_ | 12 colunas | migration |
| `lalamove_status_history` | _(sem COMMENT ON TABLE — significado não documentado)_ | 9 colunas | migration |
| `lalamove_stop_proofs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 14 colunas | migration |
| `lalamove_stops` | _(sem COMMENT ON TABLE — significado não documentado)_ | 15 colunas | migration |
| `lalamove_uapi_sessions` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `login_attempts` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `map_settings_overrides` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `mcp_diagnostics_grants` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `mfa_sessions` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `new_device_alerts` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `orders_operator_view` | _(sem COMMENT ON TABLE — significado não documentado)_ | 36 colunas | types.ts |
| `orders_safe_view` | _(sem COMMENT ON TABLE — significado não documentado)_ | 36 colunas | types.ts |
| `password_reset_requests` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `password_reset_tokens` | _(sem COMMENT ON TABLE — significado não documentado)_ | 7 colunas | migration |
| `permissions` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `query_telemetry` | _(sem COMMENT ON TABLE — significado não documentado)_ | 13 colunas | migration |
| `rate_limit_logs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `region_cache` | _(sem COMMENT ON TABLE — significado não documentado)_ | 4 colunas | migration |
| `report_presets` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `risk_rules` | Regras configuráveis para cálculo de risk score dos motoristas | 8 colunas | migration |
| `role_permissions` | _(sem COMMENT ON TABLE — significado não documentado)_ | 4 colunas | migration |
| `runtime_error_logs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 21 colunas | migration |
| `saved_filters` | Armazena filtros salvos pelos usuários para diferentes entidades | 8 colunas | migration |
| `security_test_logs` | _(sem COMMENT ON TABLE — significado não documentado)_ | 8 colunas | migration |
| `system_logs` | Logs estruturados do sistema | 7 colunas | migration |
| `tracking_events` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `tracking_events_default` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | types.ts |
| `tracking_events_y2026m05` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | types.ts |
| `tracking_events_y2026m06` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | types.ts |
| `tracking_events_y2026m07` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | types.ts |
| `tracking_events_y2026m08` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | types.ts |
| `tracking_events_y2026m09` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | types.ts |
| `tracking_events_y2026m10` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | types.ts |
| `user_devices` | _(sem COMMENT ON TABLE — significado não documentado)_ | 14 colunas | migration |
| `user_passkeys` | _(sem COMMENT ON TABLE — significado não documentado)_ | 11 colunas | migration |
| `user_roles` | _(sem COMMENT ON TABLE — significado não documentado)_ | 10 colunas | migration |
| `webauthn_challenges` | _(sem COMMENT ON TABLE — significado não documentado)_ | 6 colunas | migration |
| `webhook_events` | Log completo de todos webhooks recebidos do Lalamove | 9 colunas | migration |
| `order_status` (enum) | PENDING, MATCHED, ON_GOING, PICKED_UP, COMPLETED, CANCELLED, REJECTED, EXPIRED |  | banco |
| `vehicle_type` (enum) | MOTORCYCLE, CAR, VAN, TRUCK |  | banco |
| `driver_status` (enum) | APPROVED, PENDING_APPROVAL, BLOCKED, WHITELIST, BLACKLIST |  | banco |
| `incident_type` (enum) | ROUTE_DEVIATION, LONG_STOP, LATE_DELIVERY, CUSTOMER_COMPLAINT, DAMAGE, OTHER |  | banco |
| `incident_severity` (enum) | LOW, MEDIUM, HIGH, CRITICAL |  | banco |
| `alert_type` (enum) | DRIVER_BLOCKED, ROUTE_DEVIATION, DRIVER_STOPPED, LATE_DELIVERY, APPROVAL_REQUIRED, ORDER_CANCELLED, INTEGRATION_FAILURE |  | banco |
| `alert_severity` (enum) | INFO, WARNING, CRITICAL |  | banco |
| `approval_status` (enum) | PENDING, APPROVED, REJECTED |  | banco |
| `delivery_outcome` (enum) | SUCCESS, FAILED, DAMAGED, STOLEN, LATE, WRONG_ADDRESS, CUSTOMER_UNAVAILABLE |  | banco |
| `approval_priority` (enum) | LOW, MEDIUM, HIGH, URGENT, CRITICAL |  | banco |
| `app_role` (enum) | admin, manager, operator, viewer |  | banco |
| `RasterProvider` (TS) | osm \| esri-sat |  | `src/components/map/mapLayers.ts` |
| `MarkerDensity` (TS) | comfortable \| compact |  | `src/components/map/markerFactories.ts` |
| `VehicleFilter` (TS) | ALL \| MOTORCYCLE \| CAR \| VAN \| TRUCK |  | `src/components/map/types.ts` |
| `StatusFilter` (TS) | ALL \| IN_TRANSIT \| STOPPED \| OFF_ROUTE |  | `src/components/map/types.ts` |
| `EtaTrend` (TS) | improving \| worsening \| stable |  | `src/components/map/hooks/useMapAlerts.ts` |
| `HeatmapMetric` (TS) | volume \| cost \| delay |  | `src/components/reports/GeoHeatmap.tsx` |
| `HealthStatus` (TS) | ok \| degraded \| down \| unknown |  | `src/hooks/healthChecks.ts` |
| `AchievementId` (TS) | first_approval \| speed_demon \| streak_5 \| streak_10 \| risk_master \| zero_alerts \| bulk_approver \| perfect_day \| early_bird \| night_owl |  | `src/hooks/useAchievementsSystem.tsx` |
| `AchievementRarity` (TS) | common \| uncommon \| rare \| epic \| legendary |  | `src/hooks/useAchievementsSystem.tsx` |
| `GroupBy` (TS) | none \| severity \| type \| time |  | `src/hooks/useAlertGrouping.ts` |
| `SortBy` (TS) | newest \| oldest \| severity |  | `src/hooks/useAlertGrouping.ts` |
| `ViewMode` (TS) | list \| compact |  | `src/hooks/useAlertGrouping.ts` |
| `ExternalTable` (TS) | companies \| customers \| suppliers \| carriers \| contacts |  | `src/hooks/useExternalData.ts` |
| `FusePreset` (TS) | strict \| balanced \| fuzzy |  | `src/hooks/useFuseSearch.ts` |
| `FleetKind` (TS) | favorites \| blocked |  | `src/hooks/useLalamoveUapi.ts` |
| `MarkerDensity` (TS) | comfortable \| compact |  | `src/hooks/useMapSettings.ts` |
| `MapProvider` (TS) | mapbox-dark \| mapbox-sat \| osm \| esri-sat \| google-roadmap \| google-hybrid \| google-3d |  | `src/hooks/useMapSettings.ts` |
| `AppRole` (TS) | admin \| manager \| operator \| viewer |  | `src/hooks/usePermissions.ts` |
| `NotificationPermission` (TS) | default \| granted \| denied |  | `src/hooks/usePushNotifications.ts` |
| `AlertSeverity` (TS) | CRITICAL \| WARNING \| INFO |  | `src/hooks/usePushNotifications.ts` |
| `SLOWindow` (TS) | 1h \| 24h \| 7d \| 30d |  | `src/hooks/useSLOMetrics.ts` |
| `SLOStatus` (TS) | healthy \| at_risk \| breached |  | `src/hooks/useSLOMetrics.ts` |
| `ThemeMode` (TS) | light \| dark \| auto \| scheduled |  | `src/hooks/useScheduledTheme.ts` |
| `AlertPriority` (TS) | CRITICAL \| URGENT \| HIGH \| MEDIUM \| LOW |  | `src/hooks/useSoundSettings.ts` |
| `ToneType` (TS) | beep \| chime \| alert \| notification \| ping \| silent |  | `src/hooks/useSoundSettings.ts` |
| `ThemeMode` (TS) | light \| dark \| auto |  | `src/hooks/useTheme.ts` |
| `OrderOperation` (TS) | edit \| cancel \| priorityFee \| changeDriver |  | `src/lib/lalamoveOrderEdit.ts` |
| `CHANGE_DRIVER_REASONS` (TS) | 'DRIVER_UNRESPONSIVE', 'DRIVER_LATE', 'DRIVER_ASKED_CHANGE', 'DRIVER_RUDE', 'DRIVER_ASKED_FOR_MORE_MONEY', |  | `src/lib/lalamoveReasons.ts` |
| `CANCEL_ORDER_REASONS` (TS) | 'USER_REQUESTED', 'INCORRECT_ORDER_DETAILS', 'WRONG_ADDRESS', 'MISTAKEN_ORDER', 'PRICE_TOO_HIGH', 'DELIVERY_ETA_TOO_LONG', 'DRIVER_UNRESPONSIVE', 'DRIVER_LATE', 'DRIVER_ASKED_CANCEL', 'DRIVER_ASKED_FOR_MORE_MONEY', 'NO_CAPACITY', 'OTHER', |  | `src/lib/lalamoveReasons.ts` |
| `StageState` (TS) | done \| current \| pending \| skipped \| aborted |  | `src/lib/lalamoveTimeline.ts` |
| `OrderErrorField` (TS) | senderPhone \| recipientPhone \| schedule \| address |  | `src/lib/orderErrors.ts` |
| `StatusLevel` (TS) | operational \| attention \| critical \| info |  | `src/lib/statusPalette.ts` |
| `DriverStatus` (TS) | ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE', SUSPENDED = 'SUSPENDED', BANNED = 'BANNED', // Compatibilidade com sistema atual APPROVED = 'APPROVED', PENDING_APPROVAL = 'PENDING_APPROVAL', BLOCKED = 'BLOCKED', WHITELIST = 'WHITELIST', BLACKLIST = 'BLACKLIST' |  | `src/types/driver.ts` |
| `RiskLevel` (TS) | LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', CRITICAL = 'CRITICAL' |  | `src/types/driver.ts` |
| `DeliveryOutcome` (TS) | SUCCESS = 'SUCCESS', FAILED = 'FAILED', DAMAGED = 'DAMAGED', STOLEN = 'STOLEN', LATE = 'LATE', WRONG_ADDRESS = 'WRONG_ADDRESS', CUSTOMER_UNAVAILABLE = 'CUSTOMER_UNAVAILABLE' |  | `src/types/driver.ts` |
| `ApprovalPriority` (TS) | LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', URGENT = 'URGENT', CRITICAL = 'CRITICAL' |  | `src/types/driver.ts` |
| `IncidentType` (TS) | DELAY = 'DELAY', DAMAGE = 'DAMAGE', THEFT = 'THEFT', RUDE_BEHAVIOR = 'RUDE_BEHAVIOR', WRONG_DELIVERY = 'WRONG_DELIVERY', NO_SHOW = 'NO_SHOW', UNSAFE_DRIVING = 'UNSAFE_DRIVING', // Compatibilidade com sistema atual ROUTE_DEVIATION = 'ROUTE_DEVIATION', LONG_STOP = 'LONG_STOP', LATE_DELIVERY = 'LATE_DE … |  | `src/types/driver.ts` |
| `IncidentSeverity` (TS) | LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', CRITICAL = 'CRITICAL' |  | `src/types/driver.ts` |
| `OrderStatus` (TS) | PENDING \| MATCHED \| ON_GOING \| PICKED_UP \| COMPLETED \| CANCELLED \| REJECTED \| EXPIRED |  | `src/types/index.ts` |
| `VehicleType` (TS) | MOTORCYCLE \| CAR \| VAN \| TRUCK |  | `src/types/index.ts` |
| `DriverStatus` (TS) | APPROVED \| PENDING_APPROVAL \| BLOCKED \| WHITELIST \| BLACKLIST |  | `src/types/index.ts` |
| `IncidentType` (TS) | ROUTE_DEVIATION \| LONG_STOP \| LATE_DELIVERY \| CUSTOMER_COMPLAINT \| DAMAGE \| OTHER |  | `src/types/index.ts` |
| `ApprovalPriority` (TS) | LOW \| MEDIUM \| HIGH \| URGENT \| CRITICAL |  | `src/types/index.ts` |
| `AlertType` (TS) | DRIVER_BLOCKED \| ROUTE_DEVIATION \| DRIVER_STOPPED \| LATE_DELIVERY \| APPROVAL_REQUIRED \| ORDER_CANCELLED |  | `src/types/index.ts` |
| `SERVICE_TYPES` (TS) | 'LALAGO', 'LALAPRO', 'LALAGOFOUR', 'CAR', 'CARFOURH', 'HATCHBACK', 'HATCHFOURH', 'UV_FIORINO', 'UV_4H', 'VAN', 'VANFOURH', 'TRUCK330', 'TRUCK3_5T', 'TRUCK_6H', |  | `src/types/lalamove.ts` |
| `CITY_CODES` (TS) | 'BR AJU', 'BR BEL', 'BR BHZ', 'BR BSB', 'BR CWB', 'BR FLN', 'BR FOR', 'BR GYN', 'BR MAO', 'BR POA', 'BR RAO', 'BR REC', 'BR RIO', 'BR SAO', 'BR SLZ', 'BR SSA', |  | `src/types/lalamove.ts` |
| `ORDER_STATUSES` (TS) | 'ASSIGNING_DRIVER', 'ON_GOING', 'PICKED_UP', 'DELIVERING', 'COMPLETED', 'CANCELED', 'REJECTED', 'EXPIRED', |  | `src/types/lalamove.ts` |
| `ITEM_CATEGORIES` (TS) | 'FOOD_PRODUCTS_OR_GROCERY', 'CONSTRUCTION_MATERIALS_OR_PARTS', 'RETAIL_AND_WHOLESALE_', 'FURNITURE_OR_HOME_APPLIANCES', 'FRAGILE_ITEMS', |  | `src/types/lalamove.ts` |
| `HANDLING_INSTRUCTIONS` (TS) | 'FRAGILE_OR_HANDLE_WITH_CARE', 'DO_NOT_STACK', 'KEEP_UPRIGHT', 'KEEP_DRY', 'NO_BENDING', |  | `src/types/lalamove.ts` |
| `UAPI_POD_STATUS` (TS) | 'PENDING', 'SIGNED', 'DELIVERED', 'FAILED', 'NOT_APPLICABLE' |  | `src/types/lalamove.ts` |
| `ContractVersion` (TS) | v1 \| v2 |  | `supabase/functions/_shared/contract.ts` |
| `ContractName` (TS) | lalamove-webhook \| evaluate-driver \| send-notification \| new-device-alert \| route-analyzer \| check-external-api \| test-notification |  | `supabase/functions/_shared/schemas.ts` |
| `CHANGE_DRIVER_REASONS` (TS) | 'DRIVER_UNRESPONSIVE', 'DRIVER_LATE', 'DRIVER_ASKED_CHANGE', 'DRIVER_RUDE', 'DRIVER_ASKED_FOR_MORE_MONEY', |  | `supabase/functions/lalamove-api/index.ts` |

## Dados de referência (seed — planos, categorias, perfis fixos)

_nenhum item encontrado_

## Auditoria de consistência (código × schema) — trate como NÃO VERIFICADO

> `status`: inclui estados só de UI/realtime (ex.: `uploading`, `SUBSCRIBED`) que nunca vão ao banco — confira o arquivo antes de concluir que falta valor no enum.

| Tipo | Problema | Onde |
|---|---|---|
| status | valor `start` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/auth/MFAEnroll.tsx` |
| status | valor `scan` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/auth/MFAEnroll.tsx` |
| status | valor `quoting` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/orders/NewOrderDialog.tsx` |
| status | valor `creating` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/orders/NewOrderDialog.tsx` |
| status | valor `form` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/orders/NewOrderDialog.tsx` |
| status | valor `quoted` para `step` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/orders/NewOrderDialog.tsx` |
| status | valor `verified` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/auth/MFASettings.tsx`<br>`compara:src/hooks/useMFA.ts`<br>`escreve:src/hooks/useMFA.ts` |
| status | valor `synced` para `status` usado no código não existe em nenhum enum do banco/TS | `escreve:src/components/ui/data-refresh-indicator.tsx` |
| status | valor `syncing` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/ui/data-refresh-indicator.tsx`<br>`escreve:src/hooks/useOfflineStorage.ts` |
| status | valor `Entregue` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/ui/hover-preview.tsx` |
| status | valor `Disponível` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/ui/hover-preview.tsx` |
| status | valor `completed` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/ui/timeline-item.tsx` |
| status | valor `in_progress` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/ui/timeline-item.tsx` |
| status | valor `all` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/hooks/useAdvancedReports.ts`<br>`compara:src/pages/AdvancedReportsPage.tsx`<br>`escreve:src/hooks/useAdvancedReports.ts` |
| status | valor `sent` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/hooks/useNotificationHistory.ts` |
| status | valor `stale` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/pages/CacheMonitoringPage.tsx` |
| status | valor `OPEN` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:src/pages/IncidentsPage.tsx` |
| status | valor `DRIVER_CHANGED` para `status` usado no código não existe em nenhum enum do banco/TS | `escreve:supabase/functions/lalamove-api/index.ts` |
| status | valor `DELETED` para `status` usado no código não existe em nenhum enum do banco/TS | `compara:supabase/migrations/20251226020000_create_materialized_views_cache.sql` |
| status | valor `succeeded` para `last_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/components/health/CronJobsHealthPanel.tsx` |
| status | valor `installed` para `state` usado no código não existe em nenhum enum do banco/TS | `compara:src/hooks/useServiceWorker.ts` |
| status | valor `suspended` para `state` usado no código não existe em nenhum enum do banco/TS | `compara:src/utils/alertSounds.ts` |
| status | valor `CLOSED` para `state` usado no código não existe em nenhum enum do banco/TS | `escreve:src/utils/circuitBreaker.ts` |
| status | valor `OPEN` para `state` usado no código não existe em nenhum enum do banco/TS | `compara:src/utils/circuitBreaker.ts` |
| status | valor `synced` para `sync_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/hooks/useJobQueue.ts`<br>`filtra:src/hooks/useJobQueue.ts` |
| status | valor `error` para `sync_status` usado no código não existe em nenhum enum do banco/TS | `compara:src/hooks/useJobQueue.ts`<br>`escreve:supabase/functions/bitrix24-process-queue/index.ts`<br>`filtra:src/hooks/useJobQueue.ts` |
| coluna | coluna `city` usada no código não existe no schema de `contacts` |  |
| coluna | coluna `email` usada no código não existe no schema de `contacts` |  |
| coluna | coluna `phone` usada no código não existe no schema de `contacts` |  |
| coluna | coluna `state` usada no código não existe no schema de `contacts` |  |
| coluna | coluna `zip_code` usada no código não existe no schema de `contacts` |  |
| coluna | coluna `count` usada no código não existe no schema de `drivers` |  |
| tabela | tabela `a` usada no código não existe nas migrations/types do repo | `scripts/ci/gerar-matriz-edge-tabela.unit.mjs` |
| tabela | tabela `carriers` usada no código não existe nas migrations/types do repo | `supabase/functions/external-companies/index.ts` |
| tabela | tabela `companies` usada no código não existe nas migrations/types do repo | `supabase/functions/external-companies/index.ts` |
| tabela | tabela `customers` usada no código não existe nas migrations/types do repo | `supabase/functions/external-companies/index.ts` |
| tabela | tabela `fantasma` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `ignorada` usada no código não existe nas migrations/types do repo | `scripts/ci/gerar-matriz-edge-tabela.unit.mjs` |
| tabela | tabela `information_schema.tables` usada no código não existe nas migrations/types do repo | `scripts/list-tables.ts` |
| tabela | tabela `orders` usada no código não existe nas migrations/types do repo | `scripts/ci/gerar-matriz-edge-tabela.unit.mjs` |
| tabela | tabela `profiles` usada no código não existe nas migrations/types do repo | `scripts/ci/gerar-matriz-edge-tabela.unit.mjs` |
| tabela | tabela `shared_nao_conta` usada no código não existe nas migrations/types do repo | `scripts/ci/gerar-matriz-edge-tabela.unit.mjs` |
| tabela | tabela `so_teste` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `suppliers` usada no código não existe nas migrations/types do repo | `supabase/functions/external-companies/index.ts` |
| tabela | tabela `t` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `t1` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `tabela` usada no código não existe nas migrations/types do repo | `scripts/ci/gerar-matriz-edge-tabela.mjs`<br>`scripts/inventario/gerar-banco.mjs`<br>`scripts/inventario/gerar-repo.mjs` |
| tabela | tabela `tx` usada no código não existe nas migrations/types do repo | `scripts/ai-context/cenarios.mjs` |
| tabela | tabela `x` usada no código não existe nas migrations/types do repo | `scripts/db-audit/supabase-usage-guard.mjs`<br>`scripts/inventario/gerar-rotas.mjs` |
| rls | `geo_blocks`: acessada do front (1 arquivo(s)) sem RLS (não encontrado) | `src/pages/GeoBlockingPage.tsx` |
| edge | edge function `edge` invocada mas não existe em supabase/functions/ | `scripts/inventario/gerar-rotas.mjs` |
| edge | edge function `inexistente` invocada mas não existe em supabase/functions/ | `scripts/ai-context/cenarios.mjs` |
| edge | edge function `nada` invocada mas não existe em supabase/functions/ | `scripts/ai-context/cenarios.mjs` |
| rpc | RPC `demo` chamada mas não definida nas migrations/types | `scripts/supabase_snapshot/test_snapshot.py` |
| rpc | RPC `exec` chamada mas não definida nas migrations/types | `supabase/functions/apply-fixes/index.ts`<br>`supabase/functions/seed-fix-rls/index.ts` |
| rpc | RPC `exec_sql` chamada mas não definida nas migrations/types | `scripts/fix-dashboard-via-api.ts`<br>`scripts/list-tables.ts` |
| rpc | RPC `fn` chamada mas não definida nas migrations/types | `scripts/supabase_snapshot/snapshot.py` |
| rpc | RPC `get_order_stats` chamada mas não definida nas migrations/types | `scripts/ai-context/gerar.unit.mjs` |
| rpc | RPC `nome` chamada mas não definida nas migrations/types | `scripts/supabase_snapshot/snapshot.py` |
| rpc | RPC `r1` chamada mas não definida nas migrations/types | `scripts/ai-context/cenarios.mjs` |
| rpc | RPC `rpc_inexistente` chamada mas não definida nas migrations/types | `scripts/ai-context/gerar.unit.mjs` |
| rpc | RPC `y` chamada mas não definida nas migrations/types | `scripts/db-audit/supabase-usage-guard.mjs` |
| dinâmico | 1 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `scripts/seed-database.ts` |
| dinâmico | 1 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `scripts/inventario/gerar-banco.mjs` |
| dinâmico | 1 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `scripts/inventario/gerar-rotas.mjs` |
| dinâmico | 2 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `scripts/regras_negocio/generate.py` |
| dinâmico | 4 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `supabase/functions/external-companies/index.ts` |
| dinâmico | 4 chamada(s) `.from(variável)` — tabela só conhecida em runtime | `supabase/functions/external-db-bridge/index.ts` |
| segurança | função `cleanup_old_system_logs` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20251226000001_create_system_logs.sql` |
| segurança | função `create_audit_log` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20251226000002_create_audit_log.sql` |
| segurança | função `add_job` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20251226010000_create_job_queue_system.sql` |
| segurança | função `process_job_queue` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20251226010001_configure_pg_cron.sql` |
| segurança | função `get_cron_jobs_status` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20251226010001_configure_pg_cron.sql` |
| segurança | função `pause_cron_job` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20251226010001_configure_pg_cron.sql` |
| segurança | função `resume_cron_job` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20251226010001_configure_pg_cron.sql` |
| segurança | função `run_rls_security_audit` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20260513180724_3f8df4ed-2b79-4254-a66e-c07ac0297cfe.sql` |
| segurança | função `log_mfa_session` é SECURITY DEFINER sem `set search_path` (risco de escalação) | `supabase/migrations/20260516112923_4931320e-6f67-4667-8eae-490bb7d9564c.sql` |

## Lacunas — o que este contexto NÃO consegue responder (perguntas para o dono do negócio)

- Nenhuma regra manual em `manual/`: prazos, limites, exceções comerciais, quem aprova o quê — só o negócio sabe.
- `cache_refresh_log.status` tem valores ['failed', 'running', 'success'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `drivers.status` tem valores ['APPROVED', 'PENDING_APPROVAL', 'BLOCKED', 'WHITELIST', 'BLACKLIST'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `lalamove_orders.status` tem valores ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `lalamove_orders.internal_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `lalamove_stops.pod_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `lalamove_status_history.status` tem valores ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `lalamove_status_history.old_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `driver_approval_queue.status` tem valores ['PENDING', 'APPROVED', 'REJECTED'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `active_tracking.tracking_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `alerts_sent.status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `bitrix24_sync.sync_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `bitrix24_stage_mappings.lalamove_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `bitrix24_stage_mappings.bitrix_stage_name` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `job_queue.status` tem valores ['CANCELLED', 'COMPLETED', 'FAILED', 'PENDING', 'PROCESSING'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `password_reset_requests.status` tem valores ['approved', 'pending', 'rejected'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `lalamove_stop_proofs.pod_status` tem valores ['NOT_REQUIRED', 'delivered', 'failed', 'pending'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `lalamove_stop_proofs.pop_status` tem valores ['NOT_REQUIRED', 'failed', 'pending', 'picked_up'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `lalamove_stop_proofs.delivery_code_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `lalamove_rate_limits.status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `drivers_safe_view.status` tem valores ['APPROVED', 'PENDING_APPROVAL', 'BLOCKED', 'WHITELIST', 'BLACKLIST'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `orders_operator_view.internal_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `orders_operator_view.status` tem valores ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- `orders_safe_view.internal_status` é uma coluna de status sem enum/CHECK — os valores válidos e as transições permitidas não estão no banco.
- `orders_safe_view.status` tem valores ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'] mas nenhum mapa de transições foi encontrado no código — a ordem permitida (ex.: pago → cancelado?) não está declarada.
- 63/71 tabelas sem `COMMENT ON TABLE` — o significado de negócio não está no schema: `entity_versions`, `cache_refresh_log`, `drivers`, `lalamove_orders`, `lalamove_stops`, `lalamove_status_history`, `driver_incidents`, `driver_approval_queue`, `active_tracking`, `alerts`, `alerts_sent`, `alert_configurations` …
- Há tabelas usadas no código sem migration no repo — o schema real pode ter sido alterado pelo painel.

## Regras manuais presentes

_nenhuma — copie `manual/TEMPLATE-regras-de-negocio.md`_
