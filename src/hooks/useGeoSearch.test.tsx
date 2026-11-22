import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAddressSearchBox, useCustomerSearchBias, resolveDeliveryPoint, useFrequentAddresses } from './useGeoSearch';

const invokeMock = vi.fn();
const orderQueryMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
    from: (...args: unknown[]) => orderQueryMock(...args),
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

  it('busca sugestÃµes com action autocomplete e session_token', async () => {
    invokeMock.mockResolvedValue({ data: [{ id: 'mapbox:1', main_text: 'Rua A', secondary_text: 'Curitiba', type: 'address', provider: 'mapbox' }], error: null });

    const { result } = renderHook(() => useAddressSearchBox('Rua A', true), { wrapper });
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    const [, opts] = invokeMock.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(invokeMock.mock.calls[0][0]).toBe('geo-gateway');
    expect(opts.body).toMatchObject({ action: 'autocomplete', input: 'Rua A', country: 'br', language: 'pt', limit: 5 });
    expect(typeof opts.body.session_token).toBe('string');
    expect((opts.body.session_token as string).length).toBeGreaterThanOrEqual(8);
  });

  it('isError fica true quando a busca de sugestÃµes falha (ex.: 429)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('rate limited') });

    const { result } = renderHook(() => useAddressSearchBox('Rua A', true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.suggestions).toEqual([]);
  });

  it('retrieve manda o mesmo session_token do autocomplete e depois renova para a prÃ³xima sessÃ£o', async () => {
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

describe('useAddressSearchBox — validade da sessão (etapa 37)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.useRealTimers();
  });

  it('renova o session_token depois de 170 s, mesmo sem limpar o campo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    invokeMock.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useAddressSearchBox('Rua A', true), { wrapper });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const firstToken = invokeMock.mock.calls.at(-1)![1].body.session_token as string;

    // 180 s sem seleção: o Mapbox já teria fechado a sessão.
    vi.advanceTimersByTime(171_000);
    invokeMock.mockResolvedValue({ data: null, error: new Error('ok') });
    await result.current.retrieve('mapbox:1').catch(() => undefined);

    const renewCall = invokeMock.mock.calls.at(-1)! as [string, { body: Record<string, unknown> }];
    expect(renewCall[1].body.action).toBe('place-details');
    expect(renewCall[1].body.session_token).not.toBe(firstToken);
  });

  it('mantém o session_token dentro dos 170 s', async () => {
    invokeMock.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useAddressSearchBox('Rua A', true), { wrapper });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const firstToken = invokeMock.mock.calls.at(-1)![1].body.session_token as string;

    invokeMock.mockResolvedValue({ data: null, error: null });
    await result.current.retrieve('mapbox:1');

    const call = invokeMock.mock.calls.at(-1)! as [string, { body: Record<string, unknown> }];
    expect(call[1].body.session_token).toBe(firstToken);
  });
});

describe('useFrequentAddresses (etapa 41)', () => {
  beforeEach(() => {
    orderQueryMock.mockReset();
  });

  function mockOrders(rows: unknown[]) {
    orderQueryMock.mockReturnValue({
      select: () => ({
        gte: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }),
        }),
      }),
    });
  }

  it('deduplica coleta e entrega iguais e ordena por reincidência', async () => {
    mockOrders([
      { pickup_address: 'Rua A, 1', pickup_latitude: -25.4, pickup_longitude: -49.2, delivery_address: 'Rua B, 2', delivery_latitude: -25.5, delivery_longitude: -49.3 },
      { pickup_address: 'rua a, 1 ', pickup_latitude: -25.4, pickup_longitude: -49.2, delivery_address: null, delivery_latitude: null, delivery_longitude: null },
    ]);

    const { result } = renderHook(() => useFrequentAddresses(true), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    const [first, second] = result.current.data!;
    expect(first.address).toBe('Rua A, 1');
    expect(first.hits).toBe(2);
    expect(first.latitude).toBe(-25.4);
    expect(second.address).toBe('Rua B, 2');
    expect(second.hits).toBe(1);
  });

  it('descarta linhas sem coordenada — preencher o texto sem ponto seria pior que não sugerir', async () => {
    mockOrders([
      { pickup_address: 'Rua sem ponto', pickup_latitude: null, pickup_longitude: null, delivery_address: 'Rua C, 3', delivery_latitude: -25.5, delivery_longitude: -49.3 },
    ]);

    const { result } = renderHook(() => useFrequentAddresses(true), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0].address).toBe('Rua C, 3');
  });
});

describe('resolveDeliveryPoint', () => {
  const base = {
    formatted: 'Rua A, 1',
    place_id: 'mapbox:1',
    components: {},
    provider: 'mapbox' as const,
  };

  it('prefere o ponto roteÃ¡vel ao centroide do imÃ³vel', () => {
    // Caso real medido: Av. Paulista 1578 devolve centroide no imÃ³vel e ponto
    // roteÃ¡vel na via â€” o motorista precisa do segundo.
    const point = resolveDeliveryPoint({
      ...base,
      location: { lat: -23.561459, lng: -46.655928 },
      routable_point: { lat: -23.561655, lng: -46.656126 },
    });
    expect(point).toEqual({ lat: -23.561655, lng: -46.656126 });
  });

  it('cai para o centroide quando nÃ£o hÃ¡ ponto roteÃ¡vel', () => {
    const point = resolveDeliveryPoint({ ...base, location: { lat: -25.4, lng: -49.2 } });
    expect(point).toEqual({ lat: -25.4, lng: -49.2 });
  });

  it('devolve null sem coordenada nenhuma (nunca [0,0])', () => {
    expect(resolveDeliveryPoint({ ...base, location: null })).toBeNull();
    expect(resolveDeliveryPoint({ ...base, location: null, routable_point: null })).toBeNull();
  });
});
describe('useAddressSearchBox — viés de localização (etapa 81)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    orderQueryMock.mockReset();
  });

  it('envia bias com raio padrão quando o caller informa uma região', async () => {
    invokeMock.mockResolvedValue({ data: [], error: null });

    renderHook(() => useAddressSearchBox('Rua XV', true, { lat: -25.43, lng: -49.27 }), { wrapper });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());

    const body = invokeMock.mock.calls[0][1].body as Record<string, unknown>;
    expect(body.bias).toEqual({ lat: -25.43, lng: -49.27, radius_m: 50_000 });
  });

  it('não envia bias sem região conhecida (mantém a busca global)', async () => {
    invokeMock.mockResolvedValue({ data: [], error: null });

    renderHook(() => useAddressSearchBox('Rua XV', true, null), { wrapper });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());

    const body = invokeMock.mock.calls[0][1].body as Record<string, unknown>;
    expect('bias' in body).toBe(false);
  });

  it('useCustomerSearchBias usa o último pedido do telefone informado', async () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: { pickup_latitude: -25.44, pickup_longitude: -49.28, delivery_latitude: null, delivery_longitude: null },
        error: null,
      })),
    };
    orderQueryMock.mockReturnValue(chain);

    const { result } = renderHook(() => useCustomerSearchBias('+5541999998888'), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ lat: -25.44, lng: -49.28, radius_m: 50_000 }));

    expect(orderQueryMock).toHaveBeenCalledWith('lalamove_orders');
    expect(chain.eq).toHaveBeenCalledWith('customer_phone', '+5541999998888');
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('useCustomerSearchBias devolve null sem telefone, sem forçar request', async () => {
    const { result } = renderHook(() => useCustomerSearchBias(null), { wrapper });
    expect(result.current).toBeNull();
    expect(orderQueryMock).not.toHaveBeenCalled();
  });
});
