/**
 * Catálogo oficial Lalamove BR (Etapa 4 do roteiro).
 *
 * Fonte: `docs/LALAMOVE_MASTER_ANALYSIS.md` §4 — 14 serviceTypes, 16 cidades,
 * matriz de special requests por veículo e faixas de peso do `item`.
 *
 * Este catálogo é a fonte de verdade **oficial da API**. O módulo
 * `lalamoveValidation.ts` mantém a matriz histórica usada pela UI legada;
 * novas features devem consumir este arquivo.
 */

import type {
  LalamoveCityCode,
  LalamoveServiceType,
} from '@/types/lalamove';
import { CITY_CODES, SERVICE_TYPES } from '@/types/lalamove';

export interface ServiceSpec {
  /** Carga máxima em kg. */
  maxWeightKg: number;
  /** Dimensões máximas em metros (comprimento × largura × altura). */
  dimensionsM: { length: number; width: number; height: number };
  /** Sobrescritas de dimensão por cidade (ex.: TRUCK330 no RIO). */
  dimensionsByCity?: Partial<Record<LalamoveCityCode, { length: number; width: number; height: number }>>;
  /** `true` quando a API processa `deliveryItemSpecification`. */
  acceptsItem: boolean;
  /** `null` = disponível em todas as cidades. */
  cities: LalamoveCityCode[] | null;
  label: string;
}

const ALL: null = null;

export const SERVICE_CATALOG: Readonly<Record<LalamoveServiceType, ServiceSpec>> = {
  LALAGO: {
    label: 'Lalago (moto)',
    maxWeightKg: 20,
    dimensionsM: { length: 0.3, width: 0.4, height: 0.3 },
    acceptsItem: false,
    cities: ALL,
  },
  LALAPRO: {
    label: 'Lalapro (moto)',
    maxWeightKg: 20,
    dimensionsM: { length: 0.4, width: 0.4, height: 0.3 },
    acceptsItem: false,
    cities: ['BR SAO', 'BR RIO'],
  },
  LALAGOFOUR: {
    label: 'Lalago 4h',
    maxWeightKg: 20,
    dimensionsM: { length: 0.3, width: 0.4, height: 0.3 },
    acceptsItem: false,
    // Conferido contra GET /v3/cities em 2026-11-21: BHZ e CWB nao oferecem.
    cities: ['BR RIO', 'BR SAO'],
  },
  CAR: {
    label: 'Carro',
    maxWeightKg: 300,
    dimensionsM: { length: 1.2, width: 0.8, height: 0.6 },
    acceptsItem: false,
    cities: ALL,
  },
  CARFOURH: {
    label: 'Carro 4h',
    maxWeightKg: 300,
    dimensionsM: { length: 1.2, width: 0.8, height: 0.6 },
    acceptsItem: false,
    cities: ['BR SAO'],
  },
  HATCHBACK: {
    label: 'Hatchback',
    maxWeightKg: 200,
    dimensionsM: { length: 1, width: 0.7, height: 0.6 },
    acceptsItem: false,
    cities: ALL,
  },
  HATCHFOURH: {
    label: 'Hatchback 4h',
    maxWeightKg: 200,
    dimensionsM: { length: 1, width: 0.7, height: 0.6 },
    acceptsItem: false,
    cities: ['BR SAO'],
  },
  UV_FIORINO: {
    label: 'Fiorino',
    maxWeightKg: 500,
    dimensionsM: { length: 1.8, width: 1.3, height: 1.1 },
    acceptsItem: true,
    // Conferido contra GET /v3/cities em 2026-11-21 (inclui BSB e MAO).
    cities: ['BR BHZ', 'BR BSB', 'BR CWB', 'BR FLN', 'BR FOR', 'BR GYN', 'BR MAO', 'BR POA', 'BR RAO', 'BR RIO', 'BR SAO', 'BR SSA'],
  },
  UV_4H: {
    label: 'Fiorino 4h',
    maxWeightKg: 500,
    dimensionsM: { length: 1.8, width: 1.3, height: 1.1 },
    acceptsItem: false,
    // Conferido contra GET /v3/cities em 2026-11-21: so 4 cidades.
    cities: ['BR BHZ', 'BR BSB', 'BR RIO', 'BR SAO'],
  },
  VAN: {
    label: 'Van',
    maxWeightKg: 1000,
    dimensionsM: { length: 2.7, width: 1.8, height: 1.6 },
    acceptsItem: true,
    cities: ['BR BHZ', 'BR BSB', 'BR CWB', 'BR POA', 'BR RIO', 'BR SAO'],
  },
  VANFOURH: {
    label: 'Van 4h',
    maxWeightKg: 1000,
    dimensionsM: { length: 2.7, width: 1.8, height: 1.6 },
    acceptsItem: false,
    cities: ['BR BHZ', 'BR RIO', 'BR SAO'],
  },
  TRUCK330: {
    label: 'Caminhão 3/4',
    maxWeightKg: 1500,
    dimensionsM: { length: 3, width: 1.8, height: 2 },
    dimensionsByCity: { 'BR RIO': { length: 2, width: 2, height: 2.5 } },
    acceptsItem: true,
    cities: ['BR BHZ', 'BR BSB', 'BR CWB', 'BR FOR', 'BR POA', 'BR RIO', 'BR SAO'],
  },
  TRUCK3_5T: {
    label: 'Caminhão 3,5t',
    maxWeightKg: 2500,
    dimensionsM: { length: 4, width: 2.2, height: 2.2 },
    acceptsItem: false,
    cities: ['BR SAO'],
  },
  TRUCK_6H: {
    label: 'Caminhão 6h',
    maxWeightKg: 1500,
    dimensionsM: { length: 3, width: 1.8, height: 2 },
    dimensionsByCity: { 'BR RIO': { length: 2, width: 2, height: 2.5 } },
    acceptsItem: false,
    cities: ['BR BHZ', 'BR RIO', 'BR SAO'],
  },
};

