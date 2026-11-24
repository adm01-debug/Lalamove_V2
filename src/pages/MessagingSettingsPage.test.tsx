import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockSettings = vi.fn();
const mockUsage = vi.fn();
const mockRoutes = vi.fn();
const mockTemplates = vi.fn();
const mockOptouts = vi.fn();
const mockLedger = vi.fn();

vi.mock('@/hooks/useMessaging', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useMessaging')>('@/hooks/useMessaging');
  return {
    ...actual,
    useMessagingSettings: () => mockSettings(),
    useUpdateMessagingSettings: () => ({ mutate: vi.fn(), isPending: false }),
    useMessagingUsage: () => mockUsage(),
    useNotificationRoutes: () => mockRoutes(),
    useUpdateNotificationRoute: () => ({ mutate: vi.fn(), isPending: false }),
    useMessageTemplates: () => mockTemplates(),
    useSaveTemplateVersion: () => ({ mutate: vi.fn(), isPending: false }),
    useNotificationOptouts: () => mockOptouts(),
    useAddNotificationOptout: () => ({ mutate: vi.fn(), isPending: false }),
    useRemoveNotificationOptout: () => ({ mutate: vi.fn(), isPending: false }),
    useNotificationLedger: () => mockLedger(),
  };
});

import MessagingSettingsPage from './MessagingSettingsPage';

const IDLE = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

const SETTINGS_ROW = {
  id: 'default',
  whatsapp_provider: 'zapp',
  sms_provider: 'none',
  sms_fallback_after_min: 10,
  monthly_budget_cents: 0,
  shadow_mode: true,
  pilot_mode: false,
  quiet_hours_by_role: {},
  updated_at: '2026-11-24T00:00:00Z',
  updated_by: null,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MessagingSettingsPage />
    </QueryClientProvider>,
  );
}

describe('MessagingSettingsPage (etapas 141-151 do plano de mensageria)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.mockReturnValue(IDLE);
    mockUsage.mockReturnValue(IDLE);
    mockRoutes.mockReturnValue(IDLE);
    mockTemplates.mockReturnValue(IDLE);
    mockOptouts.mockReturnValue(IDLE);
    mockLedger.mockReturnValue(IDLE);
  });

  it('mostra carregamento enquanto a configuracao nao chegou', () => {
    mockSettings.mockReturnValue({ ...IDLE, isLoading: true });

    renderPage();

    expect(screen.getByText('Carregando...')).toBeTruthy();
  });

  it('erro de leitura mostra o motivo e o botao de tentar novamente', () => {
    const refetch = vi.fn();
    mockSettings.mockReturnValue({
      ...IDLE,
      isError: true,
      error: new Error('permission denied for table messaging_settings'),
      refetch,
    });

    renderPage();

    expect(screen.getByText(/poss.vel carregar os dados/)).toBeTruthy();
    expect(screen.getByText('permission denied for table messaging_settings')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('config salva lista os bloqueios que impedem o envio real', () => {
    mockSettings.mockReturnValue({ ...IDLE, data: SETTINGS_ROW });

    renderPage();

    expect(screen.getByText('zapp')).toBeTruthy();
    expect(screen.getByText('Teto mensal em R$ zerado')).toBeTruthy();
    expect(screen.getByText(/Modo sombra ligado/)).toBeTruthy();
    expect(screen.queryByText(/Nenhum bloqueio de configuracao/)).toBeNull();
  });

  it('aba de uso mostra o gasto do mes e o total de mensagens', () => {
    mockSettings.mockReturnValue({ ...IDLE, data: SETTINGS_ROW });
    mockUsage.mockReturnValue({
      ...IDLE,
      data: {
        monthCostCents: 1234,
        rows: [
          {
            day: '2026-11-23',
            channel: 'whatsapp',
            provider: 'zapp',
            messages: 5,
            segments: 6,
            cost_cents: 1234,
          },
        ],
      },
    });

    renderPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Uso e custo' }));

    expect(screen.getAllByText(/R\$\s*12,34/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Teto n.o definido/)).toBeTruthy();
    expect(screen.getByText(/Somat.rio de messaging_usage/)).toBeTruthy();
  });
});