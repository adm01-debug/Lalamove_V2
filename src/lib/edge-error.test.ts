import { describe, it, expect } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { parseEdgeError, formatEdgeError } from './edge-error';

function httpErrorWithBody(body: unknown): FunctionsHttpError {
  return new FunctionsHttpError(new Response(JSON.stringify(body), {
    status: 422,
    headers: { 'Content-Type': 'application/json' },
  }));
}

describe('parseEdgeError', () => {
  it('lê o formato único de erro do body do FunctionsHttpError', async () => {
    const err = httpErrorWithBody({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'A validação do payload falhou.',
        fields: [{ field: 'quotationId', message: 'quotationId é obrigatório' }],
      },
      meta: { contractVersion: 'v2' },
    });

    const info = await parseEdgeError(err);
    expect(info).not.toBeNull();
    expect(info!.code).toBe('VALIDATION_FAILED');
    expect(info!.message).toBe('A validação do payload falhou.');
    expect(info!.fields).toHaveLength(1);
    expect(info!.fields[0].field).toBe('quotationId');
    expect(info!.fields[0].message).toBe('quotationId é obrigatório');
  });

  it('retorna null para erro que não é FunctionsHttpError', async () => {
    const info = await parseEdgeError(new Error('boom'));
    expect(info).toBeNull();
  });

  it('retorna null quando o body não traz nem `error` objeto nem `error` string', async () => {
    const err = httpErrorWithBody({ foo: 'bar', message: 'sem erro' });
    const info = await parseEdgeError(err);
    expect(info).toBeNull();
  });

  it('retorna null quando o body não é JSON válido', async () => {
    const err = new FunctionsHttpError(new Response('<html>erro</html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    }));
    const info = await parseEdgeError(err);
    expect(info).toBeNull();
  });

  it('lê o formato legado `{ error: string, message }` (edge lalamove-uapi sem sessão)', async () => {
    const err = new FunctionsHttpError(new Response(JSON.stringify({
      error: 'No active UAPI session',
      message: 'Configure a UAPI session token first using action: set-token',
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }));
    const info = await parseEdgeError(err);
    expect(info?.message).toBe('Configure a UAPI session token first using action: set-token');
  });

  it('usa o texto de `error` quando o formato legado não traz `message`', async () => {
    const err = new FunctionsHttpError(new Response(JSON.stringify({ error: 'No active UAPI session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }));
    const info = await parseEdgeError(err);
    expect(info?.message).toBe('No active UAPI session');
  });
});

describe('formatEdgeError', () => {
  it('usa field: message quando há campos', () => {
    expect(formatEdgeError({
      code: 'VALIDATION_FAILED',
      message: 'A validação falhou.',
      fields: [{ field: 'quotationId', message: 'quotationId é obrigatório' }],
    })).toBe('quotationId: quotationId é obrigatório');
  });

  it('usa message quando não há campos', () => {
    expect(formatEdgeError({
      code: 'INTERNAL_ERROR',
      message: 'Erro interno',
      fields: [],
    })).toBe('Erro interno');
  });
});
