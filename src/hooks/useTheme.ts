import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export type ThemeMode = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'lalamove-guardian-theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      if (stored && ['light', 'dark', 'auto'].includes(stored)) {
        return stored;
      }
    }
    return 'auto';
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Resolved theme based on mode
  const resolvedTheme: ResolvedTheme = mode === 'auto' ? systemTheme : mode;

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Add transition class for smooth theme change
    root.classList.add('theme-transition');
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Store preference
    localStorage.setItem(THEME_KEY, mode);
    
    // Remove transition class after animation
    const timeout = setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [resolvedTheme, mode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+T to toggle theme
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setModeState(prev => {
          const next = prev === 'auto' ? 'light' : prev === 'light' ? 'dark' : 'auto';
          const labels = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };
          const icons = { auto: '🌓', light: '☀️', dark: '🌙' };
          toast.success(`${icons[next]} Tema alterado`, {
            description: `Modo ${labels[next]} ativado`,
            duration: 2000,
          });
          return next;
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState(prev => {
      if (prev === 'auto') return 'light';
      if (prev === 'light') return 'dark';
      return 'auto';
    });
  }, []);

  return {
    mode,
    theme: resolvedTheme,
    setMode,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isAuto: mode === 'auto',
  };
}
