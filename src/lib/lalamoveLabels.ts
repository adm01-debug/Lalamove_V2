/**
 * Rótulos PT-BR para os códigos canônicos da Lalamove (Etapa 7 do roteiro).
 *
 * Regra: os **códigos** vivem em `lalamoveCatalog.ts` / `types/lalamove.ts`.
 * Este módulo contém apenas apresentação — nunca lógica de negócio.
 */

import type {
  LalamoveHandlingInstruction,
  LalamoveItemCategory,
  LalamoveServiceType,
} from '@/types/lalamove';

/** Ícone por serviço (usado nos seletores de veículo). */
export const SERVICE_EMOJI: Readonly<Record<LalamoveServiceType, string>> = {
  LALAGO: '🏍️',
  LALAPRO: '🏍️',
  LALAGOFOUR: '🏍️',
  CAR: '🚗',
  CARFOURH: '🚗',
  HATCHBACK: '🚙',
  HATCHFOURH: '🚙',
  UV_FIORINO: '🚚',
  UV_4H: '🚚',
  VAN: '🚐',
  VANFOURH: '🚐',
  TRUCK330: '🚛',
  TRUCK3_5T: '🚛',
  TRUCK_6H: '🚛',
};

/**
 * Rótulos dos special requests oficiais BR. Códigos ausentes caem no fallback
 * `humanizeSpecialRequest`, garantindo que nenhum código novo quebre a UI.
 */
export const SPECIAL_REQUEST_LABELS: Readonly<Record<string, string>> = {
  THERMAL_BAG_1: 'Bag térmica',
  RETURN: 'Ida e volta (retorno)',
  WAITING_TIME_030MIN: 'Espera até 30 min',
  WAITING_TIME_060MIN: 'Espera até 60 min',
  WAITING_TIME_1: 'Espera adicional',
  LOADING_1DRIVER_MAX030MIN: 'Carga c/ motorista — até 30 min',
  LOADING_1DRIVER_MAX060MIN: 'Carga c/ motorista — até 60 min',
  LOADING_1DRIVER_MAX120MIN: 'Carga c/ motorista — até 120 min',
  LOADING_1DRIVER_MAX180MIN: 'Carga c/ motorista — até 180 min',
  LOADING_1DRIVER1HELPER: 'Carga c/ motorista + ajudante',
  LOADING_1DRIVER1HELPER_MAX060MIN: 'Motorista + ajudante — até 60 min',
  LOADING_1DRIVER1HELPER_MAX120MIN: 'Motorista + ajudante — até 120 min',
  LOADING_1DRIVER1HELPER_MAX180MIN: 'Motorista + ajudante — até 180 min',
  HOUSE_MOVING_MAX120MIN: 'Mudança — até 120 min',
  HOUSE_MOVING_MAX180MIN: 'Mudança — até 180 min',
  HOUSE_MOVING_MAX240MIN: 'Mudança — até 240 min',
  REFRIGERATED_VEHICLE: 'Veículo refrigerado',
  INSULATED_VEHICLE: 'Veículo isotérmico',
  FROZEN_VEHICLE: 'Veículo congelado',
  RENTAL_TIME_1HR: 'Locação — 1 h',
  RENTAL_TIME_2HR: 'Locação — 2 h',
  RENTAL_TIME_3HR: 'Locação — 3 h',
  RENTAL_TIME_4HR: 'Locação — 4 h',
  HOURLY_RENTAL_1: 'Locação por hora — 1',
  HOURLY_RENTAL_2: 'Locação por hora — 2',
  HOURLY_RENTAL_3: 'Locação por hora — 3',
  HOURLY_RENTAL_4: 'Locação por hora — 4',
};

/** Converte um código desconhecido em texto legível (fallback seguro). */
export function humanizeSpecialRequest(code: string): string {
  return (
    SPECIAL_REQUEST_LABELS[code] ??
    code
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

/** Rótulos das faixas de peso de `item.weight` (variam por serviceType). */
export const WEIGHT_RANGE_LABELS: Readonly<Record<string, string>> = {
  LESS_THAN_100_KG: '≤ 100 kg',
  '100_KG_TO_250_KG': '100 – 250 kg',
  '250_KG_TO_500_KG': '250 – 500 kg',
  LESS_THAN_200_KG: '≤ 200 kg',
  '200_KG_TO_500_KG': '200 – 500 kg',
  '500_KG_TO_1000_KG': '500 – 1000 kg',
  LESS_THAN_300_KG: '≤ 300 kg',
  '300_KG_TO_750_KG': '300 – 750 kg',
  '750_KG_TO_1500_KG': '750 – 1500 kg',
};

export function humanizeWeightRange(code: string): string {
  return WEIGHT_RANGE_LABELS[code] ?? code.toLowerCase().replace(/_/g, ' ');
}

export const ITEM_CATEGORY_LABELS: Readonly<Record<LalamoveItemCategory, string>> = {
  FOOD_PRODUCTS_OR_GROCERY: 'Alimentos / mercado',
  CONSTRUCTION_MATERIALS_OR_PARTS: 'Materiais de construção',
  RETAIL_AND_WHOLESALE_: 'Varejo / atacado',
  FURNITURE_OR_HOME_APPLIANCES: 'Móveis / eletrodomésticos',
  FRAGILE_ITEMS: 'Itens frágeis',
};

export const HANDLING_LABELS: Readonly<Record<LalamoveHandlingInstruction, string>> = {
  FRAGILE_OR_HANDLE_WITH_CARE: 'Frágil — manusear com cuidado',
  DO_NOT_STACK: 'Não empilhar',
  KEEP_UPRIGHT: 'Manter em pé',
  KEEP_DRY: 'Manter seco',
  NO_BENDING: 'Não dobrar',
};
