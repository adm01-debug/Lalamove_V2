import { describe, it, expect } from 'vitest';
import { buildLalamoveStatus } from '@/hooks/useLalamove';

const ok = (value: unknown): PromiseSettledResult<unknown> => ({ status: 'fulfilled', value });
const fail: PromiseSettledResult<unknown> = { status: 'rejected', reason: new Error('401') };

describe('buildLalamoveStatus', () => {
  it('marca os dois canais conectados e usa o e-mail como usuário', () => {
    const status = buildLalamoveStatus(
      ok({ cities: [] }),
      ok({ ret: 0, data: { email: 'op@empresa.com' } }),
    );
    expect(status.v3?.ok).toBe(true);
    expect(status.uapi?.ok).toBe(true);
    expect(status.uapi?.username).toBe('op@empresa.com');
  });

  it('não inventa usuário quando a UAPI não manda e-mail', () => {
    const status = buildLalamoveStatus(ok({}), ok({ ret: 0, data: {} }));
    expect(status.uapi?.ok).toBe(true);
    expect(status.uapi?.username).toBeUndefined();
  });

  it('canal rejeitado aparece desconectado', () => {
    const status = buildLalamoveStatus(fail, fail);
    expect(status.v3?.ok).toBe(false);
    expect(status.uapi?.ok).toBe(false);
  });

  it('resposta vazia conta como falha', () => {
    const status = buildLalamoveStatus(ok(null), ok(undefined));
    expect(status.v3?.ok).toBe(false);
    expect(status.uapi?.ok).toBe(false);
  });
});
