# Views


## public.drivers_safe_view (view)

| campo | valor |
|---|---|
| owner | postgres |
| security_invoker | sim |
| opções | security_invoker=true |
| depende de | public.drivers |
| populada | n/a |
| comentário |  |


```sql
SELECT id,
    name,
    vehicle_type,
    status,
    rating,
    risk_score,
    risk_level,
    total_deliveries,
    completed_deliveries,
    failed_deliveries,
    cancelled_deliveries,
    success_rate,
    failure_rate,
    avg_delay_minutes,
    lalamove_id,
    vehicle_plate,
    photo_url,
    blacklisted,
    blacklist_reason,
    whitelisted,
    notes,
    last_active_at,
    last_delivery_at,
    last_evaluated_at,
    first_seen_at,
    external_rating,
    external_success_rate,
    external_total_deliveries,
    risk_reasons,
    created_at,
    updated_at,
        CASE
            WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) THEN phone
            ELSE '***RESTRITO***'::text
        END AS phone
   FROM drivers;
```

## public.orders_operator_view (view)

| campo | valor |
|---|---|
| owner | postgres |
| security_invoker | sim |
| opções | security_invoker=true |
| depende de | public.lalamove_orders |
| populada | n/a |
| comentário |  |


```sql
SELECT id,
    lalamove_id,
    status,
    pickup_address,
    delivery_address,
        CASE
            WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) THEN customer_phone
            ELSE '***RESTRITO***'::text
        END AS customer_phone,
    customer_name,
    vehicle_type,
    total_cost,
    currency,
    scheduled_at,
    estimated_delivery,
    actual_delivery,
    driver_id,
    is_urgent,
    outcome,
    delay_minutes,
    duration_minutes,
    distance_meters,
    tags,
    department,
    cost_center,
    internal_status,
    internal_order_id,
    share_link,
    internal_notes,
    custom_rating,
    quotation_id,
    pickup_latitude,
    pickup_longitude,
    delivery_latitude,
    delivery_longitude,
    metadata,
    bitrix24_deal_id,
    created_at,
    updated_at
   FROM lalamove_orders;
```

## public.orders_safe_view (view)

| campo | valor |
|---|---|
| owner | postgres |
| security_invoker | sim |
| opções | security_invoker=true |
| depende de | public.lalamove_orders |
| populada | n/a |
| comentário |  |


```sql
SELECT id,
    lalamove_id,
    status,
    vehicle_type,
    customer_name,
        CASE
            WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) THEN customer_phone
            ELSE '***RESTRITO***'::text
        END AS customer_phone,
    pickup_address,
    delivery_address,
    total_cost,
    currency,
    scheduled_at,
    estimated_delivery,
    actual_delivery,
    driver_id,
    bitrix24_deal_id,
    share_link,
    tags,
    metadata,
    internal_notes,
    internal_order_id,
    internal_status,
    department,
    cost_center,
    quotation_id,
    is_urgent,
    outcome,
    delay_minutes,
    custom_rating,
    distance_meters,
    duration_minutes,
    pickup_latitude,
    pickup_longitude,
    delivery_latitude,
    delivery_longitude,
    created_at,
    updated_at
   FROM lalamove_orders;
```
