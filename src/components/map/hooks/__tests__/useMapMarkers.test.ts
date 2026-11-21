import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type mapboxgl from 'mapbox-gl';
import { useMapMarkers } from '../useMapMarkers';
import type { TrackingData } from '../useTrackingData';

const addTo = vi.fn();
const setLngLat = vi.fn();
const setPopup = vi.fn();
const getElement = vi.fn();
const remove = vi.fn();

vi.mock('mapbox-gl', () => ({
  default: {
    LngLatBounds: class { extend() { return this; } isEmpty() { return false; } },
    Marker: class {
      addTo = (map: unknown) => {
        if (!map || !(map as { getCanvas?: () => unknown }).getCanvas?.()) {
          throw new TypeError("Cannot read properties of undefined (reading 'appendChild')");
        }
        addTo(map);
        return this;
      };
      setLngLat = (pos: unknown) => {
        setLngLat(pos);
        return this;
      };
      setPopup = (p: unknown) => {
        setPopup(p);
        return this;
      };
      getPopup = () => null;
      getElement = () => {
        getElement();
        return document.createElement('div');
      };
      remove = () => remove();
    },
  },
}));

vi.mock('../../markerFactories', () => ({
  createDriverMarkerElement: () => Object.assign(document.createElement('div'), { innerHTML: '' }),
  createDriverPopup: () => ({}),
  createPickupMarkerElement: () => document.createElement('div'),
  createDeliveryMarkerElement: () => document.createElement('div'),
  createStoppedMarkerElement: () => document.createElement('div'),
  createClusterMarkerElement: () => document.createElement('div'),
}));

/** Mapa com canvas vivo — o caso normal. */
function liveMap() {
  return {
    getCanvas: () => document.createElement('canvas'),
    getContainer: () => document.createElement('div'),
    isStyleLoaded: () => true,
    getSource: () => ({ setData: vi.fn() }),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getLayer: () => undefined,
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    flyTo: vi.fn(),
  } as unknown as mapboxgl.Map;
}

/** Instância já destruída por map.remove() — getCanvas() vira undefined. */
function destroyedMap() {
  return {
    getCanvas: () => undefined,
    getContainer: () => undefined,
    isStyleLoaded: () => false,
    getSource: () => undefined,
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getLayer: () => undefined,
    setPaintProperty: vi.fn(),
  } as unknown as mapboxgl.Map;
}

const makeTracking = (overrides: Partial<TrackingData> = {}): TrackingData =>
  ({
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
  }) as TrackingData;

function renderMarkers(overrides: Record<string, unknown> = {}) {
  const mapRef = { current: liveMap() };
  const props = {
    mapRef,
    loading: false,
    trackingData: [makeTracking()],
    selectedId: null as string | null,
    onSelect: vi.fn(),
    focusMode: false,
    markerDensity: 'comfortable' as const,
    isFarZoom: false,
    isVeryFarZoom: false,
    veryFarZoomThreshold: 11,
    offRouteAlerts: new Set<string>(),
    stoppedAlerts: new Map<string, number>(),
    stoppedThreshold: 5,
    ...overrides,
  };
  const hook = renderHook((p: typeof props) => useMapMarkers(p), { initialProps: props });
  return { ...hook, mapRef, props };
}

describe('useMapMarkers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('cria um marker por veículo quando o mapa está vivo', () => {
    renderMarkers();
    expect(addTo).toHaveBeenCalledTimes(1);
    expect(setLngLat).toHaveBeenCalledWith([-46.6, -23.5]);
  });

  it('não cria markers enquanto o loading do mapa é true', () => {
    renderMarkers({ loading: true });
    expect(addTo).not.toHaveBeenCalled();
  });

  it('não toca em mapa destruído (regressão do appendChild no StrictMode)', () => {
    const mapRef = { current: destroyedMap() };
    expect(() => renderMarkers({ mapRef })).not.toThrow();
    expect(addTo).not.toHaveBeenCalled();
  });

  it('não toca em mapa nulo (cleanup já zerou map.current)', () => {
    const mapRef = { current: null };
    expect(() => renderMarkers({ mapRef })).not.toThrow();
    expect(addTo).not.toHaveBeenCalled();
  });

  it('sobrevive a getCanvas() que lança (Mapbox removeu o canvas)', () => {
    const mapRef = {
      current: {
        ...liveMap(),
        getCanvas: () => {
          throw new Error('Map has already been removed');
        },
      } as unknown as mapboxgl.Map,
    };
    expect(() => renderMarkers({ mapRef })).not.toThrow();
    expect(addTo).not.toHaveBeenCalled();
  });

  it('remove o marker do veículo que saiu do tracking', () => {
    const { rerender, props } = renderMarkers();
    expect(addTo).toHaveBeenCalledTimes(1);
    rerender({ ...props, trackingData: [] });
    expect(remove).toHaveBeenCalled();
  });

  it('resetMarkers limpa todos os markers criados', () => {
    const { result } = renderMarkers();
    result.current.resetMarkers();
    expect(remove).toHaveBeenCalled();
  });
});
