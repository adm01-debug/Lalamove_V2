import { supabase } from '@/integrations/supabase/client';

/**
 * Cliente Lalamove (proxy unificado v3 + UAPI).
 *
 * Etapa 19: nenhuma chave literal vive no bundle — toda chamada passa pela
 * Edge Function autenticada `lalamove-gateway`, que injeta as credenciais.
 */

export interface LalamoveApiResponse {
  ok?: boolean;
  body?: { data?: Record<string, unknown> };
  formatted?: string;
  sp_summary?: unknown;
  [key: string]: unknown;
}

export interface LalamoveStatusResponse {
  v3?: { ok: boolean; apiKeyPreview?: string };
  uapi?: {
    ok: boolean;
    tokenPreview?: string;
    username?: string;
    session?: {
      device_id?: string;
      last_used_at?: string;
    };
  };
}

export interface LalamoveWalletHistoryResponse extends LalamoveApiResponse {
  body?: { data?: { list?: unknown[] } };
  data?: { list?: unknown[] };
}

interface GatewayPayload {
  target: 'unified' | 'uapi';
  action: string;
  params?: Record<string, string>;
  body?: unknown;
  method?: 'GET' | 'POST';
}

/**
 * Erro tipado do gateway. Carrega o `x-request-id` para correlação ponta a
 * ponta (frontend → Edge Function → proxy → Lalamove) — Etapa 15.
 */
export class LalamoveGatewayError extends Error {
  readonly requestId: string;
  readonly status?: number;

  constructor(message: string, requestId: string, status?: number) {
    super(message);
    this.name = 'LalamoveGatewayError';
    this.requestId = requestId;
    this.status = status;
  }
}

/** Gera um identificador de correlação por requisição. */
function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function callLalamoveGateway<T>(payload: GatewayPayload): Promise<T> {
  const requestId = newRequestId();

  const { data, error } = await supabase.functions.invoke('lalamove-gateway', {
    body: payload,
    headers: { 'x-request-id': requestId },
  });

  if (error) {
    throw new LalamoveGatewayError(
      error.message || 'Falha ao contatar o gateway Lalamove',
      requestId,
    );
  }

  const result = data as (T & { error?: string; status?: number; requestId?: string }) | null;
  if (result && typeof result === 'object' && typeof result.error === 'string') {
    throw new LalamoveGatewayError(result.error, result.requestId ?? requestId, result.status);
  }
  if (result === null || result === undefined) {
    throw new LalamoveGatewayError('Resposta vazia do gateway Lalamove', requestId);
  }

  return result as T;
}


async function api<T = LalamoveApiResponse>(
  action: string,
  params: Record<string, string> = {},
): Promise<T> {
  return callLalamoveGateway<T>({ target: 'unified', action, params, method: 'GET' });
}

async function apiPost<T = LalamoveApiResponse>(
  action: string,
  body: unknown,
  params: Record<string, string> = {},
): Promise<T> {
  return callLalamoveGateway<T>({ target: 'unified', action, params, body, method: 'POST' });
}

export interface QuoteParams {
  service?: string;
  from_lat: string;
  from_lng: string;
  from_addr?: string;
  to_lat: string;
  to_lng: string;
  to_addr?: string;
  special?: string;
}

export const lalamove = {
  // Status & Test
  status: () => api('status'),
  test: () => api('test'),

  // V3 Official
  cities: () => api('cities'),
  quote: (params: QuoteParams) =>
    api('quote', { service: params.service || 'CAR', ...params } as Record<string, string>),
  quotePost: (body: unknown) => apiPost('quote', body),
  orderCreate: (body: unknown) => apiPost('order_create', body),
  orderGet: (orderId: string) => api('order_get', { order_id: orderId }),
  orderCancel: (orderId: string) => api('order_cancel', { order_id: orderId }),
  orderPriority: (orderId: string, fee = '5') => api('order_priority', { order_id: orderId, fee }),
  driverLocation: (orderId: string, driverId: string) =>
    api('driver_location', { order_id: orderId, driver_id: driverId }),
  v3Call: (path: string, method = 'GET', body?: unknown) =>
    method === 'GET'
      ? api('v3', { path, http_method: method })
      : apiPost('v3', body, { path, http_method: method }),

  // UAPI
  user: () => api('user'),
  wallet: () => api('wallet'),
  walletHistory: (page = '1', size = '20') => api('wallet_flow_list', { page, size }),
  vehicles: () => api('vehicles'),
  serviceAreas: () => api('service_areas'),
  uapiCall: (method: string, args?: unknown, extraParams?: Record<string, string>) =>
    apiPost('uapi', { args, extra_params: extraParams }, { method }),

  // Token Refresh
  refreshToken: () => api('refresh_token'),

  // Credentials
  updateUapiToken: (token: string, xSignJs?: string, xFingerprint?: string) => {
    const params: Record<string, string> = { token };
    if (xSignJs) params.x_sign_js = xSignJs;
    if (xFingerprint) params.x_fingerprint = xFingerprint;
    return api('update_uapi_token', params);
  },
  updateV3Keys: (apiKey: string, apiSecret: string) =>
    api('update_v3_keys', { api_key: apiKey, api_secret: apiSecret }),
};
