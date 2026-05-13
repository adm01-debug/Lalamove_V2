const PROXY_BASE = 'https://pgxfvjmuubtbowutlide.supabase.co/functions/v1/lalamove-uapi-proxy';
const PROXY_KEY = 'promo-lalamove-2026';

export interface UAPIResponse<T = any> {
  ok?: boolean;
  method: string;
  httpCode: number;
  ms: number;
  bytes: number;
  body: {
    ret: number;
    msg: string;
    data: T;
  };
  tokenPreview: string;
  sessionId: string;
  formatted?: string;
  session?: ProxySession;
}

export interface ProxySession {
  id: string;
  tokenPreview: string;
  device_id: string;
  username: string;
  base_url: string;
  city_id: string;
  is_active: boolean;
  last_used_at: string;
  last_refreshed_at: string | null;
  created_at: string;
}

async function proxyFetch<T = any>(action: string, params: Record<string, string> = {}): Promise<UAPIResponse<T>> {
  const url = new URL(PROXY_BASE);
  url.searchParams.set('key', PROXY_KEY);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Proxy error: ${resp.status}`);
  return resp.json();
}

async function proxyPost<T = any>(method: string, args: any = {}, extraParams: Record<string, string> = {}): Promise<UAPIResponse<T>> {
  const url = new URL(PROXY_BASE);
  url.searchParams.set('key', PROXY_KEY);
  url.searchParams.set('action', 'call');
  url.searchParams.set('method', method);
  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args, extra_params: extraParams }),
  });
  if (!resp.ok) throw new Error(`Proxy error: ${resp.status}`);
  return resp.json();
}

export const uapi = {
  getStatus: () => proxyFetch<ProxySession>('status'),
  testConnection: () => proxyFetch('test'),
  getUserInfo: () => proxyFetch('user'),
  getWalletBalance: () => proxyFetch('wallet'),
  getOrders: (page = 1, size = 10) =>
    proxyFetch('orders', { page: String(page), size: String(size) }),
  getVehicles: () => proxyFetch('vehicles'),
  getServiceAreas: () => proxyFetch('service_areas'),
  call: <T = any>(method: string, args?: any, extraParams?: Record<string, string>) =>
    proxyPost<T>(method, args, extraParams),
  updateToken: (token: string, xSignJs?: string, xFingerprint?: string) => {
    const params: Record<string, string> = { token };
    if (xSignJs) params.x_sign_js = xSignJs;
    if (xFingerprint) params.x_fingerprint = xFingerprint;
    return proxyFetch('update_token', params);
  },
};
