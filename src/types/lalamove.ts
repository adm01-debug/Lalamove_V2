/**
 * Tipos canônicos e enums da integração Lalamove (REST v3 + UAPI).
 *
 * Etapa 2 (tipos canônicos) + Etapa 6 (enums centralizados) do roteiro
 * `docs/LALAMOVE_MASTER_ANALYSIS.md`. Este é o **único** módulo autorizado a
 * declarar a forma dos payloads Lalamove — qualquer outro arquivo importa daqui.
 *
 * ERRATA DE PRODUÇÃO (não violar):
 *  - o campo de serviços de uma cidade chama-se `services`, **nunca** `serviceTypes`;
 *  - `driverId` é sempre `string`; ausência de motorista é `""`, **nunca** `null`;
 *  - `cancelParty` e `cancelledReason` **não existem** na API Brasil.
 */

// ---------------------------------------------------------------------------
// Serviços, cidades e status
// ---------------------------------------------------------------------------

export const SERVICE_TYPES = [
  'LALAGO',
  'LALAPRO',
  'LALAGOFOUR',
  'CAR',
  'CARFOURH',
  'HATCHBACK',
  'HATCHFOURH',
  'UV_FIORINO',
  'UV_4H',
  'VAN',
  'VANFOURH',
  'TRUCK330',
  'TRUCK3_5T',
  'TRUCK_6H',
] as const;

export type LalamoveServiceType = (typeof SERVICE_TYPES)[number];

export const CITY_CODES = [
  'BR AJU', 'BR BEL', 'BR BHZ', 'BR BSB', 'BR CWB', 'BR FLN', 'BR FOR', 'BR GYN',
  'BR MAO', 'BR POA', 'BR RAO', 'BR REC', 'BR RIO', 'BR SAO', 'BR SLZ', 'BR SSA',
] as const;

export type LalamoveCityCode = (typeof CITY_CODES)[number];

export const ORDER_STATUSES = [
  'ASSIGNING_DRIVER',
  'ON_GOING',
  'PICKED_UP',
  'DELIVERING',
  'COMPLETED',
  'CANCELED',
  'REJECTED',
  'EXPIRED',
] as const;

export type LalamoveOrderStatus = (typeof ORDER_STATUSES)[number];

/** Ordem de progressão do fluxo feliz — usada para ignorar eventos fora de ordem. */
export const ORDER_STATUS_RANK: Readonly<Record<LalamoveOrderStatus, number>> = {
  ASSIGNING_DRIVER: 0,
  ON_GOING: 1,
  PICKED_UP: 2,
  DELIVERING: 3,
  COMPLETED: 4,
  // Estados terminais alternativos: nunca são "regredidos" por outro evento.
  CANCELED: 4,
  REJECTED: 4,
  EXPIRED: 4,
};

export const TERMINAL_ORDER_STATUSES: readonly LalamoveOrderStatus[] = [
  'COMPLETED',
  'CANCELED',
  'REJECTED',
  'EXPIRED',
];

// ---------------------------------------------------------------------------
// Item (deliveryItemSpecification)
// ---------------------------------------------------------------------------

export const ITEM_CATEGORIES = [
  'FOOD_PRODUCTS_OR_GROCERY',
  'CONSTRUCTION_MATERIALS_OR_PARTS',
  'RETAIL_AND_WHOLESALE_',
  'FURNITURE_OR_HOME_APPLIANCES',
  'FRAGILE_ITEMS',
] as const;

export type LalamoveItemCategory = (typeof ITEM_CATEGORIES)[number];

export const HANDLING_INSTRUCTIONS = [
  'FRAGILE_OR_HANDLE_WITH_CARE',
  'DO_NOT_STACK',
  'KEEP_UPRIGHT',
  'KEEP_DRY',
  'NO_BENDING',
] as const;

export type LalamoveHandlingInstruction = (typeof HANDLING_INSTRUCTIONS)[number];

export interface LalamoveItemSpecification {
  quantity: string;
  weight: string;
  categories?: LalamoveItemCategory[];
  handlingInstructions?: LalamoveHandlingInstruction[];
}

// ---------------------------------------------------------------------------
// Cotação e pedido (REST v3)
// ---------------------------------------------------------------------------

export interface LalamoveCoordinates {
  lat: string;
  lng: string;
}

export interface LalamoveStop {
  stopId?: string;
  coordinates: LalamoveCoordinates;
  address: string;
  name?: string;
  phone?: string;
}

export interface LalamovePriceBreakdown {
  base?: string;
  extraMileage?: string;
  surcharge?: string;
  totalExcludePriorityFee?: string;
  total: string;
  currency: string;
  priorityFee?: string;
  specialRequests?: string;
  multiStopSurcharge?: string;
}

export interface LalamoveQuotation {
  quotationId: string;
  scheduleAt?: string;
  expiresAt: string;
  serviceType: LalamoveServiceType | string;
  specialRequests?: string[];
  language?: string;
  stops: LalamoveStop[];
  priceBreakdown: LalamovePriceBreakdown;
  distance?: { value: string; unit: string };
  item?: LalamoveItemSpecification;
}

export interface LalamoveDeliveryRecipient {
  stopId: string;
  name: string;
  phone: string;
  remarks?: string;
}

export interface LalamoveDelivery {
  stopId: string;
  /** Errata BR: string sempre presente; `""` significa "sem motorista". */
  driverId?: string;
  toStop?: LalamoveStop;
  toContact?: { name: string; phone: string };
  remarks?: string;
}

