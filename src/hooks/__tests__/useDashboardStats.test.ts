import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// Helper: creates a deeply chainable mock that resolves to `value`
function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order', 'single'];
  for (const m of methods) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  // Make it thenable so Promise.all works
  self.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    Promise.resolve(value).then(resolve)
  ) as ReturnType<typeof vi.fn>;
  // Allow await directly
  Object.defineProperty(self, Symbol.toStringTag, { value: 'Promise' });
  return self;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useDashboardStats, type DashboardStats } from '../useDashboardStats';
import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar stats padrão quando supabase retorna zeros', async () => {
    const tables = ['lalamove_orders', 'lalamove_orders', 'lalamove_orders',
                    'driver_approval_queue', 'alerts', 'drivers', 'lalamove_orders'];
    let callIdx = 0;

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIdx++;
      if (callIdx <= 6) {
        return chainable({ count: 0, error: null });
      }
      // 7th call: delivery times data query
      return chainable({ data: [], error: null });
    });

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const stats = result.current.data as DashboardStats;
    expect(stats.totalOrders).toBe(0);
    expect(stats.activeDeliveries).toBe(0);
    expect(stats.completedToday).toBe(0);
    expect(stats.pendingApprovals).toBe(0);
    expect(stats.alertsCount).toBe(0);
    expect(stats.activeDrivers).toBe(0);
    expect(stats.avgDeliveryTime).toBe(45); // fallback
    expect(stats.onTimeRate).toBe(95); // fallback
  });

  it('deve calcular onTimeRate corretamente com dados de entrega', async () => {
    const now = new Date();
    const scheduled = new Date(now.getTime() - 30 * 60 * 1000);
    const estimated = new Date(now.getTime() + 10 * 60 * 1000);

    let callIdx = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIdx++;
      if (callIdx <= 6) {
        return chainable({ count: 5, error: null });
      }
      return chainable({
        data: [
          { scheduled_at: scheduled.toISOString(), actual_delivery: now.toISOString(), estimated_delivery: estimated.toISOString() },
          { scheduled_at: scheduled.toISOString(), actual_delivery: now.toISOString(), estimated_delivery: null },
        ],
        error: null,
      });
    });

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const stats = result.current.data as DashboardStats;
    expect(stats.onTimeRate).toBe(100);
    expect(stats.avgDeliveryTime).toBe(30);
  });

  it('deve consultar 7 queries do supabase', async () => {
    let callIdx = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIdx++;
      if (callIdx <= 6) return chainable({ count: 0, error: null });
      return chainable({ data: [], error: null });
    });

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabase.from).toHaveBeenCalledTimes(7);
  });
});
