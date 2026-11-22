import { describe, expect, it } from 'vitest';
import { isTrustedBitrix24Origin } from '../postMessage';

describe('isTrustedBitrix24Origin', () => {
  it('aceita a origem da própria página', () => {
    expect(isTrustedBitrix24Origin('https://app.lalamove.com', 'https://app.lalamove.com', 'https://abc.supabase.co')).toBe(true);
  });

  it('aceita a origem do Supabase (callback da edge function)', () => {
    expect(isTrustedBitrix24Origin('https://abc.supabase.co', 'https://app.lalamove.com', 'https://abc.supabase.co')).toBe(true);
  });

  it('rejeita origem desconhecida (XSS por postMessage)', () => {
    expect(isTrustedBitrix24Origin('https://evil.example.com', 'https://app.lalamove.com', 'https://abc.supabase.co')).toBe(false);
  });

  it('rejeita quando a SUPABASE_URL é inválida', () => {
    expect(isTrustedBitrix24Origin('https://abc.supabase.co', 'https://app.lalamove.com', 'not-a-url')).toBe(false);
  });

  it('rejeita origem com esquema diferente', () => {
    expect(isTrustedBitrix24Origin('http://abc.supabase.co', 'https://app.lalamove.com', 'https://abc.supabase.co')).toBe(false);
  });
});