export interface LalamoveOrder {
  orderId: string;
  quotationId: string;
  status: LalamoveOrderStatus | string;
  shareLink?: string;
  /** Errata BR: `""` quando nenhum motorista foi atribuído. Nunca `null`. */
  driverId: string;
  priceBreakdown: LalamovePriceBreakdown;
  distance?: { value: string; unit: string };
  stops: LalamoveStop[];
  metadata?: Record<string, string | number | boolean>;
  /** Presente somente quando o cliente habilita POD. */
  podEnabled?: boolean;
}

export interface LalamoveDriver {
  driverId: string;
  name: string;
  phone: string;
  plateNumber?: string;
  photo?: string;
  coordinates?: LalamoveCoordinates & { updatedAt?: string };
}

/** Errata BR: o campo é `services` — `serviceTypes` NÃO existe. */
export interface LalamoveCity {
  locode: LalamoveCityCode | string;
  name: string;
  services: Array<{
    key: LalamoveServiceType | string;
    description?: string;
    dimensions?: { height?: { value: string; unit: string }; length?: { value: string; unit: string }; width?: { value: string; unit: string } };
    load?: { value: string; unit: string };
    specialRequests?: Array<{ name: string; description?: string; effectiveTime?: string }>;
  }>;
}

// ---------------------------------------------------------------------------
// Erros v3
// ---------------------------------------------------------------------------

export interface LalamoveV3Error {
  id: string;
  message?: string;
  /** JSON pointer — presente apenas em `ERR_INVALID_FIELD`. */
  detail?: string;
}

export interface LalamoveV3ErrorEnvelope {
  errors: LalamoveV3Error[];
}

// ---------------------------------------------------------------------------
// Enums UAPI (valores numéricos — a UAPI não usa strings)
// ---------------------------------------------------------------------------

export const UapiOrderStatus = {
  MATCHING: 0,
  ONGOING: 1,
  COMPLETED: 2,
  CANCELLED: 3,
  DRIVER_REJECTED: 4,
  ORDER_TIMEOUT: 5,
  ORDER_NOPAY: 6,
  ORDER_LOADED: 7,
  LOADING: 15,
  UNLOADING: 16,
} as const;
export type UapiOrderStatus = (typeof UapiOrderStatus)[keyof typeof UapiOrderStatus];

export const UapiPaymentType = {
  CASH: 0,
  ENTERPRISE_WALLET: 3,
  WALLET: 4,
  ONLINE: 31,
  POSTPAID_ENTERPRISE_WALLET: 32,
} as const;
export type UapiPaymentType = (typeof UapiPaymentType)[keyof typeof UapiPaymentType];

export const UapiPaymentChannel = {
  BusinessWallet: 301,
  PersonalWallet: 302,
  BusinessPostpaidWallet: 2501,
} as const;
export type UapiPaymentChannel = (typeof UapiPaymentChannel)[keyof typeof UapiPaymentChannel];

export const UapiQuoteType = {
  REGULAR: 100,
  SAVER: 101,
  PRICE_NEGOTIATION: 102,
  PRIORITY: 103,
} as const;
export type UapiQuoteType = (typeof UapiQuoteType)[keyof typeof UapiQuoteType];

export const UapiOrderPlan = {
  DEFAULT: 1,
  REGULAR: 2,
  SAVER: 3,
  PRICE_NEGOTIATION: 4,
  PRIORITY: 5,
} as const;
export type UapiOrderPlan = (typeof UapiOrderPlan)[keyof typeof UapiOrderPlan];

export const UapiPayStatus = {
  NO_PAY: 0,
  PAY_SUCCESS: 1,
  PAY_FAILURE: 2,
  REFUNDING: 3,
  REFUNDED: 4,
  PAY_WAIT: 5,
} as const;
export type UapiPayStatus = (typeof UapiPayStatus)[keyof typeof UapiPayStatus];

export const UapiPostpaidWalletStatus = {
  CREATED: 0,
  DISABLED: 5,
  ENABLED: 10,
  REMOVED: 15,
  NO_POSTPAID_WALLET: 13001,
} as const;
export type UapiPostpaidWalletStatus =
  (typeof UapiPostpaidWalletStatus)[keyof typeof UapiPostpaidWalletStatus];

export const UapiProfileType = { BUSINESS: 1, PERSONAL: 2 } as const;
export const UapiStaffRole = { NONBUSINESS: 0, ADMIN: 1, STAFF: 2, MANAGER: 3 } as const;
export const UapiFleetType = { favorited: 1, blocked: 2 } as const;
export const UapiOrderType = { STANDARD: 1, BUNDLED: 101 } as const;
export const UapiAddrOpMode = {
  NO_EDIT: 0,
  UPDATE_DELIVERY_INFO: 1,
  ADD_POINT: 2,
  REORDER_POINT: 3,
  REMOVE_CASH_PAYEE_POINT: 4,
} as const;
export const UapiTerminal = { APP: 1, PC: 2, L4W: 3 } as const;
export const UapiPriorityLevel = { LOWEST: 1, LOWER: 4, DEFAULT: 5, HIGHER: 6, HIGHEST: 9 } as const;
export const UapiVehicleWheel = { TWO_WHEELS: 2, FOUR_WHEELS: 4 } as const;
export const UapiSpecialRequestPriceType = {
  FIXED_PRICE: 1,
  PERCENTAGE: 2,
  DRIVER_NEGOTIABLE: 3,
  FREE: 4,
} as const;

/** POD status é posicional: o índice do array é o valor retornado pela UAPI. */
export const UAPI_POD_STATUS = ['PENDING', 'SIGNED', 'DELIVERED', 'FAILED', 'NOT_APPLICABLE'] as const;
export type UapiPodStatus = (typeof UAPI_POD_STATUS)[number];

export const UapiPodFeedback = { NO_FEEDBACK: 0, THUMB_UP: 1, THUMB_DOWN: 2 } as const;
