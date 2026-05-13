import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';


interface SecurityNotification {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export function useSecurityPushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  // Check if notifications are supported
  useEffect(() => {
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Seu navegador não suporta notificações push');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Notificações push ativadas!');
        // Send a test notification
        showNotification({
          title: '🔔 Notificações Ativadas',
          body: 'Você receberá alertas de segurança em tempo real.',
          tag: 'test-notification',
        });
        return true;
      } else if (result === 'denied') {
        toast.error('Permissão de notificação negada. Ative nas configurações do navegador.');
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Erro ao solicitar permissão de notificação');
      return false;
    }
  }, [isSupported]);

  // Show a notification
  const showNotification = useCallback((notification: SecurityNotification) => {
    if (!isSupported || permission !== 'granted') {
      if (import.meta.env.DEV) logger.log('Notifications not available or not permitted');
      return;
    }

    try {
      const notif = new Notification(notification.title, {
        body: notification.body,
        icon: notification.icon || '/favicon.ico',
        tag: notification.tag,
        badge: '/favicon.ico',
        requireInteraction: true,
        data: notification.data,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
        
        // Navigate based on notification type
        if (notification.data?.type === 'new_device') {
          window.location.href = '/security?tab=devices';
        } else if (notification.data?.type === 'blocked_ip') {
          window.location.href = '/security?tab=alerts';
        } else if (notification.data?.type === 'failed_login') {
          window.location.href = '/security?tab=sessions';
        }
      };

      // Auto-close after 10 seconds
      setTimeout(() => notif.close(), 10000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [isSupported, permission]);

  // Subscribe to realtime security events
  useEffect(() => {
    if (!user?.id || permission !== 'granted') return;

    // Listen for new device alerts
    const deviceAlertsChannel = supabase
      .channel('security-device-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'new_device_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (import.meta.env.DEV) logger.log('New device alert:', payload);
          showNotification({
            title: '🔐 Novo Dispositivo Detectado',
            body: 'Um login foi feito de um dispositivo desconhecido. Verifique se foi você.',
            tag: 'new-device-' + payload.new.id,
            data: { type: 'new_device', id: payload.new.id },
          });
        }
      )
      .subscribe();

    // Listen for blocked IPs (admin only)
    const blockedIPsChannel = supabase
      .channel('security-blocked-ips')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'blocked_ips',
        },
        (payload) => {
          if (import.meta.env.DEV) logger.log('New blocked IP:', payload);
          showNotification({
            title: '🚫 IP Bloqueado',
            body: `Um IP foi bloqueado: ${payload.new.ip_address}. Motivo: ${payload.new.reason}`,
            tag: 'blocked-ip-' + payload.new.id,
            data: { type: 'blocked_ip', id: payload.new.id },
          });
        }
      )
      .subscribe();

    // Listen for failed login attempts
    const authLogsChannel = supabase
      .channel('security-auth-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auth_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!payload.new.success) {
            if (import.meta.env.DEV) logger.log('Failed login attempt:', payload);
            showNotification({
              title: '⚠️ Tentativa de Login Falha',
              body: `Uma tentativa de login falhou para sua conta. IP: ${payload.new.ip_address}`,
              tag: 'failed-login-' + payload.new.id,
              data: { type: 'failed_login', id: payload.new.id },
            });
          }
        }
      )
      .subscribe();

    // Listen for MFA changes
    const mfaChannel = supabase
      .channel('security-mfa-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mfa_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            showNotification({
              title: '🔒 Nova Sessão MFA',
              body: 'Uma verificação MFA foi iniciada para sua conta.',
              tag: 'mfa-session-' + payload.new.id,
              data: { type: 'mfa_session', id: payload.new.id },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deviceAlertsChannel);
      supabase.removeChannel(blockedIPsChannel);
      supabase.removeChannel(authLogsChannel);
      supabase.removeChannel(mfaChannel);
    };
  }, [user?.id, permission, showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    isEnabled: permission === 'granted',
  };
}
