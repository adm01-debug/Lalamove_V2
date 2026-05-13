import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

function chainable(value: unknown): Record<string, ReturnType<typeof vi.fn>> {
  const self: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'in', 'gte', 'not', 'limit', 'order', 'update', 'delete', 'insert', 'single'];
  for (const method of methods) {
    self[method] = vi.fn().mockReturnValue(self);
  }
  self.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    Promise.resolve(value).then(resolve)
  ) as ReturnType<typeof vi.fn>;
  Object.defineProperty(self, Symbol.toStringTag, { value: 'Promise' });
  return self;
}

const mockUseAuth = vi.fn();

vi.mock('../useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('deve carregar roles e permissões do usuário', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'user_roles') {
        return chainable({
          data: [{ role: 'manager', is_active: true }],
          error: null,
        });
      }
      if (table === 'permissions') {
        return chainable({ data: [{ id: 'p1', module: 'orders', action: 'read' }], error: null });
      }
      if (table === 'role_permissions') {
        return chainable({ data: [{ role: 'manager', permission_id: 'p1' }], error: null });
      }
      return chainable({ data: [], error: null });
    });

    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ permission_name: 'orders:view', module: 'orders', action: 'view' }],
      error: null,
    });

    const { usePermissions } = await import('../usePermissions');
    const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userRoles?.length).toBe(1);
    expect(result.current.userPermissions?.length).toBe(1);
    expect(result.current.hasRole('manager')).toBe(true);
    expect(result.current.hasPermission('orders:view')).toBe(true);
    expect(result.current.canAccess('orders', 'view')).toBe(true);
    expect(result.current.isManagerOrAbove()).toBe(true);
  });

  it('deve retornar false para permissões inexistentes', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'user_roles') {
        return chainable({ data: [{ role: 'viewer', is_active: true }], error: null });
      }
      return chainable({ data: [], error: null });
    });

    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ permission_name: 'dashboard:view', module: 'dashboard', action: 'view' }],
      error: null,
    });

    const { usePermissions } = await import('../usePermissions');
    const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasRole('admin')).toBe(false);
    expect(result.current.hasPermission('orders:delete')).toBe(false);
    expect(result.current.canAccess('orders', 'delete')).toBe(false);
    expect(result.current.isAdmin()).toBe(false);
  });

  it('deve suportar usuário não autenticado sem quebrar', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: [], error: null })
    );

    const { usePermissions } = await import('../usePermissions');
    const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });

    await vi.waitFor(() => {
      expect(result.current.allPermissions).toEqual([]);
    });

    expect(result.current.hasRole('admin')).toBe(false);
    expect(result.current.hasPermission('anything')).toBe(false);
    expect(result.current.canAccess('module', 'action')).toBe(false);
  });

  it('deve simular matriz com 240 cenários de acesso (20 módulos x 12 ações)', async () => {
    const modules = Array.from({ length: 20 }, (_, i) => `module-${i + 1}`);
    const actions = Array.from({ length: 12 }, (_, i) => `action-${i + 1}`);

    const permissionsMatrix = modules.flatMap((module) =>
      actions.map((action) => ({
        permission_name: `${module}:${action}`,
        module,
        action,
      }))
    );

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'user_roles') {
        return chainable({ data: [{ role: 'admin', is_active: true }], error: null });
      }
      if (table === 'permissions') {
        return chainable({ data: permissionsMatrix, error: null });
      }
      if (table === 'role_permissions') {
        return chainable({ data: [], error: null });
      }
      return chainable({ data: [], error: null });
    });

    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: permissionsMatrix,
      error: null,
    });

    const { usePermissions } = await import('../usePermissions');
    const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.userPermissions?.length).toBe(240));

    for (const module of modules) {
      for (const action of actions) {
        expect(result.current.canAccess(module, action)).toBe(true);
      }
    }

    expect(result.current.canAccess('module-inexistente', 'action-1')).toBe(false);
    expect(result.current.canAccess('module-1', 'acao-inexistente')).toBe(false);
  });

  it('deve propagar erro do rpc de permissões', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
      chainable({ data: [], error: null })
    );

    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'rpc denied' },
    });

    const { usePermissions } = await import('../usePermissions');
    const { result } = renderHook(() => usePermissions(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.userPermissions).toBeUndefined());
    expect(result.current.hasPermission('orders:view')).toBe(false);
  });
});
