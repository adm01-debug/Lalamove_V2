import { describe, it, expect } from 'vitest';
import { pickRegion, coordKey } from '@/hooks/useRegionResolver';

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

describe('pickRegion', () => {
  it('retorna null quando não há features', () => {
    expect(pickRegion({ features: [] })).toBeNull();
    expect(pickRegion({})).toBeNull();
  });

  it('prioriza bairro (neighborhood) sobre demais tipos', () => {
    const region = pickRegion({
      features: [
        { text: 'Rua Augusta, 100', place_type: ['address'] },
        { text: 'Consolação', place_type: ['neighborhood'] },
        { text: 'São Paulo', place_type: ['place'] },
      ],
    });
    expect(region).toBe('Consolação');
  });

  it('usa o context quando nenhum feature é do tipo neighborhood', () => {
    const region = pickRegion({
      features: [
        {
          text: 'Rua Augusta, 100',
          place_type: ['address'],
          context: [
            { id: 'neighborhood.123', text: 'Cerqueira César' },
            { id: 'place.456', text: 'São Paulo' },
          ],
        },
      ],
    });
    expect(region).toBe('Cerqueira César');
  });

  it('cai para localidade quando não há bairro', () => {
    const region = pickRegion({
      features: [
        { text: 'Zona Central', place_type: ['locality'] },
        { text: 'São Paulo', place_type: ['place'] },
      ],
    });
    expect(region).toBe('Zona Central');
  });

  it('cai para cidade (place) quando não há bairro nem localidade', () => {
    const region = pickRegion({
      features: [
        { text: 'Av. Paulista', place_type: ['address'] },
        { text: 'São Paulo', place_type: ['place'] },
      ],
    });
    expect(region).toBe('São Paulo');
  });

  it('usa o texto do primeiro feature como último recurso', () => {
    const region = pickRegion({
      features: [{ text: 'Ponto Desconhecido', place_type: ['poi'] }],
    });
    expect(region).toBe('Ponto Desconhecido');
  });
});
