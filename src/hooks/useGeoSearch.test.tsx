import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAddressSearchBox } from './useGeoSearch';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAddressSearchBox', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('busca sugestões com action autocomplete e session_token', async () => {
    invokeMock.mockResolvedValue({ data: [{ id: 'mapbox:1', main_text: 'Rua A', secondary_text: 'Curitiba', type: 'address', provider: 'mapbox' }], error: null });

    const { result } = renderHook(() => useAddressSearchBox('Rua A', true), { wrapper });
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    const [, opts] = invokeMock.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(invokeMock.mock.calls[0][0]).toBe('geo-gateway');
    expect(opts.body).toMatchObject({ action: 'autocomplete', input: 'Rua A', country: 'br', language: 'pt', limit: 5 });
    expect(typeof opts.body.session_token).toBe('string');
    expect((opts.body.session_token as string).length).toBeGreaterThanOrEqual(8);
  });

  it('isError fica true quando a busca de sugestões falha (ex.: 429)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('rate limited') });

    const { result } = renderHook(() => useAddressSearchBox('Rua A', true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.suggestions).toEqual([]);
  });

  it('retrieve manda o mesmo session_token do autocomplete e depois renova para a próxima sessão', async () => {
    invokeMock.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useAddressSearchBox('Rua A', true), { wrapper });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const firstToken = invokeMock.mock.calls[0][1].body.session_token as string;

    invokeMock.mockResolvedValue({ data: { formatted: 'Rua A, 1', place_id: 'mapbox:1', location: { lat: -25.4, lng: -49.2 }, components: {}, provider: 'mapbox' }, error: null });
    await result.current.retrieve('mapbox:1');

    const retrieveCall = invokeMock.mock.calls.at(-1) as [string, { body: Record<string, unknown> }];
    expect(retrieveCall[1].body).toMatchObject({ action: 'place-details', place_id: 'mapbox:1', session_token: firstToken });

    invokeMock.mockResolvedValue({ data: [], error: null });
    renderHook(() => useAddressSearchBox('Rua B', true), { wrapper });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const secondToken = invokeMock.mock.calls.at(-1)?.[1].body.session_token as string;
    expect(secondToken).not.toBe(firstToken);
  });

  it('retrieve propaga o erro (para o caller decidir o feedback) em vez de engolir silenciosamente', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('network down') });
    const { result } = renderHook(() => useAddressSearchBox('', false), { wrapper });

    await expect(result.current.retrieve('mapbox:1')).rejects.toThrow('network down');
  });
});
