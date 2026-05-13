import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface DriverStatsCached {
  id: string;
  name: string;
  phone: string;
  total_deliveries: number;
  completed_deliveries: number;
  cancelled_deliveries: number;
  avg_rating: number | null;
  total_revenue: number;
  last_delivery_at: string | null;
  cached_at: string;
}

export interface DeliveryMetricsCached {
  date: string;
  total_orders: number;
  completed_orders: number;
  in_progress_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  avg_value: number;
  total_value: number;
  avg_delivery_time_minutes: number | null;
  cached_at: string;
}

export interface HourlyMetricsCached {
  hour: string;
  total_orders: number;
  completed_orders: number;
  avg_value: number;
  cached_at: string;
}

export interface TopDriver {
  id: string;
  name: string;
  metric_value: number;
}

// ============================================================================
// MAIN HOOK - Stats Cacheados
// ============================================================================

/**
 * Hook principal para stats cacheados
 * Usa dados das materialized views para performance máxima
 * 
 * @example
 * const { data: stats } = useCachedStats();
 * logger.log(stats.driverStats, stats.deliveryMetrics);
 */
export function useCachedStats() {
  // Driver stats
  const { data: driverStats, isLoading: loadingDrivers } = useDriverStatsCache();
  
  // Delivery metrics (last 30 days)
  const { data: deliveryMetrics, isLoading: loadingMetrics } = useDeliveryMetricsCache(30);
  
  // Hourly metrics (last 24 hours)
  const { data: hourlyMetrics, isLoading: loadingHourly } = useHourlyMetricsCache(24);

  return {
    data: {
      driverStats: driverStats || [],
      deliveryMetrics: deliveryMetrics || [],
      hourlyMetrics: hourlyMetrics || [],
    },
    isLoading: loadingDrivers || loadingMetrics || loadingHourly,
  };
}

// ============================================================================
// GRANULAR HOOKS - Dados Específicos
// ============================================================================

/**
 * Hook para estatísticas de motoristas (cacheado)
 * Dados atualizados a cada hora via materialized view
 */
