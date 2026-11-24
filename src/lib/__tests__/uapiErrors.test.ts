import { describe, it, expect } from 'vitest';
import {
  resolveUapiError,
  isUapiAuthFailure,
  isUapiSessionMissing,
  UAPI_ERROR_MAP,
  UAPI_SESSION_MISSING_HINT,
  UAPI_SESSION_MISSING_MESSAGE,
} from '@/lib/uapiErrors';

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

  describe('isUapiSessionMissing', () => {
    it('reconhece a resposta 401 da edge lalamove-uapi (formato legado)', () => {
      expect(isUapiSessionMissing('No active UAPI session')).toBe(true);
      expect(isUapiSessionMissing('Edge Function returned a non-2xx status code')).toBe(false);
    });

    it('reconhece a mensagem da edge e o par traduzido da camada de dados', () => {
      expect(isUapiSessionMissing('Configure a UAPI session token first using action: set-token')).toBe(true);
      expect(isUapiSessionMissing('Sessão UAPI não configurada.')).toBe(true);
    });

    it('reconhece os códigos de sessão e o UapiError traduzido', () => {
      expect(isUapiSessionMissing({ code: 10007, message: 'Sessão UAPI expirada' })).toBe(true);
      expect(isUapiSessionMissing({ code: 10001 })).toBe(true);
      expect(
        isUapiSessionMissing({ code: -1, message: UAPI_SESSION_MISSING_MESSAGE, hint: UAPI_SESSION_MISSING_HINT }),
      ).toBe(true);
    });

    it('não confunde falha de rede nem erro de negócio com falta de sessão', () => {
      expect(isUapiSessionMissing('Falha ao contatar a Lalamove')).toBe(false);
      expect(isUapiSessionMissing('Cupom já utilizado')).toBe(false);
      expect(isUapiSessionMissing({ code: 27103, message: 'Cupom já utilizado' })).toBe(false);
      expect(isUapiSessionMissing(null)).toBe(false);
      expect(isUapiSessionMissing(undefined)).toBe(false);
    });
  });
});
