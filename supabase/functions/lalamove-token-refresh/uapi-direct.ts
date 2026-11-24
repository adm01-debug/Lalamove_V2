/**
 * Renovação do token UAPI sem o proxy externo.
 *
 * `LALAMOVE_UNIFIED_PROXY_URL`/`_KEY` nunca existiram na produção, então a
 * renovação automática sempre morria em "Configuração do proxy Lalamove
 * ausente". Este módulo monta a chamada `refresh_token` direto na UAPI, com o
 * mesmo formato usado por `lalamove-uapi/index.ts` (que já renova assim).
 *
 * Funções puras de propósito: a forma da requisição é testável sem rede.
 */

const UAPI_BASE_URL = 'https://br-uapi.lalamove.com/index.php';
const HCOUNTRY = '20000';
const HLANG = 'pt_BR';
const CITY_ID = '21001';
const APP_VERSION = '5.37.0';
const APP_REVISION = '53700';

// Anti-WAF: a UAPI rejeita chamadas sem a "cara" do portal web.
export const UAPI_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
  'Origin': 'https://web.lalamove.com',
  'Referer': 'https://web.lalamove.com/',
  'X-LLM-LOCATION': 'BR',
  'Accept': 'application/json, text/plain, */*',
};

export interface UapiRefreshRequest {
  url: string;
  body: string;
  headers: Record<string, string>;
}

/** Monta a requisição de refresh (`_m=refresh_token`). */
export function buildUapiRefreshRequest(
  accessToken: string,
  refreshToken: string,
  now: number = Date.now(),
): UapiRefreshRequest {
  const query = new URLSearchParams({
    _m: 'refresh_token',
    hcountry: HCOUNTRY,
    _su: `${now}ehll${Math.floor(Math.random() * 1e10)}`,
    _t: Math.floor(now / 1000).toString(),
    device_id: crypto.randomUUID(),
    version: APP_VERSION,
    revision: APP_REVISION,
    os: 'web',
    device_type: 'web',
  });

  const body = new URLSearchParams();
  body.set('token', accessToken);
  body.set('is_ep', '1');
  body.set('hcountry', HCOUNTRY);
  body.set('hlang', HLANG);
  body.set('city_id', CITY_ID);
  body.set('args', JSON.stringify({ refresh_token: refreshToken }));

  return {
    url: `${UAPI_BASE_URL}?${query.toString()}`,
    body: body.toString(),
    headers: UAPI_HEADERS,
  };
}

export interface UapiRefreshResult {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  detail: string;
}

/**
 * Interpreta a resposta da UAPI: `ret === 0` é sucesso e o novo par vem em
 * `data.token` / `data.raw.refresh_token`. Quando o refresh_token não volta na
 * resposta, o atual continua valendo.
 */
export function parseUapiRefreshResponse(
  payload: unknown,
  currentRefreshToken: string,
): UapiRefreshResult {
  const detail = JSON.stringify(payload ?? null).slice(0, 500);
  const data = (payload as { ret?: number; msg?: string; data?: Record<string, unknown> } | null);
  if (!data || data.ret !== 0) {
    return { ok: false, detail: data?.msg ?? detail };
  }
  const token = (data.data?.token as string | undefined) ?? '';
  if (!token) {
    return { ok: false, detail: `resposta sem data.token: ${detail}` };
  }
  const raw = (data.data?.raw ?? {}) as { refresh_token?: string };
  return {
    ok: true,
    accessToken: token,
    refreshToken: raw.refresh_token || currentRefreshToken,
    detail,
  };
}