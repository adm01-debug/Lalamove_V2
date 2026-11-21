import { describe, it, expect } from 'vitest';
import { regionFromAddress, coordKey } from '@/hooks/useRegionResolver';

describe('coordKey', () => {
  it('arredonda para 3 casas decimais (~110m)', () => {
    expect(coordKey(-23.561414, -46.655881)).toBe('-23.561,-46.656');
  });

  it('agrupa coordenadas muito próximas na mesma chave', () => {
    const a = coordKey(-23.5610, -46.6558);
    const b = coordKey(-23.5611, -46.6559);
    expect(a).toBe(b);
  });

  it('gera chaves distintas para pontos distantes', () => {
    expect(coordKey(-23.55, -46.63)).not.toBe(coordKey(-22.90, -43.20));
  });
});

describe('regionFromAddress', () => {
  it('retorna null quando o endereço é null', () => {
    expect(regionFromAddress(null)).toBeNull();
  });

  it('retorna null quando não há district, city nem formatted', () => {
    expect(regionFromAddress({ formatted: '', components: {} })).toBeNull();
  });

  it('prioriza bairro (district) sobre cidade', () => {
    const region = regionFromAddress({
      formatted: 'Rua Augusta, 100, Consolação, São Paulo',
      components: { district: 'Consolação', city: 'São Paulo' },
    });
    expect(region).toBe('Consolação');
  });

  it('cai para cidade (city) quando não há bairro', () => {
    const region = regionFromAddress({
      formatted: 'São Paulo, SP',
      components: { city: 'São Paulo' },
    });
    expect(region).toBe('São Paulo');
  });

  it('usa o endereço formatado como último recurso', () => {
    const region = regionFromAddress({
      formatted: 'Ponto Desconhecido',
      components: {},
    });
    expect(region).toBe('Ponto Desconhecido');
  });
});
