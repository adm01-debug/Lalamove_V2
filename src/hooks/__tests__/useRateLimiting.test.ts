import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from "@testing-library/react";
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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useRateLimiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve calcular estatísticas básicas corretamente', async () => {
    const logs = [
      { id: '1', ip_address: '1.1.1.1', blocked: true },
      { id: '2', ip_address: '1.1.1.1', blocked: false },
      { id: '3', ip_address: '2.2.2.2', blocked: true },
    ];

    const blockedIps = [
      { id: 'b1', is_permanent: true, expires_at: null },
      { id: 'b2', is_permanent: false, expires_at: '2099-12-31T23:59:59Z' },
      { id: 'b3', is_permanent: false, expires_at: '2000-01-01T00:00:00Z' },
    ];

    const whitelist = [
      { id: 'w1', is_active: true },
      { id: 'w2', is_active: false },
    ];

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'rate_limit_logs') return chainable({ data: logs, error: null });
      if (table === 'blocked_ips') return chainable({ data: blockedIps, error: null });
      if (table === 'ip_whitelist') return chainable({ data: whitelist, error: null });
      return chainable({ data: [], error: null });
    });

    const { useRateLimiting } = await import('../useRateLimiting');
    const { result } = renderHook(() => useRateLimiting(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.totalRequests).toBe(3);
    expect(result.current.stats.blockedRequests).toBe(2);
    expect(result.current.stats.uniqueIPs).toBe(2);
    expect(result.current.stats.activeBlockedIPs).toBe(2);
    expect(result.current.stats.whitelistedIPs).toBe(1);
  });

  it('deve simular stress com 780 cenários agregados sem quebrar', async () => {
    const logs = Array.from({ length: 500 }, (_, i) => ({
      id: `log-${i}`,
      ip_address: `10.0.${i % 100}.${(i % 200) + 1}`,
      blocked: i % 4 === 0,
    }));

    const blockedIps = Array.from({ length: 200 }, (_, i) => ({
      id: `block-${i}`,
      is_permanent: i % 5 === 0,
      expires_at: i % 5 === 0 ? null : i % 2 === 0 ? '2099-12-31T23:59:59Z' : '2000-01-01T00:00:00Z',
    }));

    const whitelist = Array.from({ length: 80 }, (_, i) => ({
      id: `wl-${i}`,
      is_active: i % 3 !== 0,
    }));

    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'rate_limit_logs') return chainable({ data: logs, error: null });
      if (table === 'blocked_ips') return chainable({ data: blockedIps, error: null });
      if (table === 'ip_whitelist') return chainable({ data: whitelist, error: null });
      return chainable({ data: [], error: null });
    });

    const { useRateLimiting } = await import('../useRateLimiting');
    const { result } = renderHook(() => useRateLimiting(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.totalRequests).toBe(500);
    expect(result.current.stats.blockedRequests).toBe(125);
    expect(result.current.stats.uniqueIPs).toBe(200);
    expect(result.current.stats.activeBlockedIPs).toBeGreaterThan(0);
    expect(result.current.stats.whitelistedIPs).toBeGreaterThan(0);
  });

  it('deve executar blockIP com sucesso', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'rate_limit_logs') return chainable({ data: [], error: null });
      if (table === 'blocked_ips') return chainable({ data: [{ id: 'b1' }], error: null });
      if (table === 'ip_whitelist') return chainable({ data: [], error: null });
      return chainable({ data: [], error: null });
    });

    const { useRateLimiting } = await import('../useRateLimiting');
    const { result } = renderHook(() => useRateLimiting(), { wrapper: createWrapper() });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.blockIP({
        ipAddress: '200.1.1.1',
        reason: 'brute force',
        isPermanent: true,
      });
    });

    await vi.waitFor(() => {
      expect((toast.success as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    });
  });
});
