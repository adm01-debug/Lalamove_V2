import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto' | 'scheduled';

interface ScheduleSettings {
  enabled: boolean;
  darkModeStart: string; // "18:00"
  darkModeEnd: string; // "06:00"
  useSystemTheme: boolean;
}

interface ThemeState {
  mode: ThemeMode;
  schedule: ScheduleSettings;
}

const defaultSchedule: ScheduleSettings = {
  enabled: false,
  darkModeStart: '18:00',
  darkModeEnd: '06:00',
  useSystemTheme: true,
};

const getStoredTheme = (): ThemeState => {
  try {
    const stored = localStorage.getItem('theme-settings');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading theme settings:', e);
  }
  return { mode: 'auto', schedule: defaultSchedule };
};

const isInDarkModeSchedule = (start: string, end: string): boolean => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Handle overnight schedules (e.g., 18:00 to 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

export function useScheduledTheme() {
  const [themeState, setThemeState] = useState<ThemeState>(getStoredTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  // Calculate resolved theme based on mode, schedule, and system preference
  const resolvedTheme = useCallback((): 'light' | 'dark' => {
    const { mode, schedule } = themeState;

    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    
    if (mode === 'scheduled' && schedule.enabled) {
      return isInDarkModeSchedule(schedule.darkModeStart, schedule.darkModeEnd) ? 'dark' : 'light';
    }
    
    // Auto mode - use system preference
    return systemTheme;
  }, [themeState, systemTheme])();

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Add transition class
    root.classList.add('theme-transition');
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Remove transition class after animation
    const timeout = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Check schedule every minute
  useEffect(() => {
    if (themeState.mode !== 'scheduled') return;
    
    const interval = setInterval(() => {
      // Force re-render to check schedule
      setThemeState(prev => ({ ...prev }));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [themeState.mode]);

  // Persist theme settings
  useEffect(() => {
    localStorage.setItem('theme-settings', JSON.stringify(themeState));
  }, [themeState]);

  const setMode = useCallback((mode: ThemeMode) => {
    setThemeState(prev => ({ ...prev, mode }));
  }, []);

  const setSchedule = useCallback((schedule: Partial<ScheduleSettings>) => {
    setThemeState(prev => ({
      ...prev,
      schedule: { ...prev.schedule, ...schedule },
    }));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const modes: ThemeMode[] = ['auto', 'light', 'dark', 'scheduled'];
      const currentIndex = modes.indexOf(prev.mode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { ...prev, mode: modes[nextIndex] };
    });
  }, []);

  const enableSchedule = useCallback((start: string, end: string) => {
    setThemeState(prev => ({
      mode: 'scheduled',
      schedule: {
        ...prev.schedule,
        enabled: true,
        darkModeStart: start,
        darkModeEnd: end,
      },
    }));
  }, []);

  const disableSchedule = useCallback(() => {
    setThemeState(prev => ({
      ...prev,
      mode: 'auto',
      schedule: { ...prev.schedule, enabled: false },
    }));
  }, []);

  return {
    mode: themeState.mode,
    schedule: themeState.schedule,
    resolvedTheme,
    systemTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isScheduled: themeState.mode === 'scheduled',
    setMode,
    setSchedule,
    toggleTheme,
    enableSchedule,
    disableSchedule,
  };
}
