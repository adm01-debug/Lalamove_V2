import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface AuthLog {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useAuthLogs(options?: { limit?: number; userId?: string }) {
  const { user } = useAuth();
  const limit = options?.limit || 100;
  const targetUserId = options?.userId || user?.id;

  const { data: authLogs, isLoading, refetch } = useQuery({
    queryKey: ['auth-logs', targetUserId, limit],
    queryFn: async () => {
      let query = supabase
        .from('auth_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (targetUserId) {
        query = query.eq('user_id', targetUserId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as AuthLog[];
    },
    enabled: !!user?.id,
  });

  // Agrupar por tipo de evento
  const eventSummary = authLogs?.reduce((acc, log) => {
    acc[log.event_type] = (acc[log.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Estatísticas
  const stats = {
    total: authLogs?.length || 0,
    successful: authLogs?.filter(l => l.success).length || 0,
    failed: authLogs?.filter(l => !l.success).length || 0,
    uniqueIPs: new Set(authLogs?.map(l => l.ip_address).filter(Boolean)).size,
  };

  return {
    authLogs,
    isLoading,
    refetch,
    eventSummary,
    stats,
  };
}
