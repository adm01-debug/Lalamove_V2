import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AddressAutocomplete } from './AddressAutocomplete';

const invokeMock = vi.fn();
const orderQueryMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invokeMock(...a) },
    from: (...a: unknown[]) => orderQueryMock(...a),
  },
}));

vi.mock('@/lib/bitrix-config', () => ({ isBitrixConfigured: () => false }));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function noOrders() {
  orderQueryMock.mockReturnValue({
    select: () => ({
      gte: () => ({
        order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  });
}

function httpError(status: number) {
  return { data: null, error: { context: { status } } };
}

describe('AddressAutocomplete — estados de falha (etapa 40)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    orderQueryMock.mockReset();
    noOrders();
  });

  it('429 mostra "limite atingido" e oferece seguir com o endereço digitado', async () => {
    invokeMock.mockResolvedValue(httpError(429));
    const onUseTypedAddress = vi.fn();
    render(
      <AddressAutocomplete value="" onChange={() => {}} onUseTypedAddress={onUseTypedAddress} />,
      { wrapper },
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Rua Sem Retorno' } });

    await waitFor(() => expect(screen.getByText('Limite de busca atingido')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /usar o endereço como digitado/i }));
    expect(onUseTypedAddress).toHaveBeenCalledWith('Rua Sem Retorno');
  });

  it('erro sem status (rede) tem mensagem distinta do 429', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('network down') });
    render(<AddressAutocomplete value="" onChange={() => {}} />, { wrapper });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Rua Sem Retorno' } });

    await waitFor(() => expect(screen.getByText('Busca indisponível')).toBeTruthy());
  });

  it('sem resultado e sem falha sugere incluir número ou CEP', async () => {
    invokeMock.mockResolvedValue({ data: [], error: null });
    render(<AddressAutocomplete value="" onChange={() => {}} />, { wrapper });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Rua Inexistente' } });

    await waitFor(() => expect(screen.getByText(/Nenhum resultado para/)).toBeTruthy());
    expect(screen.getByText(/incluir o número do imóvel ou o CEP/i)).toBeTruthy();
  });
});

describe('AddressAutocomplete — endereços frequentes (etapa 41)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    orderQueryMock.mockReset();
  });

  it('mostra endereço já usado antes de qualquer chamada ao provedor', async () => {
    orderQueryMock.mockReturnValue({
      select: () => ({
        gte: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [
                { pickup_address: 'Av. Paulista, 1000', pickup_latitude: -23.5629, pickup_longitude: -46.6544, delivery_address: null, delivery_latitude: null, delivery_longitude: null },
                { pickup_address: 'Av. Paulista, 1000', pickup_latitude: -23.5629, pickup_longitude: -46.6544, delivery_address: null, delivery_latitude: null, delivery_longitude: null },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    const onCoordinatesChange = vi.fn();
    render(
      <AddressAutocomplete value="" onChange={() => {}} onCoordinatesChange={onCoordinatesChange} />,
      { wrapper },
    );

    fireEvent.focus(screen.getByRole('textbox'));

    await waitFor(() => expect(screen.getByText('Já usados (1)')).toBeTruthy());
    fireEvent.click(screen.getByText('Av. Paulista, 1000'));

    expect(onCoordinatesChange).toHaveBeenCalledWith(-23.5629, -46.6544);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
