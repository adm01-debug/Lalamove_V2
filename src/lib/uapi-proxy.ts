import { callLalamoveGateway, setUapiSessionToken } from '@/lib/lalamove-api';

/**
 * Cliente do proxy UAPI.
 *
 * Etapa 19: as chamadas passam pela Edge Function `lalamove-gateway`
 * (destino `uapi`), que injeta a chave a partir dos secrets do backend.
 */

export interface UAPIResponse<T = unknown> {
  ok?: boolean;
  method: string;
  httpCode: number;
  ms: number;
  bytes: number;
  /** Payload cru da UAPI (`{ ret, msg, data }`) — é o que a edge devolve hoje. */
  ret: number;
  msg: string;
  data: T;
  /**
   * Bloco acrescentado pela edge `lalamove-uapi`. `servedFromSnapshot` avisa
   * que o dado veio da última coleta do robô, não de uma leitura ao vivo.
   */
  _meta?: {
    tokenRefreshed?: boolean;
    servedFromSnapshot?: boolean;
    snapshotCollectedAt?: string;
  };
  /** @deprecated envelope do proxy externo legado (não configurado em produção). */
  body?: {
    ret: number;
    msg: string;
    data: T;
  };
  /** @deprecated idem. */
  formatted?: string;
  tokenPreview: string;
  sessionId: string;
  session?: UAPISessionStatus['session'];
  [key: string]: unknown;
}

export interface UAPIUserData {
  nickname?: string;
  real_name?: string;
  email?: string;
  balance_fen?: number;
  [key: string]: unknown;
}

/** Resposta da action `status` da edge `lalamove-uapi` (metadados da sessão). */
export interface UAPISessionStatus {  ok: boolean;
  session: {
    is_active: boolean;
    token_preview: string | null;
    user_fid: string | null;
    city_id: number | null;
    refresh_method: string | null;
    token_obtained_at: string | null;
    token_expires_at: string | null;
    last_refreshed_at: string | null;
  };
}

function proxyFetch<T = unknown>(
  action: string,
  params: Record<string, string> = {},
): Promise<UAPIResponse<T>> {
  return callLalamoveGateway<UAPIResponse<T>>({ target: 'uapi', action, params, method: 'GET' });
}

function proxyPost<T = unknown>(
  method: string,
  args: unknown = {},
  extraParams: Record<string, string> = {},
): Promise<UAPIResponse<T>> {
  return callLalamoveGateway<UAPIResponse<T>>({
    target: 'uapi',
    action: 'call',
    params: { method },
    body: { args, extra_params: extraParams },
    method: 'POST',
  });
}

export const uapi = {
  getStatus: () => callLalamoveGateway<UAPISessionStatus>({ target: 'uapi', action: 'status', method: 'GET' }),
  testConnection: () => proxyFetch('test'),
  getUserInfo: () => proxyFetch<UAPIUserData>('user'),
  getWalletBalance: () => proxyFetch<UAPIUserData>('wallet'),
  getOrders: (page = 1, size = 10) =>
    proxyFetch('orders', { page: String(page), size: String(size) }),
  getVehicles: () => proxyFetch('vehicles'),
  getServiceAreas: () => proxyFetch('service_areas'),
  call: <T = unknown>(method: string, args?: unknown, extraParams?: Record<string, string>) =>
    proxyPost<T>(method, args, extraParams),
  updateToken: (accessToken: string, refreshToken: string) =>
    setUapiSessionToken(accessToken, refreshToken),
};
