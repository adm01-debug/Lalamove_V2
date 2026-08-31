import { describe, it, expect } from 'vitest';
import { validateBrazilianPhone, maskBrazilianPhone } from '@/lib/phone';

describe('validateBrazilianPhone — casos válidos', () => {
  const validSamples: string[] = [];
  // Gera centenas de números celulares válidos variando DDD (11–99) e sufixo.
  for (let ddd = 11; ddd <= 99; ddd++) {
    for (const suffix of ['87654321', '00000001', '99999999', '12345678']) {
      validSamples.push(`${ddd}9${suffix}`);
    }
  }

  it.each(validSamples)('aceita %s (nacional cru)', (n) => {
    const r = validateBrazilianPhone(n);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.e164).toBe(`+55${n}`);
      expect(r.national).toBe(n);
      expect(r.country).toBe('BR');
    }
  });

  it.each(validSamples.slice(0, 40))('aceita %s com prefixo +55', (n) => {
    const r = validateBrazilianPhone(`+55${n}`);
    expect(r.valid).toBe(true);
  });

  it.each(validSamples.slice(0, 40))('aceita %s formatado com máscara', (n) => {
    const masked = `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    const r = validateBrazilianPhone(masked);
    expect(r.valid).toBe(true);
  });

  it('aceita 55 sem + como código do país', () => {
    expect(validateBrazilianPhone('5511987654321').valid).toBe(true);
  });
});

describe('validateBrazilianPhone — rejeições', () => {
  const cases: Array<[string, string, string]> = [
    ['string vazia', '', 'obrigatório'],
    ['espaços apenas', '   ', 'obrigatório'],
    ['apenas letras', 'abcdef', 'inválido'],
    ['fixo 10 dígitos', '1132234567', '9 dígitos'],
    ['DDD 10', '1098765432', '9 dígitos'],
    ['DDD 09', '0987654321', '9 dígitos'],
    ['sem nono dígito', '1187654321', '9 dígitos'],
    ['muitos dígitos', '11987654321000', '9 dígitos'],
    ['nono dígito 8', '11887654321', 'nono dígito'],
    ['nono dígito 0', '11087654321', 'nono dígito'],
    ['apenas 9s', '999999999999', '9 dígitos'],
    ['DDD 100', '1009876543', '9 dígitos'],
  ];
  it.each(cases)('rejeita %s (%s)', (_desc, input) => {
    const r = validateBrazilianPhone(input);
    expect(r.valid).toBe(false);
    if (!r.valid) {
      expect(r.e164).toBeNull();
      expect(r.error.length).toBeGreaterThan(0);
    }
  });

  // Todos os DDDs fora da faixa 11–99 devem falhar.
  const invalidDDDs = Array.from({ length: 11 }, (_, i) => i); // 0..10
  it.each(invalidDDDs)('rejeita DDD inválido %s', (ddd) => {
    const n = `${String(ddd).padStart(2, '0')}987654321`;
    expect(validateBrazilianPhone(n).valid).toBe(false);
  });
});

describe('maskBrazilianPhone', () => {
  const cases: Array<[string, string]> = [
    ['', ''],
    ['1', '1'],
    ['11', '11'],
    ['119', '(11) 9'],
    ['1198765', '(11) 98765'],
    ['11987654321', '(11) 98765-4321'],
    ['5511987654321', '(11) 98765-4321'],
    ['(11) 98765-4321', '(11) 98765-4321'],
    ['abc11def98765ghi4321', '(11) 98765-4321'],
    ['11987654321999', '(11) 98765-4321'], // trunca em 11 dígitos
  ];
  it.each(cases)('mascara %s -> %s', (input, expected) => {
    expect(maskBrazilianPhone(input)).toBe(expected);
  });
});
