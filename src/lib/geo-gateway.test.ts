import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { countMapLoad } from './geo-gateway';
import { useMapboxDirections, useMapboxGeocode, useMapboxMapMatching, useMapboxMatrix } from '@/hooks/useMapbox';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe('countMapLoad', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('chama geo-gateway com a action count-map-load e o provider informado', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

    await countMapLoad('mapbox');

    expect(invokeMock).toHaveBeenCalledWith('geo-gateway', {
      body: { action: 'count-map-load', provider: 'mapbox' },
    });
  });

  it('nunca lança quando invoke retorna error (telemetria best-effort)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') });

    await expect(countMapLoad('mapbox')).resolves.toBeUndefined();
  });

  it('nunca lança quando invoke rejeita (ex.: rede fora)', async () => {
    invokeMock.mockRejectedValue(new Error('network down'));

    await expect(countMapLoad('google')).resolves.toBeUndefined();
  });
});


function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe('useMapbox* usam o geo-gateway e traduzem o contrato normalizado', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('directions: monta origem/destino/paradas e devolve geometry GeoJSON para o mapa', async () => {
    invokeMock.mockResolvedValue({
      data: {
        polyline: [{ lat: -25.4296, lng: -49.2716 }, { lat: -25.4426, lng: -49.2385 }],
        distance_m: 3625,
        duration_s: 540,
        legs: [{ distance_m: 3625, duration_s: 540 }],
        provider: 'mapbox',
        profile: 'driving-traffic',
      },
      error: null,
    });

    const { result } = renderHook(() => useMapboxDirections(), { wrapper: wrapper() });
    const route = await result.current.mutateAsync({
      coordinates: [[-49.2716, -25.4296], [-49.2385, -25.4426]],
    });

    expect(invokeMock).toHaveBeenCalledWith('geo-gateway', {
      body: {
        action: 'route',
        origin: { lat: -25.4296, lng: -49.2716 },
        destination: { lat: -25.4426, lng: -49.2385 },
        waypoints: [],
        alternatives: false,
      },
    });
    expect(route.routes[0].distance).toBe(3625);
    expect(route.routes[0].geometry.coordinates).toEqual([[-49.2716, -25.4296], [-49.2385, -25.4426]]);
  });

  it('directions: perfil pedido pela tela é repassado ao gateway', async () => {
    invokeMock.mockResolvedValue({
      data: { polyline: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }], distance_m: 1, duration_s: 1, legs: [], provider: 'mapbox', profile: 'walking' },
      error: null,
    });
    const { result } = renderHook(() => useMapboxDirections(), { wrapper: wrapper() });
    await result.current.mutateAsync({ coordinates: [[0, 0], [1, 1]], profile: 'walking' });
    expect(invokeMock.mock.calls[0][1].body.profile).toBe('walking');
  });

  it('matrix: envia a mesma lista como origens e destinos e remapeia o nome das colunas', async () => {
    invokeMock.mockResolvedValue({
      data: { durations_s: [[541]], distances_m: [[3626]], provider: 'mapbox', profile: 'driving' },
      error: null,
    });
    const { result } = renderHook(() => useMapboxMatrix(), { wrapper: wrapper() });
    const m = await result.current.mutateAsync({ coordinates: [[-49.27, -25.43], [-49.24, -25.44]] });

    expect(invokeMock.mock.calls[0][1].body.origins).toHaveLength(2);
    expect(m.durations).toEqual([[541]]);
    expect(m.distances).toEqual([[3626]]);
    expect(m.destinations[0].name).toBe('A');
    expect(m.destinations[1].location).toEqual([-49.24, -25.44]);
  });

  it('geocode: FeatureCollection com place_name/center a partir do GeoAddress do gateway', async () => {
    invokeMock.mockResolvedValue({
      data: [{
        formatted: 'Rua XV de Novembro, 100 - Centro, Curitiba - PR',
        place_id: 'mapbox.1',
        location: { lat: -25.4296, lng: -49.2716 },
        components: { street: 'Rua XV de Novembro', number: '100', city: 'Curitiba', state: 'PR' },
        precision: 'address',
        provider: 'mapbox',
      }],
      error: null,
    });
    const { result } = renderHook(() => useMapboxGeocode('Rua XV de Novembro 100'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const f = result.current.data!.features[0];
    expect(f.center).toEqual([-49.2716, -25.4296]);
    expect(f.text).toBe('Rua XV de Novembro');
    expect(f.address).toBe('100');
    expect(f.geometry.coordinates).toEqual([-49.2716, -25.4296]);
  });

  it('geocode sem resultado devolve lista vazia em vez de estourar a tela', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('GEO_NOT_FOUND: endereço não encontrado') });
    const { result } = renderHook(() => useMapboxGeocode('endereco inexistente'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.features).toEqual([]);
  });

  it('map-matching: recompõe matchings[0] com confidence, distância, duração e geometria', async () => {
    invokeMock.mockResolvedValue({
      data: {
        points: [{ lat: -25.429, lng: -49.271 }, { lat: -25.43, lng: -49.27 }],
        confidence: 0.87,
        provider: 'mapbox',
        distance_m: 842.6,
        duration_s: 95.4,
        polyline: [{ lat: -25.429, lng: -49.271 }, { lat: -25.43, lng: -49.27 }],
      },
      error: null,
    });
    const { result } = renderHook(() => useMapboxMapMatching(), { wrapper: wrapper() });
    const r = await result.current.mutateAsync({ coordinates: [[-49.2716, -25.4296], [-49.27, -25.43]] });

    expect(r.matchings[0].confidence).toBe(0.87);
    expect(r.matchings[0].distance).toBeCloseTo(842.6, 1);
    expect(r.matchings[0].geometry.coordinates[0]).toEqual([-49.271, -25.429]);
    expect(r.tracepoints).toHaveLength(2);
  });
});
