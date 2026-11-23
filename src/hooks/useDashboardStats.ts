import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays } from 'date-fns';
import { DashboardStats } from '@/types';

export type { DashboardStats } from '@/types';

interface QueryError {
  name: string;
  error: unknown;
}

export type DashboardStatsResult = DashboardStats & { errors: QueryError[] };

async function fetchDashboardStats(): Promise<DashboardStatsResult> {
  const today = startOfDay(new Date()).toISOString();
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  const results = await Promise.allSettled([
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

  const errors: QueryError[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      errors.push({ name: QUERY_NAMES[index], error: result.reason });
    }
  });

  // Cada KPI é isolado: query rejeitada devolve undefined e cai no fallback, em vez
  // de derrubar as outras seis (o cast cego anterior lançava TypeError e zerava tudo).
  const value = <T,>(index: number): T | undefined =>
    results[index].status === 'fulfilled'
      ? (results[index] as PromiseFulfilledResult<T>).value
      : undefined;

  const ordersResult = value<{ count: number | null }>(0);
  const activeDeliveriesResult = value<{ count: number | null }>(1);
  const completedTodayResult = value<{ count: number | null }>(2);
  const pendingApprovalsResult = value<{ count: number | null }>(3);
  const alertsResult = value<{ count: number | null }>(4);
  const activeDriversResult = value<{ count: number | null }>(5);
  const deliveryTimesResult = value<{ data: { scheduled_at: string | null; actual_delivery: string | null; estimated_delivery: string | null }[] | null }>(6);

  // Calculate average delivery time and on-time rate (só pares completos)
  let avgDeliveryTime = 0;
  let onTimeRate = 0;
  
  if (deliveryTimesResult?.data && deliveryTimesResult.data.length > 0) {
    const complete = deliveryTimesResult.data.filter(
      (order) => order.scheduled_at && order.actual_delivery,
    );
    let totalMinutes = 0;
    let onTimeCount = 0;

    complete.forEach((order) => {
      const scheduled = new Date(order.scheduled_at!).getTime();
      const actual = new Date(order.actual_delivery!).getTime();
      const diffMinutes = Math.round((actual - scheduled) / (1000 * 60));
      totalMinutes += Math.max(0, diffMinutes);

      // Consider on-time if delivered within estimated time or within 15 min of scheduled
      if (order.estimated_delivery) {
        const estimated = new Date(order.estimated_delivery).getTime();
        if (actual <= estimated) onTimeCount++;
      } else {
        if (diffMinutes <= 60) onTimeCount++;
      }
    });

    if (complete.length > 0) {
      avgDeliveryTime = Math.round(totalMinutes / complete.length);
      onTimeRate = Math.round((onTimeCount / complete.length) * 100);
    }
  }

  return {
    totalOrders: ordersResult?.count ?? 0,
    activeDeliveries: activeDeliveriesResult?.count ?? 0,
    completedToday: completedTodayResult?.count ?? 0,
    pendingApprovals: pendingApprovalsResult?.count ?? 0,
    alertsCount: alertsResult?.count ?? 0,
    avgDeliveryTime, // real computed average (0 when there are no complete deliveries)
    onTimeRate, // real on-time percentage (0 when there are no complete deliveries)
    activeDrivers: activeDriversResult?.count ?? 0,
    errors,
  };
}

const QUERY_NAMES = [
  'totalOrders',
  'activeDeliveries',
  'completedToday',
  'pendingApprovals',
  'alertsCount',
  'activeDrivers',
  'deliveryTimes',
] as const;

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000,
    refetchIntervalInBackground: false, // Refresh every 30 seconds
    staleTime: 10000,
  });
}
