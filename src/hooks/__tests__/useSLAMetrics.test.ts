import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order'];
  for (const m of methods) self[m] = vi.fn().mockReturnValue(self);
  self.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    Promise.resolve(value).then(resolve)
  ) as ReturnType<typeof vi.fn>;
  Object.defineProperty(self, Symbol.toStringTag, { value: 'Promise' });
  return self;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../useRealtimeSubscriptions', () => ({
  useSLAMetricsRealtime: vi.fn(),
}));

import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useSLAMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve calcular métricas SLA com pedidos completos', async () => {
    const orders = [
      { status: 'COMPLETED', scheduled_at: '2026-03-15T08:00:00Z', actual_delivery: '2026-03-15T08:30:00Z', estimated_delivery: '2026-03-15T09:00:00Z', created_at: '2026-03-15T07:00:00Z' },
      { status: 'COMPLETED', scheduled_at: '2026-03-15T09:00:00Z', actual_delivery: '2026-03-15T10:30:00Z', estimated_delivery: '2026-03-15T10:00:00Z', created_at: '2026-03-15T08:00:00Z' },
      { status: 'ON_GOING', scheduled_at: '2026-03-15T11:00:00Z', actual_delivery: null, estimated_delivery: '2026-03-15T12:00:00Z', created_at: '2026-03-15T10:00:00Z' },
    ];
    const tracking = [
      { is_stopped: false, is_on_route: true, speed: 30 },
      { is_stopped: true, is_on_route: false, speed: 0 },
    ];
    const alerts = [
      { severity: 'CRITICAL' },
      { severity: 'WARNING' },
      { severity: 'WARNING' },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'lalamove_orders') return chainable({ data: orders, error: null });
      if (table === 'active_tracking') return chainable({ data: tracking, error: null });
      if (table === 'alerts') return chainable({ data: alerts, error: null });
      if (table === 'driver_approval_queue') return chainable({ data: [{ id: 'a1' }], error: null });
      if (table === 'drivers') return chainable({ data: [], error: null });
      return chainable({ data: [], error: null });
    });

    const { useSLAMetrics } = await import('../useSLAMetrics');
    const { result } = renderHook(() => useSLAMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const m = result.current.data!;
    expect(m.onTimeDeliveries).toBe(1);
    expect(m.lateDeliveries).toBe(1);
    expect(m.onTimeRate).toBe(50);
    expect(m.activeDrivers).toBe(2);
    expect(m.stoppedDrivers).toBe(1);
    expect(m.offRouteDrivers).toBe(1);
    expect(m.criticalAlerts).toBe(1);
    expect(m.warningAlerts).toBe(2);
    expect(m.pendingApprovals).toBe(1);
    expect(m.hourlyStats).toHaveLength(24);
  });

  it('deve retornar onTimeRate 100 sem pedidos completos', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: [], error: null })
    );

    const { useSLAMetrics } = await import('../useSLAMetrics');
    const { result } = renderHook(() => useSLAMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.onTimeRate).toBe(100);
    expect(result.current.data!.avgDeliveryTime).toBe(0);
    expect(result.current.data!.statusBreakdown).toHaveLength(0);
  });

  it('deve simular 200 pedidos para stress test de statusBreakdown', async () => {
    const statuses = ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED'];
    const orders = Array.from({ length: 200 }, (_, i) => ({
      status: statuses[i % statuses.length],
      scheduled_at: '2026-03-15T08:00:00Z',
      actual_delivery: statuses[i % statuses.length] === 'COMPLETED' ? '2026-03-15T08:40:00Z' : null,
      estimated_delivery: '2026-03-15T09:00:00Z',
      created_at: '2026-03-15T07:00:00Z',
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'lalamove_orders') return chainable({ data: orders, error: null });
      return chainable({ data: [], error: null });
    });

    const { useSLAMetrics } = await import('../useSLAMetrics');
    const { result } = renderHook(() => useSLAMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const m = result.current.data!;
    expect(m.statusBreakdown.length).toBeGreaterThan(0);
    const totalFromBreakdown = m.statusBreakdown.reduce((s, b) => s + b.count, 0);
    expect(totalFromBreakdown).toBe(200);
  });

  it('deve filtrar outliers de tempo > 480 min', async () => {
    const orders = [
      { status: 'COMPLETED', scheduled_at: '2026-03-10T08:00:00Z', actual_delivery: '2026-03-15T08:00:00Z', estimated_delivery: null, created_at: '2026-03-15T07:00:00Z' },
      { status: 'COMPLETED', scheduled_at: '2026-03-15T08:00:00Z', actual_delivery: '2026-03-15T08:30:00Z', estimated_delivery: null, created_at: '2026-03-15T07:00:00Z' },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'lalamove_orders') return chainable({ data: orders, error: null });
      return chainable({ data: [], error: null });
    });

    const { useSLAMetrics } = await import('../useSLAMetrics');
    const { result } = renderHook(() => useSLAMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.avgDeliveryTime).toBe(30);
  });
});
