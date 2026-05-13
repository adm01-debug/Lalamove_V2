import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AlertSettings {
  stopped_alert_enabled: boolean;
  stopped_alert_minutes: number;
  stopped_critical_minutes: number;
  off_route_alert_enabled: boolean;
  late_delivery_alert_enabled: boolean;
  late_delivery_minutes: number;
}

export const defaultAlertSettings: AlertSettings = {
  stopped_alert_enabled: true,
  stopped_alert_minutes: 5,
  stopped_critical_minutes: 10,
  off_route_alert_enabled: true,
  late_delivery_alert_enabled: true,
  late_delivery_minutes: 15,
};

export function useAlertSettings() {
  const [settings, setSettings] = useState<AlertSettings>(defaultAlertSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alert_configurations')
        .select('*');

      if (error) throw error;

      const configs = data || [];
      const newSettings = { ...defaultAlertSettings };

      configs.forEach((config) => {
        const configData = config.config as Record<string, unknown> || {};
        switch (config.alert_type) {
          case 'DRIVER_STOPPED':
            newSettings.stopped_alert_enabled = config.is_enabled ?? true;
            newSettings.stopped_alert_minutes = (configData.warning_minutes as number) || 5;
            newSettings.stopped_critical_minutes = (configData.critical_minutes as number) || 10;
            break;
          case 'ROUTE_DEVIATION':
            newSettings.off_route_alert_enabled = config.is_enabled ?? true;
            break;
          case 'LATE_DELIVERY':
            newSettings.late_delivery_alert_enabled = config.is_enabled ?? true;
            newSettings.late_delivery_minutes = (configData.threshold_minutes as number) || 15;
            break;
        }
      });

      setSettings(newSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const configs = [
        {
          alert_type: 'DRIVER_STOPPED' as const,
          channel: 'in_app',
          is_enabled: settings.stopped_alert_enabled,
          config: {
            warning_minutes: settings.stopped_alert_minutes,
            critical_minutes: settings.stopped_critical_minutes,
          },
        },
        {
          alert_type: 'ROUTE_DEVIATION' as const,
          channel: 'in_app',
          is_enabled: settings.off_route_alert_enabled,
          config: {},
        },
        {
          alert_type: 'LATE_DELIVERY' as const,
          channel: 'in_app',
          is_enabled: settings.late_delivery_alert_enabled,
          config: {
            threshold_minutes: settings.late_delivery_minutes,
          },
        },
      ];

      for (const config of configs) {
        const { data: existing } = await supabase
          .from('alert_configurations')
          .select('id')
          .eq('alert_type', config.alert_type)
          .eq('channel', config.channel)
          .single();

        if (existing) {
          const { error } = await supabase
            .from('alert_configurations')
            .update({
              is_enabled: config.is_enabled,
              config: config.config,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('alert_configurations')
            .insert(config);
          if (error) throw error;
        }
      }

      toast.success('Configurações salvas com sucesso!');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    setSettings(defaultAlertSettings);
    setHasChanges(true);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, loading, saving, hasChanges, saveSettings, updateSetting, resetToDefaults };
}
