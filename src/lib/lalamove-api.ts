const PROXY = 'https://pgxfvjmuubtbowutlide.supabase.co/functions/v1/lalamove-unified';
const KEY = 'promo-llm-unified-2026';

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

async function api<T = LalamoveApiResponse>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(PROXY);
  url.searchParams.set('key', KEY);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Proxy error: ${resp.status}`);
  return resp.json();
}

async function apiPost<T = LalamoveApiResponse>(action: string, body: unknown, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(PROXY);
  url.searchParams.set('key', KEY);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Proxy error: ${resp.status}`);
  return resp.json();
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
    method === 'GET' ? api('v3', { path, http_method: method }) : apiPost('v3', body, { path, http_method: method }),

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
