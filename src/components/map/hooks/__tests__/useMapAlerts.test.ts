import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMapAlerts } from '../useMapAlerts';
import type { TrackingData } from '../useTrackingData';

const makeTracking = (overrides: Partial<TrackingData> = {}): TrackingData => ({
  id: 't1',
  order_id: 'o1',
  driver_id: 'd1',
  current_latitude: -23.5,
  current_longitude: -46.6,
  heading: 0,
  speed: 30,
  is_on_route: true,
  is_stopped: false,
  eta_minutes: 20,
  ...overrides,
});

describe('useMapAlerts', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00Z')));
  afterEach(() => vi.useRealTimers());

  it('detecta fora de rota via is_on_route=false', () => {
    const { result, rerender } = renderHook(({ d }: { d: TrackingData[] }) => useMapAlerts(d), {
      initialProps: { d: [makeTracking({ id: 'a' })] },
    });
    expect(result.current.offRouteAlerts.size).toBe(0);

    rerender({ d: [makeTracking({ id: 'a', is_on_route: false })] });
    expect(result.current.offRouteAlerts.has('a')).toBe(true);

    rerender({ d: [makeTracking({ id: 'a', is_on_route: true })] });
    expect(result.current.offRouteAlerts.has('a')).toBe(false);
  });

  it('registra timestamp de parada e o preserva enquanto continua parado', () => {
    const { result, rerender } = renderHook(({ d }: { d: TrackingData[] }) => useMapAlerts(d), {
      initialProps: { d: [makeTracking({ id: 'a', speed: 0 })] },
    });
    const t0 = result.current.stoppedAlerts.get('a');
    expect(t0).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    rerender({ d: [makeTracking({ id: 'a', speed: 0 })] });
    expect(result.current.stoppedAlerts.get('a')).toBe(t0);

    rerender({ d: [makeTracking({ id: 'a', speed: 40 })] });
    expect(result.current.stoppedAlerts.has('a')).toBe(false);
  });

  it('calcula tendência de ETA (improving / worsening / stable)', () => {
    const { result, rerender } = renderHook(({ d }: { d: TrackingData[] }) => useMapAlerts(d), {
      initialProps: { d: [makeTracking({ id: 'a', eta_minutes: 20 })] },
    });
    expect(result.current.etaIndicator.get('a')?.trend).toBe('stable');

    rerender({ d: [makeTracking({ id: 'a', eta_minutes: 15 })] });
    expect(result.current.etaIndicator.get('a')?.trend).toBe('improving');

    rerender({ d: [makeTracking({ id: 'a', eta_minutes: 25 })] });
    expect(result.current.etaIndicator.get('a')?.trend).toBe('worsening');

    expect(result.current.etaIndicator.get('a')?.original).toBe(20);
  });

  it('limpa alertas de trackings que desapareceram', () => {
    const { result, rerender } = renderHook(({ d }: { d: TrackingData[] }) => useMapAlerts(d), {
      initialProps: {
        d: [
          makeTracking({ id: 'a', speed: 0, is_on_route: false, eta_minutes: 10 }),
          makeTracking({ id: 'b', speed: 0 }),
        ],
      },
    });
    expect(result.current.stoppedAlerts.size).toBe(2);
    expect(result.current.offRouteAlerts.has('a')).toBe(true);

    rerender({ d: [makeTracking({ id: 'b', speed: 0 })] });
    expect(result.current.stoppedAlerts.has('a')).toBe(false);
    expect(result.current.offRouteAlerts.has('a')).toBe(false);
    expect(result.current.etaIndicator.has('a')).toBe(false);
    expect(result.current.stoppedAlerts.has('b')).toBe(true);
  });
});
