import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';


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

import { supabase } from '@/integrations/supabase/client';
import { useTrackingHistory } from '../useTrackingHistory';

describe('useTrackingHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve buscar histórico de tracking', async () => {
    const events = [
      { id: 'e1', order_id: 'ord-1', driver_id: 'drv-1', latitude: -23.55, longitude: -46.63, heading: 90, speed: 30, created_at: '2026-03-15T10:00:00Z', event_type: 'location_update' },
      { id: 'e2', order_id: 'ord-1', driver_id: 'drv-1', latitude: -23.56, longitude: -46.64, heading: 180, speed: 0, created_at: '2026-03-15T10:01:00Z', event_type: 'stop' },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: events, error: null })
    );

    const { result } = renderHook(() => useTrackingHistory());

    expect(result.current.loading).toBe(false);
    expect(result.current.history).toHaveLength(0);

    await act(async () => {
      await result.current.fetchHistory('drv-1');
    });

    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].latitude).toBe(-23.55);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('deve lidar com erro graciosamente', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: null, error: { message: 'Table not found' } })
    );

    const { result } = renderHook(() => useTrackingHistory());

    await act(async () => {
      await result.current.fetchHistory('drv-1');
    });

    expect(result.current.error).toBe('Erro ao buscar histórico de rastreamento');
    expect(result.current.history).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });

  it('deve limpar histórico', async () => {
    const events = [
      { id: 'e1', order_id: 'o1', driver_id: 'd1', latitude: 0, longitude: 0, heading: 0, speed: 0, created_at: '2026-03-15T10:00:00Z', event_type: null },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: events, error: null })
    );

    const { result } = renderHook(() => useTrackingHistory());

    await act(async () => {
      await result.current.fetchHistory('d1');
    });

    expect(result.current.history).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('deve buscar com orderId e limit', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: [], error: null })
    );

    const { result } = renderHook(() => useTrackingHistory());

    await act(async () => {
      await result.current.fetchHistory('drv-1', 'ord-1', 50);
    });

    expect(result.current.history).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });

  it('deve simular 300 pontos de rastreamento sem quebrar', async () => {
    const events = Array.from({ length: 300 }, (_, i) => ({
      id: `e-${i}`,
      order_id: 'ord-1',
      driver_id: 'drv-1',
      latitude: -23.55 + (i * 0.001),
      longitude: -46.63 + (i * 0.001),
      heading: (i * 15) % 360,
      speed: Math.floor(Math.random() * 60),
      created_at: `2026-03-15T10:${String(i % 60).padStart(2, '0')}:00Z`,
      event_type: i % 10 === 0 ? 'stop' : 'location_update',
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: events, error: null })
    );

    const { result } = renderHook(() => useTrackingHistory());

    await act(async () => {
      await result.current.fetchHistory('drv-1');
    });

    expect(result.current.history).toHaveLength(300);
    expect(result.current.history.every(e => e.latitude >= -90 && e.latitude <= 90)).toBe(true);
    expect(result.current.history.filter(e => e.event_type === 'stop')).toHaveLength(30);
  });
});

