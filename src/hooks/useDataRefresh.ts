import { useState, useEffect, useCallback, useRef } from "react";

export interface DataRefreshOptions {
  autoRefreshInterval?: number;
  onError?: (error: Error) => void;
  pauseWhenHidden?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
}

export interface DataRefreshResult {
  lastUpdated: Date | null;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  error: string | null;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  refreshCount: number;
  averageRefreshTime: number | undefined;
}

export function useDataRefresh(
  refreshFn: () => Promise<void>,
  options?: DataRefreshOptions
): DataRefreshResult {
  const {
    autoRefreshInterval,
    onError,
    pauseWhenHidden = true,
    retryOnError = true,
    maxRetries = 3,
  } = options || {};

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [averageRefreshTime, setAverageRefreshTime] = useState<number | undefined>();
  const retryCountRef = useRef(0);
  const refreshTimesRef = useRef<number[]>([]);

  const refresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setError(null);
    const startTime = performance.now();
    
    try {
      await refreshFn();
      const duration = performance.now() - startTime;
      
      refreshTimesRef.current.push(duration);
      if (refreshTimesRef.current.length > 10) {
        refreshTimesRef.current.shift();
      }
      setAverageRefreshTime(
        Math.round(refreshTimesRef.current.reduce((a, b) => a + b, 0) / refreshTimesRef.current.length)
      );
      
      setLastUpdated(new Date());
      setRefreshCount((prev) => prev + 1);
      retryCountRef.current = 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      
      if (retryOnError && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setTimeout(refresh, Math.pow(2, retryCountRef.current) * 1000);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshFn, isRefreshing, onError, retryOnError, maxRetries]);

  useEffect(() => {
    if (!pauseWhenHidden) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setPaused(true);
      } else {
        setPaused(false);
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pauseWhenHidden, refresh]);

  useEffect(() => {
    if (!autoRefreshInterval || paused) return;
    const interval = setInterval(refresh, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, paused, refresh]);

  useEffect(() => {
    refresh();
  }, []);

  return { 
    lastUpdated, 
    isRefreshing, 
    refresh, 
    error, 
    paused, 
    setPaused,
    refreshCount,
    averageRefreshTime,
  };
}
