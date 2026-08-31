import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order', 'insert', 'update', 'delete', 'single'];
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

describe('useRiskRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve buscar e mapear regras de risco', async () => {
    const rules = [
      { id: 'r1', name: 'Poucos pedidos', description: 'Motorista com menos de 5 entregas', condition: { field: 'total_deliveries', operator: '<', value: 5 }, score_impact: 3, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'r2', name: 'Rating baixo', description: null, condition: { field: 'rating', operator: '<', value: 3 }, score_impact: 4, is_active: false, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: rules, error: null })
    );

    const { useRiskRules } = await import('../useRiskRules');
    const { result } = renderHook(() => useRiskRules(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].condition.field).toBe('total_deliveries');
    expect(result.current.data![1].is_active).toBe(false);
  });

  it('deve retornar lista vazia sem regras', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: [], error: null })
    );

    const { useRiskRules } = await import('../useRiskRules');
    const { result } = renderHook(() => useRiskRules(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('deve propagar erro', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: null, error: { message: 'DB error' } })
    );

    const { useRiskRules } = await import('../useRiskRules');
    const { result } = renderHook(() => useRiskRules(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('deve simular 100 regras variadas sem quebrar', async () => {
    const fields = ['total_deliveries', 'rating', 'failure_rate', 'incident_count', 'avg_delay_minutes'];
    const operators = ['<', '>', '<=', '>=', '=='];
    const rules = Array.from({ length: 100 }, (_, i) => ({
      id: `rule-${i}`,
      name: `Rule ${i}`,
      description: i % 3 === 0 ? null : `Desc ${i}`,
      condition: { field: fields[i % fields.length], operator: operators[i % operators.length], value: i * 0.5 },
      score_impact: (i % 10) + 1,
      is_active: i % 4 !== 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: rules, error: null })
    );

    const { useRiskRules } = await import('../useRiskRules');
    const { result } = renderHook(() => useRiskRules(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(100);
    expect(result.current.data!.filter(r => r.is_active).length).toBe(75);
    expect(result.current.data!.filter(r => r.description === null).length).toBe(34);
  });
});

describe('useCreateRiskRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve criar regra com sucesso', async () => {
    const created = {
      id: 'new-r',
      name: 'Nova regra',
      description: null,
      condition: { field: 'rating', operator: '<', value: 2 },
      score_impact: 5,
      is_active: true,
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-03-15T00:00:00Z',
    };

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: created, error: null })
    );

    const { useCreateRiskRule } = await import('../useRiskRules');
    const { result } = renderHook(() => useCreateRiskRule(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        name: 'Nova regra',
        condition: { field: 'rating', operator: '<', value: 2 },
        score_impact: 5,
      });
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Nova regra');
  });
});