/** Matriz oficial de special requests: serviceType → códigos aceitos. */
export const SPECIAL_REQUESTS_BY_SERVICE: Readonly<Record<LalamoveServiceType, readonly string[]>> = {
  LALAGO: ['THERMAL_BAG_1', 'RETURN', 'WAITING_TIME_030MIN', 'WAITING_TIME_060MIN', 'WAITING_TIME_1'],
  LALAPRO: ['THERMAL_BAG_1', 'RETURN', 'WAITING_TIME_030MIN', 'WAITING_TIME_060MIN', 'WAITING_TIME_1'],
  LALAGOFOUR: ['RENTAL_TIME_1HR', 'RENTAL_TIME_2HR', 'RENTAL_TIME_3HR', 'RENTAL_TIME_4HR'],
  CAR: [
    'RETURN', 'WAITING_TIME_030MIN', 'WAITING_TIME_060MIN', 'WAITING_TIME_1',
    'LOADING_1DRIVER_MAX030MIN', 'LOADING_1DRIVER_MAX060MIN', 'LOADING_1DRIVER_MAX120MIN', 'LOADING_1DRIVER_MAX180MIN',
  ],
  CARFOURH: ['HOURLY_RENTAL_1', 'HOURLY_RENTAL_2', 'HOURLY_RENTAL_3', 'HOURLY_RENTAL_4', 'RENTAL_TIME_1HR', 'RENTAL_TIME_2HR', 'RENTAL_TIME_3HR', 'RENTAL_TIME_4HR'],
  HATCHBACK: [
    'RETURN', 'WAITING_TIME_030MIN', 'WAITING_TIME_060MIN', 'WAITING_TIME_1',
    'LOADING_1DRIVER_MAX030MIN', 'LOADING_1DRIVER_MAX060MIN', 'LOADING_1DRIVER_MAX120MIN', 'LOADING_1DRIVER_MAX180MIN',
  ],
  HATCHFOURH: ['HOURLY_RENTAL_1', 'HOURLY_RENTAL_2', 'HOURLY_RENTAL_3', 'HOURLY_RENTAL_4', 'RENTAL_TIME_1HR', 'RENTAL_TIME_2HR', 'RENTAL_TIME_3HR', 'RENTAL_TIME_4HR'],
  UV_FIORINO: [
    'WAITING_TIME_030MIN', 'WAITING_TIME_060MIN', 'WAITING_TIME_1',
    'LOADING_1DRIVER_MAX030MIN', 'LOADING_1DRIVER_MAX060MIN', 'LOADING_1DRIVER_MAX120MIN', 'LOADING_1DRIVER_MAX180MIN',
    'REFRIGERATED_VEHICLE', 'INSULATED_VEHICLE', 'FROZEN_VEHICLE',
  ],
  UV_4H: ['RENTAL_TIME_1HR', 'RENTAL_TIME_2HR', 'RENTAL_TIME_3HR', 'RENTAL_TIME_4HR'],
  VAN: [
    'WAITING_TIME_030MIN', 'WAITING_TIME_060MIN', 'WAITING_TIME_1',
    'LOADING_1DRIVER_MAX030MIN', 'LOADING_1DRIVER_MAX060MIN', 'LOADING_1DRIVER_MAX120MIN', 'LOADING_1DRIVER_MAX180MIN',
    'LOADING_1DRIVER1HELPER', 'LOADING_1DRIVER1HELPER_MAX060MIN', 'LOADING_1DRIVER1HELPER_MAX120MIN', 'LOADING_1DRIVER1HELPER_MAX180MIN',
  ],
  VANFOURH: ['HOURLY_RENTAL_1', 'HOURLY_RENTAL_2', 'HOURLY_RENTAL_3', 'HOURLY_RENTAL_4', 'RENTAL_TIME_1HR', 'RENTAL_TIME_2HR', 'RENTAL_TIME_3HR', 'RENTAL_TIME_4HR'],
  TRUCK330: [
    'WAITING_TIME_030MIN', 'WAITING_TIME_060MIN', 'WAITING_TIME_1',
    'LOADING_1DRIVER_MAX030MIN', 'LOADING_1DRIVER_MAX060MIN', 'LOADING_1DRIVER_MAX120MIN', 'LOADING_1DRIVER_MAX180MIN',
    'LOADING_1DRIVER1HELPER', 'LOADING_1DRIVER1HELPER_MAX060MIN', 'LOADING_1DRIVER1HELPER_MAX120MIN', 'LOADING_1DRIVER1HELPER_MAX180MIN',
    'HOUSE_MOVING_MAX120MIN', 'HOUSE_MOVING_MAX180MIN', 'HOUSE_MOVING_MAX240MIN',
  ],
  TRUCK3_5T: [
    'LOADING_1DRIVER_MAX030MIN', 'LOADING_1DRIVER_MAX060MIN', 'LOADING_1DRIVER_MAX120MIN', 'LOADING_1DRIVER_MAX180MIN',
    'LOADING_1DRIVER1HELPER', 'LOADING_1DRIVER1HELPER_MAX060MIN', 'LOADING_1DRIVER1HELPER_MAX120MIN', 'LOADING_1DRIVER1HELPER_MAX180MIN',
  ],
  TRUCK_6H: [
    'LOADING_1DRIVER1HELPER', 'LOADING_1DRIVER1HELPER_MAX060MIN', 'LOADING_1DRIVER1HELPER_MAX120MIN', 'LOADING_1DRIVER1HELPER_MAX180MIN',
    'RENTAL_TIME_1HR', 'RENTAL_TIME_2HR', 'RENTAL_TIME_3HR', 'RENTAL_TIME_4HR',
  ],
};

