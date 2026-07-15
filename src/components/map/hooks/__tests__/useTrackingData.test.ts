import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTrackingData } from '../useTrackingData';

/**
 * Mocks do cliente Supabase.
 * `selectMock` é reatribuído por teste para simular payloads distintos.
 */
const selectMock = vi.fn();
const removeChannelMock = vi.fn();
const onMock = vi.fn().mockReturnThis();
const subscribeMock = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const channelMock = vi.fn(() => ({ on: onMock, subscribe: subscribeMock }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ select: selectMock })),
    channel: (...args: unknown[]) => channelMock(...args as []),
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
    vi.useFakeTimers();
    selectMock.mockReset();
    onMock.mockClear();
    subscribeMock.mockClear();
    channelMock.mockClear();
    removeChannelMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('faz o fetch inicial e popula trackingData/allTrackingData', async () => {
    selectMock.mockResolvedValueOnce({
      data: [{ ...baseRow, driver: { vehicle_type: 'CAR' } }],
      error: null,
    });

    const { result } = renderHook(() => useTrackingData('ALL', 'ALL'));

    await waitFor(() => expect(result.current.trackingData).toHaveLength(1));
    expect(result.current.allTrackingData).toHaveLength(1);
  });

  it('filtra por tipo de veículo', async () => {
    selectMock.mockResolvedValueOnce({
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

  it('filtra por status STOPPED / OFF_ROUTE / IN_TRANSIT', async () => {
    const rows = [
      { ...baseRow, id: 'stopped', is_stopped: true },
      { ...baseRow, id: 'off', is_on_route: false, is_stopped: false },
      { ...baseRow, id: 'transit', is_on_route: true, is_stopped: false },
    ];
    selectMock.mockResolvedValue({ data: rows, error: null });

    const { result, rerender } = renderHook(
      ({ s }: { s: 'STOPPED' | 'OFF_ROUTE' | 'IN_TRANSIT' }) => useTrackingData('ALL', s),
      { initialProps: { s: 'STOPPED' } },
    );
    await waitFor(() => expect(result.current.trackingData.map(r => r.id)).toEqual(['stopped']));

    rerender({ s: 'OFF_ROUTE' });
    await waitFor(() => expect(result.current.trackingData.map(r => r.id)).toEqual(['off']));

    rerender({ s: 'IN_TRANSIT' });
    await waitFor(() => expect(result.current.trackingData.map(r => r.id)).toEqual(['transit']));
  });

  it('não atualiza estado quando fetch resolve após unmount (guarda cancelled)', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    selectMock.mockReturnValueOnce(new Promise(res => { resolveFetch = res; }));

    const { result, unmount } = renderHook(() => useTrackingData('ALL', 'ALL'));

    unmount();
    await act(async () => {
      resolveFetch({ data: [{ ...baseRow }], error: null });
    });

    expect(result.current.trackingData).toHaveLength(0);
    expect(removeChannelMock).toHaveBeenCalled();
  });

  it('faz polling a cada 5 segundos', async () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    renderHook(() => useTrackingData('ALL', 'ALL'));

    await waitFor(() => expect(selectMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(selectMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(selectMock).toHaveBeenCalledTimes(3);
  });
});
