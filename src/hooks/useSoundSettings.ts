import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'sound_settings';

export type AlertPriority = 'CRITICAL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ToneType = 'beep' | 'chime' | 'alert' | 'notification' | 'ping' | 'silent';

export interface ToneConfig {
  type: ToneType;
  label: string;
  description: string;
}

export const AVAILABLE_TONES: ToneConfig[] = [
  { type: 'beep', label: 'Beep', description: 'Som de bipe clássico' },
  { type: 'chime', label: 'Chime', description: 'Som suave de sino' },
  { type: 'alert', label: 'Alerta', description: 'Som de alerta urgente' },
  { type: 'notification', label: 'Notificação', description: 'Som de notificação padrão' },
  { type: 'ping', label: 'Ping', description: 'Som curto e agudo' },
  { type: 'silent', label: 'Silencioso', description: 'Sem som' },
];

export interface PriorityTones {
  CRITICAL: ToneType;
  URGENT: ToneType;
  HIGH: ToneType;
  MEDIUM: ToneType;
  LOW: ToneType;
}

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0-100
  priorityTones: PriorityTones;
}

const defaultPriorityTones: PriorityTones = {
  CRITICAL: 'alert',
  URGENT: 'alert',
  HIGH: 'beep',
  MEDIUM: 'notification',
  LOW: 'ping',
};

const defaultSettings: SoundSettings = {
  enabled: true,
  volume: 50,
  priorityTones: defaultPriorityTones,
};

// Get settings from localStorage (can be called outside of React)
export const getSoundSettings = (): SoundSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { 
        ...defaultSettings, 
        ...parsed,
        priorityTones: { ...defaultPriorityTones, ...parsed.priorityTones }
      };
    }
  } catch (error) {
    logger.error('Error reading sound settings:', error);
  }
  return defaultSettings;
};

// Save settings to localStorage (can be called outside of React)
export const saveSoundSettings = (settings: SoundSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent('soundSettingsChanged', { detail: settings }));
  } catch (error) {
    logger.error('Error saving sound settings:', error);
  }
};

// Check if sounds are enabled (utility function)
export const isSoundEnabled = (): boolean => {
  return getSoundSettings().enabled;
};

// Get volume level (0-1 for Web Audio API)
export const getSoundVolume = (): number => {
  return getSoundSettings().volume / 100;
};

// Get tone type for a specific priority
export const getToneForPriority = (priority: AlertPriority): ToneType => {
  return getSoundSettings().priorityTones[priority];
};

// React hook for components that need to react to changes
export const useSoundSettings = () => {
  const [settings, setSettings] = useState<SoundSettings>(getSoundSettings);

  // Listen for changes from other components
  useEffect(() => {
    const handleChange = (event: CustomEvent<SoundSettings>) => {
      setSettings(event.detail);
    };

    window.addEventListener('soundSettingsChanged', handleChange as EventListener);
    return () => {
      window.removeEventListener('soundSettingsChanged', handleChange as EventListener);
    };
  }, []);

  const updateSettings = useCallback((newSettings: Partial<SoundSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSoundSettings(updated);
  }, [settings]);

  const toggleSound = useCallback(() => {
    updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  const setVolume = useCallback((volume: number) => {
    updateSettings({ volume: Math.max(0, Math.min(100, volume)) });
  }, [updateSettings]);

  const setPriorityTone = useCallback((priority: AlertPriority, tone: ToneType) => {
    updateSettings({ 
      priorityTones: { 
        ...settings.priorityTones, 
        [priority]: tone 
      } 
    });
  }, [settings.priorityTones, updateSettings]);

  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    saveSoundSettings(defaultSettings);
  }, []);

  return {
    settings,
    updateSettings,
    toggleSound,
    setVolume,
    setPriorityTone,
    resetToDefaults,
    isEnabled: settings.enabled,
    volume: settings.volume,
    priorityTones: settings.priorityTones,
  };
};
