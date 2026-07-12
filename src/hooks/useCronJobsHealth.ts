import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CronJobHealth {
  jobid: number;
  jobname: string | null;
  schedule: string | null;
  active: boolean | null;
  last_status: string | null;
  last_run_started: string | null;
  last_run_duration_ms: number | null;
  runs_considered: number | null;
  failed_runs: number | null;
  failure_rate: number | null;
}

/**
 * Consome a RPC `get_cron_jobs_health` (restrita a administradores) para expor
 * o estado dos jobs de manutenção agendados via pg_cron.
 */
export const useCronJobsHealth = (runsWindow = 20, refetchInterval = 60000) => {
  return useQuery({
    queryKey: ['cron-jobs-health', runsWindow],
    queryFn: async (): Promise<CronJobHealth[]> => {
      const { data, error } = await supabase.rpc('get_cron_jobs_health', {
        p_runs_window: runsWindow,
      });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as CronJobHealth[];
    },
    refetchInterval,
    staleTime: refetchInterval / 2,
    retry: false,
  });
};
