import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

interface DailyChartData {
  date: string;
  dateRaw: string;
  pedidos: number;
  entregas: number;
  aprovacoes: number;
  alertas: number;
}

export interface AnalyticsData {
  chartData: DailyChartData[];
  pieData: { name: string; value: number; color: string }[];
  performanceData: { metric: string; value: string; change: number; trend: 'up' | 'down' }[];
  driverRanking: { name: string; entregas: number; rating: number; taxa: number }[];
  totals: { pedidos: number; entregas: number; aprovacoes: number; alertas: number };
}

async function fetchAnalyticsData(days: number): Promise<AnalyticsData> {
  const startDate = startOfDay(subDays(new Date(), days - 1)).toISOString();
  const endDate = endOfDay(new Date()).toISOString();
  const prevStartDate = startOfDay(subDays(new Date(), (days * 2) - 1)).toISOString();
  const prevEndDate = startOfDay(subDays(new Date(), days)).toISOString();

  const [ordersRes, driversRes, approvalsRes, alertsRes, prevOrdersRes, prevApprovalsRes, prevAlertsRes] = await Promise.all([
    supabase.from('lalamove_orders').select('id, status, created_at, actual_delivery, scheduled_at, driver_id').gte('created_at', startDate).lte('created_at', endDate),
    supabase.from('drivers').select('id, name, completed_deliveries, rating, success_rate, total_deliveries').order('completed_deliveries', { ascending: false }).limit(10),
    supabase.from('driver_approval_queue').select('id, status, requested_at').gte('requested_at', startDate).lte('requested_at', endDate),
    supabase.from('alerts').select('id, severity, created_at').gte('created_at', startDate).lte('created_at', endDate),
    supabase.from('lalamove_orders').select('id, status').gte('created_at', prevStartDate).lte('created_at', prevEndDate),
    supabase.from('driver_approval_queue').select('id').gte('requested_at', prevStartDate).lte('requested_at', prevEndDate),
    supabase.from('alerts').select('id').gte('created_at', prevStartDate).lte('created_at', prevEndDate),
  ]);

  const orders = ordersRes.data || [];
  const drivers = driversRes.data || [];
  const approvals = approvalsRes.data || [];
  const alerts = alertsRes.data || [];
  const prevOrders = prevOrdersRes.data || [];

  const dateRange = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() });
  const chartData: DailyChartData[] = dateRange.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOrders = orders.filter(o => o.created_at?.startsWith(dateStr));
    const dayApprovals = approvals.filter(a => a.requested_at?.startsWith(dateStr));
    const dayAlerts = alerts.filter(a => a.created_at?.startsWith(dateStr));
    return { date: format(date, 'dd/MM'), dateRaw: dateStr, pedidos: dayOrders.length, entregas: dayOrders.filter(o => o.status === 'COMPLETED').length, aprovacoes: dayApprovals.length, alertas: dayAlerts.length };
  });

  const completed = orders.filter(o => o.status === 'COMPLETED').length;
  const ongoing = orders.filter(o => ['ON_GOING', 'PICKED_UP', 'MATCHED'].includes(o.status)).length;
  const cancelled = orders.filter(o => ['CANCELLED', 'REJECTED'].includes(o.status)).length;
  const pending = orders.filter(o => o.status === 'PENDING').length;

  const pieData = [
    { name: 'Concluídas', value: completed, color: 'hsl(var(--success))' },
    { name: 'Em andamento', value: ongoing, color: 'hsl(var(--primary))' },
    { name: 'Canceladas', value: cancelled, color: 'hsl(var(--destructive))' },
    { name: 'Pendentes', value: pending, color: 'hsl(var(--warning))' },
  ].filter(d => d.value > 0);

  const calcChange = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const prevCompleted = prevOrders.filter(o => o.status === 'COMPLETED');

  const avgDeliveryMins = completedOrders.length > 0 ?
    Math.round(completedOrders.reduce((sum, o) => {
      if (o.actual_delivery && o.scheduled_at) return sum + Math.abs(new Date(o.actual_delivery).getTime() - new Date(o.scheduled_at).getTime()) / 60000;
      return sum;
    }, 0) / completedOrders.length) : 0;

  const successRate = orders.length > 0 ? ((completedOrders.length / orders.length) * 100).toFixed(1) : '0';
  const prevSuccessRate = prevOrders.length > 0 ? ((prevCompleted.length / prevOrders.length) * 100) : 0;

  const performanceData = [
    { metric: 'Tempo médio de entrega', value: `${avgDeliveryMins}min`, change: avgDeliveryMins > 0 ? -5 : 0, trend: 'down' as const },
    { metric: 'Taxa de sucesso', value: `${successRate}%`, change: calcChange(parseFloat(successRate), prevSuccessRate), trend: parseFloat(successRate) >= prevSuccessRate ? 'up' as const : 'down' as const },
    { metric: 'Total de motoristas', value: `${drivers.length}`, change: 0, trend: 'up' as const },
    { metric: 'Aprovações no período', value: `${approvals.length}`, change: calcChange(approvals.length, (prevApprovalsRes.data || []).length), trend: approvals.length >= (prevApprovalsRes.data || []).length ? 'up' as const : 'down' as const },
  ];

  return {
    chartData,
    pieData,
    performanceData,
    driverRanking: drivers.slice(0, 5).map(d => ({ name: d.name, entregas: d.completed_deliveries || 0, rating: Number(d.rating) || 0, taxa: Number(d.success_rate) || 0 })),
    totals: { pedidos: orders.length, entregas: completedOrders.length, aprovacoes: approvals.length, alertas: alerts.length },
  };
}

export function useAnalyticsData(days: number) {
  return useQuery({
    queryKey: ['analytics-dashboard', String(days)],
    queryFn: () => fetchAnalyticsData(days),
    staleTime: 30000,
  });
}
