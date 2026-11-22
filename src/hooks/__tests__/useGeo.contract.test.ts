import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { GeoGatewayError } from '@/lib/geo-gateway';

// Etapa 33: contrato nomeado do plano (useGeoAutocomplete / useGeoPlaceDetails /
// useGeocode / useRoute / useMatrix / useStaticMap) e tipos de `@/types/geo`.

type Impl = (body: Record<string, unknown>) => Promise<unknown>;

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

const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

import {
  useGeoAutocomplete,
  useGeoPlaceDetails,
  useGeocode,
  useRoute,
  useMatrix,
  useStaticMap,
} from '../useGeo';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const ADDRESS = {
  formatted: 'Rua XV de Novembro, 100 - Centro, Curitiba',
  place_id: 'google:addr-9',
  location: { lat: -25.43, lng: -49.27 },
  components: { street: 'Rua XV de Novembro', number: '100', city: 'Curitiba', state: 'PR' },
  precision: 'exact',
  provider: 'google',
  retainable: true,
};

describe('etapa 33 — hooks do contrato do geo-gateway', () => {
  beforeEach(() => {
    geo.calls = [];
    geo.resolve({});
    invokeMock.mockReset();
  });

  it('useGeocode devolve GeoAddress[] cru com o lugar tipado', async () => {
    geo.resolve([ADDRESS]);
    const { result } = renderHook(() => useGeocode('Rua XV de Novembro'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(geo.calls[0]).toEqual(expect.objectContaining({ action: 'geocode', address: 'Rua XV de Novembro', country: 'br' }));
    expect(result.current.data![0].precision).toBe('exact');
    expect(result.current.data![0].retainable).toBe(true);
  });

  it('useGeocode 404 vira lista vazia e não dispara abaixo de 3 caracteres', async () => {
    geo.reject(new GeoGatewayError('não encontrado', 'GEO_NOT_FOUND', 404));
    const { result } = renderHook(() => useGeocode('xyz'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);

    geo.calls = [];
    renderHook(() => useGeocode('ab'), { wrapper: createWrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(geo.calls).toHaveLength(0);
  });

  it('useRoute envia origin/destination/waypoints como objetos', async () => {
    geo.resolve({ polyline: [], distance_m: 1, duration_s: 1, legs: [], provider: 'google', profile: 'driving' });
    const { result } = renderHook(() => useRoute(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        origin: { lat: -25.43, lng: -49.27 },
        destination: { lat: -25.44, lng: -49.28 },
        waypoints: [{ lat: -25.435, lng: -49.275 }],
        profile: 'driving',
      });
    });

    expect(geo.calls[0]).toEqual({
      action: 'route',
      origin: { lat: -25.43, lng: -49.27 },
      destination: { lat: -25.44, lng: -49.28 },
      waypoints: [{ lat: -25.435, lng: -49.275 }],
      profile: 'driving',
    });
  });

  it('useMatrix preserva célula nula (par inalcançável)', async () => {
    geo.resolve({ durations_s: [[0, null]], distances_m: [[0, null]], provider: 'mapbox', profile: 'driving' });
    const { result } = renderHook(() => useMatrix(), { wrapper: createWrapper() });

    const out = await result.current.mutateAsync({
      origins: [{ lat: -25.43, lng: -49.27 }],
      destinations: [{ lat: -25.44, lng: -49.28 }],
    });

    expect(geo.calls[0]).toEqual(expect.objectContaining({ action: 'matrix' }));
    expect(out.durations_s[0][1]).toBeNull();
  });

  it('useStaticMap devolve o data URL PNG', async () => {
    geo.resolve({ image: 'data:image/png;base64,ZZZ', width: 600, height: 300, provider: 'google' });
    const { result } = renderHook(() => useStaticMap(), { wrapper: createWrapper() });

    const out = await result.current.mutateAsync({ center: { lat: -25.43, lng: -49.27 }, zoom: 15 });

    expect(geo.calls[0]).toEqual(expect.objectContaining({ action: 'static', center: { lat: -25.43, lng: -49.27 }, zoom: 15 }));
    expect(out.image).toBe('data:image/png;base64,ZZZ');
  });

  it('useGeoPlaceDetails chama place-details com session_token e normaliza precision', async () => {
    geo.resolve({ ...ADDRESS, precision: undefined });
    const { result } = renderHook(() => useGeoPlaceDetails(), { wrapper: createWrapper() });

    const out = await result.current.mutateAsync({ placeId: 'google:addr-9', sessionToken: 'sess-12345678' });

    expect(geo.calls[0]).toEqual(expect.objectContaining({ action: 'place-details', place_id: 'google:addr-9', session_token: 'sess-12345678' }));
    // Precisão ausente nunca vira "exact": o consumidor não pode tratar como rooftop.
    expect(out!.precision).toBe('unknown');
  });

  it('useGeoAutocomplete segura a digitação pelo debounce antes de chamar o gateway', async () => {
    invokeMock.mockResolvedValue({ data: [], error: null });
    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useGeoAutocomplete(input, { debounceMs: 60 }),
      { wrapper: createWrapper(), initialProps: { input: '' } },
    );

    rerender({ input: 'Rua XV de Novembro' });
    expect(invokeMock).not.toHaveBeenCalled();

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const body = invokeMock.mock.calls[0][1].body as Record<string, unknown>;
    expect(body.action).toBe('autocomplete');
    expect(body.input).toBe('Rua XV de Novembro');
    expect(typeof body.session_token).toBe('string');
    expect(result.current.debouncedInput).toBe('Rua XV de Novembro');
  });

  it('useGeoAutocomplete retrieve normaliza precision ausente para unknown', async () => {
    invokeMock.mockResolvedValue({ data: { ...ADDRESS, precision: undefined }, error: null });
    const { result } = renderHook(() => useGeoAutocomplete('Rua XV de Novembro'), { wrapper: createWrapper() });

    const address = await result.current.retrieve('google:addr-9');

    expect(invokeMock).toHaveBeenCalledWith('geo-gateway', expect.objectContaining({ body: expect.objectContaining({ action: 'place-details' }) }));
    expect(address!.precision).toBe('unknown');
  });
});
