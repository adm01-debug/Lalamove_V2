import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { OrderGeoEvents } from './OrderGeoEvents';

const invokeMock = vi.fn();
const selectMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invokeMock(...a) },
    from: (...a: unknown[]) => selectMock(...a),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Cadeia de query do supabase-js: from().select().eq().order().limit() */
function mockEvents(rows: unknown[]) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  selectMock.mockReturnValue(chain);
}

const baseEvent = {
  id: 'ev-1',
  event_type: 'DRIVER_ARRIVED_PICKUP',
  stop_index: 0,
  triggered_at: '2026-11-22T14:05:00.000Z',
  distance_m: 87,
  eta_min: 1,
  notification_status: 'sent',
  notified_at: '2026-11-22T14:05:30.000Z',
};

describe('OrderGeoEvents — etapas 62/63 (painel de eventos + reenvio)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    selectMock.mockReset();
  });

  it('estado vazio explica o que aparece ali em vez de sumir', async () => {
    mockEvents([]);
    render(<OrderGeoEvents orderId="ord-1" />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText(/Nenhum evento geográfico registrado/i)).toBeTruthy(),
    );
  });

  it('lista evento com rótulo em PT-BR, distância, ETA e status', async () => {
    mockEvents([baseEvent]);
    render(<OrderGeoEvents orderId="ord-1" />, { wrapper });
    await waitFor(() =>
      expect(screen.getByText('Motorista chegou na coleta')).toBeTruthy(),
    );
    expect(screen.getByText('87 m do ponto')).toBeTruthy();
    expect(screen.getByText('ETA 1 min')).toBeTruthy();
    expect(screen.getByText('Enviado')).toBeTruthy();
  });

  it('status sem destinatário é sinalizado na UI (motivo do reenvio)', async () => {
    mockEvents([{ ...baseEvent, notification_status: 'no_recipient', notified_at: null }]);
    render(<OrderGeoEvents orderId="ord-1" />, { wrapper });
    await waitFor(() => expect(screen.getByText('Sem destinatário')).toBeTruthy());
  });

  it('reenvio chama send-notification com skip_dedup e geo_event_id', async () => {
    mockEvents([baseEvent]);
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    render(<OrderGeoEvents orderId="ord-1" driverId="drv-9" />, { wrapper });
    await waitFor(() => expect(screen.getByText('Reenviar')).toBeTruthy());

    screen.getByText('Reenviar').click();
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    const [fn, opts] = invokeMock.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fn).toBe('send-notification');
    expect(opts.body).toMatchObject({
      skip_dedup: true,
      order_id: 'ord-1',
      driver_id: 'drv-9',
      type: 'DRIVER_ARRIVED_PICKUP',
    });
    expect((opts.body.metadata as Record<string, unknown>).geo_event_id).toBe('ev-1');
  });
});