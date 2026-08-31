import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays } from 'date-fns';

export interface DashboardStats {
  totalOrders: number;
  activeDeliveries: number;
  completedToday: number;
  pendingApprovals: number;
  alertsCount: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  activeDrivers: number;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = startOfDay(new Date()).toISOString();
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  const [
    ordersResult,
    activeDeliveriesResult,
    completedTodayResult,
    pendingApprovalsResult,
    alertsResult,
    activeDriversResult,
    deliveryTimesResult,
  ] = await Promise.all([
    // Total orders in last 30 days
    supabase
      .from('lalamove_orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    // Active deliveries (ON_GOING or PICKED_UP)
    supabase
      .from('lalamove_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ON_GOING', 'PICKED_UP']),

    // Completed today
    supabase
      .from('lalamove_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'COMPLETED')
      .gte('actual_delivery', today),

    // Pending approvals
    supabase
      .from('driver_approval_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING'),

    // Active alerts (not dismissed)
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('is_dismissed', false),

    // Active drivers (last active in 24h)
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .gte('last_active_at', subDays(new Date(), 1).toISOString()),

    // Delivery times for avg calculation
    supabase
      .from('lalamove_orders')
      .select('scheduled_at, actual_delivery, estimated_delivery')
      .eq('status', 'COMPLETED')
      .not('actual_delivery', 'is', null)
      .gte('actual_delivery', thirtyDaysAgo)
      .limit(100),
  ]);

  // Calculate average delivery time and on-time rate
  let avgDeliveryTime = 0;
  let onTimeRate = 0;
  
  if (deliveryTimesResult.data && deliveryTimesResult.data.length > 0) {
    const deliveries = deliveryTimesResult.data;
    let totalMinutes = 0;
    let onTimeCount = 0;

    deliveries.forEach((order) => {
      if (order.scheduled_at && order.actual_delivery) {
        const scheduled = new Date(order.scheduled_at).getTime();
        const actual = new Date(order.actual_delivery).getTime();
        const diffMinutes = Math.round((actual - scheduled) / (1000 * 60));
        totalMinutes += Math.max(0, diffMinutes);

        // Consider on-time if delivered within estimated time or within 15 min of scheduled
        if (order.estimated_delivery) {
          const estimated = new Date(order.estimated_delivery).getTime();
          if (actual <= estimated) onTimeCount++;
        } else {
          if (diffMinutes <= 60) onTimeCount++;
        }
      }
    });

    avgDeliveryTime = deliveries.length > 0 ? Math.round(totalMinutes / deliveries.length) : 0;
    onTimeRate = deliveries.length > 0 ? Math.round((onTimeCount / deliveries.length) * 100) : 0;
  }

  return {
    totalOrders: ordersResult.count ?? 0,
    activeDeliveries: activeDeliveriesResult.count ?? 0,
    completedToday: completedTodayResult.count ?? 0,
    pendingApprovals: pendingApprovalsResult.count ?? 0,
    alertsCount: alertsResult.count ?? 0,
    avgDeliveryTime, // real computed average (0 when there are no deliveries)
    onTimeRate, // real on-time percentage (0 when there are no deliveries)
    activeDrivers: activeDriversResult.count ?? 0,
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
}
