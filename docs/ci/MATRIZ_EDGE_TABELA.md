# Matriz edge function x tabela

> Gerado por `node scripts/ci/gerar-matriz-edge-tabela.mjs` — não editar à mão.
> Fonte: chamadas `.from('tabela')` em `supabase/functions/<funcao>/**/*.ts` (sem testes e sem `_shared`).
>
> Não cobre: tabelas acessadas por `.rpc()` (chamada de função, não de tabela), por nome em variável
> (`from(nome)`) nem por SQL cru. Chamadas `storage.from('bucket')` são bucket de storage, não tabela,
> e ficam de fora.

## Por função

| Função | Tabelas |
|---|---|
| `apply-fixes` | — |
| `bitrix24-process-queue` | `bitrix24_activities`, `bitrix24_stage_mappings`, `bitrix24_sync`, `bitrix24_tokens` |
| `bitrix24-sync` | `bitrix24_activities`, `bitrix24_stage_mappings`, `bitrix24_sync`, `bitrix24_tokens`, `lalamove_orders` |
| `check-driver-alerts` | `active_tracking`, `alert_configurations`, `alerts` |
| `check-external-api` | — |
| `escalate-alerts` | — |
| `evaluate-driver` | `alerts`, `driver_approval_queue`, `driver_evaluations`, `driver_incidents`, `drivers`, `lalamove_orders`, `risk_rules` |
| `external-companies` | `carriers`, `companies`, `contacts`, `customers`, `suppliers` |
| `external-db-bridge` | `query_telemetry` |
| `get-mapbox-token` | — |
| `job-worker` | — |
| `lalamove-api` | `drivers`, `lalamove_orders`, `lalamove_priority_fee_history`, `lalamove_rate_limits`, `lalamove_status_history` |
| `lalamove-gateway` | `alerts`, `lalamove_rate_limits`, `query_telemetry` |
| `lalamove-token-refresh` | `alerts`, `lalamove_uapi_sessions` |
| `lalamove-uapi` | `lalamove_orders`, `lalamove_uapi_sessions` |
| `lalamove-webhook` | `active_tracking`, `alerts`, `driver_locations`, `drivers`, `lalamove_order_replacements`, `lalamove_orders`, `lalamove_status_history`, `lalamove_stop_proofs`, `lalamove_stops`, `tracking_events`, `webhook_events` |
| `llm-wh` | — |
| `mapbox-proxy` | — |
| `migrate-helper` | — |
| `new-device-alert` | `auth_logs`, `new_device_alerts`, `user_devices` |
| `rotate-tokens` | `alerts`, `bitrix24_tokens` |
| `route-analyzer` | `alerts`, `drivers`, `lalamove_orders` |
| `seed-fix-rls` | — |
| `send-notification` | `alert_configurations`, `alerts`, `alerts_sent`, `bitrix24_tokens` |
| `simulate-driver-movement` | `active_tracking`, `tracking_events` |
| `test-notification` | `bitrix24_tokens` |

## Por tabela

| Tabela | Funções |
|---|---|
| `active_tracking` | `check-driver-alerts`, `lalamove-webhook`, `simulate-driver-movement` |
| `alert_configurations` | `check-driver-alerts`, `send-notification` |
| `alerts` | `check-driver-alerts`, `evaluate-driver`, `lalamove-gateway`, `lalamove-token-refresh`, `lalamove-webhook`, `rotate-tokens`, `route-analyzer`, `send-notification` |
| `alerts_sent` | `send-notification` |
| `auth_logs` | `new-device-alert` |
| `bitrix24_activities` | `bitrix24-process-queue`, `bitrix24-sync` |
| `bitrix24_stage_mappings` | `bitrix24-process-queue`, `bitrix24-sync` |
| `bitrix24_sync` | `bitrix24-process-queue`, `bitrix24-sync` |
| `bitrix24_tokens` | `bitrix24-process-queue`, `bitrix24-sync`, `rotate-tokens`, `send-notification`, `test-notification` |
| `carriers` | `external-companies` |
| `companies` | `external-companies` |
| `contacts` | `external-companies` |
| `customers` | `external-companies` |
| `driver_approval_queue` | `evaluate-driver` |
| `driver_evaluations` | `evaluate-driver` |
| `driver_incidents` | `evaluate-driver` |
| `driver_locations` | `lalamove-webhook` |
| `drivers` | `evaluate-driver`, `lalamove-api`, `lalamove-webhook`, `route-analyzer` |
| `lalamove_order_replacements` | `lalamove-webhook` |
| `lalamove_orders` | `bitrix24-sync`, `evaluate-driver`, `lalamove-api`, `lalamove-uapi`, `lalamove-webhook`, `route-analyzer` |
| `lalamove_priority_fee_history` | `lalamove-api` |
| `lalamove_rate_limits` | `lalamove-api`, `lalamove-gateway` |
| `lalamove_status_history` | `lalamove-api`, `lalamove-webhook` |
| `lalamove_stop_proofs` | `lalamove-webhook` |
| `lalamove_stops` | `lalamove-webhook` |
| `lalamove_uapi_sessions` | `lalamove-token-refresh`, `lalamove-uapi` |
| `new_device_alerts` | `new-device-alert` |
| `query_telemetry` | `external-db-bridge`, `lalamove-gateway` |
| `risk_rules` | `evaluate-driver` |
| `suppliers` | `external-companies` |
| `tracking_events` | `lalamove-webhook`, `simulate-driver-movement` |
| `user_devices` | `new-device-alert` |
| `webhook_events` | `lalamove-webhook` |
