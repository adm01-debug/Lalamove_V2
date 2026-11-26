import { describe, it, expect } from 'vitest';
import { buildLalamoveStatus } from '@/hooks/useLalamove';

const ok = <T>(value: T): PromiseSettledResult<T> => ({ status: 'fulfilled', value });
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

  it('sessão cadastrada inativa vence o perfil que respondeu', () => {
    const status = buildLalamoveStatus(
      ok({ cities: [] }),
      ok({ ret: 0, data: { email: 'op@empresa.com' } }),
      ok({ ok: false, session: { is_active: false } }),
    );
    expect(status.uapi?.ok).toBe(false);
    expect(status.uapi?.username).toBe('op@empresa.com');
  });

  it('perfil servido do snapshot não conta como sessão viva', () => {
    const status = buildLalamoveStatus(
      ok({ cities: [] }),
      ok({ ret: 0, data: { email: 'op@empresa.com' }, _meta: { servedFromSnapshot: true } }),
    );
    expect(status.uapi?.ok).toBe(false);
  });

  it('sessão ativa mantém conectado mesmo com perfil vindo do snapshot', () => {
    const status = buildLalamoveStatus(
      ok({ cities: [] }),
      ok({ ret: 0, data: {}, _meta: { servedFromSnapshot: true } }),
      ok({ ok: true, session: { is_active: true } }),
    );
    expect(status.uapi?.ok).toBe(true);
  });
});
