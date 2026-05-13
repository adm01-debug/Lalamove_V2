import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, differenceInMinutes } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/utils/logger';

export interface DeliveryStats {
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  totalDrivers: number;
  activeDrivers: number;
}

export interface DriverPerformance {
  id: string;
  name: string;
  completedDeliveries: number;
  avgTime: number;
  rating: number;
  onTimeRate: number;
  incidents: number;
}

export interface DailyStats {
  date: string;
  deliveries: number;
  completed: number;
  cancelled: number;
  avgTime: number;
}

export interface VehicleDistribution {
  type: string;
  count: number;
  percentage: number;
}

export function useReportData(period: string) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [driverPerformance, setDriverPerformance] = useState<DriverPerformance[]>([]);
  const [vehicleDistribution, setVehicleDistribution] = useState<VehicleDistribution[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<{ status: string; count: number }[]>([]);

  const getVehicleLabel = (type: string) => {
    const labels: Record<string, string> = { MOTORCYCLE: 'Moto', CAR: 'Carro', VAN: 'Van', TRUCK: 'Caminhão' };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Pendente', MATCHED: 'Atribuído', ON_GOING: 'Em andamento',
      PICKED_UP: 'Coletado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
      REJECTED: 'Rejeitado', EXPIRED: 'Expirado',
    };
    return labels[status] || status;
  };

  const fetchReportData = async () => {
    setRefreshing(true);
    const days = parseInt(period);
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    try {
      const { data: orders, error: ordersError } = await supabase
        .from('lalamove_orders')
        .select('*, driver:drivers(name, rating)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });
      if (ordersError) throw ordersError;

      const { data: drivers, error: driversError } = await supabase.from('drivers').select('*');
      if (driversError) throw driversError;

      const { data: incidents, error: incidentsError } = await supabase
        .from('driver_incidents').select('driver_id').gte('created_at', startDate.toISOString());
      if (incidentsError) throw incidentsError;

      const completedOrders = orders?.filter(o => o.status === 'COMPLETED') || [];
      const cancelledOrders = orders?.filter(o => o.status === 'CANCELLED') || [];

      let totalDeliveryTime = 0;
      let deliveriesWithTime = 0;
      completedOrders.forEach(order => {
        if (order.actual_delivery && order.scheduled_at) {
          const time = differenceInMinutes(new Date(order.actual_delivery), new Date(order.scheduled_at));
          if (time > 0 && time < 480) { totalDeliveryTime += time; deliveriesWithTime++; }
        }
      });

      let onTimeCount = 0;
      completedOrders.forEach(order => {
        if (order.actual_delivery && order.estimated_delivery && new Date(order.actual_delivery) <= new Date(order.estimated_delivery)) onTimeCount++;
      });

      const activeDriverIds = new Set(orders?.map(o => o.driver_id).filter(Boolean));

      setStats({
        totalDeliveries: orders?.length || 0,
        completedDeliveries: completedOrders.length,
        cancelledDeliveries: cancelledOrders.length,
        avgDeliveryTime: deliveriesWithTime > 0 ? Math.round(totalDeliveryTime / deliveriesWithTime) : 0,
        onTimeRate: completedOrders.length > 0 ? Math.round((onTimeCount / completedOrders.length) * 100) : 0,
        totalDrivers: drivers?.length || 0,
        activeDrivers: activeDriverIds.size,
      });

      // Daily stats
      const dailyMap = new Map<string, DailyStats>();
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        dailyMap.set(date, { date: format(subDays(new Date(), i), 'dd/MM', { locale: ptBR }), deliveries: 0, completed: 0, cancelled: 0, avgTime: 0 });
      }
      orders?.forEach(order => {
        const date = format(new Date(order.created_at), 'yyyy-MM-dd');
        if (dailyMap.has(date)) {
          const day = dailyMap.get(date)!;
          day.deliveries++;
          if (order.status === 'COMPLETED') day.completed++;
          if (order.status === 'CANCELLED') day.cancelled++;
        }
      });
      setDailyStats(Array.from(dailyMap.values()).reverse());

      // Vehicle distribution
      const vehicleMap = new Map<string, number>();
      orders?.forEach(order => { const type = order.vehicle_type || 'MOTORCYCLE'; vehicleMap.set(type, (vehicleMap.get(type) || 0) + 1); });
      const totalVehicles = orders?.length || 1;
      setVehicleDistribution(Array.from(vehicleMap.entries()).map(([type, count]) => ({
        type: getVehicleLabel(type), count, percentage: Math.round((count / totalVehicles) * 100),
      })));

      // Status distribution
      const statusMap = new Map<string, number>();
      orders?.forEach(order => { statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1); });
      setStatusDistribution(Array.from(statusMap.entries()).map(([status, count]) => ({ status: getStatusLabel(status), count })));

      // Driver performance
      const driverStats = new Map<string, { name: string; completed: number; totalTime: number; timeCount: number; rating: number; onTime: number; total: number }>();
      orders?.forEach(order => {
        if (!order.driver_id) return;
        const current = driverStats.get(order.driver_id) || { name: order.driver?.name || 'Desconhecido', completed: 0, totalTime: 0, timeCount: 0, rating: order.driver?.rating || 5, onTime: 0, total: 0 };
        current.total++;
        if (order.status === 'COMPLETED') {
          current.completed++;
          if (order.actual_delivery && order.scheduled_at) {
            const time = differenceInMinutes(new Date(order.actual_delivery), new Date(order.scheduled_at));
            if (time > 0 && time < 480) { current.totalTime += time; current.timeCount++; }
          }
          if (order.actual_delivery && order.estimated_delivery && new Date(order.actual_delivery) <= new Date(order.estimated_delivery)) current.onTime++;
        }
        driverStats.set(order.driver_id, current);
      });

      const incidentCount = new Map<string, number>();
      incidents?.forEach(inc => { incidentCount.set(inc.driver_id, (incidentCount.get(inc.driver_id) || 0) + 1); });

      setDriverPerformance(
        Array.from(driverStats.entries())
          .map(([id, data]) => ({
            id, name: data.name, completedDeliveries: data.completed,
            avgTime: data.timeCount > 0 ? Math.round(data.totalTime / data.timeCount) : 0,
            rating: data.rating,
            onTimeRate: data.completed > 0 ? Math.round((data.onTime / data.completed) * 100) : 0,
            incidents: incidentCount.get(id) || 0,
          }))
          .sort((a, b) => b.completedDeliveries - a.completedDeliveries)
          .slice(0, 10)
      );
    } catch (error) {
      logger.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchReportData(); }, [period]);

  return { loading, refreshing, stats, dailyStats, driverPerformance, vehicleDistribution, statusDistribution, fetchReportData };
}
