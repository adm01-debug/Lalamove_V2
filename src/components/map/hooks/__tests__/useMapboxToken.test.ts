import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMapboxToken } from '../useMapboxToken';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('useMapboxToken', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('retorna o token quando a edge function responde com sucesso', async () => {
    invokeMock.mockResolvedValue({ data: { token: 'pk.test.token' }, error: null });

    const { result } = renderHook(() => useMapboxToken());

    await waitFor(() => {
      expect(result.current.mapboxToken).toBe('pk.test.token');
    });
    expect(result.current.error).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith('get-mapbox-token');
  });

  it('define erro quando a edge function retorna erro', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') });

    const { result } = renderHook(() => useMapboxToken());

    await waitFor(() => {
      expect(result.current.error).toBe('Erro ao buscar token do Mapbox');
    });
    expect(result.current.mapboxToken).toBeNull();
  });

  it('define erro específico quando o token está ausente na resposta', async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null });

    const { result } = renderHook(() => useMapboxToken());

    await waitFor(() => {
      expect(result.current.error).toBe('Token Mapbox não configurado');
    });
    expect(result.current.mapboxToken).toBeNull();
  });

  it('define erro quando invoke lança exceção', async () => {
    invokeMock.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useMapboxToken());

    await waitFor(() => {
      expect(result.current.error).toBe('Erro ao buscar token do Mapbox');
    });
    expect(result.current.mapboxToken).toBeNull();
  });

  it('descarta a resposta se o componente for desmontado antes do fetch (guarda cancelled)', async () => {
    let resolveFn: (v: unknown) => void = () => {};
    invokeMock.mockReturnValue(new Promise((resolve) => { resolveFn = resolve; }));

    const { result, unmount } = renderHook(() => useMapboxToken());
    unmount();
    resolveFn({ data: { token: 'late.token' }, error: null });
    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.mapboxToken).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
