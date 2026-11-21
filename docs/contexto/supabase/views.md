# Views


## public.cache_status (view)

| campo | valor |
|---|---|
| owner | postgres |
| security_invoker | não |
| opções |  |
| depende de | public.delivery_metrics_cache, public.driver_stats_cache, public.hourly_metrics_cache |
| populada | n/a |
| comentário | Status de cada materialized view de cache (stale/atualizada) |


```sql
SELECT view_name,
    row_count,
    last_refresh,
    refresh_duration_ms,
    last_refresh IS NULL OR last_refresh < (now() - '01:00:00'::interval) AS is_stale,
        CASE
            WHEN last_refresh IS NULL THEN 'never_refreshed'::text
            WHEN last_refresh < (now() - '01:00:00'::interval) THEN 'stale'::text
            ELSE 'success'::text
        END AS status
   FROM ( SELECT 'driver_stats_cache'::text AS view_name,
            ( SELECT count(*) AS count
                   FROM driver_stats_cache) AS row_count,
            ( SELECT max(driver_stats_cache.cached_at) AS max
                   FROM driver_stats_cache) AS last_refresh,
            NULL::integer AS refresh_duration_ms
        UNION ALL
         SELECT 'delivery_metrics_cache'::text,
            ( SELECT count(*) AS count
                   FROM delivery_metrics_cache) AS count,
            ( SELECT max(delivery_metrics_cache.cached_at) AS max
                   FROM delivery_metrics_cache) AS max,
            NULL::integer AS int4
        UNION ALL
         SELECT 'hourly_metrics_cache'::text,
            ( SELECT count(*) AS count
                   FROM hourly_metrics_cache) AS count,
            ( SELECT max(hourly_metrics_cache.cached_at) AS max
                   FROM hourly_metrics_cache) AS max,
            NULL::integer AS int4) s;
```

## public.delivery_metrics_cache (materialized)

| campo | valor |
|---|---|
| owner | postgres |
| security_invoker | n/a |
| opções |  |
| depende de | public.lalamove_orders |
| populada | sim |
| comentário | Cache de metricas diarias de entregas |


```sql
SELECT date(created_at) AS delivery_date,
    count(*) AS total_orders,
    count(*) FILTER (WHERE status = 'COMPLETED'::order_status) AS completed_orders,
    count(*) FILTER (WHERE status = 'CANCELLED'::order_status) AS cancelled_orders,
    count(*) FILTER (WHERE status = ANY (ARRAY['REJECTED'::order_status, 'EXPIRED'::order_status])) AS failed_orders,
    count(*) FILTER (WHERE status = ANY (ARRAY['ON_GOING'::order_status, 'PICKED_UP'::order_status])) AS in_progress_orders,
    COALESCE(avg(delay_minutes), 0::numeric) AS avg_delay_minutes,
    COALESCE(sum(total_cost), 0::numeric) AS total_value,
    COALESCE(avg(total_cost), 0::numeric) AS avg_value,
    COALESCE(max(total_cost), 0::numeric) AS max_value,
    now() AS cached_at
   FROM lalamove_orders lo
  GROUP BY (date(created_at));
```

## public.driver_stats_cache (materialized)

| campo | valor |
|---|---|
| owner | postgres |
| security_invoker | n/a |
| opções |  |
| depende de | public.drivers |
| populada | sim |
| comentário | Cache de estatisticas consolidadas de motoristas |


```sql
SELECT id AS driver_id,
    name AS driver_name,
    lalamove_id AS lalamove_driver_id,
    phone,
    vehicle_type,
    status AS driver_status,
    risk_score,
    risk_level,
    whitelisted AS is_whitelisted,
    blacklisted AS is_blacklisted,
    COALESCE(total_deliveries, 0) AS total_deliveries,
    COALESCE(completed_deliveries, 0) AS completed_deliveries,
    COALESCE(cancelled_deliveries, 0) AS cancelled_deliveries,
    COALESCE(failed_deliveries, 0) AS failed_deliveries,
    COALESCE(rating, 0::numeric) AS avg_rating,
    last_delivery_at,
    last_active_at,
    created_at AS driver_created_at,
    now() AS cached_at
   FROM drivers d;
```

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

## public.hourly_metrics_cache (materialized)

| campo | valor |
|---|---|
| owner | postgres |
| security_invoker | n/a |
| opções |  |
| depende de | public.lalamove_orders |
| populada | sim |
| comentário | Cache de metricas horarias de entregas |


```sql
SELECT date_trunc('hour'::text, created_at) AS hour,
    count(*) AS total_orders,
    count(*) FILTER (WHERE status = 'COMPLETED'::order_status) AS completed_orders,
    COALESCE(avg(total_cost), 0::numeric) AS avg_value,
    COALESCE(sum(total_cost), 0::numeric) AS total_value,
    now() AS cached_at
   FROM lalamove_orders lo
  GROUP BY (date_trunc('hour'::text, created_at));
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
