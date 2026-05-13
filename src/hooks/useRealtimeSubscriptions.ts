/**
 * Centralized Realtime Subscriptions Manager
 * 
 * This hook consolidates all Supabase Realtime subscriptions into a single
 * manageable system, preventing duplicate channels and optimizing performance.
 */

import { logger } from '@/utils/logger';
import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Alert, ApprovalPriority } from '@/types';
import { toast } from 'sonner';
import { playAlertSound, enableAudioOnInteraction } from '@/utils/alertSounds';
import { showNotification, showCriticalAlertNotification, getNotificationPermission, getPushSettings } from '@/hooks/usePushNotifications';
import { isInQuietHours, isTypeEnabled } from '@/components/notifications/NotificationPreferences';


type TableName = 'alerts' | 'driver_approval_queue' | 'driver_incidents' | 'lalamove_orders' | 'active_tracking';
type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionCallback {
  table: TableName;
  event: EventType;
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

// No singleton logic here currently used

/**
 * Core Realtime Manager Hook
 * Manages a single consolidated channel for all table subscriptions
 */
export function useRealtimeManager() {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribersRef = useRef<Map<string, SubscriptionCallback[]>>(new Map());

  const subscribe = useCallback((
    table: TableName,
    event: EventType,
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  ) => {
    const key = `${table}-${event}`;
    const existing = subscribersRef.current.get(key) || [];
    subscribersRef.current.set(key, [...existing, { table, event, callback }]);
    
    return () => {
      const callbacks = subscribersRef.current.get(key) || [];
      subscribersRef.current.set(key, callbacks.filter(c => c.callback !== callback));
    };
  }, []);

  useEffect(() => {
    enableAudioOnInteraction();

    if (import.meta.env.DEV) logger.log('[RealtimeManager] Initializing consolidated channel...');

    const channel = supabase
      .channel('consolidated-realtime', {
        config: {
          broadcast: { self: true },
          presence: { key: 'user' },
        }
      })
      // Alerts table
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload) => {
          const key = `alerts-${payload.eventType}`;
          const allKey = 'alerts-*';
          
          subscribersRef.current.get(key)?.forEach(sub => sub.callback(payload));
          subscribersRef.current.get(allKey)?.forEach(sub => sub.callback(payload));
        }
      )
      // Driver approval queue
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_approval_queue' },
        (payload) => {
          const key = `driver_approval_queue-${payload.eventType}`;
          const allKey = 'driver_approval_queue-*';
          
          subscribersRef.current.get(key)?.forEach(sub => sub.callback(payload));
          subscribersRef.current.get(allKey)?.forEach(sub => sub.callback(payload));
        }
      )
      // Driver incidents
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_incidents' },
        (payload) => {
          const key = `driver_incidents-${payload.eventType}`;
          const allKey = 'driver_incidents-*';
          
          subscribersRef.current.get(key)?.forEach(sub => sub.callback(payload));
          subscribersRef.current.get(allKey)?.forEach(sub => sub.callback(payload));
        }
      )
      // Lalamove orders
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lalamove_orders' },
        (payload) => {
          const key = `lalamove_orders-${payload.eventType}`;
          const allKey = 'lalamove_orders-*';
          
          subscribersRef.current.get(key)?.forEach(sub => sub.callback(payload));
          subscribersRef.current.get(allKey)?.forEach(sub => sub.callback(payload));
        }
      )
      // Active tracking
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_tracking' },
        (payload) => {
          const key = `active_tracking-${payload.eventType}`;
          const allKey = 'active_tracking-*';
          
          subscribersRef.current.get(key)?.forEach(sub => sub.callback(payload));
          subscribersRef.current.get(allKey)?.forEach(sub => sub.callback(payload));
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) logger.log('[RealtimeManager] Channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (import.meta.env.DEV) logger.log('[RealtimeManager] Cleaning up consolidated channel');
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  return { subscribe, queryClient };
}