/** Special requests restritos a cidades específicas. */
export const SPECIAL_REQUEST_CITY_RESTRICTIONS: Readonly<Record<string, readonly LalamoveCityCode[]>> = {
  REFRIGERATED_VEHICLE: ['BR SAO'],
  INSULATED_VEHICLE: ['BR SAO'],
  FROZEN_VEHICLE: ['BR SAO'],
};

/** Faixas de peso aceitas em `item.weight`, por serviceType que processa `item`. */
export const ITEM_WEIGHT_RANGES: Readonly<Record<string, readonly string[]>> = {
  TRUCK330: ['LESS_THAN_300_KG', '300_KG_TO_750_KG', '750_KG_TO_1500_KG'],
  UV_FIORINO: ['LESS_THAN_100_KG', '100_KG_TO_250_KG', '250_KG_TO_500_KG'],
  VAN: ['LESS_THAN_200_KG', '200_KG_TO_500_KG', '500_KG_TO_1000_KG'],
};

// ---------------------------------------------------------------------------
// Helpers de consulta
// ---------------------------------------------------------------------------

export function isServiceType(value: string): value is LalamoveServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}

export function isCityCode(value: string): value is LalamoveCityCode {
  return (CITY_CODES as readonly string[]).includes(value);
}

export function isServiceAvailableInCity(
  serviceType: LalamoveServiceType,
  city: LalamoveCityCode,
): boolean {
  const spec = SERVICE_CATALOG[serviceType];
  return spec.cities === null || spec.cities.includes(city);
}

