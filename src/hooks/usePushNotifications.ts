import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';


export type NotificationPermission = 'default' | 'granted' | 'denied';
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

const STORAGE_KEY = 'push_notification_settings';

export interface PushSettings {
  enabled: boolean;
  criticalOnly: boolean;
  showBadge: boolean;
  vibrate: boolean;
  groupByType: boolean;
}

const defaultSettings: PushSettings = {
  enabled: true,
  criticalOnly: false,
  showBadge: true,
  vibrate: true,
  groupByType: true,
};

// Get push settings from localStorage
export const getPushSettings = (): PushSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error reading push settings:', error);
  }
  return defaultSettings;
};

// Save push settings to localStorage
export const savePushSettings = (settings: PushSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('pushSettingsChanged', { detail: settings }));
  } catch (error) {
    console.error('Error saving push settings:', error);
  }
};

// Check if browser supports notifications
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window;
};

// Get current permission status
export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission as NotificationPermission;
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported in this browser');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

// Vibration patterns for different severities
const vibrationPatterns: Record<string, number[]> = {
  CRITICAL: [200, 100, 200, 100, 400],
  URGENT: [200, 100, 200],
  HIGH: [200, 100],
  MEDIUM: [150],
  LOW: [100],
};

// Show a notification with enhanced options
export const showNotification = (options: NotificationOptions): Notification | null => {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  const settings = getPushSettings();
  if (!settings.enabled) {
    logger.log('Push notifications disabled by user');
    return null;
  }

  // Check quiet hours
  try {
    const quietHours = JSON.parse(localStorage.getItem('notification_quiet_hours') || '{}');
    if (quietHours.enabled) {
      const now = new Date().getHours();
      const { startHour, endHour } = quietHours;
      const isQuiet = startHour > endHour 
        ? (now >= startHour || now < endHour)
        : (now >= startHour && now < endHour);
      
      // Only block non-critical notifications during quiet hours
      if (isQuiet && options.data?.priority !== 'CRITICAL') {
        logger.log('Notification blocked during quiet hours');
        return null;
      }
    }
  } catch {
    // Ignore quiet hours errors
  }

  // Check type preferences
  try {
    const typePrefs = JSON.parse(localStorage.getItem('notification_type_preferences') || '{}');
    const notificationType = options.data?.notificationType as string;
    if (notificationType && typePrefs[notificationType] === false) {
      logger.log(`Notification type ${notificationType} is disabled`);
      return null;
    }
  } catch {
    // Ignore type preferences errors
  }

  try {
    const priority = options.data?.priority as string;

    const notificationOptions: globalThis.NotificationOptions = {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      badge: settings.showBadge ? (options.badge || '/favicon.ico') : undefined,
      tag: options.tag,
      requireInteraction: options.requireInteraction ?? ['CRITICAL', 'URGENT'].includes(priority || ''),
      silent: options.silent ?? false,
      data: options.data,
    };

    // Vibration is only supported in some browsers
    if (settings.vibrate && priority && 'vibrate' in navigator) {
      const pattern = vibrationPatterns[priority];
      if (pattern) {
        navigator.vibrate(pattern);
      }
    }

    const notification = new Notification(options.title, notificationOptions);

    notification.onclick = () => {
      window.focus();
      notification.close();
      
      // Navigate based on notification type
      const data = options.data;
      if (data?.type === 'approval') {
        window.location.href = '/approvals';
      } else if (data?.type === 'alert') {
        window.location.href = '/alerts';
      } else if (data?.type === 'driver') {
        window.location.href = '/drivers';
      } else if (data?.type === 'order') {
        window.location.href = '/orders';
      }
    };

    // Auto-close non-critical notifications
    if (!['CRITICAL', 'URGENT'].includes(priority || '')) {
      setTimeout(() => notification.close(), 10000);
    }

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
};

// Show critical alert notification
export const showCriticalAlertNotification = (
  priority: string,
  driverName: string,
  riskScore: number,
  orderId?: string
): Notification | null => {
  const settings = getPushSettings();
  
  // If criticalOnly is enabled, only show for CRITICAL and URGENT
  if (settings.criticalOnly && !['CRITICAL', 'URGENT'].includes(priority)) {
    return null;
  }

  const priorityLabels: Record<string, string> = {
    CRITICAL: '🚨 CRÍTICO',
    URGENT: '⚠️ URGENTE',
    HIGH: '🔴 ALTO',
    MEDIUM: '🟡 MÉDIO',
    LOW: '🟢 BAIXO',
  };

  const priorityLabel = priorityLabels[priority] || priority;

  return showNotification({
    title: `${priorityLabel}: Aprovação Pendente`,
    body: `${driverName} - Risco: ${riskScore.toFixed(1)}${orderId ? `\nPedido: ${orderId.slice(0, 8)}...` : ''}`,
    tag: `approval-${orderId || Date.now()}`,
    requireInteraction: ['CRITICAL', 'URGENT'].includes(priority),
    data: {
      type: 'approval',
      priority,
      driverName,
      riskScore,
      orderId,
    },
  });
};

// React hook for push notifications
export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermission);
  const [settings, setSettings] = useState<PushSettings>(getPushSettings);
  const [isSupported] = useState(isNotificationSupported);

  useEffect(() => {
    const handleChange = (event: CustomEvent<PushSettings>) => {
      setSettings(event.detail);
    };

    window.addEventListener('pushSettingsChanged', handleChange as EventListener);
    return () => {
      window.removeEventListener('pushSettingsChanged', handleChange as EventListener);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    const newPermission = await requestNotificationPermission();
    setPermission(newPermission);
    return newPermission;
  }, []);

  const updateSettings = useCallback((newSettings: Partial<PushSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    savePushSettings(updated);
  }, [settings]);

  const toggleEnabled = useCallback(() => {
    updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  const toggleCriticalOnly = useCallback(() => {
    updateSettings({ criticalOnly: !settings.criticalOnly });
  }, [settings.criticalOnly, updateSettings]);

  const toggleVibrate = useCallback(() => {
    updateSettings({ vibrate: !settings.vibrate });
  }, [settings.vibrate, updateSettings]);

  const toggleBadge = useCallback(() => {
    updateSettings({ showBadge: !settings.showBadge });
  }, [settings.showBadge, updateSettings]);

  const sendTestNotification = useCallback(() => {
    if (permission !== 'granted') {
      console.warn('Permission not granted for test notification');
      return null;
    }

    return showNotification({
      title: '🔔 Teste de Notificação',
      body: 'As notificações push estão funcionando corretamente!',
      tag: 'test-notification',
      requireInteraction: false,
      data: {
        type: 'test',
        priority: 'MEDIUM',
      },
    });
  }, [permission]);

  // Show alert notification with severity-based styling
  const showAlertNotification = useCallback((
    severity: AlertSeverity,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ) => {
    const severityConfig = {
      CRITICAL: { emoji: '🚨', priority: 'CRITICAL' },
      WARNING: { emoji: '⚠️', priority: 'URGENT' },
      INFO: { emoji: 'ℹ️', priority: 'LOW' },
    };

    const config = severityConfig[severity];

    return showNotification({
      title: `${config.emoji} ${title}`,
      body: message,
      tag: `alert-${Date.now()}`,
      data: {
        type: 'alert',
        priority: config.priority,
        severity,
        notificationType: 'critical_alert',
        ...data,
      },
    });
  }, []);

  return {
    isSupported,
    permission,
    settings,
    isEnabled: settings.enabled && permission === 'granted',
    requestPermission,
    updateSettings,
    toggleEnabled,
    toggleCriticalOnly,
    toggleVibrate,
    toggleBadge,
    sendTestNotification,
    showNotification,
    showCriticalAlertNotification,
    showAlertNotification,
  };
};
