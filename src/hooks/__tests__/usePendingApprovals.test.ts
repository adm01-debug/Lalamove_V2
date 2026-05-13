import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order', 'update', 'delete', 'insert', 'single', 'head'];
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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../useGlobalUndo', () => ({
  showUndoToast: vi.fn(),
}));

import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePendingApprovals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve buscar e mapear aprovações pendentes', async () => {
    const mockApprovals = [
      {
        id: 'app-1', driver_id: 'drv-1', order_id: 'ord-1',
        status: 'PENDING', risk_score: 7.5,
        risk_factors: ['Novo motorista', 'Pedido urgente'],
        requested_at: '2026-03-15T10:00:00Z',
        reviewed_at: null, reviewed_by: null, notes: null,
        approval_priority: 'HIGH', decision_notes: null,
        driver_name: null, priority: null,
        drivers: {
          id: 'drv-1', lalamove_id: 'LLM001', name: 'Carlos Silva',
          phone: '11999999999', photo_url: null, vehicle_type: 'MOTORCYCLE',
          vehicle_plate: 'ABC1234', risk_score: 7.5, status: 'PENDING_APPROVAL',
          total_deliveries: 5, completed_deliveries: 3, rating: 4.0,
          last_active_at: '2026-03-15T09:00:00Z', created_at: '2025-01-01T00:00:00Z',
        },
        lalamove_orders: {
          id: 'ord-1', lalamove_id: 'LLM-ORD-001', internal_order_id: 'INT-001',
          status: 'PENDING', pickup_address: 'Rua A, 100',
          delivery_address: 'Rua B, 200', customer_name: 'Maria Souza',
          customer_phone: '11988888888', scheduled_at: '2026-03-15T11:00:00Z',
          estimated_delivery: '2026-03-15T12:00:00Z', vehicle_type: 'MOTORCYCLE',
          total_cost: 25.50, currency: 'BRL', tags: ['urgente'],
          created_at: '2026-03-15T09:30:00Z', updated_at: '2026-03-15T09:30:00Z',
        },
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockApprovals, error: null })
    );

    const { usePendingApprovals } = await import('../usePendingApprovals');
    const { result } = renderHook(() => usePendingApprovals(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    const approval = result.current.data![0];
    expect(approval.driverId).toBe('drv-1');
    expect(approval.orderId).toBe('ord-1');
    expect(approval.riskScore).toBe(7.5);
    expect(approval.riskFactors).toEqual(['Novo motorista', 'Pedido urgente']);
    expect(approval.approvalPriority).toBe('HIGH');
    expect(approval.driver?.name).toBe('Carlos Silva');
    expect(approval.order?.customerName).toBe('Maria Souza');
    expect(approval.requestedAt).toBeInstanceOf(Date);
  });

  it('deve lidar com driver e order null', async () => {
    const mockApprovals = [
      {
        id: 'app-2', driver_id: 'drv-x', order_id: 'ord-x',
        status: 'PENDING', risk_score: 5, risk_factors: null,
        requested_at: '2026-03-15T10:00:00Z',
        reviewed_at: null, reviewed_by: null, notes: null,
        approval_priority: null, decision_notes: null,
        driver_name: null, priority: null,
        drivers: null, lalamove_orders: null,
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockApprovals, error: null })
    );

    const { usePendingApprovals } = await import('../usePendingApprovals');
    const { result } = renderHook(() => usePendingApprovals(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    const approval = result.current.data![0];
    expect(approval.driver?.name).toBe('Motorista');
    expect(approval.order?.customerName).toBe('');
    expect(approval.riskFactors).toEqual([]);
    expect(approval.approvalPriority).toBeUndefined();
  });

  it('deve propagar erro do supabase', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: null, error: { message: 'Permission denied' } })
    );

    const { usePendingApprovals } = await import('../usePendingApprovals');
    const { result } = renderHook(() => usePendingApprovals(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('deve retornar lista vazia sem aprovações', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: [], error: null })
    );

    const { usePendingApprovals } = await import('../usePendingApprovals');
    const { result } = renderHook(() => usePendingApprovals(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('deve mapear todas as prioridades', async () => {
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'];
    const mockApprovals = priorities.map((p, i) => ({
      id: `app-p-${i}`, driver_id: `drv-${i}`, order_id: `ord-${i}`,
      status: 'PENDING', risk_score: i * 2, risk_factors: [],
      requested_at: '2026-03-15T10:00:00Z',
      reviewed_at: null, reviewed_by: null, notes: null,
      approval_priority: p, decision_notes: null,
      driver_name: null, priority: null,
      drivers: null, lalamove_orders: null,
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockApprovals, error: null })
    );

    const { usePendingApprovals } = await import('../usePendingApprovals');
    const { result } = renderHook(() => usePendingApprovals(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map(a => a.approvalPriority)).toEqual(priorities);
  });
});

describe('useApprovalStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve calcular stats corretamente', async () => {
    let callIdx = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIdx++;
      if (callIdx <= 3) {
        return chainable({ count: callIdx === 1 ? 5 : callIdx === 2 ? 10 : 3, error: null });
      }
      return chainable({ data: [{ risk_score: 6 }, { risk_score: 8 }], error: null });
    });

    const { useApprovalStats } = await import('../usePendingApprovals');
    const { result } = renderHook(() => useApprovalStats(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.pending).toBe(5);
    expect(result.current.data?.approvedToday).toBe(10);
    expect(result.current.data?.rejectedToday).toBe(3);
    expect(result.current.data?.avgRiskScore).toBe(7);
  });

  it('deve retornar avgRiskScore 0 sem dados pendentes', async () => {
    let callIdx = 0;
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callIdx++;
      if (callIdx <= 3) return chainable({ count: 0, error: null });
      return chainable({ data: [], error: null });
    });

    const { useApprovalStats } = await import('../usePendingApprovals');
    const { result } = renderHook(() => useApprovalStats(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.avgRiskScore).toBe(0);
  });
});
