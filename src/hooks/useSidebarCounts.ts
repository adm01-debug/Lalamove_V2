import { useCallback } from 'react';
import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Contadores da sidebar (item 53).
 * Três counts em paralelo via `useQueries`, com `staleTime` de 30 s e cache
 * compartilhado entre `Sidebar` e `MobileSidebar` — em vez de três queries
 * sequenciais repetidas a cada montagem.
 */

const STALE_TIME_MS = 30_000;

async function countUnreadAlerts() {
  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
    .eq('is_dismissed', false);
  return count ?? 0;
}

async function countPendingApprovals() {
  const { count } = await supabase
    .from('driver_approval_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');
  return count ?? 0;
}

async function countOpenIncidents() {
  const { count } = await supabase
    .from('driver_incidents')
    .select('*', { count: 'exact', head: true })
    .eq('resolved', false);
  return count ?? 0;
}

export function useSidebarCounts() {
  const results = useQueries({
    queries: [
      { queryKey: ['sidebar-count', 'alerts'], queryFn: countUnreadAlerts, staleTime: STALE_TIME_MS },
      { queryKey: ['sidebar-count', 'approvals'], queryFn: countPendingApprovals, staleTime: STALE_TIME_MS },
      { queryKey: ['sidebar-count', 'incidents'], queryFn: countOpenIncidents, staleTime: STALE_TIME_MS },
    ],
  });

  const refetchCounts = useCallback(() => {
    for (const r of results) r.refetch();
  }, [results]);

  return {
    unreadAlerts: results[0].data ?? 0,
    pendingApprovals: results[1].data ?? 0,
    openIncidents: results[2].data ?? 0,
    refetchCounts,
  };
}