/**
 * Hook for Alert subscriptions with built-in notification handling
 */
export function useAlertsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (import.meta.env.DEV) logger.log('[AlertsRealtime] Setting up alerts subscription...');
    enableAudioOnInteraction();

    const channel = supabase
      .channel('alerts-consolidated')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          if (import.meta.env.DEV) logger.log('[AlertsRealtime] New alert received:', payload);
          
          const newAlert = payload.new as {
            id: string;
            type: string;
            severity: string;
            title: string;
            message: string;
            order_id?: string;
            driver_id?: string;
            is_read?: boolean;
            created_at: string;
          };

          const alert: Alert = {
            id: newAlert.id,
            type: newAlert.type as Alert['type'],
            severity: newAlert.severity as Alert['severity'],
            title: newAlert.title,
            message: newAlert.message,
            orderId: newAlert.order_id,
            driverId: newAlert.driver_id,
            isRead: newAlert.is_read ?? false,
            createdAt: new Date(newAlert.created_at),
          };

          // Update cache
          queryClient.setQueryData<Alert[]>(['active-alerts'], (old = []) => {
            if (old.some(a => a.id === alert.id)) return old;
            return [alert, ...old].slice(0, 20);
          });

          // Notification logic
          const inQuietHours = isInQuietHours();
          const typeEnabled = isTypeEnabled('critical_alert');
          const pushSettings = getPushSettings();
          const hasPermission = getNotificationPermission() === 'granted';

          const icon = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'WARNING' ? '⚠️' : 'ℹ️';
          
          if (!inQuietHours || alert.severity === 'CRITICAL') {
            if (alert.severity === 'CRITICAL') {
              toast.error(`${icon} ${alert.title}`, { description: alert.message, duration: 10000 });
              playAlertSound('CRITICAL');
            } else if (alert.severity === 'WARNING') {
              toast.warning(`${icon} ${alert.title}`, { description: alert.message, duration: 7000 });
              playAlertSound('HIGH');
            } else {
              toast.info(`${icon} ${alert.title}`, { description: alert.message, duration: 5000 });
              playAlertSound('MEDIUM');
            }
          }

          if (hasPermission && pushSettings.enabled && typeEnabled) {
            if (!pushSettings.criticalOnly || alert.severity === 'CRITICAL') {
              showNotification({
                title: `${icon} ${alert.title}`,
                body: alert.message,
                tag: `alert-${alert.id}`,
                data: {
                  type: 'alert',
                  alertId: alert.id,
                  priority: alert.severity === 'CRITICAL' ? 'CRITICAL' : 
                           alert.severity === 'WARNING' ? 'URGENT' : 'MEDIUM',
                  notificationType: 'critical_alert',
                },
              });
            }
          }

          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alerts' },
        (payload) => {
          const updatedAlert = payload.new as { id: string; is_dismissed?: boolean; is_read?: boolean };

          if (updatedAlert.is_dismissed) {
            queryClient.setQueryData<Alert[]>(['active-alerts'], (old = []) => 
              old.filter(a => a.id !== updatedAlert.id)
            );
          } else {
            queryClient.setQueryData<Alert[]>(['active-alerts'], (old = []) =>
              old.map(a => a.id === updatedAlert.id ? { ...a, isRead: updatedAlert.is_read ?? a.isRead } : a)
            );
          }
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) logger.log('[AlertsRealtime] Subscription status:', status);
      });

    return () => {
      if (import.meta.env.DEV) logger.log('[AlertsRealtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Hook for Approval queue subscriptions
 */
export function useApprovalsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (import.meta.env.DEV) logger.log('[ApprovalsRealtime] Setting up approvals subscription...');
    enableAudioOnInteraction();

    const channel = supabase
      .channel('approvals-consolidated')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_approval_queue' },
        (payload) => {
          if (import.meta.env.DEV) logger.log('[ApprovalsRealtime] New approval received:', payload);
          
          const newApproval = payload.new as {
            driver_name?: string;
            risk_score: number;
            approval_priority?: string;
            order_id?: string;
          };

          const driverName = newApproval.driver_name || 'Motorista desconhecido';
          const riskScore = newApproval.risk_score;
          const priority = (newApproval.approval_priority || 'MEDIUM') as ApprovalPriority;
          const orderId = newApproval.order_id;

          const inQuietHours = isInQuietHours();
          const typeEnabled = isTypeEnabled('approval_request');
          const pushSettings = getPushSettings();
          const isCriticalOrUrgent = priority === 'CRITICAL' || priority === 'URGENT';

          if (!inQuietHours || isCriticalOrUrgent) {
            playAlertSound(priority);

            if (isCriticalOrUrgent) {
              toast.error(`🚨 Aprovação Urgente: ${driverName}`, {
                description: `Score de risco: ${riskScore} | Prioridade: ${priority}`,
                duration: 10000,
              });
            } else if (priority === 'HIGH') {
              toast.warning(`⚠️ Nova Aprovação: ${driverName}`, {
                description: `Score de risco: ${riskScore} | Prioridade: ${priority}`,
                duration: 7000,
              });
            } else {
              toast.info(`📋 Nova Aprovação: ${driverName}`, {
                description: `Score de risco: ${riskScore} | Prioridade: ${priority}`,
                duration: 5000,
              });
            }
          }

          if (getNotificationPermission() === 'granted' && pushSettings.enabled && typeEnabled) {
            if (!pushSettings.criticalOnly || isCriticalOrUrgent) {
              showCriticalAlertNotification(priority, driverName, riskScore, orderId);
            }
          }

          queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
          queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'driver_approval_queue' },
        (payload) => {
          const updated = payload.new as { status: string };

          if (updated.status === 'APPROVED' || updated.status === 'REJECTED') {
            queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['approval-history'] });
            queryClient.invalidateQueries({ queryKey: ['approval-stats'] });
          }
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) logger.log('[ApprovalsRealtime] Subscription status:', status);
      });

    return () => {
      if (import.meta.env.DEV) logger.log('[ApprovalsRealtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Hook for Sidebar badge counts - uses query invalidation pattern
 */
export function useSidebarCountsRealtime(onUpdate: () => void) {
  useEffect(() => {
    if (import.meta.env.DEV) logger.log('[SidebarRealtime] Setting up counts subscription...');

    const channel = supabase
      .channel('sidebar-counts-consolidated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, onUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_approval_queue' }, onUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_incidents' }, onUpdate)
      .subscribe((status) => {
        if (import.meta.env.DEV) logger.log('[SidebarRealtime] Subscription status:', status);
      });

    return () => {
      if (import.meta.env.DEV) logger.log('[SidebarRealtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}

/**
 * Hook for SLA Metrics realtime updates
 */
export function useSLAMetricsRealtime(onUpdate: () => void) {
  useEffect(() => {
    if (import.meta.env.DEV) logger.log('[SLARealtime] Setting up SLA subscription...');

    const channel = supabase
      .channel('sla-metrics-consolidated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lalamove_orders' }, onUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_tracking' }, onUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, onUpdate)
      .subscribe((status) => {
        if (import.meta.env.DEV) logger.log('[SLARealtime] Subscription status:', status);
      });

    return () => {
      if (import.meta.env.DEV) logger.log('[SLARealtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}

/**
 * Hook for Live Map tracking updates
 */
export function useLiveMapRealtime(onUpdate: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  useEffect(() => {
    if (import.meta.env.DEV) logger.log('[LiveMapRealtime] Setting up tracking subscription...');

    const channel = supabase
      .channel('live-map-consolidated')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_tracking' },
        onUpdate
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) logger.log('[LiveMapRealtime] Subscription status:', status);
      });

    return () => {
      if (import.meta.env.DEV) logger.log('[LiveMapRealtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