/** Dimensões efetivas considerando sobrescritas por cidade (TRUCK330/TRUCK_6H no RIO). */
export function getServiceDimensions(
  serviceType: LalamoveServiceType,
  city?: LalamoveCityCode,
): { length: number; width: number; height: number } {
  const spec = SERVICE_CATALOG[serviceType];
  if (city && spec.dimensionsByCity?.[city]) return spec.dimensionsByCity[city];
  return spec.dimensionsM;
}

/**
 * Valida um special request contra o serviceType e (opcionalmente) a cidade.
 * Retorna `null` quando válido, ou a razão da rejeição.
 */
export function validateSpecialRequest(
  code: string,
  serviceType: LalamoveServiceType,
  city?: LalamoveCityCode,
): string | null {
  if (!SPECIAL_REQUESTS_BY_SERVICE[serviceType].includes(code)) {
    return `"${code}" não é aceito pelo serviço ${serviceType}.`;
  }
  const cities = SPECIAL_REQUEST_CITY_RESTRICTIONS[code];
  if (city && cities && !cities.includes(city)) {
    return `"${code}" está disponível apenas em ${cities.join(', ')}.`;
  }
  return null;
}

/**
 * Mantém só os special requests ainda válidos para `serviceType`+`city`.
 * Usada pela UI ao trocar serviço ou cidade: sem isso, um special request
 * restrito a outra praça (ex.: REFRIGERATED_VEHICLE só em BR SAO) ficava no
 * formulário mesmo depois de mudar a cidade de coleta, reproduzindo o 422
 * ERR_INVALID_FIELD que a troca de serviço já evita para o campo `item`.
 */
export function filterValidSpecialRequests(
  specialRequests: readonly string[],
  serviceType: LalamoveServiceType,
  city: LalamoveCityCode,
): string[] {
  return specialRequests.filter(code => validateSpecialRequest(code, serviceType, city) === null);
}

/** `true` quando a API realmente processa `deliveryItemSpecification` para o serviço. */
export function serviceAcceptsItem(serviceType: LalamoveServiceType): boolean {
  return SERVICE_CATALOG[serviceType].acceptsItem;
}

export function validateItemWeight(serviceType: LalamoveServiceType, weight: string): string | null {
  const ranges = ITEM_WEIGHT_RANGES[serviceType];
  if (!ranges) return `O serviço ${serviceType} ignora a especificação de item.`;
  return ranges.includes(weight)
    ? null
    : `Peso "${weight}" inválido para ${serviceType}. Use: ${ranges.join(', ')}.`;
}

/**
 * Servicos realmente disponiveis numa cidade (`cities: null` = todas).
 *
 * A Lalamove rejeita com 422 `ERR_INVALID_FIELD` qualquer `serviceType` que a
 * cidade de coleta nao ofereca — ex.: Curitiba aceita apenas CAR, HATCHBACK,
 * LALAGO, TRUCK330, UV_FIORINO e VAN. Use isto para filtrar o seletor de
 * veiculo em vez de oferecer os 14 servicos em todas as pracas.
 */
export function servicesForCity(city: LalamoveCityCode): LalamoveServiceType[] {
  return (SERVICE_TYPES as readonly LalamoveServiceType[]).filter(service => {
    const spec = SERVICE_CATALOG[service];
    return spec.cities === null || spec.cities.includes(city);
  });
}

/** `true` quando a cidade oferece o servico (ou o servico e nacional). */
export function serviceAvailableInCity(
  service: LalamoveServiceType,
  city: LalamoveCityCode,
): boolean {
  const spec = SERVICE_CATALOG[service];
  return spec.cities === null || spec.cities.includes(city);
}

/**
 * Nome da praca para exibir no seletor. O codigo e o `locode` que a Lalamove
 * usa no header `Market`/campo `data.market`; o operador nao reconhece "BR CWB".
 */
export const CITY_LABELS: Readonly<Record<LalamoveCityCode, string>> = {
  'BR AJU': 'Aracaju',
  'BR BEL': 'Belém',
  'BR BHZ': 'Belo Horizonte',
  'BR BSB': 'Brasília',
  'BR CWB': 'Curitiba',
  'BR FLN': 'Florianópolis',
  'BR FOR': 'Fortaleza',
  'BR GYN': 'Goiânia',
  'BR MAO': 'Manaus',
  'BR POA': 'Porto Alegre',
  'BR RAO': 'Ribeirão Preto',
  'BR REC': 'Recife',
  'BR RIO': 'Rio de Janeiro',
  'BR SAO': 'São Paulo',
  'BR SLZ': 'São Luís',
  'BR SSA': 'Salvador',
};
