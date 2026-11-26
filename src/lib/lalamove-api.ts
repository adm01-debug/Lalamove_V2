import { supabase } from '@/integrations/supabase/client';
import { parseEdgeError } from '@/lib/edge-error';
import type { LalamoveRawResponse, WalletFlow } from '@/lib/lalamoveUapiPayload';

/**
 * Cliente Lalamove (proxy unificado v3 + UAPI).
 *
 * Etapa 19: nenhuma chave literal vive no bundle — toda chamada passa pela
 * Edge Function autenticada `lalamove-gateway`, que injeta as credenciais.
 */

export interface LalamoveApiResponse extends LalamoveRawResponse {
  sp_summary?: unknown;
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
  body?: { data?: WalletFlow };
  data?: WalletFlow;
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
    const edge = await parseEdgeError(error);
    throw new LalamoveGatewayError(
      edge?.message || error.message || 'Falha ao contatar o gateway Lalamove',
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

/**
 * Grava a sessão UAPI pela via sancionada: a edge `lalamove-uapi` (ação
 * `set-token`, restrita a admin), que insere uma linha nova em
 * `lalamove_uapi_sessions` e desativa as anteriores.
 *
 * O gateway bloqueia `update_uapi_token`/`update_token` de propósito
 * (`lalamove-gateway/route.ts`: "credenciais não são gravadas por requisição"),
 * então as telas de configuração não têm como gravar o token por lá — era por
 * isso que o botão "Atualizar Token" falhava sempre.
 */
export async function setUapiSessionToken(
  accessToken: string,
  refreshToken: string,
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.functions.invoke('lalamove-uapi', {
    body: {
      action: 'set-token',
      access_token: accessToken,
      refresh_token: refreshToken,
    },
  });
  // Respostas 4xx/5xx chegam em `error`; o corpo traz o motivo real
  // (401 sem sessão, 403 sem papel admin, 400 token faltando).
  if (error) {
    let message: string | undefined;
    const context = (error as unknown as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const payload = (await context.json()) as { error?: string };
        message = payload?.error;
      } catch {
        // corpo não-JSON: cai na mensagem padrão abaixo
      }
    }
    return { ok: false, message: message ?? error.message };
  }
  const payload = (data ?? {}) as { success?: boolean; message?: string; error?: string };
  return { ok: payload.success === true, message: payload.message ?? payload.error };
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
  updateUapiToken: (accessToken: string, refreshToken: string) =>
    setUapiSessionToken(accessToken, refreshToken),
  updateV3Keys: (apiKey: string, apiSecret: string) =>
    api('update_v3_keys', { api_key: apiKey, api_secret: apiSecret }),
};
