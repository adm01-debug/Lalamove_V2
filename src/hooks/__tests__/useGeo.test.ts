import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { GeoGatewayError } from '@/lib/geo-gateway';

type Impl = (body: Record<string, unknown>) => Promise<unknown>;

/**
 * Mock controlado por uma função simples (não `vi.fn()`): no vitest 5 uma
 * rejeição/throw originada de `vi.fn()` é atribuída ao teste mesmo quando o
 * consumidor a trata, o que inviabiliza testar o caminho 404 → estado vazio.
 */
const geo = {
  calls: [] as Record<string, unknown>[],
  impl: (async () => ({})) as Impl,
  resolve(value: unknown) {
    this.impl = async () => value;
  },
  reject(err: Error) {
    this.impl = () => {
      throw err;
    };
  },
};

vi.mock('@/lib/geo-gateway', async () => {
  const actual = await vi.importActual<typeof import('@/lib/geo-gateway')>('@/lib/geo-gateway');
  return {
    ...actual,
    callGeo: (body: Record<string, unknown>) => {
      geo.calls.push(body);
      return geo.impl(body);
    },
  };
});

import {
  useMapboxGeocode,
  useMapboxDirections,
  useMapboxMatrix,
  useMapboxMapMatching,
  useMapboxStaticImage,
  geocodeAddress,
  getDirections,
} from '../useGeo';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const ADDRESS = {
  formatted: 'Rua Augusta, 100 - Consolação, São Paulo',
  place_id: 'mapbox:addr-1',
  location: { lat: -23.555, lng: -46.66 },
  routable_point: { lat: -23.5551, lng: -46.6601 },
  components: { street: 'Rua Augusta', number: '100', district: 'Consolação', city: 'São Paulo', state: 'SP', country: 'Brasil' },
  precision: 'exact',
  provider: 'mapbox',
  retainable: false,
};

