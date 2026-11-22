import { describe, expect, it } from 'vitest';
import { buildOrIlike, escapeIlike } from '../postgrest';

describe('escapeIlike', () => {
  it('remove caracteres com significado no DSL do PostgREST', () => {
    expect(escapeIlike('a,b)c')).toBe('abc');
    expect(escapeIlike('100%')).toBe('100');
    expect(escapeIlike('a.b')).toBe('ab');
    expect(escapeIlike('x\\y')).toBe('xy');
  });

  it('mantém caracteres comuns de busca', () => {
    expect(escapeIlike('João Silva')).toBe('João Silva');
  });
});

describe('buildOrIlike', () => {
  it('monta filtro ilike válido para vários campos', () => {
    expect(buildOrIlike(['name', 'phone'], 'joao')).toBe('name.ilike.%joao%,phone.ilike.%joao%');
  });

  it('escapa o termo antes de interpolar', () => {
    expect(buildOrIlike(['name'], 'a,b)c')).toBe('name.ilike.%abc%');
  });
});
