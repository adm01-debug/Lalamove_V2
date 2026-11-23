import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';

export interface DashboardStats {
  totalOrders: number | null;
  activeDeliveries: number | null;
  completedToday: number | null;
  pendingApprovals: number | null;
  alertsCount: number | null;
  avgDeliveryTime: number | null;
  onTimeRate: number | null;
  activeDrivers: number | null;
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
  ] = await Promise.allSettled([
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

  // Notify user for each failed KPI query
  const kpiNames: Record<number, string> = {
    0: 'pedidos totais',
    1: 'entregas ativas',
    2: 'concluídos hoje',
    3: 'aprovações pendentes',
    4: 'alertas',
    5: 'motoristas ativos',
    6: 'tempos de entrega',
  };
  const results = [ordersResult, activeDeliveriesResult, completedTodayResult, pendingApprovalsResult, alertsResult, activeDriversResult, deliveryTimesResult];
  const failedKpis = results
    .map((r, i) => (r.status === 'rejected' ? kpiNames[i] : null))
    .filter(Boolean);
  if (failedKpis.length > 0) {
    toast({ title: 'Dashboard', description: `Não foi possível carregar: ${failedKpis.join(', ')}.`, variant: 'destructive' });
  }

  // Calculate average delivery time and on-time rate
  let avgDeliveryTime: number | null = null;
  let onTimeRate: number | null = null;

  if (deliveryTimesResult.status === 'fulfilled' && deliveryTimesResult.value.data && deliveryTimesResult.value.data.length > 0) {
    const deliveries = deliveryTimesResult.value.data;
    let totalMinutes = 0;
    let onTimeCount = 0;

    deliveries.forEach((order) => {
      if (order.scheduled_at && order.actual_delivery) {
        const scheduled = new Date(order.scheduled_at).getTime();
        const actual = new Date(order.actual_delivery).getTime();
        const diffMinutes = Math.round((actual - scheduled) / (1000 * 60));
        totalMinutes += Math.max(0, diffMinutes);

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
    totalOrders: ordersResult.status === 'fulfilled' ? (ordersResult.value.count ?? 0) : null,
    activeDeliveries: activeDeliveriesResult.status === 'fulfilled' ? (activeDeliveriesResult.value.count ?? 0) : null,
    completedToday: completedTodayResult.status === 'fulfilled' ? (completedTodayResult.value.count ?? 0) : null,
    pendingApprovals: pendingApprovalsResult.status === 'fulfilled' ? (pendingApprovalsResult.value.count ?? 0) : null,
    alertsCount: alertsResult.status === 'fulfilled' ? (alertsResult.value.count ?? 0) : null,
    avgDeliveryTime,
    onTimeRate,
    activeDrivers: activeDriversResult.status === 'fulfilled' ? (activeDriversResult.value.count ?? 0) : null,
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
