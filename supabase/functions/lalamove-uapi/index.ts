import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logger } from "../_shared/logger.ts";
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";
import { requireRole } from "../_shared/auth.ts";
import { evaluateSessionHealth } from "./session-health.ts";
import {
  EMPTY_STATEMENT_PAGE,
  isBeyondHistory,
  statementItems,
  STATEMENT_PAGE_SIZE,
} from "./statement-history.ts";
import {
  buildStatementPage,
  statementPageRange,
  type StatementItem,
} from "./statement-items.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UAPI_BASE_URL = 'https://br-uapi.lalamove.com/index.php';
const HCOUNTRY = '20000';
const CITY_ID = '21001';
const HLANG = 'pt_BR';
const APP_VERSION = '5.37.0';
const APP_REVISION = '53700';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Anti-WAF headers required for UAPI
const UAPI_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
  'Origin': 'https://web.lalamove.com',
  'Referer': 'https://web.lalamove.com/',
  'X-LLM-LOCATION': 'BR',
  'Accept': 'application/json, text/plain, */*',
};

// Generate _su parameter (session URL token)
function generateSu(): string {
  return `${Date.now()}ehll${Math.floor(Math.random() * 1e10)}`;
}

// Generate device_id (UUID v4)
function generateDeviceId(): string {
  return crypto.randomUUID();
}

// Build UAPI query string
function buildUapiUrl(method: string, su?: string): string {
  const _su = su || generateSu();
  const _t = Math.floor(Date.now() / 1000).toString();
  const deviceId = generateDeviceId();
  
  const params = new URLSearchParams({
    _m: method,
    hcountry: HCOUNTRY,
    _su,
    _t,
    device_id: deviceId,
    version: APP_VERSION,
    revision: APP_REVISION,
    os: 'web',
    device_type: 'web',
  });
  
  return `${UAPI_BASE_URL}?${params.toString()}`;
}

// Ações administrativas (set-token, token-status) usam o `requireRole` de
// `_shared/auth.ts`. A cópia local que existia aqui lia o papel só de
// `app_metadata.role`/`user_metadata.role`: como nenhuma conta tem esses campos,
// todo admin real levava 403 (o botão "Atualizar Token" das telas de
// configuração nunca funcionou) e, ao mesmo tempo, qualquer conta podia se
// autopromover escrevendo `user_metadata.role`. O helper resolve por
// `app_metadata.role` (gravável só com service_role) e por `public.user_roles`.

