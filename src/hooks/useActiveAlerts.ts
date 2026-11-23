import { logger } from '@/utils/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Alert, AlertType } from '@/types';
import { toast } from 'sonner';
import { useAlertsRealtime } from './useRealtimeSubscriptions';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type AlertRow = Database['public']['Tables']['alerts']['Row'];
type AlertSeverity = Database['public']['Enums']['alert_severity'];
type AlertTypeEnum = Database['public']['Enums']['alert_type'];

async function fetchActiveAlerts(): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    logger.error('Error fetching alerts:', error);
    throw error;
  }

  return (data || []).map((alert: AlertRow): Alert => ({
    id: alert.id,
    type: alert.type as AlertType,
    severity: alert.severity as Alert['severity'],
    title: alert.title,
    message: alert.message,
    orderId: alert.order_id ?? undefined,
    driverId: alert.driver_id ?? undefined,
    isRead: alert.is_read ?? false,
    createdAt: new Date(alert.created_at),
    acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at) : undefined,
  }));
}

export function useActiveAlerts() {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);

  // Use centralized realtime subscription
  useAlertsRealtime(isAuthenticated);

  const query = useQuery({
    queryKey: ['active-alerts'],
    queryFn: fetchActiveAlerts,
    enabled: isAuthenticated,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  });

  return query;
}

export function useAlertActions() {
  const queryClient = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ is_dismissed: true })
        .eq('id', alertId);

      if (error) throw error;
    },
    onMutate: async (alertId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['active-alerts'] });
      const previousAlerts = queryClient.getQueryData<Alert[]>(['active-alerts']);
      
      queryClient.setQueryData<Alert[]>(['active-alerts'], (old = []) => {
        return old.filter(a => a.id !== alertId);
      });

      return { previousAlerts };
    },
    onError: (error, alertId, context) => {
      // Rollback on error
      if (context?.previousAlerts) {
        queryClient.setQueryData(['active-alerts'], context.previousAlerts);
      }
      logger.error('Error dismissing alert:', error);
      toast.error('Falha ao dispensar alerta.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
    },
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: ['active-alerts'] });
      const previousAlerts = queryClient.getQueryData<Alert[]>(['active-alerts']);
      
      queryClient.setQueryData<Alert[]>(['active-alerts'], (old = []) => {
        return old.map(a => a.id === alertId ? { ...a, isRead: true } : a);
      });

      return { previousAlerts };
    },
    onError: (_error, _alertId, context) => {
      if (context?.previousAlerts) {
        queryClient.setQueryData(['active-alerts'], context.previousAlerts);
      }
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('is_dismissed', false)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
      toast.success('Todos os alertas marcados como lidos.');
    },
    onError: (error) => {
      logger.error('Error marking all as read:', error);
      toast.error('Falha ao marcar alertas como lidos.');
    },
  });

  // Acknowledge an alert — stops the automatic escalation worker from
  // re-notifying and records who acknowledged it (via RPC acknowledge_alert).
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase.rpc('acknowledge_alert', {
        p_alert_id: alertId,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (alreadyAcknowledged) => {
      queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
      if (alreadyAcknowledged === false) {
        toast.info('Este alerta já havia sido reconhecido.');
        return;
      }
      toast.success('Alerta reconhecido. Escalonamento cancelado.');
    },
    onError: (error) => {
      logger.error('Error acknowledging alert:', error);
      toast.error('Falha ao reconhecer alerta.');
    },
  });

  return { dismissMutation, markAsReadMutation, markAllAsReadMutation, acknowledgeMutation };
}

