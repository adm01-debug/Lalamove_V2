import { describe, it, expect } from 'vitest';
import { SERVICE_TYPES } from '@/types/lalamove';
import { SERVICE_CATALOG, servicesForCity, serviceAvailableInCity } from '@/lib/lalamoveCatalog';

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