export function useDriverStatsCache() {
  return useQuery({
    queryKey: ['driver-stats-cache'],
    queryFn: async (): Promise<DriverStatsCached[]> => {
      // Fetch from drivers table as fallback since RPC doesn't exist
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, phone, total_deliveries, completed_deliveries, cancelled_deliveries, rating, last_delivery_at')
        .order('total_deliveries', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Error fetching driver stats:', error);
        throw error;
      }
      
      return (data || []).map(d => ({
        id: d.id,
        name: d.name,
        phone: d.phone || '',
        total_deliveries: d.total_deliveries || 0,
        completed_deliveries: d.completed_deliveries || 0,
        cancelled_deliveries: d.cancelled_deliveries || 0,
        avg_rating: d.rating,
        total_revenue: 0,
        last_delivery_at: d.last_delivery_at,
        cached_at: new Date().toISOString(),
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos no client
    refetchInterval: 10 * 60 * 1000, // Refetch a cada 10 minutos
  });
}

/**
 * Hook para métricas de entregas por dia (cacheado)
 * 
 * @param daysBack - Quantos dias voltar (padrão: 30)
 */
export function useDeliveryMetricsCache(daysBack: number = 30) {
  return useQuery({
    queryKey: ['delivery-metrics-cache', daysBack],
    queryFn: async (): Promise<DeliveryMetricsCached[]> => {
      // Calculate metrics from orders table
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      const { data, error } = await supabase
        .from('lalamove_orders')
        .select('created_at, status, total_cost')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching delivery metrics:', error);
        throw error;
      }
      
      // Group by date
      const metricsByDate = new Map<string, DeliveryMetricsCached>();
      
      (data || []).forEach(order => {
        const date = order.created_at.split('T')[0];
        const existing = metricsByDate.get(date) || {
          date,
          total_orders: 0,
          completed_orders: 0,
          in_progress_orders: 0,
          pending_orders: 0,
          cancelled_orders: 0,
          avg_value: 0,
          total_value: 0,
          avg_delivery_time_minutes: null,
          cached_at: new Date().toISOString(),
        };
        
        existing.total_orders++;
        existing.total_value += order.total_cost || 0;
        
        if (order.status === 'COMPLETED') existing.completed_orders++;
        if (order.status === 'ON_GOING' || order.status === 'PICKED_UP') existing.in_progress_orders++;
        if (order.status === 'PENDING' || order.status === 'MATCHED') existing.pending_orders++;
        if (order.status === 'CANCELLED') existing.cancelled_orders++;
        
        metricsByDate.set(date, existing);
      });
      
      // Calculate averages
      const metrics = Array.from(metricsByDate.values()).map(m => ({
        ...m,
        avg_value: m.total_orders > 0 ? m.total_value / m.total_orders : 0,
      }));
      
      return metrics.sort((a, b) => b.date.localeCompare(a.date));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

/**
 * Hook para métricas por hora (cacheado)
 * 
 * @param hoursBack - Quantas horas voltar (padrão: 24)
 */
export function useHourlyMetricsCache(hoursBack: number = 24) {
  return useQuery({
    queryKey: ['hourly-metrics-cache', hoursBack],
    queryFn: async (): Promise<HourlyMetricsCached[]> => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hoursBack);
      
      const { data, error } = await supabase
        .from('lalamove_orders')
        .select('created_at, status, total_cost')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching hourly metrics:', error);
        throw error;
      }
      
      // Group by hour
      const metricsByHour = new Map<string, HourlyMetricsCached>();
      
      (data || []).forEach(order => {
        const date = new Date(order.created_at);
        const hour = `${date.toISOString().split('T')[0]}T${String(date.getHours()).padStart(2, '0')}:00:00`;
        
        const existing = metricsByHour.get(hour) || {
          hour,
          total_orders: 0,
          completed_orders: 0,
          avg_value: 0,
          cached_at: new Date().toISOString(),
        };
        
        existing.total_orders++;
        if (order.status === 'COMPLETED') existing.completed_orders++;
        existing.avg_value = (existing.avg_value * (existing.total_orders - 1) + (order.total_cost || 0)) / existing.total_orders;
        
        metricsByHour.set(hour, existing);
      });
      
      return Array.from(metricsByHour.values()).sort((a, b) => b.hour.localeCompare(a.hour));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

/**
 * Hook para top drivers por métrica específica
 * 
 * @param metric - Métrica para ranquear (total_deliveries, avg_rating, total_revenue)
 * @param limit - Quantidade de drivers (padrão: 10)
 */
export function useTopDrivers(
  metric: 'total_deliveries' | 'avg_rating' | 'total_revenue' = 'total_deliveries',
  limit: number = 10
) {
  return useQuery({
    queryKey: ['top-drivers', metric, limit],
    queryFn: async (): Promise<TopDriver[]> => {
      const columnMap = {
        total_deliveries: 'total_deliveries',
        avg_rating: 'rating',
        total_revenue: 'total_deliveries', // Fallback since we don't have revenue
      };
      
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, total_deliveries, rating')
        .order(columnMap[metric], { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error fetching top drivers:', error);
        throw error;
      }
      
      return (data || []).map(d => ({
        id: d.id,
        name: d.name,
        metric_value: metric === 'avg_rating' ? (d.rating || 0) : (d.total_deliveries || 0),
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

// ============================================================================
// UTILITY HOOKS - Dados Derivados
// ============================================================================

/**
 * Hook para métricas agregadas do dashboard
 * Calcula totais e médias a partir dos dados cacheados
 */
export function useDashboardSummary() {
  const { data } = useCachedStats();
  
  const summary = {
    // Driver metrics
    totalDrivers: data.driverStats.length,
    activeDrivers: data.driverStats.filter(d => d.last_delivery_at).length,
    avgDriverRating: data.driverStats.reduce((acc, d) => acc + (d.avg_rating || 0), 0) / data.driverStats.length || 0,
    
    // Delivery metrics (last 7 days)
    last7Days: data.deliveryMetrics.slice(0, 7),
    totalOrders: data.deliveryMetrics.slice(0, 7).reduce((acc, m) => acc + m.total_orders, 0),
    completedOrders: data.deliveryMetrics.slice(0, 7).reduce((acc, m) => acc + m.completed_orders, 0),
    totalRevenue: data.deliveryMetrics.slice(0, 7).reduce((acc, m) => acc + m.total_value, 0),
    
    // Hourly trends (last 24h)
    last24Hours: data.hourlyMetrics,
    peakHour: data.hourlyMetrics.reduce((max, m) => m.total_orders > (max?.total_orders || 0) ? m : max, data.hourlyMetrics[0]),
  };
  
  return summary;
}

/**
 * Hook para comparação período anterior
 * Útil para mostrar variação % no dashboard
 */
export function useMetricsComparison(daysBack: number = 7) {
  const { data: metrics } = useDeliveryMetricsCache(daysBack * 2);
  
  if (!metrics || metrics.length === 0) {
    return { current: null, previous: null, change: null };
  }
  
  const current = metrics.slice(0, daysBack);
  const previous = metrics.slice(daysBack, daysBack * 2);
  
  const currentTotal = current.reduce((acc, m) => acc + m.total_orders, 0);
  const previousTotal = previous.reduce((acc, m) => acc + m.total_orders, 0);
  
  const change = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : 0;
  
  return {
    current: currentTotal,
    previous: previousTotal,
    change: Math.round(change * 10) / 10, // Round to 1 decimal
  };
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Formata valor monetário
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata rating (0-5 estrelas)
 */
export function formatRating(rating: number | null): string {
  if (rating === null) return 'N/A';
  return `${rating.toFixed(1)} ⭐`;
}

/**
 * Formata duração em minutos
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'N/A';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}
