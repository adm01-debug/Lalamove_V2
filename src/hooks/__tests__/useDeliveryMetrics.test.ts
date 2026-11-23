import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order', 'range'];
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

import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('useDeliveryMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve calcular métricas de entrega corretamente', async () => {
    const today = new Date().toISOString().split('T')[0];
    const orders = [
      { status: 'COMPLETED', vehicle_type: 'MOTORCYCLE', scheduled_at: '2026-03-15T08:00:00Z', actual_delivery: '2026-03-15T08:30:00Z', estimated_delivery: null, created_at: `${today}T07:00:00Z` },
      { status: 'CANCELLED', vehicle_type: 'CAR', scheduled_at: '2026-03-15T09:00:00Z', actual_delivery: null, estimated_delivery: null, created_at: `${today}T08:00:00Z` },
      { status: 'ON_GOING', vehicle_type: 'MOTORCYCLE', scheduled_at: '2026-03-15T10:00:00Z', actual_delivery: null, estimated_delivery: null, created_at: `${today}T09:00:00Z` },
      { status: 'COMPLETED', vehicle_type: 'VAN', scheduled_at: '2026-03-15T06:00:00Z', actual_delivery: '2026-03-15T07:00:00Z', estimated_delivery: null, created_at: '2026-03-14T05:00:00Z' },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: orders, error: null })
    );

    const { useDeliveryMetrics } = await import('../useDeliveryMetrics');
    const { result } = renderHook(() => useDeliveryMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const m = result.current.data!;
    expect(m.totalOrders).toBe(4);
    expect(m.completedOrders).toBe(2);
    expect(m.cancelledOrders).toBe(1);
    expect(m.pendingOrders).toBe(1);
    expect(m.completionRate).toBe(50);
    expect(m.cancellationRate).toBe(25);
    expect(m.avgDeliveryTimeMinutes).toBeGreaterThan(0);
    expect(m.byStatus['COMPLETED']).toBe(2);
    expect(m.byVehicleType['MOTORCYCLE']).toBe(2);
    expect(m.todayOrders).toBe(3);
    expect(m.todayCompleted).toBe(1);
    expect(m.todayCancelled).toBe(1);
  });

  it('deve retornar zeros sem dados', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: [], error: null })
    );

    const { useDeliveryMetrics } = await import('../useDeliveryMetrics');
    const { result } = renderHook(() => useDeliveryMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.totalOrders).toBe(0);
    expect(result.current.data!.completionRate).toBe(0);
    expect(result.current.data!.avgDeliveryTimeMinutes).toBe(0);
  });

  it('deve propagar erro do supabase', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: null, error: { message: 'RLS denied' } })
    );

    const { useDeliveryMetrics } = await import('../useDeliveryMetrics');
    const { result } = renderHook(() => useDeliveryMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('deve simular 500 pedidos de stress test', async () => {
    const statuses = ['COMPLETED', 'CANCELLED', 'PENDING', 'ON_GOING', 'REJECTED', 'MATCHED'];
    const vehicles = ['MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'];
    const orders = Array.from({ length: 500 }, (_, i) => ({
      status: statuses[i % statuses.length],
      vehicle_type: vehicles[i % vehicles.length],
      scheduled_at: '2026-03-15T08:00:00Z',
      actual_delivery: statuses[i % statuses.length] === 'COMPLETED' ? '2026-03-15T08:45:00Z' : null,
      estimated_delivery: null,
      created_at: '2026-03-14T00:00:00Z',
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: orders, error: null })
    );

    const { useDeliveryMetrics } = await import('../useDeliveryMetrics');
    const { result } = renderHook(() => useDeliveryMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const m = result.current.data!;
    expect(m.totalOrders).toBe(500);
    const statusTotal = Object.values(m.byStatus).reduce((a, b) => a + b, 0);
    expect(statusTotal).toBe(500);
    const vehicleTotal = Object.values(m.byVehicleType).reduce((a, b) => a + b, 0);
    expect(vehicleTotal).toBe(500);
  });

  it('deve filtrar tempos > 24h como outliers', async () => {
    const orders = [
      { status: 'COMPLETED', vehicle_type: 'CAR', scheduled_at: '2026-03-01T08:00:00Z', actual_delivery: '2026-03-15T08:00:00Z', estimated_delivery: null, created_at: '2026-03-14T00:00:00Z' },
      { status: 'COMPLETED', vehicle_type: 'CAR', scheduled_at: '2026-03-15T08:00:00Z', actual_delivery: '2026-03-15T08:20:00Z', estimated_delivery: null, created_at: '2026-03-14T00:00:00Z' },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: orders, error: null })
    );

    const { useDeliveryMetrics } = await import('../useDeliveryMetrics');
    const { result } = renderHook(() => useDeliveryMetrics(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.avgDeliveryTimeMinutes).toBe(20);
  });
});

describe('useDriverDeliveryStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve agrupar entregas por motorista', async () => {
    let callIdx = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return chainable({
          data: [
            { id: 'drv-1', name: 'Carlos', rating: 4.5, risk_level: 'LOW', completed_deliveries: 10, total_deliveries: 12 },
            { id: 'drv-2', name: 'Maria', rating: 3.0, risk_level: 'HIGH', completed_deliveries: 2, total_deliveries: 5 },
          ],
          error: null,
        });
      }
      return chainable({
        data: [
          { driver_id: 'drv-1', status: 'COMPLETED', scheduled_at: '2026-03-15T08:00:00Z', actual_delivery: '2026-03-15T08:30:00Z' },
          { driver_id: 'drv-1', status: 'COMPLETED', scheduled_at: '2026-03-15T09:00:00Z', actual_delivery: '2026-03-15T09:40:00Z' },
          { driver_id: 'drv-1', status: 'CANCELLED', scheduled_at: '2026-03-15T10:00:00Z', actual_delivery: null },
          { driver_id: 'drv-2', status: 'COMPLETED', scheduled_at: '2026-03-15T11:00:00Z', actual_delivery: '2026-03-15T11:20:00Z' },
          { driver_id: null, status: 'PENDING', scheduled_at: '2026-03-15T12:00:00Z', actual_delivery: null },
        ],
        error: null,
      });
    });

    const { useDriverDeliveryStats } = await import('../useDeliveryMetrics');
    const { result } = renderHook(() => useDriverDeliveryStats(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const stats = result.current.data!;
    expect(stats.length).toBe(2);
    expect(stats[0].driverName).toBe('Carlos');
    expect(stats[0].totalDeliveries).toBe(3);
    expect(stats[0].completedDeliveries).toBe(2);
    expect(stats[0].cancelledDeliveries).toBe(1);
    expect(stats[1].driverName).toBe('Maria');
    expect(stats[1].totalDeliveries).toBe(1);
  });
});
