import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
import { useFeatureFlag } from '../useFeatureFlags';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function mockFlags(rows: unknown[]) {
  const select = vi.fn().mockResolvedValue({ data: rows, error: null });
  (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ select });
}

describe('useFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expõe isEnabled=true quando a flag existe e está habilitada', async () => {
    mockFlags([
      { id: '1', name: 'realtime_map_updates', description: null, is_enabled: true, rules: {} },
    ]);

    const { result } = renderHook(() => useFeatureFlag('realtime_map_updates'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.flag?.name).toBe('realtime_map_updates');
  });

  it('expõe isEnabled=false quando a flag existe mas está desligada', async () => {
    mockFlags([
      { id: '1', name: 'driver_auto_evaluation', description: null, is_enabled: false, rules: {} },
    ]);

    const { result } = renderHook(() => useFeatureFlag('driver_auto_evaluation'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEnabled).toBe(false);
  });

  it('cai para false quando a flag não existe (kill-switch seguro)', async () => {
    mockFlags([
      { id: '1', name: 'ai_route_optimization', description: null, is_enabled: true, rules: {} },
    ]);

    const { result } = renderHook(() => useFeatureFlag('flag_inexistente'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.flag).toBeUndefined();
  });
});