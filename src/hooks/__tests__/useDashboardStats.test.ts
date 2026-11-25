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

import { useDashboardStats, type DashboardStats, type DashboardStatsResult } from '../useDashboardStats';
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
    // With no deliveries the dashboard must report real zeros, not fabricated defaults.
    expect(stats.avgDeliveryTime).toBe(0);
    expect(stats.onTimeRate).toBe(0);
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

  it('uma query rejeitada não derruba os outros KPIs', async () => {
    let callIdx = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIdx++;
      // A 5ª query (alertas ativos) falha — RLS negada, por exemplo.
      if (callIdx === 5) {
        const failing = chainable({ count: null, error: null });
        failing.then = vi.fn().mockImplementation(
          (_resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
            Promise.reject(new Error('permission denied for table alerts')).then(undefined, reject),
        ) as ReturnType<typeof vi.fn>;
        return failing;
      }
      if (callIdx <= 6) return chainable({ count: 7, error: null });
      return chainable({ data: [], error: null });
    });

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data as DashboardStatsResult;
    // As queries que responderam continuam valendo (antes do fix, todas viravam 0).
    expect(data.totalOrders).toBe(7);
    expect(data.activeDeliveries).toBe(7);
    expect(data.activeDrivers).toBe(7);
    // Só o KPI que falhou cai no fallback, e o nome dele fica registrado.
    expect(data.alertsCount).toBe(0);
    expect(data.errors.map((e) => e.name)).toEqual(['alertsCount']);
  });

  it('limita "hoje" ao dia de São Paulo, não ao fuso da máquina', async () => {
    const gteArgs: string[] = [];
    // Captura o valor passado em gte('actual_delivery', today)
    const capture = (value: unknown) => {
      const self = chainable(value);
      self.gte = vi.fn().mockImplementation((_column: string, val: string) => {
        gteArgs.push(val);
        return self;
      });
      return self;
    };

    let callIdx = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIdx++;
      if (callIdx <= 6) return capture({ count: 0, error: null });
      return capture({ data: [], error: null });
    });

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    // O limite de "hoje" é a meia-noite de São Paulo (UTC-3, sem horário de verão
    // desde 2019). O fuso da máquina de quem abre o painel não entra mais na conta.
    const todayArg = gteArgs.find((v) => v.includes('-03:00'));
    expect(todayArg).toBeDefined();

    const spMidnight = new Date(todayArg as string);
    expect(spMidnight.getUTCHours()).toBe(3);
    expect(spMidnight.getUTCMinutes()).toBe(0);

    const spDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    expect(spMidnight.toISOString().slice(0, 10)).toBe(spDay);
  });
});
