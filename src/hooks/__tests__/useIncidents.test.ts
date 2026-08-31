import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    })),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useIncidents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve buscar e mapear incidentes corretamente', async () => {
    const mockIncidents = [
      {
        id: 'inc-1',
        driver_id: 'drv-1',
        type: 'LATE_DELIVERY',
        severity: 'MEDIUM',
        description: 'Entrega atrasada em 20 min',
        order_id: 'ord-1',
        reported_by: null,
        evidence_urls: null,
        resolved: false,
        resolved_at: null,
        resolution_notes: null,
        created_at: '2026-03-15T08:00:00Z',
        metadata: null,
        drivers: { name: 'João Silva' },
      },
    ];

    mockSelect.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: mockIncidents, error: null }),
    });

    const { useIncidents } = await import('@/hooks/useIncidents');
    const { result } = renderHook(() => useIncidents(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].driverName).toBe('João Silva');
    expect(result.current.data![0].type).toBe('LATE_DELIVERY');
    expect(result.current.data![0].resolved).toBe(false);
  });

  it('deve lidar com erro na busca', async () => {
    mockSelect.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Permission denied' } }),
    });

    const { useIncidents } = await import('@/hooks/useIncidents');
    const { result } = renderHook(() => useIncidents(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('deve retornar lista vazia quando sem dados', async () => {
    mockSelect.mockReturnValueOnce({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const { useIncidents } = await import('@/hooks/useIncidents');
    const { result } = renderHook(() => useIncidents(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });
});
