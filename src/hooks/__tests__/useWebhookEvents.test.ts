import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order', 'ilike', 'lte', 'update', 'delete'];
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

describe('useWebhookEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve buscar eventos sem filtros', async () => {
    const mockEvents = [
      {
        id: 'wh-1',
        event_type: 'ORDER_STATUS_CHANGED',
        lalamove_order_id: 'LLM-001',
        raw_payload: { status: 'COMPLETED' },
        processed: true,
        processed_at: '2026-03-15T10:05:00Z',
        error_message: null,
        received_at: '2026-03-15T10:00:00Z',
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockEvents, error: null })
    );

    const { useWebhookEvents } = await import('../useWebhookEvents');
    const { result } = renderHook(() => useWebhookEvents({}), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].event_type).toBe('ORDER_STATUS_CHANGED');
    expect(result.current.data![0].processed).toBe(true);
  });

  it('deve retornar lista vazia', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: [], error: null })
    );

    const { useWebhookEvents } = await import('../useWebhookEvents');
    const { result } = renderHook(() => useWebhookEvents({}), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('deve propagar erro', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: null, error: { message: 'Forbidden' } })
    );

    const { useWebhookEvents } = await import('../useWebhookEvents');
    const { result } = renderHook(() => useWebhookEvents({}), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('deve lidar com data null', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: null, error: null })
    );

    const { useWebhookEvents } = await import('../useWebhookEvents');
    const { result } = renderHook(() => useWebhookEvents({}), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('deve lidar com múltiplos eventos com erros', async () => {
    const mockEvents = [
      {
        id: 'wh-2',
        event_type: 'DRIVER_LOCATION',
        lalamove_order_id: null,
        raw_payload: {},
        processed: false,
        processed_at: null,
        error_message: 'Driver not found',
        received_at: '2026-03-15T09:00:00Z',
      },
      {
        id: 'wh-3',
        event_type: 'ORDER_STATUS_CHANGED',
        lalamove_order_id: 'LLM-002',
        raw_payload: { status: 'CANCELLED' },
        processed: false,
        processed_at: null,
        error_message: 'Order not in DB',
        received_at: '2026-03-15T08:00:00Z',
      },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: mockEvents, error: null })
    );

    const { useWebhookEvents } = await import('../useWebhookEvents');
    const { result } = renderHook(() => useWebhookEvents({ processed: false }), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data!.every(e => !e.processed)).toBe(true);
    expect(result.current.data!.every(e => e.error_message !== null)).toBe(true);
  });
});

describe('useEventTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('deve deduplicar tipos de evento', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: [
        { event_type: 'ORDER_STATUS_CHANGED' },
        { event_type: 'ORDER_STATUS_CHANGED' },
        { event_type: 'DRIVER_LOCATION' },
      ], error: null })
    );

    const { useEventTypes } = await import('../useWebhookEvents');
    const { result } = renderHook(() => useEventTypes(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['ORDER_STATUS_CHANGED', 'DRIVER_LOCATION']);
  });

  it('deve retornar vazio sem dados', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      chainable({ data: [], error: null })
    );

    const { useEventTypes } = await import('../useWebhookEvents');
    const { result } = renderHook(() => useEventTypes(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
