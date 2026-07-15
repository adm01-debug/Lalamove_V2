import { describe, it, expect, vi } from 'vitest';
import type mapboxgl from 'mapbox-gl';
import { setupMapLayers } from '../mapLayers';

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
});
