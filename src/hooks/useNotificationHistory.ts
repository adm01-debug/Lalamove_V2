import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationSent {
  id: string;
  alert_id: string;
  channel: string;
  recipient: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  retry_count: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  alert?: {
    id: string;
    title: string;
    type: string;
    severity: string;
    message: string;
  };
}

interface NotificationFilters {
  channel?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

async function fetchNotificationHistory(filters: NotificationFilters): Promise<NotificationSent[]> {
  let query = supabase
    .from('alerts_sent')
    .select(`
      *,
      alert:alerts(id, title, type, severity, message)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters.channel && filters.channel !== 'ALL') {
    query = query.eq('channel', filters.channel);
  }

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as NotificationSent[];
}

async function fetchNotificationStats() {
  const { data, error } = await supabase
    .from('alerts_sent')
    .select('channel, status');

  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    sent: data?.filter(d => d.status === 'sent').length || 0,
    delivered: data?.filter(d => d.status === 'delivered').length || 0,
    failed: data?.filter(d => d.status === 'failed').length || 0,
    pending: data?.filter(d => d.status === 'pending').length || 0,
    byChannel: {} as Record<string, number>,
  };

  data?.forEach(d => {
    stats.byChannel[d.channel] = (stats.byChannel[d.channel] || 0) + 1;
  });

  return stats;
}

export function useNotificationHistory(filters: NotificationFilters) {
  return useQuery({
    queryKey: ['notification-history', filters],
    queryFn: () => fetchNotificationHistory(filters),
    refetchInterval: 30000,
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: ['notification-stats'],
    queryFn: fetchNotificationStats,
    refetchInterval: 60000,
  });
}
