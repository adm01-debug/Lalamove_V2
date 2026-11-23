import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';
import { useSLAMetricsRealtime } from './useRealtimeSubscriptions';

export interface SLAMetrics {
  // Delivery metrics
  totalActiveDeliveries: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  atRiskDeliveries: number;
  onTimeRate: number;
  
  // Time metrics
  avgDeliveryTime: number;
  avgPickupTime: number;
  fastestDelivery: number;
  slowestDelivery: number;
  
  // Driver metrics
  activeDrivers: number;
  stoppedDrivers: number;
  offRouteDrivers: number;
  avgDriverSpeed: number;
  
  // Alert metrics
  criticalAlerts: number;
  warningAlerts: number;
  pendingApprovals: number;
  
  // Hourly breakdown
  hourlyStats: { hour: string; completed: number; onTime: number }[];
  
  // Status breakdown
  statusBreakdown: { status: string; count: number }[];
}

async function fetchSLAMetrics(): Promise<SLAMetrics> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Fetch all required data in parallel
  const [
    ordersResult,
    activeTrackingResult,
    alertsResult,
    approvalsResult,
    driversResult
  ] = await Promise.all([
    supabase
      .from('lalamove_orders')
      .select('*')
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('active_tracking')
      .select('*, driver:drivers(name, vehicle_type)'),
    supabase
      .from('alerts')
      .select('*')
      .eq('is_dismissed', false)
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('driver_approval_queue')
      .select('*')
      .eq('status', 'PENDING'),
    supabase
      .from('drivers')
      .select('*')
      .in('status', ['APPROVED', 'WHITELIST'])
  ]);

  const orders = ordersResult.data || [];
  const activeTracking = activeTrackingResult.data || [];
  const alerts = alertsResult.data || [];
  const pendingApprovals = approvalsResult.data || [];
  // Note: driversResult fetched for potential future use
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const activeOrders = orders.filter(o => ['ON_GOING', 'PICKED_UP', 'MATCHED'].includes(o.status));
  
  // On-time calculation (within estimated delivery time)
  const onTimeOrders = completedOrders.filter(o => {
    if (!o.estimated_delivery || !o.actual_delivery) return true;
    return new Date(o.actual_delivery) <= new Date(o.estimated_delivery);
  });
  
  const lateOrders = completedOrders.filter(o => {
    if (!o.estimated_delivery || !o.actual_delivery) return false;
    return new Date(o.actual_delivery) > new Date(o.estimated_delivery);
  });

  // At-risk: active orders with ETA exceeded or about to exceed
  const atRiskOrders = activeOrders.filter(o => {
    if (!o.estimated_delivery) return false;
    const eta = new Date(o.estimated_delivery);
    const buffer = 10 * 60 * 1000; // 10 minutes
    return eta.getTime() - buffer <= now.getTime();
  });

  // Calculate time metrics
  const deliveryTimes = completedOrders
    .filter(o => o.actual_delivery && o.scheduled_at)
    .map(o => {
      const start = new Date(o.scheduled_at!).getTime();
      const end = new Date(o.actual_delivery!).getTime();
      return (end - start) / (1000 * 60); // in minutes
    })
    .filter(t => t > 0 && t < 480); // filter outliers

  const avgDeliveryTime = deliveryTimes.length > 0 
    ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : 0;
  const fastestDelivery = deliveryTimes.length > 0 ? Math.round(Math.min(...deliveryTimes)) : 0;
  const slowestDelivery = deliveryTimes.length > 0 ? Math.round(Math.max(...deliveryTimes)) : 0;

  // Driver metrics
  const stoppedDrivers = activeTracking.filter(t => t.is_stopped).length;
  const offRouteDrivers = activeTracking.filter(t => !t.is_on_route).length;
  const speeds = activeTracking
    .map(t => Number(t.speed) || 0)
    .filter(s => s > 0);
  const avgDriverSpeed = speeds.length > 0
    ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
    : 0;

  // Alert metrics
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
  const warningAlerts = alerts.filter(a => a.severity === 'WARNING').length;

  // Hourly breakdown
  const hourlyMap = new Map<string, { completed: number; onTime: number }>();
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0') + ':00';
    hourlyMap.set(hour, { completed: 0, onTime: 0 });
  }
  
  completedOrders.forEach(o => {
    if (o.actual_delivery) {
      const hour = new Date(o.actual_delivery).getHours().toString().padStart(2, '0') + ':00';
      const stats = hourlyMap.get(hour) || { completed: 0, onTime: 0 };
      stats.completed++;
      if (!o.estimated_delivery || new Date(o.actual_delivery) <= new Date(o.estimated_delivery)) {
        stats.onTime++;
      }
      hourlyMap.set(hour, stats);
    }
  });

  const hourlyStats = Array.from(hourlyMap.entries()).map(([hour, stats]) => ({
    hour,
    ...stats
  }));

  // Status breakdown
  const statusCount = new Map<string, number>();
  orders.forEach(o => {
    statusCount.set(o.status, (statusCount.get(o.status) || 0) + 1);
  });
  const statusBreakdown = Array.from(statusCount.entries()).map(([status, count]) => ({
    status,
    count
  }));

  return {
    totalActiveDeliveries: activeOrders.length,
    onTimeDeliveries: onTimeOrders.length,
    lateDeliveries: lateOrders.length,
    atRiskDeliveries: atRiskOrders.length,
    onTimeRate: completedOrders.length > 0 
      ? Math.round((onTimeOrders.length / completedOrders.length) * 100)
      : 100,
    avgDeliveryTime,
    avgPickupTime: Math.round(avgDeliveryTime * 0.3), // Estimate
    fastestDelivery,
    slowestDelivery,
    activeDrivers: activeTracking.length,
    stoppedDrivers,
    offRouteDrivers,
    avgDriverSpeed,
    criticalAlerts,
    warningAlerts,
    pendingApprovals: pendingApprovals.length,
    hourlyStats,
    statusBreakdown
  };
}

export function useSLAMetrics() {
  const query = useQuery({
    queryKey: ['sla-metrics'],
    queryFn: fetchSLAMetrics,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    staleTime: 5000,
  });

  // Use centralized realtime subscription
  const handleUpdate = useCallback(() => {
    query.refetch();
  }, [query]);

  useSLAMetricsRealtime(handleUpdate);

  return query;
}
