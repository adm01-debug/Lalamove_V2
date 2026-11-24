import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => {
  class UapiError extends Error {
    code: number;
    hint?: string;
    constructor(code: number, message: string, hint?: string) {
      super(message);
      this.code = code;
      this.hint = hint;
    }
  }
  return {
    UapiError,
    statement: {} as Record<string, unknown>,
    wallet: {} as Record<string, unknown>,
    navigate: vi.fn(),
  };
});

vi.mock('@/hooks/useLalamoveUapi', () => ({
  UapiError: h.UapiError,
  useUapiWalletStatement: () => h.statement,
}));

vi.mock('@/hooks/useLalamove', () => ({
  useWallet: () => h.wallet,
  useLalamoveStatus: () => ({ data: { v3: { ok: true }, uapi: { ok: true } }, isLoading: false }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => h.navigate };
});

import { UapiSessionRequired } from '@/components/lalamove/UapiSessionRequired';
import { UapiStatementPanel } from '@/components/lalamove/UapiStatementPanel';
import { UAPIStatusCards } from '@/components/dashboard/UAPIStatusCards';
import { UAPI_SESSION_MISSING_MESSAGE } from '@/lib/uapiErrors';

const SESSION_ERROR = new h.UapiError(-1, UAPI_SESSION_MISSING_MESSAGE, 'Salve os 2 tokens.');

function renderWithRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('sessão UAPI ausente não vira erro genérico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('avisa que falta configuração, com link de configuração e retry', () => {
    const onRetry = vi.fn();
    renderWithRouter(<UapiSessionRequired onRetry={onRetry} />);

    expect(screen.getByText(UAPI_SESSION_MISSING_MESSAGE)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Configurar sessão UAPI/ }).getAttribute('href')).toBe(
      '/settings/uapi',
    );

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('painel do extrato mostra o caminho de configuração em vez do erro cru da edge', () => {
    h.statement = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: SESSION_ERROR,
      isFetching: false,
      refetch: vi.fn(),
    };

    renderWithRouter(<UapiStatementPanel />);

    expect(screen.getByText(UAPI_SESSION_MISSING_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/Edge Function returned/)).toBeNull();
  });

  it('painel do extrato mantém o aviso de erro para falhas que não são de sessão', () => {
    h.statement = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch'),
      isFetching: false,
      refetch: vi.fn(),
    };

    renderWithRouter(<UapiStatementPanel />);

    expect(screen.getByText(/Falha ao carregar o extrato/)).toBeTruthy();
    expect(screen.queryByText(UAPI_SESSION_MISSING_MESSAGE)).toBeNull();
  });

  it('card do saldo diz que está indisponível e leva para a configuração da sessão', () => {
    h.wallet = { data: undefined, isLoading: false, isError: true };
    renderWithRouter(<UAPIStatusCards />);

    expect(screen.getByText('Indisponível — ver sessão')).toBeTruthy();
    fireEvent.click(screen.getByText('Saldo Lalamove'));
    expect(h.navigate).toHaveBeenCalledWith('/settings/uapi');
  });

  it('card do saldo mantém o valor quando a carteira responde', () => {
    h.wallet = { data: { formatted: 'R$ 1.234,56' }, isLoading: false, isError: false };
    renderWithRouter(<UAPIStatusCards />);

    expect(screen.getByText('R$ 1.234,56')).toBeTruthy();
    expect(screen.queryByText('Indisponível — ver sessão')).toBeNull();
  });
});