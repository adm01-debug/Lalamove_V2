import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RuntimeErrorLog {
  id: string;
  error_id: string;
  error_name: string;
  error_message: string;
  stack_trace: string | null;
  component_stack: string | null;
  source: string;
  severity: string;
  url: string | null;
  user_agent: string | null;
  user_id: string | null;
  app_version: string | null;
  fingerprint: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  metadata: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

interface ErrorLogFilters {
  severity?: string;
  source?: string;
  resolved?: boolean;
  search?: string;
  limit?: number;
}

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token ?? API_KEY;
  return {
    'apikey': API_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function useErrorLogs(filters: ErrorLogFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['runtime-error-logs', filters],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set('select', '*');
      params.set('order', 'last_seen_at.desc');
      params.set('limit', String(filters.limit ?? 100));

      if (filters.severity) params.set('severity', `eq.${filters.severity}`);
      if (filters.source) params.set('source', `eq.${filters.source}`);
      if (filters.resolved !== undefined) params.set('resolved', `eq.${filters.resolved}`);
      if (filters.search) params.set('or', `(error_name.ilike.%${filters.search}%,error_message.ilike.%${filters.search}%)`);

      const res = await fetch(`${API_BASE}/runtime_error_logs?${params}`, { headers });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'Failed to fetch error logs');
      return body as RuntimeErrorLog[];
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('runtime-error-logs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'runtime_error_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['runtime-error-logs'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useResolveError() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ errorId, resolved }: { errorId: string; resolved: boolean }) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/runtime_error_logs?id=eq.${errorId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          resolved,
          resolved_at: resolved ? new Date().toISOString() : null,
        }),
      });
      const body = await res.text();
      if (!res.ok) throw new Error(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime-error-logs'] });
    },
  });
}

export function useDeleteErrorLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (errorId: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/runtime_error_logs?id=eq.${errorId}`, {
        method: 'DELETE',
        headers,
      });
      const body = await res.text();
      if (!res.ok) throw new Error(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime-error-logs'] });
    },
  });
}

export function useErrorStats() {
  return useQuery({
    queryKey: ['runtime-error-stats'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE}/runtime_error_logs?select=severity,resolved,occurrence_count,source,last_seen_at`,
        { headers }
      );
      const logs = (await res.json()) as RuntimeErrorLog[];
      if (!res.ok) throw new Error('Failed to fetch stats');

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      return {
        total: logs.length,
        unresolved: logs.filter(l => !l.resolved).length,
        critical: logs.filter(l => l.severity === 'critical' && !l.resolved).length,
        last24hCount: logs.filter(l => new Date(l.last_seen_at) > last24h).length,
        last7dCount: logs.filter(l => new Date(l.last_seen_at) > last7d).length,
        totalOccurrences: logs.reduce((sum, l) => sum + (l.occurrence_count ?? 1), 0),
        bySeverity: logs.reduce((acc, l) => { acc[l.severity] = (acc[l.severity] ?? 0) + 1; return acc; }, {} as Record<string, number>),
        bySource: logs.reduce((acc, l) => { acc[l.source] = (acc[l.source] ?? 0) + 1; return acc; }, {} as Record<string, number>),
      };
    },
    refetchInterval: 30_000,
  });
}
