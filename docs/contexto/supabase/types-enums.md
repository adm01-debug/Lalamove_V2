# Tipos customizados (enums, domains, composites)

| tipo | kind | valores / definição | usado em |
|---|---|---|---|
| public.alert_severity | enum | INFO, WARNING, CRITICAL | public.alerts.severity |
| public.alert_type | enum | DRIVER_BLOCKED, ROUTE_DEVIATION, DRIVER_STOPPED, LATE_DELIVERY, APPROVAL_REQUIRED, ORDER_CANCELLED, INTEGRATION_FAILURE, DRIVER_APPROACHING_PICKUP, DRIVER_ARRIVED_PICKUP, DRIVER_APPROACHING_DELIVERY, DRIVER_ARRIVED_DELIVERY, ETA_DELAY, SUPPLIER_DELAY_NOTICE, MISSING_POD, GEO_BUDGET_WARNING, DRIVER_ASSIGNED, DRIVER_NO_CONFIRMATION | public.alert_configurations.alert_type, public.alert_dedup.alert_type, public.alerts.type, public.order_geo_events.event_type |
| public.app_role | enum | admin, manager, operator, viewer | public.role_permissions.role, public.user_roles.role |
| public.approval_priority | enum | LOW, MEDIUM, HIGH, URGENT, CRITICAL | public.driver_approval_queue.approval_priority |
| public.approval_status | enum | PENDING, APPROVED, REJECTED | public.driver_approval_queue.status |
| public.delivery_outcome | enum | SUCCESS, FAILED, DAMAGED, STOLEN, LATE, WRONG_ADDRESS, CUSTOMER_UNAVAILABLE | public.lalamove_orders.outcome, public.orders_operator_view.outcome, public.orders_safe_view.outcome |
| public.driver_status | enum | APPROVED, PENDING_APPROVAL, BLOCKED, WHITELIST, BLACKLIST | public.driver_stats_cache.driver_status, public.drivers.status, public.drivers_safe_view.status |
| public.incident_severity | enum | LOW, MEDIUM, HIGH, CRITICAL | public.driver_incidents.severity |
| public.incident_type | enum | ROUTE_DEVIATION, LONG_STOP, LATE_DELIVERY, CUSTOMER_COMPLAINT, DAMAGE, OTHER | public.driver_incidents.type |
| public.order_status | enum | PENDING, MATCHED, ON_GOING, PICKED_UP, COMPLETED, CANCELLED, REJECTED, EXPIRED, QUOTED, ASSIGNING_DRIVER, DELIVERING | public.lalamove_orders.status, public.orders_operator_view.status, public.orders_safe_view.status |
| public.vehicle_type | enum | MOTORCYCLE, CAR, VAN, TRUCK | public.driver_stats_cache.vehicle_type, public.drivers.vehicle_type, public.drivers_safe_view.vehicle_type, public.lalamove_orders.vehicle_type, public.orders_operator_view.vehicle_type, public.orders_safe_view.vehicle_type |