// As telas que gravam a sessão UAPI (`/settings/uapi`, `/settings/lalamove`)
// exigem MFA no front (`ProtectedRoute requireMFA`). Sem a mesma exigência
// aqui, um access token em AAL1 (só o primeiro fator) já trocaria a credencial
// compartilhada. Só bloqueia quem tem fator TOTP verificado: conta sem fator
// não tem como elevar e continua passando — igual quando a consulta de fatores
// falha, para não travar a rotação do token.
async function requireMfaElevation(req: Request): Promise<{ error: Response | null }> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const payload = token ? decodeJwtPayload(token) : null;
  const userId = typeof payload?.sub === 'string' ? payload.sub : null;
  if (!userId || payload?.aal !== 'aal1') return { error: null };

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) {
    logger.error('Falha ao consultar fatores MFA:', error);
    return { error: null };
  }
  const hasVerifiedFactor = (data?.factors ?? []).some(
    (f: { status: string }) => f.status === 'verified',
  );
  if (!hasVerifiedFactor) return { error: null };

  return {
    error: new Response(
      JSON.stringify({
        error: 'mfa_required',
        message: 'Confirme o segundo fator (MFA) antes de trocar a sessão UAPI.',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    ),
  };
}

/** Lê o payload do JWT sem validar assinatura — o token já passou por `requireRole`. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Build UAPI body (application/x-www-form-urlencoded)
function buildUapiBody(token: string, args: Record<string, unknown> = {}): string {
  const params = new URLSearchParams();
  params.set('token', token);
  params.set('is_ep', '1');
  params.set('hcountry', HCOUNTRY);
  params.set('hlang', HLANG);
  params.set('city_id', CITY_ID);
  params.set('args', JSON.stringify(args));
  return params.toString();
}

// Get active token from database, refresh if needed
// deno-lint-ignore no-explicit-any
async function getActiveToken(supabase: any): Promise<{
  accessToken: string;
  refreshToken: string;
  userFid: string;
  wasRefreshed: boolean;
} | null> {
  const { data: session, error } = await supabase
    .rpc('get_active_uapi_token');

  if (error || !session || session.length === 0) {
    logger.error('No active UAPI session found:', error);
    return null;
  }

  const s = session[0];
  
  // If token is < 20 hours old, use as-is
  if (!s.needs_refresh) {
    return {
      accessToken: s.access_token,
      refreshToken: s.refresh_token,
      userFid: s.user_fid || '',
      wasRefreshed: false,
    };
  }

  // Token is 20-24h old, try refresh
  // Sem refresh_token nao ha renovacao possivel: tentar a cada requisicao so
  // soma latencia e enche o log de erro. Nesse cenario quem mantem o token vivo
  // e o coletor do navegador (login manual), que grava o par novo.
  if (!s.refresh_token) {
    return {
      accessToken: s.access_token,
      refreshToken: '',
      userFid: s.user_fid || '',
      wasRefreshed: false,
    };
  }
  logger.log('Token needs refresh, attempting refresh_token...');
  const refreshResult = await refreshUapiToken(s.access_token, s.refresh_token);
  
  if (refreshResult) {
    // Update in database
    await supabase
      .from('lalamove_uapi_sessions')
      .update({
        access_token: refreshResult.newAccessToken,
        refresh_token: refreshResult.newRefreshToken,
        token_obtained_at: new Date().toISOString(),
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        last_refreshed_at: new Date().toISOString(),
        refresh_method: 'refresh_token',
        updated_at: new Date().toISOString(),
      })
      // Escopo pelo token lido, não só por `is_active`: se o dono gravar uma
      // sessão nova (`set-token`) enquanto esta renovação está em voo, o update
      // não pode cair na sessão nova — antes ele pegava "a linha ativa do
      // momento" e sobrescrevia os tokens recém-colados com os da sessão antiga.
      .eq('is_active', true)
      .eq('access_token', s.access_token);

    return {
      accessToken: refreshResult.newAccessToken,
      refreshToken: refreshResult.newRefreshToken,
      userFid: s.user_fid || '',
      wasRefreshed: true,
    };
  }

  // Refresh failed but token might still work (< 24h)
  logger.warn('Token refresh failed, using existing token');
  return {
    accessToken: s.access_token,
    refreshToken: s.refresh_token,
    userFid: s.user_fid || '',
    wasRefreshed: false,
  };
}

// Refresh token via UAPI
async function refreshUapiToken(
  accessToken: string,
  currentRefreshToken: string
): Promise<{ newAccessToken: string; newRefreshToken: string } | null> {
  try {
    const url = buildUapiUrl('refresh_token');
    const body = buildUapiBody(accessToken, { refresh_token: currentRefreshToken });

    const response = await fetch(url, {
      method: 'POST',
      headers: UAPI_HEADERS,
      body,
    });

    const data = await response.json();
    
    if (data.ret !== 0) {
      logger.error('Token refresh failed:', data);
      return null;
    }

    return {
      newAccessToken: data.data.token,
      newRefreshToken: data.data.raw?.refresh_token || currentRefreshToken,
    };
  } catch (error) {
    logger.error('Token refresh error:', error);
    return null;
  }
}

// Make UAPI request
async function uapiRequest(
  method: string,
  token: string,
  args: Record<string, unknown> = {}
): Promise<{ ret: number; data?: unknown; msg?: string }> {
  const url = buildUapiUrl(method);
  const body = buildUapiBody(token, args);

  logger.log(`UAPI Request: ${method}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: UAPI_HEADERS,
    body,
  });

  const result = await response.json();
  
  if (result.ret !== 0) {
    logger.error(`UAPI ${method} error:`, result);
  }

  return result;
}

// Ações cujo resultado pode ser servido do snapshot coletado por navegador
// quando o gateway assinado recusa a chamada direta (ret 10010, 24/11/2026).
// A chave é a ação da edge; o valor resolve o `resource` que o coletor grava.
// Listas paginadas guardam uma chave por página (`recurso:pN`) e as que usam
// cursor (`last_id`) guardam a chave do próprio cursor, porque o painel reenvia
// o mesmo valor ao avançar.
const pageKey = (body: Record<string, unknown>, resource: string) => {
  const page = Number(body?.page_no ?? 1);
  return page > 1 ? `${resource}:p${page}` : resource;
};

const SNAPSHOT_ACTIONS: Record<string, (body: Record<string, unknown>) => string> = {
  'wallet-balance': () => 'wallet_balance',
  'wallet-transactions': (body) => pageKey(body, 'wallet_flow_list'),
  'coupons': (body) => pageKey(body, 'coupon_list_web'),
  'fleet-favorites': (body) => pageKey(body, 'get_fleet:1'),
  'fleet-blocked': (body) => pageKey(body, 'get_fleet:2'),
  'user-info': () => 'get_user_info',
  'corporate-info': () => 'get_corporate',
  'list-orders': (body) =>
    typeof body?.last_id === 'string' && body.last_id ? `order_list_new:${body.last_id}` : 'order_list_new',
  'last-order': () => 'get_laster_order',
  'city-info': () => 'city_info',
  'download-receipt': (body) => `download_pdf_receipt:${String(body?.order_uuid ?? '')}`,
};

// Lê o último snapshot válido. Devolve null quando não há coleta fresca — nesse
// caso o painel recebe o erro real do gateway, nunca dado velho se passando por
// atual.
async function loadSnapshot(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  resource: string,
): Promise<{ payload: unknown; collectedAt: string } | null> {
  const { data, error } = await supabase
    .from('lalamove_uapi_snapshot')
    .select('payload, collected_at')
    .eq('resource', resource)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    logger.error(`Snapshot ${resource} indisponível:`, error);
    return null;
  }
  if (!data) return null;
  return { payload: data.payload, collectedAt: data.collected_at as string };
}

// Fim do histórico do extrato: a página seguinte à última não existe e o gateway
// responde erro. A última página vem incompleta, então o tamanho da página
// anterior guardada no snapshot prova o fim e o painel recebe lista vazia em vez
// de falha. Sem prova (página anterior ausente ou vencida) o erro real segue.
async function beyondStatementEnd(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  page: number,
  pageSize: number,
): Promise<boolean> {
  if (page <= 1) return false;
  const resource = page === 2 ? 'wallet_flow_list' : `wallet_flow_list:p${page - 1}`;
  const { data, error } = await supabase
    .from('lalamove_uapi_snapshot')
    .select('payload')
    .eq('resource', resource)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    logger.error(`Snapshot ${resource} indisponível:`, error);
    return false;
  }
  return isBeyondHistory(statementItems(data?.payload), pageSize);
}

// Página do extrato montada pela identidade do lançamento já coletado: a chave
// não depende da posição, então a página não repete nem pula lançamento na
// fronteira entre a janela recente e o histórico congelado. Devolve null — e a
// edge segue pelo snapshot — quando a faixa pedida ainda não está coberta pela
// coleta. Página incompleta também devolve null: página curta é a única prova de
// fim do histórico, então ela continua vindo do snapshot.
async function statementPageFromItems(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  page: number,
  pageSize: number,
): Promise<unknown | null> {
  const { from, to } = statementPageRange(page, pageSize);
  const { data, error } = await supabase
    .from('lalamove_uapi_statement_item')
    .select('payload')
    .order('occurred_at_local', { ascending: false })
    .order('item_key', { ascending: false })
    .range(from, to);

  // PGRST103 = faixa pedida depois do último lançamento coletado; é o fluxo
  // esperado da última página e não é falha.
  if (error) {
    if (error.code !== 'PGRST103') logger.error('Lançamentos do extrato indisponíveis:', error);
    return null;
  }
  if (!data || data.length < pageSize) return null;
  return buildStatementPage((data as { payload: StatementItem }[]).map((row) => row.payload));
}

// ========== UAPI Actions ==========

// List orders with cursor pagination
async function listOrders(
  token: string,
  args: { limit?: number; last_id?: string; order_statuses?: number[] }
) {
  return uapiRequest('order_list_new', token, {
    limit: args.limit || 20,
    last_id: args.last_id || '',
    ...(args.order_statuses && { order_statuses: args.order_statuses }),
  });
}

// Get order detail
async function getOrderDetail(token: string, orderUuid: string) {
  return uapiRequest('order_detail', token, {
    order_uuid: orderUuid,
    interest_id: 0,
    daylight_zone: 'America/Sao_Paulo',
  });
}

// Get order status
async function getOrderStatus(token: string, orderUuid: string) {
  return uapiRequest('order_status', token, {
    order_uuid: orderUuid,
    find_drivers: 0,
    send_type: 0,
  });
}

// Search orders
async function searchOrders(
  token: string,
  args: { search_order_display_id?: string; order_statuses?: number[]; start_datetime?: string; end_datetime?: string }
) {
  return uapiRequest('order_search', token, args);
}

// Get wallet balance
async function getWalletBalance(token: string) {
  return uapiRequest('wallet_balance', token, { city_id: parseInt(CITY_ID) });
}

// Get wallet transactions
async function getWalletTransactions(
  token: string,
  args: { start_time?: string; end_time?: string; page_no?: number; page_size?: number }
) {
  return uapiRequest('wallet_flow_list', token, {
    trans_type: 1,
    page_no: args.page_no || 1,
    page_size: args.page_size || 20,
    ...(args.start_time && { start_time: args.start_time }),
    ...(args.end_time && { end_time: args.end_time }),
  });
}

// Get fleet (favorites or blocked)
async function getFleet(
  token: string,
  args: { fleet_type_code: number; page_no?: number; page_size?: number; search?: string }
) {
  return uapiRequest('get_fleet', token, {
    fleet_type_code: args.fleet_type_code,
    page_no: args.page_no || 1,
    page_size: args.page_size || 50,
    ...(args.search && { search: args.search }),
  });
}

// Add/remove favorite driver
async function manageFavoriteDriver(token: string, driverFid: string, action: 'add' | 'remove') {
  const method = action === 'add' ? 'fleet_add_favorite_web' : 'fleet_del_favorite_web';
  return uapiRequest(method, token, { driver_fid: driverFid });
}

// Block/unblock driver
async function manageBlockedDriver(token: string, driverFid: string, action: 'block' | 'unblock') {
  const method = action === 'block' ? 'fleet_add_ban' : 'fleet_del_ban';
  return uapiRequest(method, token, { driver_fid: driverFid });
}

// Rate driver
async function rateDriver(
  token: string,
  args: { order_uuid: string; driver_fid: string; rating: number; comment_ids?: number[]; custom_comment?: string }
) {
  return uapiRequest('user_rating', token, {
    order_uuid: args.order_uuid,
    driver_fid: args.driver_fid,
    rating: args.rating,
    comment_ids: args.comment_ids || [],
    custom_comment: args.custom_comment || '',
    op_to_driver: 0,
    msg: '',
  });
}

// Get user info
async function getUserInfo(token: string) {
  return uapiRequest('get_user_info', token, {});
}

// Get corporate info
async function getCorporateInfo(token: string) {
  return uapiRequest('get_corporate', token, {});
}

// Get city info with vehicles and pricing
async function getCityInfo(token: string) {
  return uapiRequest('city_info', token, {
    city_id: parseInt(CITY_ID),
    fetch_spec_req: 1,
    fetch_vehicle_std: 1,
    fetch_vehicle_price: 1,
    revision: parseInt(APP_REVISION),
  });
}

// Download receipt
async function downloadReceipt(token: string, orderUuid: string) {
  return uapiRequest('download_pdf_receipt', token, {
    order_uuid: orderUuid,
    type: 'order',
  });
}

// Get coupon list
async function getCoupons(
  token: string,
  args: { page_no?: number; page_size?: number; search?: string[] }
) {
  return uapiRequest('coupon_list_web', token, {
    page_no: args.page_no || 1,
    page_size: args.page_size || 20,
    ...(args.search && { search: args.search }),
  });
}

// Exchange coupon
async function exchangeCoupon(token: string, code: string) {
  return uapiRequest('coupon_exchange_web', token, { exchange_code: code });
}

// Get last order
async function getLastOrder(token: string) {
  return uapiRequest('get_laster_order', token, {});
}

// Cancel order (UAPI)
async function cancelOrderUapi(
  token: string,
  args: { order_uuid: string; reason?: string; reason_id?: number }
) {
  return uapiRequest('order_cancel', token, {
    order_uuid: args.order_uuid,
    reason: args.reason || '',
    reason_id: args.reason_id || 0,
    order_status: 0,
    cancellation_fee_fen: 0,
  });
}

// Get cancellation eligibility
async function getCancelEligibility(token: string, orderUuid: string) {
  return uapiRequest('order_cancellation_eligibility', token, { order_uuid: orderUuid });
}

// Bulk import: paginate through all orders and save to DB
// deno-lint-ignore no-explicit-any
async function bulkImportOrders(
  supabase: any,
  token: string,
  args: { maxPages?: number; pageSize?: number }
): Promise<{ totalImported: number; totalPages: number; errors: string[] }> {
  const maxPages = args.maxPages || 10;
  const pageSize = args.pageSize || 20;
  let lastId = '';
  let totalImported = 0;
  let totalPages = 0;
  const errors: string[] = [];

  for (let page = 0; page < maxPages; page++) {
    const result = await listOrders(token, { limit: pageSize, last_id: lastId });
    totalPages++;

    if (result.ret !== 0) {
      errors.push(`Page ${page + 1}: ret=${result.ret} ${result.msg || ''}`);
      break;
    }

    const data = result.data as Record<string, unknown>;
    const orders = data.order_base_info as Array<Record<string, unknown>> | undefined;

    if (!orders || orders.length === 0) break;

    // Map and upsert each order
    for (const order of orders) {
      try {
        const statusMap: Record<number, string> = {
          0: 'PENDING',    // Matching
          1: 'ON_GOING',   // Em andamento
          2: 'COMPLETED',  // Concluído
          3: 'CANCELLED',  // Cancelado
        };

        const orderData = {
          lalamove_id: (order.order_uuid as string) || (order.order_display_id_str as string) || '',
          status: statusMap[order.order_status as number] || 'PENDING',
          total_cost: ((order.final_price_fen as number) || 0) / 100,
          currency: 'BRL',
          pickup_address: 'N/A',
          delivery_address: 'N/A',
          customer_name: 'Importado UAPI',
          updated_at: new Date().toISOString(),
          metadata: {
            source: 'uapi_bulk_import',
            uapi_order_status: order.order_status,
            vehicle_name: order.order_vehicle_name,
            pay_type: order.pay_type,
            display_id: order.order_display_id_str,
            created_at_uapi: order.order_create_time,
          },
        };

        // Extract addresses from waypoints if available
        const waypoints = order.addr_info as Array<Record<string, unknown>> | undefined;
        if (waypoints?.length) {
          orderData.pickup_address = (waypoints[0]?.addr as string) || 'N/A';
          if (waypoints.length > 1) {
            orderData.delivery_address = (waypoints[waypoints.length - 1]?.addr as string) || 'N/A';
            orderData.customer_name = (waypoints[waypoints.length - 1]?.contacts_name as string) || 'Importado UAPI';
          }
        }

        await supabase
          .from('lalamove_orders')
          .upsert(orderData, { onConflict: 'lalamove_id' });

        totalImported++;
      } catch (e) {
        errors.push(`Order ${order.order_uuid}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Check stop conditions
    if ((data.is_end as number) === 1) break;
    
    const newLastId = data.last_id as string;
    if (!newLastId || newLastId === lastId) break;
    lastId = newLastId;

    // Rate limit respect
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { totalImported, totalPages, errors };
}

// ========== Main Handler ==========
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Contrato de entrada (422 no formato único + versão v1/v2). `action` vem
    // da query OU do corpo (a query tem precedência, como antes), por isso o
    // contrato é validado sobre o input MESCLADO, não sobre o corpo cru.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage('lalamove-uapi', contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);

    const url = new URL(req.url);
    const rawBody = (parsedBody.value ?? {}) as Record<string, unknown>;
    const action = url.searchParams.get('action') || (rawBody.action as string | undefined) || null;
    const contract = validateContract(
      getSchema('lalamove-uapi', contractVersion),
      { ...rawBody, ...(action ? { action } : {}) },
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);

    // deno-lint-ignore no-explicit-any
    const body: any = (({ action: _a, ...rest }: Record<string, unknown>) => rest)(
      contract.data as Record<string, unknown>,
    );

    // Status da sessão: alimenta os cards de conexão do painel sem chamar a
    // UAPI nem consumir rate limit. Devolve apenas metadados — o token sai
    // mascarado e nunca completo.
    if (action === 'status') {
      // Qualquer perfil autenticado pode saber SE existe sessão ativa (o card do
      // painel é para a operação toda). Os metadados da credencial — token
      // mascarado, user_fid, cidade, datas — só para admin, que é quem acessa
      // /settings/uapi e o `token-status`. Antes a resposta completa vazava para
      // viewer/operator.
      const adminCheck = await requireRole(req, ['admin'], corsHeaders);
      const isAdmin = !adminCheck.error;
      if (!isAdmin) {
        const anyRoleCheck = await requireRole(
          req,
          ['admin', 'manager', 'operator', 'viewer'],
          corsHeaders,
        );
        if (anyRoleCheck.error) return anyRoleCheck.error;
      }

      const { data: sessions } = await supabase
        .from('lalamove_uapi_sessions')
        .select('access_token, refresh_token, user_fid, city_id, refresh_method, token_obtained_at, token_expires_at, last_refreshed_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      const session = sessions?.[0];
      const token = typeof session?.access_token === 'string' ? session.access_token : '';
      // Saúde da sessão = evidência recente de uso aceito, não `token_expires_at`
      // (que é só a estimativa de 24 h da última renovação). O token continua
      // aceito bem depois disso enquanto o perfil do navegador o mantiver.
      const health = evaluateSessionHealth(session);
      const active = !!session && health.recentlyVerified;
      const autoRenewal = health.autoRenewal;

      return new Response(
        JSON.stringify({
          ok: active,
          session: {
            is_active: active,
            token_preview: isAdmin && token ? `${token.slice(0, 6)}…${token.slice(-4)}` : null,
            user_fid: isAdmin ? (session?.user_fid ?? null) : null,
            city_id: isAdmin ? (session?.city_id ?? null) : null,
            refresh_method: isAdmin ? (session?.refresh_method ?? null) : null,
            token_obtained_at: isAdmin ? (session?.token_obtained_at ?? null) : null,
            token_expires_at: isAdmin ? (session?.token_expires_at ?? null) : null,
            last_refreshed_at: isAdmin ? (session?.last_refreshed_at ?? null) : null,
            last_verified_at: isAdmin ? health.lastVerifiedAt : null,
            auto_renewal: autoRenewal,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Special action: set initial token — requer role admin para evitar que
    // qualquer usuário autenticado sobrescreva a sessão UAPI ativa.
    if (action === 'set-token') {
      const adminCheck = await requireRole(req, ['admin'], corsHeaders);
      if (adminCheck.error) return adminCheck.error;

      const mfaCheck = await requireMfaElevation(req);
      if (mfaCheck.error) return mfaCheck.error;

      if (!body.access_token || !body.refresh_token) {
        return new Response(
          JSON.stringify({ error: 'access_token and refresh_token are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insere a sessão nova ANTES de desativar as antigas: se o insert falhar, a
      // sessão que estava funcionando continua ativa. Antes a desativação vinha
      // primeiro e uma falha no insert deixava o painel sem sessão alguma.
      const { data: inserted, error } = await supabase
        .from('lalamove_uapi_sessions')
        .insert({
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          user_fid: body.user_fid || null,
          ep_role: body.ep_role || 1,
          city_id: body.city_id || parseInt(CITY_ID),
          token_obtained_at: new Date().toISOString(),
          token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          refresh_method: 'manual',
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to save token', detail: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('lalamove_uapi_sessions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('is_active', true)
        .neq('id', inserted.id);

      return new Response(
        JSON.stringify({ success: true, message: 'UAPI session token saved' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Special action: token status — protegido por admin para não expor metadados do token
    if (action === 'token-status') {
      const adminCheck = await requireRole(req, ['admin'], corsHeaders);
      if (adminCheck.error) return adminCheck.error;
      const { data: session } = await supabase.rpc('get_active_uapi_token');
      if (!session || session.length === 0) {
        return new Response(
          JSON.stringify({ hasToken: false, message: 'No active UAPI session. Use set-token action first.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const s = session[0];
      return new Response(
        JSON.stringify({
          hasToken: true,
          userFid: s.user_fid,
          tokenAgeHours: parseFloat(parseFloat(s.token_age_hours).toFixed(1)),
          needsRefresh: s.needs_refresh,
          maxAgeHours: 24,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All other actions need an active token
    const tokenData = await getActiveToken(supabase);
    if (!tokenData) {
      return new Response(
        JSON.stringify({ 
          error: 'No active UAPI session',
          message: 'Configure a UAPI session token first using action: set-token',
          actions: ['set-token', 'token-status'],
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accessToken, wasRefreshed } = tokenData;
    let result: { ret: number; data?: unknown; msg?: string };

    switch (action) {
      // --- Orders ---
      case 'list-orders':
        result = await listOrders(accessToken, body);
        break;

      case 'order-detail':
        if (!body.order_uuid) {
          return new Response(
            JSON.stringify({ error: 'order_uuid is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getOrderDetail(accessToken, body.order_uuid);
        break;

      case 'order-status':
        if (!body.order_uuid) {
          return new Response(
            JSON.stringify({ error: 'order_uuid is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getOrderStatus(accessToken, body.order_uuid);
        break;

      case 'search-orders':
        result = await searchOrders(accessToken, body);
        break;

      case 'cancel-order':
        if (!body.order_uuid) {
          return new Response(
            JSON.stringify({ error: 'order_uuid is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await cancelOrderUapi(accessToken, body);
        break;

      case 'cancel-eligibility':
        if (!body.order_uuid) {
          return new Response(
            JSON.stringify({ error: 'order_uuid is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getCancelEligibility(accessToken, body.order_uuid);
        break;

      case 'last-order':
        result = await getLastOrder(accessToken);
        break;

      // --- Wallet ---
      case 'wallet-balance':
        result = await getWalletBalance(accessToken);
        break;

      case 'wallet-transactions':
        result = await getWalletTransactions(accessToken, body);
        break;

      // --- Fleet ---
      case 'fleet-favorites':
        result = await getFleet(accessToken, { fleet_type_code: 1, ...body });
        break;

      case 'fleet-blocked':
        result = await getFleet(accessToken, { fleet_type_code: 2, ...body });
        break;

      case 'favorite-driver':
        if (!body.driver_fid || !body.driver_action) {
          return new Response(
            JSON.stringify({ error: 'driver_fid and driver_action (add/remove) are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await manageFavoriteDriver(accessToken, body.driver_fid, body.driver_action);
        break;

      case 'block-driver':
        if (!body.driver_fid || !body.driver_action) {
          return new Response(
            JSON.stringify({ error: 'driver_fid and driver_action (block/unblock) are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await manageBlockedDriver(accessToken, body.driver_fid, body.driver_action);
        break;

      // --- Driver Rating ---
      case 'rate-driver':
        if (!body.order_uuid || !body.driver_fid || body.rating === undefined) {
          return new Response(
            JSON.stringify({ error: 'order_uuid, driver_fid, and rating are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await rateDriver(accessToken, body);
        break;

      // --- User & Account ---
      case 'user-info':
        result = await getUserInfo(accessToken);
        break;

      case 'corporate-info':
        result = await getCorporateInfo(accessToken);
        break;

      case 'city-info':
        result = await getCityInfo(accessToken);
        break;

      // --- Receipts ---
      case 'download-receipt':
        if (!body.order_uuid) {
          return new Response(
            JSON.stringify({ error: 'order_uuid is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await downloadReceipt(accessToken, body.order_uuid);
        break;

      // --- Coupons ---
      case 'coupons':
        result = await getCoupons(accessToken, body);
        break;

      case 'exchange-coupon':
        if (!body.code) {
          return new Response(
            JSON.stringify({ error: 'code is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await exchangeCoupon(accessToken, body.code);
        break;

      // --- Bulk Import ---
      case 'bulk-import': {
        const importResult = await bulkImportOrders(supabase, accessToken, body);
        return new Response(
          JSON.stringify({ success: true, ...importResult, tokenRefreshed: wasRefreshed }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // --- Force Token Refresh ---
      case 'refresh-token': {
        const refreshed = await refreshUapiToken(accessToken, tokenData.refreshToken);
        if (refreshed) {
          await supabase
            .from('lalamove_uapi_sessions')
            .update({
              access_token: refreshed.newAccessToken,
              refresh_token: refreshed.newRefreshToken,
              token_obtained_at: new Date().toISOString(),
              token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              last_refreshed_at: new Date().toISOString(),
              refresh_method: 'manual_refresh',
              updated_at: new Date().toISOString(),
            })
            .eq('is_active', true);

          return new Response(
            JSON.stringify({ success: true, message: 'Token refreshed successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: 'Token refresh failed. Token may be expired (>24h). Manual re-login required.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid action',
            availableActions: [
              'set-token', 'token-status', 'refresh-token',
              'list-orders', 'order-detail', 'order-status', 'search-orders',
              'cancel-order', 'cancel-eligibility', 'last-order',
              'wallet-balance', 'wallet-transactions',
              'fleet-favorites', 'fleet-blocked', 'favorite-driver', 'block-driver',
              'rate-driver', 'user-info', 'corporate-info', 'city-info',
              'download-receipt', 'coupons', 'exchange-coupon',
              'bulk-import',
            ],
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Gateway assinado nao aceita chamada de servidor (ret 10010): serve o
    // ultimo snapshot do navegador, se houver coleta fresca. Cada recurso tem
    // chave propria (pagina, cursor ou pedido do recibo); pedido sem coleta
    // correspondente continua recebendo o erro real do gateway.
    let snapshotCollectedAt: string | null = null;
    let endOfHistory = false;
    let servedFromItems = false;
    if (result.ret !== 0 && action) {
      const resource = SNAPSHOT_ACTIONS[action]?.(body);
      if (action === 'wallet-transactions') {
        // A tabela de lançamentos não tem TTL próprio: só serve com a janela
        // recente fresca, senão o operador exportaria extrato vencido sem aviso.
        const recent = await loadSnapshot(supabase, 'wallet_flow_list');
        if (recent) {
          const itemsPage = await statementPageFromItems(
            supabase,
            Number(body.page_no ?? 1),
            Number(body.page_size) || STATEMENT_PAGE_SIZE,
          );
          if (itemsPage) {
            result = itemsPage as { ret: number; data?: unknown; msg?: string };
            servedFromItems = true;
          }
        }
      }
      if (resource && !servedFromItems) {
        const snapshot = await loadSnapshot(supabase, resource);
        if (snapshot) {
          result = snapshot.payload as { ret: number; data?: unknown; msg?: string };
          snapshotCollectedAt = snapshot.collectedAt;
        } else if (
          action === 'wallet-transactions' &&
          (await beyondStatementEnd(
            supabase,
            Number(body.page_no ?? 1),
            Number(body.page_size) || STATEMENT_PAGE_SIZE,
          ))
        ) {
          result = EMPTY_STATEMENT_PAGE as { ret: number; data?: unknown; msg?: string };
          endOfHistory = true;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ...result,
        _meta: {
          tokenRefreshed: wasRefreshed,
          servedFromSnapshot: snapshotCollectedAt !== null,
          ...(snapshotCollectedAt && { snapshotCollectedAt }),
          ...(servedFromItems && { servedFromItems: true }),
          ...(endOfHistory && { endOfHistory: true }),
        },
      }),
      { status: result.ret === 0 ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('UAPI Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
