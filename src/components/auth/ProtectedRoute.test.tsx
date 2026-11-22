import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const mockUseAuth = vi.fn();
const mockUsePermissions = vi.fn();
const mockUseMFA = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => mockUsePermissions(),
}));
vi.mock('@/hooks/useMFA', () => ({
  useMFA: () => mockUseMFA(),
}));

function renderRoute(requireMFA = true) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute requireMFA={requireMFA}>
              <div data-testid="child">conteudo protegido</div>
            </ProtectedRoute>
          }
        />
        <Route path="/mfa-verify" element={<div data-testid="mfa-verify">mfa verify</div>} />
        <Route path="/auth" element={<div data-testid="auth">auth</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized">unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    mockUsePermissions.mockReturnValue({
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true),
      isLoading: false,
    });
    mockUseMFA.mockReturnValue({
      needsMFAVerification: false,
      loadingFactors: false,
      loadingAAL: false,
    });
  });

  it('não renderiza o filho enquanto o AAL está carregando (loadingAAL true)', () => {
    mockUseMFA.mockReturnValue({
      needsMFAVerification: false,
      loadingFactors: false,
      loadingAAL: true,
    });
    renderRoute();
    expect(screen.queryByTestId('child')).toBeNull();
    expect(screen.getByText(/Verificando autenticação/)).toBeTruthy();
  });

  it('renderiza o filho quando tudo carrega e não exige verificação MFA', () => {
    renderRoute();
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('redireciona para /mfa-verify quando requireMFA e needsMFAVerification', () => {
    mockUseMFA.mockReturnValue({
      needsMFAVerification: true,
      loadingFactors: false,
      loadingAAL: false,
    });
    renderRoute();
    expect(screen.getByTestId('mfa-verify')).toBeTruthy();
  });
});
