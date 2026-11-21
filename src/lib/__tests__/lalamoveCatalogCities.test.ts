import { describe, it, expect } from 'vitest';
import { SERVICE_TYPES, CITY_CODES } from '@/types/lalamove';
import { SERVICE_CATALOG, servicesForCity, serviceAvailableInCity, CITY_LABELS } from '@/lib/lalamoveCatalog';

/**
 * Regressao da matriz servico x cidade.
 *
 * Fonte da verdade: resposta real de `GET /v3/cities` da conta de producao
 * (capturada em 2026-11-21). A Lalamove responde 422 `ERR_INVALID_FIELD`
 * quando a cidade de coleta nao oferece o `serviceType` pedido, entao uma
 * matriz desatualizada vira erro na cara do operador.
 */

/** Servicos que a API lista para Curitiba (6 de 14). */
const CWB_SERVICOS_REAIS = [
  'CAR', 'HATCHBACK', 'LALAGO', 'TRUCK330', 'UV_FIORINO', 'VAN',
] as const;

describe('matriz servico x cidade (conferida com a API real)', () => {
  it('Curitiba oferece exatamente os 6 servicos que a API lista', () => {
    expect(servicesForCity('BR CWB').sort()).toEqual([...CWB_SERVICOS_REAIS].sort());
  });

  it('Sao Paulo oferece os 14 servicos', () => {
    expect(servicesForCity('BR SAO')).toHaveLength(SERVICE_TYPES.length);
  });

  it('LALAGOFOUR existe so em RIO e SAO (nao em BHZ/CWB)', () => {
    expect(SERVICE_CATALOG.LALAGOFOUR.cities).toEqual(['BR RIO', 'BR SAO']);
    expect(serviceAvailableInCity('LALAGOFOUR', 'BR CWB')).toBe(false);
    expect(serviceAvailableInCity('LALAGOFOUR', 'BR BHZ')).toBe(false);
  });

  it('UV_FIORINO inclui BSB e MAO', () => {
    expect(serviceAvailableInCity('UV_FIORINO', 'BR BSB')).toBe(true);
    expect(serviceAvailableInCity('UV_FIORINO', 'BR MAO')).toBe(true);
  });

  it('UV_4H existe em apenas 4 cidades', () => {
    expect(SERVICE_CATALOG.UV_4H.cities).toEqual(['BR BHZ', 'BR BSB', 'BR RIO', 'BR SAO']);
  });

  it('todo servico do catalogo pertence a SERVICE_TYPES', () => {
    expect(Object.keys(SERVICE_CATALOG).sort()).toEqual([...SERVICE_TYPES].sort());
  });

  it('servico nacional (cities: null) aparece em qualquer cidade', () => {
    expect(SERVICE_CATALOG.LALAGO.cities).toBeNull();
    expect(serviceAvailableInCity('LALAGO', 'BR AJU')).toBe(true);
  });
});

describe('CITY_LABELS', () => {
  it('cobre as 16 pracas, sem codigo cru sobrando', () => {
    expect(Object.keys(CITY_LABELS).sort()).toEqual([...CITY_CODES].sort());
    for (const code of CITY_CODES) {
      expect(CITY_LABELS[code]).toBeTruthy();
      // o label e nome de cidade, nao o locode
      expect(CITY_LABELS[code]).not.toMatch(/^BR /);
    }
  });

  it('nao repete nome entre pracas diferentes', () => {
    const nomes = CITY_CODES.map(c => CITY_LABELS[c]);
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});

describe('filtro do seletor de veiculo', () => {
  it('toda praca oferece ao menos um servico (seletor nunca fica vazio)', () => {
    for (const city of CITY_CODES) {
      expect(servicesForCity(city).length).toBeGreaterThan(0);
    }
  });

  it('o fallback escolhido ao trocar de praca e valido naquela praca', () => {
    // mesma regra que o NewOrderDialog aplica: servicesForCity(city)[0]
    for (const city of CITY_CODES) {
      const fallback = servicesForCity(city)[0];
      expect(serviceAvailableInCity(fallback, city)).toBe(true);
    }
  });

  it('LALAGO (padrao do formulario) e nacional: a praca inicial nunca cai no fallback', () => {
    for (const city of CITY_CODES) {
      expect(serviceAvailableInCity('LALAGO', city)).toBe(true);
    }
  });

  it('existe servico restrito a poucas pracas — e por isso que o filtro trabalha', () => {
    const restritos = SERVICE_TYPES.filter(s => SERVICE_CATALOG[s].cities !== null);
    expect(restritos.length).toBeGreaterThan(0);
    // trocar para uma praca que nao atende o servico escolhido muda a selecao
    const servico = restritos[0];
    const semEsse = CITY_CODES.find(c => !serviceAvailableInCity(servico, c));
    expect(semEsse).toBeDefined();
    expect(serviceAvailableInCity(servicesForCity(semEsse!)[0], semEsse!)).toBe(true);
  });
});