describe('useGeo', () => {
  beforeEach(() => {
    geo.calls = [];
    geo.resolve({});
  });

  it('geocode converte GeoAddress[] em features no formato v5 (picker e autocomplete)', async () => {
    geo.resolve([ADDRESS]);
    const { result } = renderHook(() => useMapboxGeocode('Rua Augusta', true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const feature = result.current.data!.features[0];
    expect(geo.calls[0]).toEqual(expect.objectContaining({ action: 'geocode', address: 'Rua Augusta' }));
    expect(feature.place_name).toBe(ADDRESS.formatted);
    expect(feature.text).toBe('Rua Augusta');
    expect(feature.center).toEqual([-46.66, -23.555]);
    expect(feature.place_type).toEqual(['address']);
    expect(feature.context).toContainEqual({ id: 'neighborhood.Consolação', text: 'Consolação' });
    expect(feature.context).toContainEqual({ id: 'place.São Paulo', text: 'São Paulo' });
  });

  it('geocode 404 vira lista vazia (estado vazio da UI, não erro)', async () => {
    geo.reject(new GeoGatewayError('Endereço não encontrado', 'GEO_NOT_FOUND', 404));
    const { result } = renderHook(() => useMapboxGeocode('xyz', true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.features).toEqual([]);
  });

  it('directions monta origin/destination/waypoints e preserva perfil explícito', async () => {
    geo.resolve({
      polyline: [{ lat: -23.5, lng: -46.6 }, { lat: -23.6, lng: -46.7 }],
      distance_m: 4200,
      duration_s: 900,
      legs: [{ distance_m: 4200, duration_s: 900 }],
      provider: 'mapbox',
      profile: 'walking',
    });
    const { result } = renderHook(() => useMapboxDirections(), { wrapper: createWrapper() });

    const out = await result.current.mutateAsync({ coordinates: [[-46.6, -23.5], [-46.65, -23.55], [-46.7, -23.6]], profile: 'walking' });

    expect(geo.calls[0]).toEqual({
      action: 'route',
      origin: { lng: -46.6, lat: -23.5 },
      destination: { lng: -46.7, lat: -23.6 },
      waypoints: [{ lng: -46.65, lat: -23.55 }],
      profile: 'walking',
    });
    expect(out.routes[0].distance).toBe(4200);
    expect(out.routes[0].duration).toBe(900);
    expect(out.routes[0].geometry).toEqual({ type: 'LineString', coordinates: [[-46.6, -23.5], [-46.7, -23.6]] });
    expect(out.waypoints).toHaveLength(3);
  });

  it('matrix devolve NxN com sources/destinations sintetizados na ordem das coords', async () => {
    geo.resolve({
      durations_s: [[0, 120], [120, 0]],
      distances_m: [[0, 800], [800, 0]],
      provider: 'mapbox',
      profile: 'driving',
    });
    const { result } = renderHook(() => useMapboxMatrix(), { wrapper: createWrapper() });

    const out = await result.current.mutateAsync({ coordinates: [[-46.6, -23.5], [-46.7, -23.6]], profile: 'driving' });

    expect(geo.calls[0]).toEqual(expect.objectContaining({ action: 'matrix', profile: 'driving', traffic: false }));
    expect(out.durations).toEqual([[0, 120], [120, 0]]);
    expect(out.distances).toEqual([[0, 800], [800, 0]]);
    expect(out.destinations).toHaveLength(2);
    expect(out.sources[0].location).toEqual([-46.6, -23.5]);
  });

  it('mapMatching nunca devolve confidence nulo (evita NaN% na tela)', async () => {
    geo.resolve({
      points: [{ lat: -23.5, lng: -46.6 }, { lat: -23.51, lng: -46.61 }],
      confidence: null,
      provider: 'mapbox',
    });
    const { result } = renderHook(() => useMapboxMapMatching(), { wrapper: createWrapper() });

    const out = await result.current.mutateAsync({ coordinates: [[-46.6, -23.5], [-46.61, -23.51]], profile: 'driving' });

    expect(out.matchings[0].confidence).toBe(0);
    expect(out.matchings[0].geometry.coordinates).toHaveLength(2);
    expect(out.code).toBe('Ok');
  });

  it('static image usa o data URL devolvido pelo gateway', async () => {
    geo.resolve({ image: 'data:image/png;base64,AAA', width: 600, height: 400, provider: 'mapbox' });
    const { result } = renderHook(() => useMapboxStaticImage(), { wrapper: createWrapper() });

    const out = await result.current.mutateAsync({ lng: -46.6, lat: -23.5, zoom: 14 });

    expect(geo.calls[0]).toEqual(expect.objectContaining({ action: 'static', center: { lat: -23.5, lng: -46.6 }, zoom: 14 }));
    expect(out).toEqual({ image: 'data:image/png;base64,AAA', width: 600, height: 400, url: '' });
  });

  it('geocodeAddress imperativo devolve features e engole 404', async () => {
    geo.resolve([ADDRESS]);
    const features = await geocodeAddress('Rua Augusta');
    expect(features).toHaveLength(1);
    expect(features[0].place_name).toBe(ADDRESS.formatted);

    geo.reject(new GeoGatewayError('not found', 'GEO_NOT_FOUND', 404));
    await expect(geocodeAddress('nada')).resolves.toEqual([]);
  });

  it('getDirections imperativo devolve a rota principal', async () => {
    geo.resolve({
      polyline: [{ lat: -23.5, lng: -46.6 }],
      distance_m: 100,
      duration_s: 60,
      legs: [],
      provider: 'mapbox',
      profile: 'driving',
    });
    const route = await getDirections([[-46.6, -23.5], [-46.7, -23.6]], 'driving-traffic');
    expect(geo.calls[0]).toEqual(expect.objectContaining({ action: 'route', profile: 'driving-traffic' }));
    expect(route!.distance).toBe(100);
    expect(route!.duration).toBe(60);
  });
});
