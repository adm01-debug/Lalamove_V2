import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockHealth = vi.fn();
vi.mock('@/hooks/useSystemHealth', () => ({
  useSystemHealth: () => mockHealth(),
}));

const mockContacts = vi.fn();
vi.mock('@/hooks/useContacts', () => ({
  useContacts: () => mockContacts(),
}));

vi.mock('@/components/health/CronJobsHealthPanel', () => ({
  CronJobsHealthPanel: () => null,
}));

import { SystemHealthPage } from './SystemHealthPage';
import ContactsPage from './ContactsPage';

function renderPage(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

describe('estado de erro em paginas de dados (item 421)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SystemHealthPage: falha mostra aviso e botao de tentar novamente em vez de tela vazia', () => {
    const refetch = vi.fn();
    mockHealth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
      refetch,
    });

    renderPage(<SystemHealthPage />);

    expect(screen.getByText(/poss.vel carregar os dados/)).toBeTruthy();
    expect(screen.getByText('Failed to fetch')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('SystemHealthPage: enquanto carrega mostra o indicador de carregamento', () => {
    mockHealth.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() });

    renderPage(<SystemHealthPage />);

    expect(screen.getByText('Carregando...')).toBeTruthy();
  });

  it('ContactsPage: falha na listagem mostra aviso e botao de tentar novamente', () => {
    const refetch = vi.fn();
    mockContacts.mockReturnValue({
      contacts: [],
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
      refetch,
      search: () => [],
      updateContact: vi.fn(),
      deleteContact: vi.fn(),
      isMutating: false,
    });

    renderPage(<ContactsPage />);

    expect(screen.getByText(/poss.vel carregar os dados/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});