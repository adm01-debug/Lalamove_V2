import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// Chainable mock builder
function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order', 'ilike', 'lte', 'update', 'delete', 'insert', 'single', 'maybeSingle', 'range'];
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
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../useRealtimeSubscriptions', () => ({
  useAlertsRealtime: vi.fn(),
}));

import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useActiveAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve buscar alertas ativos corretamente', async () => {
    const mockAlerts = [
      {
        id: 'alert-1',
        type: 'LATE_DELIVERY',
        severity: 'WARNING',
        title: 'Entrega Atrasada',
        message: 'Pedido ORD-001 atrasado 15 min',
        order_id: 'ord-1',
        driver_id: 'drv-1',
        is_read: false,
        is_dismissed: false,
        created_at: '2026-03-15T10:00:00Z',
        metadata: {},
      },
      {
        id: 'alert-2',
        type: 'DRIVER_BLOCKED',
        severity: 'CRITICAL',
        title: 'Motorista Bloqueado',
        message: 'Motorista DRV-002 bloqueado automaticamente',
        order_id: null,
        driver_id: 'drv-2',
        is_read: true,
        is_dismissed: false,
        created_at: '2026-03-15T09:00:00Z',
        metadata: {},
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockAlerts, error: null })
    );

    const { useActiveAlerts } = await import('../useActiveAlerts');
    const { result } = renderHook(() => useActiveAlerts(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].title).toBe('Entrega Atrasada');
    expect(result.current.data![0].type).toBe('LATE_DELIVERY');
    expect(result.current.data![0].severity).toBe('WARNING');
    expect(result.current.data![0].isRead).toBe(false);
    expect(result.current.data![0].orderId).toBe('ord-1');
    expect(result.current.data![0].driverId).toBe('drv-1');
    expect(result.current.data![0].createdAt).toBeInstanceOf(Date);
  });

  it('deve mapear null order_id/driver_id para undefined', async () => {
    const mockAlerts = [
      {
        id: 'alert-3', type: 'ORDER_CANCELLED', severity: 'INFO',
        title: 'Pedido Cancelado', message: 'Teste',
        order_id: null, driver_id: null, is_read: false,
        is_dismissed: false, created_at: '2026-03-15T08:00:00Z', metadata: {},
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockAlerts, error: null })
    );

    const { useActiveAlerts } = await import('../useActiveAlerts');
    const { result } = renderHook(() => useActiveAlerts(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].orderId).toBeUndefined();
    expect(result.current.data![0].driverId).toBeUndefined();
  });

  it('deve lidar com is_read null defaulting para false', async () => {
    const mockAlerts = [
      {
        id: 'alert-4', type: 'ROUTE_DEVIATION', severity: 'WARNING',
        title: 'Desvio de rota', message: 'Desvio detectado',
        order_id: null, driver_id: null, is_read: null,
        is_dismissed: false, created_at: '2026-03-15T08:00:00Z', metadata: {},
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockAlerts, error: null })
    );

    const { useActiveAlerts } = await import('../useActiveAlerts');
    const { result } = renderHook(() => useActiveAlerts(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].isRead).toBe(false);
  });

  it('deve retornar lista vazia quando sem alertas', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: [], error: null })
    );

    const { useActiveAlerts } = await import('../useActiveAlerts');
    const { result } = renderHook(() => useActiveAlerts(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('deve retornar lista vazia quando data é null', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: null, error: null })
    );

    const { useActiveAlerts } = await import('../useActiveAlerts');
    const { result } = renderHook(() => useActiveAlerts(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('deve propagar erro do supabase', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: null, error: { message: 'RLS denied' } })
    );

    const { useActiveAlerts } = await import('../useActiveAlerts');
    const { result } = renderHook(() => useActiveAlerts(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('deve mapear todos os tipos de severidade', async () => {
    const severities = ['INFO', 'WARNING', 'CRITICAL'];
    const mockAlerts = severities.map((sev, i) => ({
      id: `alert-sev-${i}`, type: 'LATE_DELIVERY', severity: sev,
      title: `Alert ${sev}`, message: 'Test',
      order_id: null, driver_id: null, is_read: false,
      is_dismissed: false, created_at: '2026-03-15T08:00:00Z', metadata: {},
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockAlerts, error: null })
    );

    const { useActiveAlerts } = await import('../useActiveAlerts');
    const { result } = renderHook(() => useActiveAlerts(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map(a => a.severity)).toEqual(['INFO', 'WARNING', 'CRITICAL']);
  });

  it('deve mapear todos os tipos de alerta', async () => {
    const types = ['DRIVER_BLOCKED', 'ROUTE_DEVIATION', 'DRIVER_STOPPED', 'LATE_DELIVERY', 'APPROVAL_REQUIRED', 'ORDER_CANCELLED'];
    const mockAlerts = types.map((type, i) => ({
      id: `alert-type-${i}`, type, severity: 'INFO',
      title: `Alert ${type}`, message: 'Test',
      order_id: null, driver_id: null, is_read: false,
      is_dismissed: false, created_at: '2026-03-15T08:00:00Z', metadata: {},
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockAlerts, error: null })
    );

    const { useActiveAlerts } = await import('../useActiveAlerts');
    const { result } = renderHook(() => useActiveAlerts(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(6);
  });
});
