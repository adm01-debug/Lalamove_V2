import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useCronJobsHealth } from '../useCronJobsHealth';

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useCronJobsHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar a saúde dos jobs de cron', async () => {
    const rows = [
      {
        jobid: 1,
        jobname: 'provision-tracking-partitions',
        schedule: '5 0 1 * *',
        active: true,
        last_status: 'succeeded',
        last_run_started: '2026-07-01T00:05:00Z',
        last_run_duration_ms: 123.45,
        runs_considered: 5,
        failed_runs: 0,
        failure_rate: 0,
      },
    ];
    mockRpc.mockResolvedValue({ data: rows, error: null });

    const { result } = renderHook(() => useCronJobsHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].jobname).toBe('provision-tracking-partitions');
    expect(mockRpc).toHaveBeenCalledWith('get_cron_jobs_health', { p_runs_window: 20 });
  });

  it('deve propagar erro quando a RPC falha (ex.: sem permissão de admin)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Acesso negado' } });

    const { result } = renderHook(() => useCronJobsHealth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Acesso negado');
  });
});
