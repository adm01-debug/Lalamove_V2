import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPending = vi.fn();
vi.mock('@/hooks/useNotificationHistory', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useNotificationHistory')>('@/hooks/useNotificationHistory');
  return {
    ...actual,
    useNotificationStats: () => ({ data: { total: 0, sent: 0, delivered: 0, failed: 0, pending: 0, byChannel: {} }, isLoading: false }),
    useNotificationHistory: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
    usePendingGeoEvents: () => mockPending(),
  };
});

import { NotificationHistoryPage } from './NotificationHistoryPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><NotificationHistoryPage /></QueryClientProvider>);
}

describe('NotificationHistoryPage — avisos geo pendentes (etapa 73)', () => {
  it('mostra evento deferred com rótulo em PT-BR, distância e ETA', () => {
    mockPending.mockReturnValue({
      isLoading: false,
      data: [{
        id: 'e1', order_id: 'o1', event_type: 'DRIVER_APPROACHING_PICKUP', stop_index: 0,
        triggered_at: '2026-11-22T23:30:00Z', distance_m: 820, eta_min: 6,
        notification_status: 'deferred', notified_at: null,
      }],
    });
    renderPage();
    expect(screen.getByText('Motorista aproximando da coleta')).toBeInTheDocument();
    expect(screen.getByText('Adiado')).toBeInTheDocument();
    expect(screen.getByText('820 m')).toBeInTheDocument();
    expect(screen.getByText('ETA 6 min')).toBeInTheDocument();
  });

  it('mostra no_recipient e failed como casos que exigem ação', () => {
    mockPending.mockReturnValue({
      isLoading: false,
      data: [
        { id: 'e2', order_id: 'o1', event_type: 'DRIVER_ARRIVED_DELIVERY', stop_index: 1, triggered_at: '2026-11-22T23:40:00Z', distance_m: 50, eta_min: 1, notification_status: 'no_recipient', notified_at: null },
        { id: 'e3', order_id: 'o2', event_type: 'DRIVER_ARRIVED_PICKUP', stop_index: 0, triggered_at: '2026-11-22T23:50:00Z', distance_m: null, eta_min: null, notification_status: 'failed', notified_at: null },
      ],
    });
    renderPage();
    expect(screen.getByText('Sem destinatário')).toBeInTheDocument();
    expect(screen.getByText('Falhou')).toBeInTheDocument();
    expect(screen.getByText('Motorista chegou na entrega')).toBeInTheDocument();
  });

  it('não renderiza o card quando não há evento pendente', () => {
    mockPending.mockReturnValue({ isLoading: false, data: [] });
    renderPage();
    expect(screen.queryByText(/Avisos geo que não chegaram/)).not.toBeInTheDocument();
  });
});
