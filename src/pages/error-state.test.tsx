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

const mockPermissions = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => mockPermissions(),
}));
vi.mock('@/hooks/useFuseSearch', () => ({
  useFuseSearchWithMatches: () => ({ results: [], matches: {} }),
}));
vi.mock('@/components/auth/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/pages/permissions/PermissionModuleList', () => ({
  PermissionModuleList: () => null,
}));

const mockExternalStats = vi.fn();
const mockExternalList = vi.fn();
vi.mock('@/hooks/useExternalData', () => ({
  useExternalStats: () => mockExternalStats(),
  useExternalList: () => mockExternalList(),
  TABLE_LABELS: { companies: 'Empresas', customers: 'Clientes' },
  EXTERNAL_TABLE_LABELS: { companies: 'Empresas', customers: 'Clientes' },
}));

import { SystemHealthPage } from './SystemHealthPage';
import ContactsPage from './ContactsPage';
import PermissionsPage from './PermissionsPage';
import ExternalDataPage from './ExternalDataPage';

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

  it('PermissionsPage: falha ao ler permissoes mostra aviso e botao de tentar novamente', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mockPermissions.mockReturnValue({
      allPermissions: [],
      rolePermissions: [],
      isLoading: false,
      isError: true,
      refetch,
    });

    renderPage(<PermissionsPage />);

    expect(screen.getByText(/poss.vel carregar/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('ExternalDataPage: falha nas contagens mostra aviso em vez de totais vazios silenciosos', () => {
    const refetchStats = vi.fn();
    mockExternalStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchStats,
    });
    mockExternalList.mockReturnValue({
      data: { data: [], count: 0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage(<ExternalDataPage />);

    expect(screen.getByText(/carregar as contagens da base/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetchStats).toHaveBeenCalledTimes(1);
  });
});