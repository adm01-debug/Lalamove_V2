import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';


vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';
import { useLoginLockout } from '../useLoginLockout';

describe('useLoginLockout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve mapear checkLockout corretamente', async () => {
    const rpcMock = supabase.rpc as ReturnType<typeof vi.fn>;
    rpcMock.mockResolvedValue({
      data: [{ is_locked: true, remaining_seconds: 90, attempt_count: 4 }],
      error: null,
    });

    const { result } = renderHook(() => useLoginLockout());

    let status: Awaited<ReturnType<typeof result.current.checkLockout>> | undefined;
    await act(async () => {
      status = await result.current.checkLockout('user@test.com');
    });

    expect(status).toEqual({ isLocked: true, remainingSeconds: 90, attemptCount: 4 });
    expect(result.current.lockoutStatus).toEqual({ isLocked: true, remainingSeconds: 90, attemptCount: 4 });
  });

  it('deve retornar fallback no erro de checkLockout', async () => {
    const rpcMock = supabase.rpc as ReturnType<typeof vi.fn>;
    rpcMock.mockResolvedValue({ data: null, error: { message: 'db_error' } });

    const { result } = renderHook(() => useLoginLockout());

    let status: Awaited<ReturnType<typeof result.current.checkLockout>> | undefined;
    await act(async () => {
      status = await result.current.checkLockout('user@test.com');
    });

    expect(status).toEqual({ isLocked: false, remainingSeconds: 0, attemptCount: 0 });
  });

  it('deve mapear recordFailedAttempt corretamente', async () => {
    const rpcMock = supabase.rpc as ReturnType<typeof vi.fn>;
    rpcMock.mockResolvedValue({
      data: [{ is_locked: true, lockout_seconds: 300, attempt_count: 5 }],
      error: null,
    });

    const { result } = renderHook(() => useLoginLockout());

    let status: Awaited<ReturnType<typeof result.current.recordFailedAttempt>> | undefined;
    await act(async () => {
      status = await result.current.recordFailedAttempt('user@test.com');
    });

    expect(status).toEqual({ isLocked: true, remainingSeconds: 300, attemptCount: 5 });
    expect(result.current.lockoutStatus.attemptCount).toBe(5);
  });

  it('deve limpar tentativas e resetar estado', async () => {
    const rpcMock = supabase.rpc as ReturnType<typeof vi.fn>;
    rpcMock
      .mockResolvedValueOnce({
        data: [{ is_locked: false, lockout_seconds: 0, attempt_count: 3 }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useLoginLockout());

    await act(async () => {
      await result.current.recordFailedAttempt('user@test.com');
      await result.current.clearAttempts('user@test.com');
    });

    expect(result.current.lockoutStatus).toEqual({ isLocked: false, remainingSeconds: 0, attemptCount: 0 });
  });

  it('deve formatar tempo restante corretamente (cenários base)', () => {
    const { result } = renderHook(() => useLoginLockout());

    expect(result.current.formatRemainingTime(1)).toBe('1 segundo');
    expect(result.current.formatRemainingTime(2)).toBe('2 segundos');
    expect(result.current.formatRemainingTime(59)).toBe('59 segundos');
    expect(result.current.formatRemainingTime(60)).toBe('1 minuto');
    expect(result.current.formatRemainingTime(61)).toBe('2 minutos');
    expect(result.current.formatRemainingTime(120)).toBe('2 minutos');
  });

  it('deve simular 600 cenários de formatação sem falhar', () => {
    const { result } = renderHook(() => useLoginLockout());

    for (let seconds = 1; seconds <= 600; seconds++) {
      const formatted = result.current.formatRemainingTime(seconds);
      expect(formatted.length).toBeGreaterThan(0);
      if (seconds < 60) {
        expect(formatted.includes('segundo')).toBe(true);
      } else {
        expect(formatted.includes('minuto')).toBe(true);
      }
    }
  });

  it('deve simular 150 respostas progressivas de brute force', async () => {
    const rpcMock = supabase.rpc as ReturnType<typeof vi.fn>;

    rpcMock.mockImplementation((_fn: string, params: { p_email: string }) => {
      const suffix = Number(params.p_email.split('+').pop() ?? '1');
      return Promise.resolve({
        data: [{
          is_locked: suffix >= 5,
          lockout_seconds: suffix >= 5 ? 300 : 0,
          attempt_count: suffix,
        }],
        error: null,
      });
    });

    const { result } = renderHook(() => useLoginLockout());

    for (let i = 1; i <= 150; i++) {
      await act(async () => {
        await result.current.recordFailedAttempt(`user+${i}`);
      });

      await vi.waitFor(() => {
        expect(result.current.lockoutStatus.attemptCount).toBe(i);
      });
    }

    expect(result.current.lockoutStatus.isLocked).toBe(true);
    expect(result.current.lockoutStatus.remainingSeconds).toBe(300);
  });
});

