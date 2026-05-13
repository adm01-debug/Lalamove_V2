import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeliveryMetrics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  completionRate: number;
  cancellationRate: number;
  avgDeliveryTimeMinutes: number;
  todayOrders: number;
  todayCompleted: number;
  todayCancelled: number;
  byStatus: Record<string, number>;
  byVehicleType: Record<string, number>;
}

export interface DriverDeliveryStats {
  driverId: string;
  driverName: string;
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  completionRate: number;
  avgDeliveryTimeMinutes: number;
  rating: number;
  riskLevel: string;
}

export interface DeliveryTrend {
  date: string;
  completed: number;
  cancelled: number;
  total: number;
}

async function fetchDeliveryMetrics(): Promise<DeliveryMetrics> {
  const { data: orders, error } = await supabase
    .from('lalamove_orders')
    .select('status, vehicle_type, scheduled_at, actual_delivery, estimated_delivery, created_at');

  if (error) throw error;

  const byStatus: Record<string, number> = {};
  const byVehicleType: Record<string, number> = {};
  let completedCount = 0;
  let cancelledCount = 0;
  let pendingCount = 0;
  let totalDeliveryTime = 0;
  let deliveriesWithTime = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let todayOrders = 0;
  let todayCompleted = 0;
  let todayCancelled = 0;

  for (const order of (orders || [])) {
    // Status count
    byStatus[order.status] = (byStatus[order.status] || 0) + 1;
    
    // Vehicle type count
    byVehicleType[order.vehicle_type] = (byVehicleType[order.vehicle_type] || 0) + 1;
    
    // Status categories
    if (order.status === 'COMPLETED') {
      completedCount++;
      
      // Calculate delivery time if we have actual and scheduled times
      if (order.actual_delivery && order.scheduled_at) {
        const actualTime = new Date(order.actual_delivery).getTime();
        const scheduledTime = new Date(order.scheduled_at).getTime();
        const deliveryTime = (actualTime - scheduledTime) / 60000; // minutes
        if (deliveryTime > 0 && deliveryTime < 1440) { // Less than 24 hours
          totalDeliveryTime += deliveryTime;
          deliveriesWithTime++;
        }
      }
    } else if (order.status === 'CANCELLED' || order.status === 'REJECTED') {
      cancelledCount++;
    } else if (['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP'].includes(order.status)) {
      pendingCount++;
    }
    
    // Today's orders
    if (order.created_at && new Date(order.created_at) >= today) {
      todayOrders++;
      if (order.status === 'COMPLETED') todayCompleted++;
      if (order.status === 'CANCELLED' || order.status === 'REJECTED') todayCancelled++;
    }
  }

  const total = orders?.length || 0;
  const completionRate = total > 0 ? (completedCount / total) * 100 : 0;
  const cancellationRate = total > 0 ? (cancelledCount / total) * 100 : 0;
  const avgDeliveryTimeMinutes = deliveriesWithTime > 0 ? totalDeliveryTime / deliveriesWithTime : 0;

  return {
    totalOrders: total,
    completedOrders: completedCount,
    cancelledOrders: cancelledCount,
    pendingOrders: pendingCount,
    completionRate,
    cancellationRate,
    avgDeliveryTimeMinutes,
    todayOrders,
    todayCompleted,
    todayCancelled,
    byStatus,
    byVehicleType,
  };
}

async function fetchDriverDeliveryStats(): Promise<DriverDeliveryStats[]> {
  // Fetch drivers with their delivery stats
  const { data: drivers, error: driversError } = await supabase
    .from('drivers')
    .select('id, name, rating, risk_level, completed_deliveries, total_deliveries');

  if (driversError) throw driversError;

  // Fetch orders grouped by driver
  const { data: orders, error: ordersError } = await supabase
    .from('lalamove_orders')
    .select('driver_id, status, scheduled_at, actual_delivery');

  if (ordersError) throw ordersError;

  // Group orders by driver
  const ordersByDriver: Record<string, typeof orders> = {};
  for (const order of (orders || [])) {
    if (order.driver_id) {
      if (!ordersByDriver[order.driver_id]) {
        ordersByDriver[order.driver_id] = [];
      }
      ordersByDriver[order.driver_id].push(order);
    }
  }

  // Calculate stats for each driver
  const stats: DriverDeliveryStats[] = [];
  
  for (const driver of (drivers || [])) {
    const driverOrders = ordersByDriver[driver.id] || [];
    let completedDeliveries = 0;
    let cancelledDeliveries = 0;
    let totalDeliveryTime = 0;
    let deliveriesWithTime = 0;

    for (const order of driverOrders) {
      if (order.status === 'COMPLETED') {
        completedDeliveries++;
        if (order.actual_delivery && order.scheduled_at) {
          const actualTime = new Date(order.actual_delivery).getTime();
          const scheduledTime = new Date(order.scheduled_at).getTime();
          const deliveryTime = (actualTime - scheduledTime) / 60000;
          if (deliveryTime > 0 && deliveryTime < 1440) {
            totalDeliveryTime += deliveryTime;
            deliveriesWithTime++;
          }
        }
      } else if (order.status === 'CANCELLED' || order.status === 'REJECTED') {
        cancelledDeliveries++;
      }
    }

    const totalDeliveries = driverOrders.length;
    const completionRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const avgDeliveryTimeMinutes = deliveriesWithTime > 0 ? totalDeliveryTime / deliveriesWithTime : 0;

    if (totalDeliveries > 0) {
      stats.push({
        driverId: driver.id,
        driverName: driver.name,
        totalDeliveries,
        completedDeliveries,
        cancelledDeliveries,
        completionRate,
        avgDeliveryTimeMinutes,
        rating: driver.rating || 0,
        riskLevel: driver.risk_level || 'MEDIUM',
      });
    }
  }

  // Sort by total deliveries descending
  return stats.sort((a, b) => b.totalDeliveries - a.totalDeliveries);
}

async function fetchDeliveryTrends(days: number = 7): Promise<DeliveryTrend[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const { data: orders, error } = await supabase
    .from('lalamove_orders')
    .select('status, created_at')
    .gte('created_at', startDate.toISOString());

  if (error) throw error;

  // Group by date
  const byDate: Record<string, { completed: number; cancelled: number; total: number }> = {};
  
  // Initialize all dates
  for (let i = 0; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    const dateStr = date.toISOString().split('T')[0];
    byDate[dateStr] = { completed: 0, cancelled: 0, total: 0 };
  }

  for (const order of (orders || [])) {
    if (order.created_at) {
      const dateStr = order.created_at.split('T')[0];
      if (byDate[dateStr]) {
        byDate[dateStr].total++;
        if (order.status === 'COMPLETED') {
          byDate[dateStr].completed++;
        } else if (order.status === 'CANCELLED' || order.status === 'REJECTED') {
          byDate[dateStr].cancelled++;
        }
      }
    }
  }

  return Object.entries(byDate)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function useDeliveryMetrics() {
  return useQuery({
    queryKey: ['metrics', 'deliveries'],
    queryFn: fetchDeliveryMetrics,
    staleTime: 60000,
  });
}

export function useDriverDeliveryStats() {
  return useQuery({
    queryKey: ['metrics', 'driver-deliveries'],
    queryFn: fetchDriverDeliveryStats,
    staleTime: 60000,
  });
}

export function useDeliveryTrends(days: number = 7) {
  return useQuery({
    queryKey: ['metrics', 'delivery-trends', days],
    queryFn: () => fetchDeliveryTrends(days),
    staleTime: 60000,
  });
}
