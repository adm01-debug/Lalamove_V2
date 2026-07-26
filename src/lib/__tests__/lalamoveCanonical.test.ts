import { describe, expect, it } from 'vitest';
import {
  SERVICE_CATALOG,
  getServiceDimensions,
  isCityCode,
  isServiceAvailableInCity,
  isServiceType,
  serviceAcceptsItem,
  validateItemWeight,
  validateSpecialRequest,
} from '@/lib/lalamoveCatalog';
import {
  extractCityServices,
  hasAssignedDriver,
  isCancellationSuccess,
  normalizeDriverId,
  parseMoney,
  shouldApplyStatusTransition,
} from '@/lib/lalamoveGuards';
import { resolveUapiRet, resolveV3Error } from '@/lib/lalamoveErrors';
import { SERVICE_TYPES } from '@/types/lalamove';

describe('lalamoveCatalog', () => {
  it('cobre os 14 serviceTypes oficiais', () => {
    expect(Object.keys(SERVICE_CATALOG)).toHaveLength(14);
    for (const type of SERVICE_TYPES) {
      expect(SERVICE_CATALOG[type]).toBeDefined();
    }
  });

  it('valida type guards', () => {
    expect(isServiceType('VAN')).toBe(true);
    expect(isServiceType('MOTORCYCLE')).toBe(false);
    expect(isCityCode('BR SAO')).toBe(true);
    expect(isCityCode('BR XYZ')).toBe(false);
  });

  it('respeita disponibilidade por cidade', () => {
    expect(isServiceAvailableInCity('CAR', 'BR MAO')).toBe(true);
    expect(isServiceAvailableInCity('LALAPRO', 'BR SAO')).toBe(true);
    expect(isServiceAvailableInCity('LALAPRO', 'BR BSB')).toBe(false);
    expect(isServiceAvailableInCity('TRUCK3_5T', 'BR RIO')).toBe(false);
  });

  it('aplica dimensões diferentes por cidade em TRUCK330', () => {
    expect(getServiceDimensions('TRUCK330', 'BR SAO')).toEqual({ length: 3, width: 1.8, height: 2 });
    expect(getServiceDimensions('TRUCK330', 'BR RIO')).toEqual({ length: 2, width: 2, height: 2.5 });
  });

  it('valida special requests por serviço e cidade', () => {
    expect(validateSpecialRequest('THERMAL_BAG_1', 'LALAGO')).toBeNull();
    expect(validateSpecialRequest('THERMAL_BAG_1', 'VAN')).toContain('não é aceito');
    expect(validateSpecialRequest('REFRIGERATED_VEHICLE', 'UV_FIORINO', 'BR SAO')).toBeNull();
    expect(validateSpecialRequest('REFRIGERATED_VEHICLE', 'UV_FIORINO', 'BR RIO')).toContain('apenas');
  });

  it('reconhece apenas TRUCK330/UV_FIORINO/VAN como processadores de item', () => {
    expect(serviceAcceptsItem('TRUCK330')).toBe(true);
    expect(serviceAcceptsItem('UV_FIORINO')).toBe(true);
    expect(serviceAcceptsItem('VAN')).toBe(true);
    expect(serviceAcceptsItem('CAR')).toBe(false);
    expect(validateItemWeight('VAN', '500_KG_TO_1000_KG')).toBeNull();
    expect(validateItemWeight('VAN', 'LESS_THAN_300_KG')).toContain('inválido');
    expect(validateItemWeight('CAR', 'LESS_THAN_300_KG')).toContain('ignora');
  });
});

describe('lalamoveGuards (errata de produção)', () => {
  it('normaliza driverId para string', () => {
    expect(normalizeDriverId(null)).toBe('');
    expect(normalizeDriverId(undefined)).toBe('');
    expect(normalizeDriverId('')).toBe('');
    expect(normalizeDriverId(12345)).toBe('12345');
    expect(normalizeDriverId(' abc ')).toBe('abc');
    expect(hasAssignedDriver('')).toBe(false);
    expect(hasAssignedDriver('DRV-1')).toBe(true);
  });

  it('extrai services tolerando o campo legado serviceTypes', () => {
    expect(extractCityServices({ services: [{ key: 'CAR' }, { key: 'VAN' }] })).toEqual(['CAR', 'VAN']);
    expect(extractCityServices({ serviceTypes: ['CAR'] })).toEqual(['CAR']);
    expect(extractCityServices({})).toEqual([]);
    expect(extractCityServices(null)).toEqual([]);
  });

  it('converte valores monetários string', () => {
    expect(parseMoney('16.97')).toBeCloseTo(16.97);
    expect(parseMoney('R$ 110,00'.replace(',', '.'))).toBeCloseTo(110);
    expect(parseMoney(null)).toBe(0);
  });

  it('ignora webhooks fora de ordem e estados terminais', () => {
    expect(shouldApplyStatusTransition('ASSIGNING_DRIVER', 'ON_GOING')).toBe(true);
    expect(shouldApplyStatusTransition('DELIVERING', 'PICKED_UP')).toBe(false);
    expect(shouldApplyStatusTransition('COMPLETED', 'DELIVERING')).toBe(false);
    expect(shouldApplyStatusTransition('ON_GOING', 'ON_GOING')).toBe(false);
    expect(shouldApplyStatusTransition('ON_GOING', 'CANCELED')).toBe(true);
  });

  it('aceita 204 como sucesso de cancelamento', () => {
    expect(isCancellationSuccess(204)).toBe(true);
    expect(isCancellationSuccess(200)).toBe(true);
    expect(isCancellationSuccess(422)).toBe(false);
  });
});

describe('lalamoveErrors', () => {
  it('resolve erros v3 conhecidos', () => {
    expect(resolveV3Error({ errors: [{ id: 'ERR_INVALID_QUOTATION_ID' }] }).requiresRequote).toBe(true);
    expect(resolveV3Error({ errors: [{ id: 'ERR_INVALID_TIPS' }] }).title).toContain('Bônus');
  });

  it('usa o JSON pointer de ERR_INVALID_FIELD', () => {
    const info = resolveV3Error({ errors: [{ id: 'ERR_INVALID_FIELD', detail: '/data/stops' }] });
    expect(info.description).toContain('2 paradas');
  });

  it('trata 502 como falha de autenticação HMAC', () => {
    expect(resolveV3Error(null, 502).title).toContain('autenticação');
  });

  it('resolve códigos ret da UAPI', () => {
    expect(resolveUapiRet(0)).toBeNull();
    expect(resolveUapiRet(10007)?.retryable).toBe(true);
    expect(resolveUapiRet(42201)?.title).toContain('Limite');
    expect(resolveUapiRet(999999)?.retryable).toBe(true);
  });
});
