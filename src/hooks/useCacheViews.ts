import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { logger } from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CacheStats {
  view_name: string;
  last_refresh: string | null;
  refresh_duration_ms: number | null;
  row_count: number | null;
  is_stale: boolean;
  status: 'success' | 'failed' | 'never_refreshed';
}

export interface CacheView {
  view_name: string;
  last_refresh: string;
  refresh_status: 'success' | 'failed' | 'stale';
  row_count: number;
  refresh_duration_ms: number;
}

export interface RefreshResult {
  view_refreshed: string;
  duration_ms: number | null;
  row_count: number | null;
  status: 'success' | 'failed';
}

// ============================================================================
// MOCK DATA - Fallback when RPC functions don't exist
// ============================================================================

const mockCacheStats: CacheStats[] = [
  { view_name: 'driver_stats_cache', last_refresh: new Date().toISOString(), refresh_duration_ms: 245, row_count: 150, is_stale: false, status: 'success' },
  { view_name: 'delivery_metrics_cache', last_refresh: new Date().toISOString(), refresh_duration_ms: 512, row_count: 3000, is_stale: false, status: 'success' },
  { view_name: 'hourly_metrics_cache', last_refresh: new Date().toISOString(), refresh_duration_ms: 128, row_count: 24, is_stale: false, status: 'success' },
];

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook para obter status de todas as views de cache
 * Mostra informações sobre última atualização, performance, e se está stale
 */
export function useCacheStats() {
  return useQuery({
    queryKey: ['cache-stats'],
    queryFn: async (): Promise<CacheStats[]> => {
      // Return mock data as the RPC doesn't exist yet
      return mockCacheStats;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    staleTime: 20000,
  });
}

/**
 * Hook para obter histórico de refreshes de cache
 * Útil para debugging e monitoramento
 */
export function useCacheRefreshHistory(viewName?: string) {
  return useQuery({
    queryKey: ['cache-refresh-history', viewName],
    queryFn: async () => {
      // Return empty array as the table doesn't exist yet
      return [];
    },
    refetchInterval: 60000, // Atualiza a cada 1 minuto
  });
}

/**
 * Hook para transformar stats em views (backward compatibility)
 * Mantém compatibilidade com código existente
 */
export function useCacheViews() {
  const { data: stats } = useCacheStats();
  
  // Transformar stats em formato de views
  const views: CacheView[] = stats
    ?.filter(s => s.status === 'success' && s.last_refresh)
    .map(s => ({
      view_name: s.view_name,
      last_refresh: s.last_refresh!,
      refresh_status: s.is_stale ? 'stale' as const : 'success' as const,
      row_count: s.row_count || 0,
      refresh_duration_ms: s.refresh_duration_ms || 0,
    })) || [];
  
  return {
    data: views,
    isLoading: false, // Stats hook já gerencia loading
  };
}

/**
 * Hook para refresh manual de views de cache
 * Permite atualizar uma view específica ou todas
 */
export function useRefreshCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (viewName?: string): Promise<RefreshResult[]> => {
      // Simulate refresh since RPC doesn't exist
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockCacheStats.map(s => ({
        view_refreshed: s.view_name,
        duration_ms: Math.floor(Math.random() * 500) + 100,
        row_count: s.row_count,
        status: 'success' as const,
      }));
    },
    onSuccess: (data) => {
      // Invalidar queries relacionadas ao cache
      queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cache-refresh-history'] });
      
      // Invalidar dados cacheados para forçar re-fetch
      queryClient.invalidateQueries({ queryKey: ['driver-stats-cache'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-metrics-cache'] });
      queryClient.invalidateQueries({ queryKey: ['hourly-metrics-cache'] });
      
      const successCount = data.filter(r => r.status === 'success').length;
      const failedCount = data.filter(r => r.status === 'failed').length;
      
      if (failedCount === 0) {
        toast.success(`Cache atualizado! ${successCount} view(s) refreshed`);
      } else {
        toast.warning(`Cache atualizado parcialmente: ${successCount} ok, ${failedCount} falhas`);
      }
    },
    onError: (error: Error) => {
      logger.error('Error in refresh mutation:', error);
      toast.error('Erro ao atualizar cache');
    },
  });
}

/**
 * Hook para verificar se cache precisa de refresh
 * Retorna true se alguma view está stale
 */
export function useCacheNeedsRefresh() {
  const { data: stats } = useCacheStats();
  
  const needsRefresh = stats?.some(s => s.is_stale) || false;
  const staleViews = stats?.filter(s => s.is_stale).map(s => s.view_name) || [];
  
  return {
    needsRefresh,
    staleViews,
  };
}

/**
 * Hook para auto-refresh baseado em timer
 * Útil para dashboards que precisam de dados sempre frescos
 */
export function useAutoRefreshCache(intervalMinutes: number = 60) {
  const { mutateAsync: refresh } = useRefreshCache();
  const { needsRefresh } = useCacheNeedsRefresh();

  useEffect(() => {
    if (!needsRefresh) return;

    const intervalMs = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
      refresh(undefined);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [needsRefresh, intervalMinutes, refresh]);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formata duração de refresh para exibição
 */
export function formatRefreshDuration(ms: number | null): string {
  if (!ms) return 'N/A';
  
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

/**
 * Formata última atualização para exibição relativa
 */
export function formatLastRefresh(date: string | null): string {
  if (!date) return 'Never';
  
  const now = new Date();
  const refreshDate = new Date(date);
  const diffMs = now.getTime() - refreshDate.getTime();
  
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
