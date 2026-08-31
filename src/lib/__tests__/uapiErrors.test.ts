import { describe, it, expect } from 'vitest';
import { resolveUapiError, isUapiAuthFailure, UAPI_ERROR_MAP } from '@/lib/uapiErrors';

describe('uapiErrors', () => {
  it('traduz os códigos da família de cupons (qp)', () => {
    expect(resolveUapiError(13001).message).toContain('inválido');
    expect(resolveUapiError(27103).message).toContain('já utilizado');
    expect(resolveUapiError(27104).message).toContain('expirado');
    expect(resolveUapiError(27105).message).toContain('não elegível');
  });

  it('marca 10007 e 10001 como falhas críticas de autenticação', () => {
    expect(isUapiAuthFailure(10007)).toBe(true);
    expect(isUapiAuthFailure(10001)).toBe(true);
    expect(isUapiAuthFailure(13001)).toBe(false);
  });

  it('faz fallback seguro para códigos desconhecidos', () => {
    expect(resolveUapiError(99999).message).toContain('99999');
    expect(resolveUapiError(99999, 'boom').message).toContain('boom');
  });

  it('sucesso é ret 0', () => {
    expect(UAPI_ERROR_MAP[0].message).toContain('sucesso');
  });
});
