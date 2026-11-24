import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTrackingData } from '../useTrackingData';

const selectMock = vi.fn();
const eqMock = vi.fn();
/** Reproduz a cadeia real do supabase-js: `select()` → `.eq()` → await. */
const selectChainable = () => {
  const promise = selectMock() as Promise<{ data: unknown; error: unknown }>;
  return {
    eq: (...args: unknown[]) => {
      eqMock(...args);
      return promise;
    },
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
};
const removeChannelMock = vi.fn();
const onMock = vi.fn().mockReturnThis();
const subscribeMock = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const channelMock = vi.fn(() => ({ on: onMock, subscribe: subscribeMock }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    // `select()` encadeia `.eq('tracking_status','ACTIVE')` antes do await.
    from: vi.fn(() => ({ select: selectChainable })),
    channel: (...args: unknown[]) => channelMock(...(args as [])),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const baseRow = {
  id: 't1',
  order_id: 'o1',
  driver_id: 'd1',
  current_latitude: -23.5,
  current_longitude: -46.6,
  heading: 90,
  speed: 40,
  is_on_route: true,
  is_stopped: false,
  eta_minutes: 10,
};

describe('useTrackingData', () => {
  beforeEach(() => {
    selectMock.mockReset();
    onMock.mockClear();
    subscribeMock.mockClear();
    channelMock.mockClear();
    removeChannelMock.mockClear();
  });

  it('faz o fetch inicial e popula trackingData/allTrackingData', async () => {
    selectMock.mockResolvedValue({
      data: [{ ...baseRow, driver: { vehicle_type: 'CAR' } }],
      error: null,
    });
    const { result } = renderHook(() => useTrackingData('ALL', 'ALL'));
    await waitFor(() => expect(result.current.trackingData).toHaveLength(1));
    expect(result.current.allTrackingData).toHaveLength(1);
    // Só entrega viva entra no mapa: tracking encerrado não pinta motorista fantasma.
    expect(eqMock).toHaveBeenCalledWith('tracking_status', 'ACTIVE');
  });

  it('filtra por tipo de veículo', async () => {
    selectMock.mockResolvedValue({
      data: [
        { ...baseRow, id: 'a', driver: { vehicle_type: 'CAR' } },
        { ...baseRow, id: 'b', driver: { vehicle_type: 'MOTORCYCLE' } },
      ],
      error: null,
    });
    const { result } = renderHook(() => useTrackingData('MOTORCYCLE', 'ALL'));
    await waitFor(() => expect(result.current.trackingData).toHaveLength(1));
    expect(result.current.trackingData[0].id).toBe('b');
    expect(result.current.allTrackingData).toHaveLength(2);
  });

  it('filtra por status STOPPED', async () => {
    selectMock.mockResolvedValue({
      data: [
        { ...baseRow, id: 'stopped', is_stopped: true },
        { ...baseRow, id: 'transit', is_on_route: true, is_stopped: false },
      ],
      error: null,
    });
    const { result } = renderHook(() => useTrackingData('ALL', 'STOPPED'));
    await waitFor(() => expect(result.current.trackingData).toHaveLength(1));
    expect(result.current.trackingData[0].id).toBe('stopped');
  });

  it('filtra por status OFF_ROUTE e IN_TRANSIT', async () => {
    selectMock.mockResolvedValue({
      data: [
        { ...baseRow, id: 'off', is_on_route: false, is_stopped: false },
        { ...baseRow, id: 'transit', is_on_route: true, is_stopped: false },
      ],
      error: null,
    });
    const { result, rerender } = renderHook(
      ({ s }: { s: 'OFF_ROUTE' | 'IN_TRANSIT' }) => useTrackingData('ALL', s),
      { initialProps: { s: 'OFF_ROUTE' } },
    );
    await waitFor(() => expect(result.current.trackingData.map(r => r.id)).toEqual(['off']));

    rerender({ s: 'IN_TRANSIT' });
    await waitFor(() => expect(result.current.trackingData.map(r => r.id)).toEqual(['transit']));
  });

  it('remove o canal Realtime ao desmontar', async () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    const { unmount } = renderHook(() => useTrackingData('ALL', 'ALL'));
    await waitFor(() => expect(selectMock).toHaveBeenCalled());
    unmount();
    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });

  it('faz polling a cada 5 segundos', async () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderHook(() => useTrackingData('ALL', 'ALL'));
      await vi.waitFor(() => expect(selectMock).toHaveBeenCalledTimes(1));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(selectMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(selectMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
