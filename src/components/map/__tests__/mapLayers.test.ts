import { describe, it, expect, vi } from 'vitest';
import type mapboxgl from 'mapbox-gl';
import { setupMapLayers, setExpectedRoute, setDriverTrail } from '../mapLayers';

/**
 * Fábrica de mock de mapa Mapbox que rastreia sources/layers adicionados.
 * `existingSources` permite simular sources pré-existentes para validar idempotência.
 */
function createMapMock(existingSources: string[] = []) {
  const sources = new Set<string>(existingSources);
  const layers: Array<{ id: string; source?: string; type: string }> = [];

  const map = {
    getSource: vi.fn((id: string) => (sources.has(id) ? { id } : undefined)),
    addSource: vi.fn((id: string) => {
      sources.add(id);
    }),
    addLayer: vi.fn((layer: { id: string; source?: string; type: string }) => {
      layers.push(layer);
    }),
  } as unknown as mapboxgl.Map;

  return { map, sources, layers };
}

describe('setupMapLayers', () => {
  it('adiciona sources e layers de zonas de risco, heatmap e geofence', () => {
    const { map, sources, layers } = createMapMock();
    setupMapLayers(map, false);

    expect(sources.has('risk-zones')).toBe(true);
    expect(sources.has('traffic-heatmap')).toBe(true);
    expect(sources.has('geofence')).toBe(true);
    expect(sources.has('mapbox-traffic')).toBe(false);

    const ids = layers.map(l => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'risk-zones-fill',
        'risk-zones-outline',
        'traffic-heatmap-layer',
        'geofence-fill',
        'geofence-outline',
      ]),
    );
    expect(ids).not.toContain('traffic-layer');
  });

  it('adiciona a camada de tráfego somente quando showTraffic=true', () => {
    const { map, sources, layers } = createMapMock();
    setupMapLayers(map, true);

    expect(sources.has('mapbox-traffic')).toBe(true);
    expect(layers.find(l => l.id === 'traffic-layer')).toBeDefined();
  });

  it('é idempotente: não recria sources já existentes', () => {
    const { map, layers } = createMapMock([
      'risk-zones',
      'traffic-heatmap',
      'geofence',
      'mapbox-traffic',
      'expected-route',
      'driver-trail',
    ]);
    setupMapLayers(map, true);

    expect(map.addSource).not.toHaveBeenCalled();
    expect(layers).toHaveLength(0);
  });

  it('define maxzoom=15 e ordem de inserção do heatmap antes de waterway-label', () => {
    const { map } = createMapMock();
    setupMapLayers(map, false);

    const heatmapCall = (map.addLayer as ReturnType<typeof vi.fn>).mock.calls.find(
      ([layer]) => layer.id === 'traffic-heatmap-layer',
    );
    expect(heatmapCall).toBeDefined();
    expect(heatmapCall![0].maxzoom).toBe(15);
    expect(heatmapCall![1]).toBe('waterway-label');
  });

  it('cria as layers de rota contratada e rastro do motorista', () => {
    const { map, sources, layers } = createMapMock();
    setupMapLayers(map, false);

    expect(sources.has('expected-route')).toBe(true);
    expect(sources.has('driver-trail')).toBe(true);

    const ids = layers.map(l => l.id);
    expect(ids).toEqual(expect.arrayContaining(['expected-route', 'driver-trail']));
    expect(layers.find(l => l.id === 'expected-route')!.source).toBe('expected-route');
    expect(layers.find(l => l.id === 'driver-trail')!.source).toBe('driver-trail');
  });
});

/** Mock mínimo que captura o `setData()` do GeoJSON source. */
function createSourceMapMock(sourceId: string) {
  const setData = vi.fn();
  const map = {
    getSource: vi.fn((id: string) => (id === sourceId ? { setData } : undefined)),
  } as unknown as mapboxgl.Map;
  return { map, setData };
}

describe('setExpectedRoute / setDriverTrail', () => {
  it('envia LineString com coordenadas [lng,lat] na ordem do Mapbox', () => {
    const { map, setData } = createSourceMapMock('expected-route');
    setExpectedRoute(map, [
      { lat: -23.5, lng: -46.6 },
      { lat: -23.6, lng: -46.7 },
    ]);

    expect(setData).toHaveBeenCalledTimes(1);
    const fc = setData.mock.calls[0][0];
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({
      type: 'LineString',
      coordinates: [[-46.6, -23.5], [-46.7, -23.6]],
    });
  });

  it('limpa a camada quando há menos de 2 pontos', () => {
    const { map, setData } = createSourceMapMock('driver-trail');
    setDriverTrail(map, [{ lat: -23.5, lng: -46.6 }]);
    expect(setData.mock.calls[0][0].features).toEqual([]);

    setDriverTrail(map, null);
    expect(setData.mock.calls[1][0].features).toEqual([]);
  });

  it('não quebra quando a source ainda não existe', () => {
    const { map } = createSourceMapMock('outra-source');
    expect(() => setExpectedRoute(map, [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }])).not.toThrow();
  });
});
