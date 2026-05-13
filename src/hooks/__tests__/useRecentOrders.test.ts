import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order', 'range'];
  for (const m of methods) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  self.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    Promise.resolve(value).then(resolve)
  ) as ReturnType<typeof vi.fn>;
  Object.defineProperty(self, Symbol.toStringTag, { value: 'Promise' });
  return self;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useRecentOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve buscar e mapear pedidos corretamente', async () => {
    const mockOrders = [
      {
        id: 'ord-1', lalamove_id: 'LLM-001', internal_order_id: 'INT-001',
        status: 'COMPLETED', pickup_address: 'Rua A, 100',
        delivery_address: 'Rua B, 200', customer_name: 'Maria Souza',
        customer_phone: '11988888888', scheduled_at: '2026-03-15T10:00:00Z',
        estimated_delivery: '2026-03-15T11:00:00Z',
        actual_delivery: '2026-03-15T10:45:00Z',
        driver_id: 'drv-1', vehicle_type: 'MOTORCYCLE',
        total_cost: 25.50, currency: 'BRL', tags: ['urgente', 'fragil'],
        created_at: '2026-03-15T09:00:00Z', updated_at: '2026-03-15T10:45:00Z',
        drivers: { name: 'Carlos Silva', phone: '11999999999' },
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockOrders, count: 1, error: null })
    );

    const { useRecentOrders } = await import('../useRecentOrders');
    const { result } = renderHook(() => useRecentOrders(1), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.orders).toHaveLength(1);
    const order = result.current.data!.orders[0];
    expect(order.lalamoveId).toBe('LLM-001');
    expect(order.internalOrderId).toBe('INT-001');
    expect(order.customerName).toBe('Maria Souza');
    expect(order.driverName).toBe('Carlos Silva');
    expect(order.driverPhone).toBe('11999999999');
    expect(order.totalCost).toBe(25.50);
    expect(order.scheduledAt).toBeInstanceOf(Date);
    expect(order.actualDelivery).toBeInstanceOf(Date);
    expect(order.tags).toEqual(['urgente', 'fragil']);
  });

  it('deve calcular paginação corretamente', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: [], count: 45, error: null })
    );

    const { useRecentOrders } = await import('../useRecentOrders');
    const { result } = renderHook(() => useRecentOrders(2), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.totalCount).toBe(45);
    expect(result.current.data?.page).toBe(2);
    expect(result.current.data?.pageSize).toBe(20);
    expect(result.current.data?.totalPages).toBe(3);
  });

  it('deve lidar com driver null', async () => {
    const mockOrders = [
      {
        id: 'ord-2', lalamove_id: 'LLM-002', internal_order_id: null,
        status: 'PENDING', pickup_address: 'Rua C', delivery_address: 'Rua D',
        customer_name: 'Pedro', customer_phone: null,
        scheduled_at: '2026-03-15T10:00:00Z',
        estimated_delivery: null, actual_delivery: null,
        driver_id: null, vehicle_type: 'CAR',
        total_cost: 0, currency: 'BRL', tags: null,
        created_at: '2026-03-15T09:00:00Z', updated_at: '2026-03-15T09:00:00Z',
        drivers: null,
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockOrders, count: 1, error: null })
    );

    const { useRecentOrders } = await import('../useRecentOrders');
    const { result } = renderHook(() => useRecentOrders(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const order = result.current.data!.orders[0];
    expect(order.internalOrderId).toBeUndefined();
    expect(order.driverId).toBeUndefined();
    expect(order.driverName).toBeUndefined();
    expect(order.driverPhone).toBeUndefined();
    expect(order.estimatedDelivery).toBeUndefined();
    expect(order.actualDelivery).toBeUndefined();
    expect(order.customerPhone).toBe('');
    expect(order.tags).toEqual([]);
  });

  it('deve propagar erro do supabase', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: null, count: null, error: { message: 'DB error' } })
    );

    const { useRecentOrders } = await import('../useRecentOrders');
    const { result } = renderHook(() => useRecentOrders(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('deve retornar totalPages 0 quando count é 0', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: [], count: 0, error: null })
    );

    const { useRecentOrders } = await import('../useRecentOrders');
    const { result } = renderHook(() => useRecentOrders(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalPages).toBe(0);
    expect(result.current.data?.totalCount).toBe(0);
  });

  it('deve retornar totalCount 0 quando count é null', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: [], count: null, error: null })
    );

    const { useRecentOrders } = await import('../useRecentOrders');
    const { result } = renderHook(() => useRecentOrders(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalCount).toBe(0);
  });

  it('deve lidar com data null', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: null, count: 0, error: null })
    );

    const { useRecentOrders } = await import('../useRecentOrders');
    const { result } = renderHook(() => useRecentOrders(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.orders).toHaveLength(0);
  });

  it('deve mapear todos os status de pedido', async () => {
    const statuses = ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'];
    const mockOrders = statuses.map((status, i) => ({
      id: `ord-s-${i}`, lalamove_id: `LLM-S-${i}`, internal_order_id: null,
      status, pickup_address: 'A', delivery_address: 'B',
      customer_name: 'C', customer_phone: null,
      scheduled_at: '2026-03-15T10:00:00Z',
      estimated_delivery: null, actual_delivery: null,
      driver_id: null, vehicle_type: 'MOTORCYCLE',
      total_cost: 0, currency: 'BRL', tags: [],
      created_at: '2026-03-15T09:00:00Z', updated_at: '2026-03-15T09:00:00Z',
      drivers: null,
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockOrders, count: 8, error: null })
    );

    const { useRecentOrders } = await import('../useRecentOrders');
    const { result } = renderHook(() => useRecentOrders(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.orders).toHaveLength(8);
    expect(result.current.data?.orders.map(o => o.status)).toEqual(statuses);
  });
});
