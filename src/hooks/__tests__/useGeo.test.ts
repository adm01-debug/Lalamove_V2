import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

import { useGeoAutocomplete, useGeoSession, fetchGeoPlace, GeoGatewayError } from '../useGeo';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe('useGeo', () => {
  beforeEach(() => invoke.mockReset());

  it('useGeoSession: mesmo token até end(); novo token depois', () => {
    const { result } = renderHook(() => useGeoSession());
    const a = result.current.get();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.current.get()).toBe(a);
    result.current.end();
    expect(result.current.get()).not.toBe(a);
  });

  it('useGeoAutocomplete: chama geo-gateway com action autocomplete, sessão e país BR; mínimo 3 caracteres', async () => {
    invoke.mockResolvedValue({ data: [{ id: 'mapbox:abc', main_text: 'Rua XV', secondary_text: 'Curitiba', type: 'street', provider: 'mapbox' }], error: null });
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useGeoAutocomplete(q, 'sess-1234-5678', true),
      { wrapper, initialProps: { q: 'Ru' } },
    );
    expect(invoke).not.toHaveBeenCalled(); // < 3 chars
    rerender({ q: 'Rua XV' });
    await waitFor(() => expect(result.current.data?.length).toBe(1));
    expect(invoke).toHaveBeenCalledWith('geo-gateway', {
      body: expect.objectContaining({ action: 'autocomplete', input: 'Rua XV', session_token: 'sess-1234-5678', country: 'br', language: 'pt', limit: 5 }),
    });
    expect(result.current.data?.[0].id).toBe('mapbox:abc');
  });

  it('fetchGeoPlace: devolve GeoAddress e converte erro do contrato em GeoGatewayError com status/code', async () => {
    invoke.mockResolvedValueOnce({ data: { formatted: 'Rua XV, 100', place_id: 'mapbox:abc', location: { lat: -25.43, lng: -49.27 }, components: {}, precision: 'exact', provider: 'mapbox', retainable: false }, error: null });
    const place = await fetchGeoPlace('mapbox:abc', 'sess');
    expect(place.location).toEqual({ lat: -25.43, lng: -49.27 });
    expect(invoke).toHaveBeenLastCalledWith('geo-gateway', { body: { action: 'place-details', place_id: 'mapbox:abc', session_token: 'sess' } });

    const ctx = new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Orçamento estourado', fields: [{ field: '(geo)', message: 'x', code: 'GEO_BUDGET' }] } }), { status: 429 });
    invoke.mockResolvedValueOnce({ data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context: ctx }) });
    await expect(fetchGeoPlace('mapbox:abc', 'sess')).rejects.toMatchObject({ name: 'GeoGatewayError', status: 429, code: 'GEO_BUDGET', message: 'Orçamento estourado' });
    expect(new GeoGatewayError('x').name).toBe('GeoGatewayError');
  });
});
