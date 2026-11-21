import { describe, it, expect, vi, beforeEach } from 'vitest';
import { countMapLoad } from './geo-gateway';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

describe('countMapLoad', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('chama geo-gateway com a action count-map-load e o provider informado', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

    await countMapLoad('mapbox');

    expect(invokeMock).toHaveBeenCalledWith('geo-gateway', {
      body: { action: 'count-map-load', provider: 'mapbox' },
    });
  });

  it('nunca lança quando invoke retorna error (telemetria best-effort)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') });

    await expect(countMapLoad('mapbox')).resolves.toBeUndefined();
  });

  it('nunca lança quando invoke rejeita (ex.: rede fora)', async () => {
    invokeMock.mockRejectedValue(new Error('network down'));

    await expect(countMapLoad('google')).resolves.toBeUndefined();
  });
});
