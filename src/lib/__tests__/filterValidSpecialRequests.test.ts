import { describe, it, expect } from 'vitest';
import { filterValidSpecialRequests } from '@/lib/lalamoveCatalog';

/**
 * Regressao do gap achado na bateria de validacao desta sessao: ao trocar a
 * cidade de coleta mantendo um serviceType que continua valido na cidade
 * nova (ex.: UV_FIORINO existe em SAO e em CWB), o formulario so filtrava
 * Special Requests por SPECIAL_REQUESTS_BY_SERVICE — nunca por
 * SPECIAL_REQUEST_CITY_RESTRICTIONS. REFRIGERATED_VEHICLE/INSULATED_VEHICLE/
 * FROZEN_VEHICLE (restritos a BR SAO) ficavam marcados no payload enviado
 * para Curitiba, reproduzindo a classe de erro 422 que a PR #133 (fallback
 * de serviço por cidade) deveria ter coberto.
 */

describe('filterValidSpecialRequests', () => {
  it('remove special request restrito a outra cidade quando o serviço continua válido na nova praça', () => {
    // UV_FIORINO existe em BR SAO e em BR CWB — não cai no fallback de serviço.
    const result = filterValidSpecialRequests(['REFRIGERATED_VEHICLE'], 'UV_FIORINO', 'BR CWB');
    expect(result).toEqual([]);
  });

  it('mantém o special request quando a cidade nova ainda está na lista de restrição', () => {
    const result = filterValidSpecialRequests(['REFRIGERATED_VEHICLE'], 'UV_FIORINO', 'BR SAO');
    expect(result).toEqual(['REFRIGERATED_VEHICLE']);
  });

  it('mantém special requests sem restrição de cidade', () => {
    const result = filterValidSpecialRequests(
      ['WAITING_TIME_030MIN', 'REFRIGERATED_VEHICLE'],
      'UV_FIORINO',
      'BR CWB',
    );
    expect(result).toEqual(['WAITING_TIME_030MIN']);
  });

  it('remove special request incompatível com o serviço independente da cidade', () => {
    // RENTAL_TIME_1HR é da LALAGOFOUR, não da UV_FIORINO.
    const result = filterValidSpecialRequests(['RENTAL_TIME_1HR'], 'UV_FIORINO', 'BR SAO');
    expect(result).toEqual([]);
  });

  it('lista vazia permanece vazia', () => {
    expect(filterValidSpecialRequests([], 'CAR', 'BR SAO')).toEqual([]);
  });
});
