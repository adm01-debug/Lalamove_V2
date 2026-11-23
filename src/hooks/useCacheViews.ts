import { logger } from '@/utils/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

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
      // View materializada `cache_status` criada no banco (migration
      // 20261122090000_cache_system_backend.sql) - retorna 3 views com status real.
      const { data, error } = await supabase
        .from('cache_status')
        .select('view_name, row_count, last_refresh, refresh_duration_ms, is_stale, status')
        .order('view_name');

      if (error) {
        logger.error('Error fetching cache stats:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        view_name: row.view_name,
        last_refresh: row.last_refresh,
        refresh_duration_ms: row.refresh_duration_ms,
        row_count: row.row_count,
        is_stale: row.is_stale,
        status: row.status,
      }));
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    refetchIntervalInBackground: false,
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
      // Histórico real de refreshes: filtra pelo nome da view quando informado.
      let query = supabase
        .from('cache_status')
        .select('view_name, row_count, last_refresh, refresh_duration_ms, is_stale, status')
        .order('last_refresh', { ascending: false });
      if (viewName) {
        query = query.eq('view_name', viewName);
      }
      const { data, error } = await query;
      if (error) {
        logger.error('Error fetching cache refresh history:', error);
        throw error;
      }
      return data || [];
    },
    refetchInterval: 60000, // Atualiza a cada 1 minuto
    refetchIntervalInBackground: false,
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
      // RPC real `refresh_cache_view` criada no banco (migration 20261122090000):
      // sem argumento refresca as 3 views; com argumento, apenas a informada.
      const { data, error } = await supabase.rpc('refresh_cache_view', viewName ? { p_view_name: viewName } : {});

      if (error) {
        logger.error('Error refreshing cache:', error);
        throw error;
      }

      return (data || []).map((r: any) => ({
        view_refreshed: r.view_refreshed,
        duration_ms: r.duration_ms,
        row_count: r.row_count,
        status: r.status,
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
