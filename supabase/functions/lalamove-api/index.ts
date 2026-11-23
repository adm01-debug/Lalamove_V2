import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logger } from "../_shared/logger.ts";
import { persistOrderCoordinates, stopsCoords } from './coordinates.ts';
import { geocodeOrderFallback } from './geocode-fallback.ts';
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";
import { requireRole } from "../_shared/auth.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LALAMOVE_API_KEY = Deno.env.get('LALAMOVE_API_KEY');
const LALAMOVE_API_SECRET = Deno.env.get('LALAMOVE_API_SECRET');
const LALAMOVE_BASE_URL = (Deno.env.get('LALAMOVE_BASE_URL') || 'https://rest.lalamove.com').replace(/\/+$/, '');
const LALAMOVE_MARKET = 'BR';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Admin client for internal writes (telemetry, rate limits) — bypasses RLS safely.
const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Persist Lalamove rate-limit headers for proactive observability.
 * Fire-and-forget: never throws, never blocks the caller.
 * Headers follow the IETF `ratelimits-*` family (limit / remaining / reset).
 */
function persistRateLimit(params: {
  method: string;
  endpoint: string;
  status: number;
  attempts: number;
  requestId: string;
  headers: Record<string, string>;
}): void {
  try {
    const { headers } = params;
    const limitTotal = Number(headers['ratelimits-limit']);
    const limitRemaining = Number(headers['ratelimits-remaining']);
    const resetRaw = headers['ratelimits-reset'];

    // `reset` may come as epoch seconds or delta seconds — treat >10^9 as epoch.
    let resetAt: string | null = null;
    if (resetRaw) {
      const n = Number(resetRaw);
      if (Number.isFinite(n) && n > 0) {
        const ms = n > 1_000_000_000 ? n * 1000 : Date.now() + n * 1000;
        resetAt = new Date(ms).toISOString();
      }
    }

    const usageRatio = Number.isFinite(limitTotal) && limitTotal > 0 && Number.isFinite(limitRemaining)
      ? Number((((limitTotal - limitRemaining) / limitTotal) * 100).toFixed(2))
      : null;

    // Fire-and-forget: do not await.
    adminDb.from('lalamove_rate_limits').insert({
      endpoint: params.endpoint,
      method: params.method,
      status: params.status,
      attempts: params.attempts,
      limit_total: Number.isFinite(limitTotal) ? limitTotal : null,
      limit_remaining: Number.isFinite(limitRemaining) ? limitRemaining : null,
      limit_reset_at: resetAt,
      usage_ratio: usageRatio,
      request_id: params.requestId,
      raw_headers: headers,
    }).then(({ error }) => {
      if (error) logger.error('persistRateLimit insert failed:', error.message);
    });

    // Early warning: alert when quota is critically low.
    if (Number.isFinite(limitRemaining) && limitRemaining <= 10) {
      logger.error(`⚠️ Lalamove rate-limit CRITICAL: ${limitRemaining}/${limitTotal} on ${params.method} ${params.endpoint}`);
    }
  } catch (err) {
    logger.error('persistRateLimit unexpected error:', err instanceof Error ? err.message : err);
  }
}

// ========== HMAC Authentication (Doc Section 1) ==========
// RAW_STRING = TIMESTAMP + \r\n + METHOD + \r\n + PATH + \r\n\r\n + BODY_JSON
// BODY_JSON = "" for GET/DELETE (but \r\n\r\n must be present)
async function generateSignature(
  method: string,
  path: string,
  timestamp: string,
  body: string
): Promise<string> {
  const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(LALAMOVE_API_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawSignature));
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getAuthHeaders(
  method: string,
  path: string,
  body?: object,
  requestId?: string,
): Promise<HeadersInit> {
  const timestamp = Date.now().toString();
  const bodyString = body ? JSON.stringify(body) : '';
  const signature = await generateSignature(method, path, timestamp, bodyString);

  return {
    'Authorization': `hmac ${LALAMOVE_API_KEY}:${timestamp}:${signature}`,
    'Content-Type': 'application/json',
    'Market': LALAMOVE_MARKET,
    // Stable Request-ID across retries acts as an idempotency key: Lalamove
    // deduplicates writes (POST /orders, POST /priority-fee, etc.) by this header.
    'Request-ID': requestId ?? crypto.randomUUID(),
  };
}

// ========== API Request Wrapper ==========
interface ApiResult {
  data?: unknown;
  error?: string;
  status: number;
  rateLimits?: Record<string, string>;
  attempts?: number;
}

interface RequestOptions {
  /** Max attempts including the first call. Default 3. */
  maxAttempts?: number;
  /** Base delay in ms for exponential backoff. Default 500. */
  baseDelayMs?: number;
  /** Opt out of retries entirely (e.g. read-only paths where you prefer fast-fail). */
  noRetry?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Whether an HTTP status is worth retrying.
 * - 429: rate-limited — retry with backoff, respect any Retry-After.
 * - 502/503/504: transient upstream — retry.
 * - 500: sometimes transient at Lalamove; retry conservatively.
 * Other 4xx are client errors and must not be retried (would just burn quota).
 */
const isRetryableStatus = (status: number): boolean =>
  status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

async function lalamoveRequest(
  method: string,
  endpoint: string,
  body?: object,
  options: RequestOptions = {},
): Promise<ApiResult> {
  const path = `/v3${endpoint}`;
  // Strip /v3 from base URL if present to avoid duplication
  const baseUrl = LALAMOVE_BASE_URL.replace(/\/v3\/?$/, '');
  const url = `${baseUrl}${path}`;

  const maxAttempts = options.noRetry ? 1 : Math.max(1, options.maxAttempts ?? 3);
  const baseDelay = Math.max(100, options.baseDelayMs ?? 500);

  // One stable Request-ID for all attempts of this logical call → idempotency.
  const requestId = crypto.randomUUID();

  let lastError = '';
  let lastStatus = 0;
  let lastRateLimits: Record<string, string> = {};

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Re-sign each attempt: timestamp must be fresh (Lalamove rejects stale HMAC).
    const headers = await getAuthHeaders(method, path, body, requestId);
    logger.log(`Lalamove API: ${method} ${url} (attempt ${attempt}/${maxAttempts}) rid=${requestId}`);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Extract rate limit headers
      const rateLimits: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key.startsWith('ratelimits-')) rateLimits[key] = value;
      });
      lastRateLimits = rateLimits;

      // DELETE returns 204 No Content with empty body
      if (response.status === 204) {
        persistRateLimit({ method, endpoint, status: 204, attempts: attempt, requestId, headers: rateLimits });
        return { data: { success: true }, status: 204, rateLimits, attempts: attempt };
      }

      const responseText = await response.text();
      logger.log(`Response status: ${response.status}`);
      if (response.status >= 400) {
        logger.log(`Error response body: ${responseText.substring(0, 500)}`);
      }

      if (!response.ok) {
        let errorDetail = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          if (errorJson.errors?.length) {
            errorDetail = errorJson.errors.map((e: { id: string; message: string; detail?: string }) =>
              `${e.id}: ${e.message}${e.detail ? ` (${e.detail})` : ''}`
            ).join('; ');
          }
        } catch { /* keep raw text */ }

        lastError = errorDetail;
        lastStatus = response.status;

        // Retry only on transient statuses and if attempts remain.
        if (isRetryableStatus(response.status) && attempt < maxAttempts) {
          // Prefer Retry-After when present, else exponential + jitter.
          const retryAfter = Number(response.headers.get('retry-after'));
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : baseDelay * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
          logger.log(`Retrying after ${backoff}ms (status ${response.status})`);
          await sleep(backoff);
          continue;
        }

        persistRateLimit({ method, endpoint, status: response.status, attempts: attempt, requestId, headers: rateLimits });
        return { error: errorDetail, status: response.status, rateLimits, attempts: attempt };
      }

      const data = responseText ? JSON.parse(responseText) : {};
      persistRateLimit({ method, endpoint, status: response.status, attempts: attempt, requestId, headers: rateLimits });
      return { data, status: response.status, rateLimits, attempts: attempt };
    } catch (error) {
      // Network-level failure — always retryable if attempts remain.
      lastError = error instanceof Error ? error.message : 'Unknown error';
      lastStatus = 0;
      logger.error(`Lalamove API request failed (attempt ${attempt}):`, error);
      if (attempt < maxAttempts) {
        const backoff = baseDelay * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
        await sleep(backoff);
        continue;
      }
    }
  }

  return {
    error: lastError || 'Unknown error',
    status: lastStatus || 500,
    rateLimits: lastRateLimits,
    attempts: maxAttempts,
  };
}

// ========== Cities & Services (Doc Section 2) ==========
// GET /v3/cities — field is "services" NOT "serviceTypes"
async function getCities() {
  return lalamoveRequest('GET', '/cities');
}

// ========== Quotations (Doc Section 3) ==========
// POST /v3/quotations
interface QuotationRequest {
  serviceType: string; // LALAGO, LALAPRO, CAR, HATCHBACK, UV_FIORINO, VAN, TRUCK330, etc.
  language?: string;
  scheduleAt?: string;
  isRouteOptimized?: boolean;
  specialRequests?: string[];
  stops: Array<{
    coordinates: { lat: string; lng: string };
    address: string;
  }>;
  item?: {
    quantity: string;
    weight: string;
    categories?: string[];
    handlingInstructions?: string[];
  };
}

// Matriz de compatibilidade Special Requests × Service Type (Lalamove v3 BR).
// Mantida em sincronia com src/components/orders/NewOrderDialog.tsx.
const SPECIAL_REQUESTS_BY_SERVICE: Record<string, readonly string[]> = {
  MOTORCYCLE: ['HELP_BUY', 'TOLL_FEE', 'DOOR_TO_DOOR', 'THERMAL_BAG_1', 'PURCHASE_SERVICE_1'],
  CAR: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR'],
  MPV: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR'],
  VAN: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
  UV_FIORINO: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE'],
  TRUCK175: ['TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
  TRUCK330: ['TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
};

function sanitizeSpecialRequests(serviceType: string, requested?: string[]): {
  clean: string[];
  dropped: string[];
} {
  if (!requested?.length) return { clean: [], dropped: [] };
  const allowed = SPECIAL_REQUESTS_BY_SERVICE[serviceType];
  // Serviço desconhecido: repassa tal qual — a Lalamove valida.
  if (!allowed) return { clean: requested, dropped: [] };
  const clean: string[] = [];
  const dropped: string[] = [];
  for (const sr of requested) {
    (allowed.includes(sr) ? clean : dropped).push(sr);
  }
  return { clean, dropped };
}

async function createQuotation(request: QuotationRequest) {
  const { clean, dropped } = sanitizeSpecialRequests(request.serviceType, request.specialRequests);
  if (dropped.length > 0) {
    console.warn(
      `[lalamove-api] Dropping incompatible specialRequests for ${request.serviceType}:`,
      dropped
    );
  }
  const body = {
    data: {
      serviceType: request.serviceType,
      language: request.language || 'pt_BR',
      stops: request.stops,
      ...(request.scheduleAt && { scheduleAt: request.scheduleAt }),
      ...(request.isRouteOptimized !== undefined && { isRouteOptimized: request.isRouteOptimized }),
      ...(clean.length > 0 && { specialRequests: clean }),
      ...(request.item && { item: request.item }),
    }
  };
  return lalamoveRequest('POST', '/quotations', body);
}

// GET /v3/quotations/{quotationId}
async function getQuotation(quotationId: string) {
  return lalamoveRequest('GET', `/quotations/${quotationId}`);
}

// ========== Orders (Doc Section 4) ==========
// POST /v3/orders
interface OrderRequest {
  quotationId: string;
  isPODEnabled?: boolean;
  sender: {
    stopId: string;
    name: string;
    phone: string; // Format: +5511955550001
  };
  recipients: Array<{
    stopId: string;
    name: string;
    phone: string;
    remarks?: string;
  }>;
  metadata?: Record<string, string>;
}

// Regex E.164: `+` seguido de 8–15 dígitos (RFC E.164 / requisitos Lalamove v3).
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

function assertE164(phone: unknown, label: string): string {
  if (typeof phone !== 'string' || !E164_REGEX.test(phone)) {
    throw new Error(`Telefone inválido em ${label}: esperado formato E.164 (+5511...)`);
  }
  return phone;
}

async function createOrder(request: OrderRequest) {
  // Guarda server-side: mesmo com validação de UI, nunca confie no cliente.
  assertE164(request.sender?.phone, 'sender');
  request.recipients?.forEach((r, i) => assertE164(r?.phone, `recipients[${i}]`));

  const body = {
    data: {
      quotationId: request.quotationId,
      sender: request.sender,
      recipients: request.recipients,
      ...(request.isPODEnabled !== undefined && { isPODEnabled: request.isPODEnabled }),
      ...(request.metadata && { metadata: request.metadata }),
    }
  };
  return lalamoveRequest('POST', '/orders', body);
}

// GET /v3/orders/{orderId}
async function getOrder(orderId: string) {
  return lalamoveRequest('GET', `/orders/${orderId}`);
}

// DELETE /v3/orders/{orderId} — returns 204 No Content
async function cancelOrder(orderId: string) {
  return lalamoveRequest('DELETE', `/orders/${orderId}`);
}

// PATCH /v3/orders/{orderId} — edit order (only when not ASSIGNING_DRIVER)
async function editOrder(orderId: string, updates: object) {
  return lalamoveRequest('PATCH', `/orders/${orderId}`, { data: updates });
}

// ========== Priority Fee (Doc Section 5) ==========
// POST /v3/orders/{orderId}/priority-fee — can only increase, never decrease
async function addPriorityFee(orderId: string, amount: string) {
  return lalamoveRequest('POST', `/orders/${orderId}/priority-fee`, {
    data: { priorityFee: amount }
  });
}

// ========== Driver (Doc Section 6) ==========
// GET /v3/orders/{orderId}/drivers/{driverId}
// IMPORTANT: Only call when driverId !== "" (never null in BR API)
async function getDriver(orderId: string, driverId: string) {
  return lalamoveRequest('GET', `/orders/${orderId}/drivers/${driverId}`);
}

// DELETE /v3/orders/{orderId}/drivers/{driverId} — Change driver (Doc Section 6)
// Valid reasons per Lalamove v3 spec
export const CHANGE_DRIVER_REASONS = [
  'DRIVER_UNRESPONSIVE',
  'DRIVER_LATE',
  'DRIVER_ASKED_CHANGE',
  'DRIVER_RUDE',
  'DRIVER_ASKED_FOR_MORE_MONEY',
] as const;
type ChangeDriverReason = typeof CHANGE_DRIVER_REASONS[number];

async function changeDriver(orderId: string, driverId: string, reason: ChangeDriverReason) {
  return lalamoveRequest('DELETE', `/orders/${orderId}/drivers/${driverId}`, {
    data: { reason },
  });
}

// ========== Webhook (Doc Section 7) ==========
// PATCH /v3/webhook — set webhook URL
async function setWebhookUrl(url: string) {
  return lalamoveRequest('PATCH', '/webhook', { data: { url } });
}

// ========== Database Sync ==========
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncOrderToDatabase(
  supabase: any,
  lalamoveOrder: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const orderData = lalamoveOrder.data as Record<string, unknown>;
  
  const priceBreakdown = orderData.priceBreakdown as Record<string, string> | undefined;
  const distance = orderData.distance as Record<string, string> | undefined;
  
  const order: Record<string, unknown> = {
    lalamove_id: orderData.orderId as string,
    status: orderData.status as string,
    total_cost: priceBreakdown ? parseFloat(priceBreakdown.total) : 0,
    currency: priceBreakdown?.currency || 'BRL',
    share_link: orderData.shareLink as string || null,
    distance_meters: distance ? parseInt(distance.value) : null,
    updated_at: new Date().toISOString(),
  };

  // ERRATA: driverId is always string, "" when no driver, never null
  const driverIdStr = orderData.driverId as string;
  if (driverIdStr && driverIdStr !== "") {
    // Fetch driver details from Lalamove
    const driverResult = await getDriver(orderData.orderId as string, driverIdStr);
    if (driverResult.data && !driverResult.error) {
      const driverData = (driverResult.data as Record<string, unknown>).data as Record<string, unknown>;
      
      // Upsert driver
      await supabase.from('drivers').upsert({
        lalamove_id: driverIdStr,
        name: driverData?.name as string || `Driver ${driverIdStr}`,
        phone: driverData?.phone as string || null,
        vehicle_plate: driverData?.plateNumber as string || null,
      }, { onConflict: 'lalamove_id' });

      const { data: driverRecord } = await supabase
        .from('drivers')
        .select('id')
        .eq('lalamove_id', driverIdStr)
        .single();

      if (driverRecord) {
        order.driver_id = driverRecord.id;
      }
    }
  }

  // Update order
  const { data: updatedOrder, error } = await supabase
    .from('lalamove_orders')
    .update(order)
    .eq('lalamove_id', orderData.orderId as string)
    .select()
    .single();

  if (error) {
    logger.error('Error updating order:', error);
    return null;
  }

  // Insert status history
  await supabase.from('lalamove_status_history').insert({
    order_id: updatedOrder.id,
    status: orderData.status as string,
    metadata: { source: 'api_sync' },
  });

  // GET /v3/orders/{id} devolve stops[].coordinates: pedidos antigos (criados antes
  // desta correção) ganham a coordenada no primeiro sync, sem depender de nova cotação.
  await persistOrderCoordinates(
    supabase,
    updatedOrder.id as string,
    orderData.stops as Array<Record<string, unknown>> | undefined,
  );

  return updatedOrder;
}

// Upsert order to database (for importing orders not yet in DB)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertOrderToDatabase(
  supabase: any,
  lalamoveOrder: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const orderData = lalamoveOrder.data as Record<string, unknown>;
  const priceBreakdown = orderData.priceBreakdown as Record<string, string> | undefined;
  const distance = orderData.distance as Record<string, string> | undefined;
  const stops = orderData.stops as Array<Record<string, unknown>> | undefined;

  // Map Lalamove status to our enum
  const statusMap: Record<string, string> = {
    'ASSIGNING_DRIVER': 'PENDING',
    'ON_GOING': 'ON_GOING',
    'PICKED_UP': 'PICKED_UP',
    'DELIVERING': 'ON_GOING',
    'COMPLETED': 'COMPLETED',
    'CANCELED': 'CANCELLED',
    'REJECTED': 'REJECTED',
    'EXPIRED': 'EXPIRED',
  };
  const mappedStatus = statusMap[orderData.status as string] || 'PENDING';

  const order: Record<string, unknown> = {
    lalamove_id: orderData.orderId as string,
    quotation_id: orderData.quotationId as string || null,
    status: mappedStatus,
    total_cost: priceBreakdown ? parseFloat(priceBreakdown.total) : 0,
    currency: priceBreakdown?.currency || 'BRL',
    share_link: orderData.shareLink as string || null,
    distance_meters: distance ? parseInt(distance.value) : null,
    pickup_address: stops?.[0]?.address as string || 'N/A',
    delivery_address: stops?.[1]?.address as string || 'N/A',
    customer_name: stops?.[1]?.name as string || stops?.[0]?.name as string || 'N/A',
    customer_phone: stops?.[1]?.phone as string || stops?.[0]?.phone as string || null,
    updated_at: new Date().toISOString(),
  };

  // Handle driver
  const driverIdStr = orderData.driverId as string;
  if (driverIdStr && driverIdStr !== "") {
    const driverResult = await getDriver(orderData.orderId as string, driverIdStr);
    if (driverResult.data && !driverResult.error) {
      const driverData = (driverResult.data as Record<string, unknown>).data as Record<string, unknown>;
      await supabase.from('drivers').upsert({
        lalamove_id: driverIdStr,
        name: driverData?.name as string || `Driver ${driverIdStr}`,
        phone: driverData?.phone as string || null,
        vehicle_plate: driverData?.plateNumber as string || null,
      }, { onConflict: 'lalamove_id' });

      const { data: driverRecord } = await supabase
        .from('drivers')
        .select('id')
        .eq('lalamove_id', driverIdStr)
        .single();

      if (driverRecord) {
        order.driver_id = driverRecord.id;
      }
    }
  }

  // Upsert by lalamove_id
  const { data: upsertedOrder, error } = await supabase
    .from('lalamove_orders')
    .upsert(order, { onConflict: 'lalamove_id' })
    .select()
    .single();

  if (error) {
    logger.error('Error upserting order:', error);
    return null;
  }

  if (upsertedOrder?.id) {
    await persistOrderCoordinates(supabase, upsertedOrder.id as string, stops);
  }

  return upsertedOrder;
}

// Sync all active orders
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncActiveOrders(supabase: any): Promise<{ synced: number; errors: string[] }> {
  const { data: activeOrders, error } = await supabase
    .from('lalamove_orders')
    .select('id, lalamove_id')
    .in('status', ['ASSIGNING_DRIVER', 'PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'DELIVERING']);

  if (error || !activeOrders) {
    logger.error('Error fetching active orders:', error);
    return { synced: 0, errors: [] };
  }

  let synced = 0;
  const errors: string[] = [];

  for (const order of activeOrders as { id: string; lalamove_id: string }[]) {
    const result = await getOrder(order.lalamove_id);
    
    if (result.error) {
      errors.push(`Order ${order.lalamove_id}: ${result.error}`);
      continue;
    }

    await syncOrderToDatabase(supabase, result.data as Record<string, unknown>);
    synced++;
  }

  return { synced, errors };
}

// ========== Main Handler ==========
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!LALAMOVE_API_KEY || !LALAMOVE_API_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Lalamove API credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);

    // Contrato de entrada (422 no formato único + versão v1/v2).
    //
    // ATENÇÃO: o contrato é validado sobre o input MESCLADO (query + corpo), não
    // sobre o corpo cru. Todo o tráfego vindo da `lalamove-gateway` é GET sem
    // corpo, com `action` e ids apenas na query
    // (supabase/functions/lalamove-gateway/index.ts:295,306,322): validar só o
    // corpo transformaria 100% desse tráfego em 422 — incluindo o cartão de
    // status do dashboard e o cancelamento de pedido.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage('lalamove-api', contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);

    const rawBody = (parsedBody.value ?? {}) as Record<string, unknown>;
    // A query tem precedência sobre o corpo, como antes desta camada.
    const QUERY_KEYS = ['action', 'orderId', 'driverId', 'quotationId', 'fee'] as const;
    const fromQuery = Object.fromEntries(
      QUERY_KEYS.flatMap((key) => {
        const value = url.searchParams.get(key);
        return value !== null ? [[key, value] as [string, string]] : [];
      }),
    );
    const contract = validateContract(
      getSchema('lalamove-api', contractVersion),
      { ...rawBody, ...fromQuery },
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);

    // `any` no corpo validado preserva os acessos encadeados que já existiam
    // (ex.: body.recipients?.[0]?.name); a FORMA já foi garantida pelo contrato.
    // deno-lint-ignore no-explicit-any
    const { action, ...body } = contract.data as { action: string } & Record<string, any>;

    let result: ApiResult;

    switch (action) {
      // --- Cities & Services ---
      case 'cities':
        result = await getCities();
        break;

      // --- Quotations ---
      case 'quotation':
        // body ja passou pelo contrato (_shared/schemas.ts, lalamoveApiV1); a validacao de forma
        // fica com a propria API (422 com o campo exato).
        result = await createQuotation(body as unknown as QuotationRequest);
        break;

      case 'get-quotation': {
        const qId = (body.quotationId as string | undefined) ?? null;
        if (!qId) {
          return new Response(
            JSON.stringify({ error: 'quotationId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getQuotation(qId);
        break;
      }

      // --- Orders ---
      case 'order': {
        result = await createOrder(body as unknown as OrderRequest);
        if (result.data && !result.error) {
          const orderData = (result.data as Record<string, unknown>).data as Record<string, unknown>;
          const priceBreakdown = orderData.priceBreakdown as Record<string, string> | undefined;
          const distance = orderData.distance as Record<string, string> | undefined;
          const stops = orderData.stops as Array<Record<string, unknown>> | undefined;
          
          // body.metadata carrega os campos do formulário (Guardian: auto-aviso ao
          // fornecedor; threshold de parada; exige POD) — nunca eram persistidos
          // aqui, então check-driver-alerts sempre lia null/default pra eles.
          const requestMetadata = (body as Record<string, unknown>).metadata as Record<string, unknown> | undefined;

          const { data: insertedOrder } = await supabase.from('lalamove_orders').insert({
            lalamove_id: orderData.orderId,
            quotation_id: body.quotationId,
            status: orderData.status, // ASSIGNING_DRIVER
            pickup_address: stops?.[0]?.address || 'N/A',
            delivery_address: stops?.[1]?.address || 'N/A',
            customer_name: stops?.[1]?.name || body.recipients?.[0]?.name || 'N/A',
            customer_phone: stops?.[1]?.phone || body.recipients?.[0]?.phone,
            share_link: orderData.shareLink as string || null,
            total_cost: priceBreakdown ? parseFloat(priceBreakdown.total) : 0,
            distance_meters: distance ? parseInt(distance.value) : null,
            vehicle_type: body.serviceType || 'MOTORCYCLE',
            metadata: orderData.metadata || {},
            internal_order_id: requestMetadata?.internalOrderId as string ?? null,
            auto_notify_supplier: requestMetadata?.autoNotifySupplier as boolean ?? false,
            supplier_contact: requestMetadata?.supplierContact as string ?? null,
            stalled_threshold_minutes: requestMetadata?.stalledThresholdMinutes as number ?? 15,
            requires_pod: requestMetadata?.requiresPod as boolean ?? true,
            // Etapa 13/36: place_id e componentes resolvidos pelo autocomplete no
            // formulário. Sem isso o pedido fica só com lat/lng da cotação, sem
            // identidade do endereço nem bairro/cidade para auditar.
            pickup_place_id: (requestMetadata?.pickupPlaceId as string) ?? null,
            delivery_place_id: (requestMetadata?.deliveryPlaceId as string) ?? null,
            pickup_address_components: (requestMetadata?.pickupAddressComponents as Record<string, string>) ?? null,
            delivery_address_components: (requestMetadata?.deliveryAddressComponents as Record<string, string>) ?? null,
            // Etapa 90: override por pedido dos padroes de geo_defaults. NULL = herda.
            approach_radius_m: typeof requestMetadata?.approachRadiusM === 'number' ? requestMetadata.approachRadiusM as number : null,
            approach_eta_min: typeof requestMetadata?.approachEtaMin === 'number' ? requestMetadata.approachEtaMin as number : null,
            notify_delivery_contact: typeof requestMetadata?.notifyDeliveryContact === 'boolean' ? requestMetadata.notifyDeliveryContact as boolean : null,
          }).select('id').single();

          // As coordenadas reais vêm da resposta da Lalamove (a cotação geocodifica).
          // Antes disto pickup_/delivery_latitude ficavam sempre NULL e o /map não
          // desenhava os marcadores de coleta e entrega de nenhum pedido.
          if (insertedOrder?.id) {
            await persistOrderCoordinates(supabase, insertedOrder.id as string, stops, {
              pickupPlaceId: requestMetadata?.pickupPlaceId as string | undefined,
              deliveryPlaceId: requestMetadata?.deliveryPlaceId as string | undefined,
              // Etapa 35/36: a atribuição do geocode do autocomplete (google:/mapbox:)
              // não pode ser sobrescrita para 'lalamove' — sem isso o custo do geocode
              // é contabilizado no provedor errado (etapa 93).
              pickupGeocodeProvider: requestMetadata?.geocodeProvider as string | undefined,
              pickupGeocodePrecision: requestMetadata?.pickupGeocodePrecision as string | undefined,
              deliveryGeocodeProvider: requestMetadata?.geocodeProvider as string | undefined,
              deliveryGeocodePrecision: requestMetadata?.deliveryGeocodePrecision as string | undefined,
            });
            // Etapa 37: pedidos de bitrix24/uapi_import/n8n chegam sem lat/lng. Se a
            // Lalamove não devolveu coordenada, geocodifica aqui e marca para revisão
            // quando a precisão não for confiável.
            if (stopsCoords(stops).every((c) => c.lat === null)) {
              const patch = await geocodeOrderFallback(
                stops?.[0]?.address as string | undefined,
                stops?.[1]?.address as string | undefined,
                { supabaseUrl: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY },
              );
              if (Object.keys(patch).length > 0) {
                const { error: geoErr } = await supabase
                  .from('lalamove_orders').update(patch).eq('id', insertedOrder.id);
                if (geoErr) logger.error('Error saving geocode fallback:', geoErr);
                if (patch.requires_address_review === true) {
                  await supabase.from('alerts').insert({
                    type: 'APPROVAL_REQUIRED',
                    severity: 'WARNING',
                    title: 'Endereço impreciso no pedido',
                    message: `O pedido ${orderData.orderId} entrou sem coordenada e o endereço geocodificado não tem precisão suficiente. Revise antes de despachar.`,
                    metadata: { order_id: insertedOrder.id, source: 'geocode_fallback', precision: patch.geocode_precision },
                  });
                }
              }
            }
          }
        }
        break;
      }

      case 'get-order': {
        const orderId = (body.orderId as string | undefined) ?? null;
        if (!orderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getOrder(orderId);
        if (result.data && !result.error) {
          await syncOrderToDatabase(supabase, result.data as Record<string, unknown>);
        }
        break;
      }

      // Fetch order from Lalamove by ID and UPSERT into database (for importing history)
      case 'fetch-order': {
        const fetchOrderId = body.orderId as string;
        if (!fetchOrderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getOrder(fetchOrderId);
        if (result.data && !result.error) {
          const saved = await upsertOrderToDatabase(supabase, result.data as Record<string, unknown>);
          result = { data: { lalamove: (result.data as Record<string, unknown>).data, saved }, status: 200 };
        }
        break;
      }

      // Bulk fetch multiple orders by IDs
      case 'fetch-orders-bulk': {
        const orderIds: string[] = body.orderIds || [];
        if (!orderIds.length) {
          return new Response(
            JSON.stringify({ error: 'orderIds array is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const results: { orderId: string; success: boolean; error?: string }[] = [];
        for (const oid of orderIds.slice(0, 50)) { // Max 50 per call
          const r = await getOrder(oid);
          if (r.data && !r.error) {
            await upsertOrderToDatabase(supabase, r.data as Record<string, unknown>);
            results.push({ orderId: oid, success: true });
          } else {
            results.push({ orderId: oid, success: false, error: r.error });
          }
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        result = { data: { processed: results.length, results }, status: 200 };
        break;
      }

      case 'edit-order': {
        { const { error: re } = await requireRole(req, ['admin', 'manager', 'operator'], corsHeaders); if (re) return re; }
        const editOrderId = (body.orderId as string | undefined) ?? null;
        if (!editOrderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // `orderId` identifica o pedido na URL do PATCH e não pode viajar
        // dentro do `data` enviado à Lalamove.
        const { orderId: _editOrderIdField, ...editPatch } = body;
        result = await editOrder(editOrderId, editPatch);
        break;
      }

      case 'cancel': {
        { const { error: re } = await requireRole(req, ['admin', 'manager', 'operator'], corsHeaders); if (re) return re; }
        const cancelOrderId = body.orderId as string;
        if (!cancelOrderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Valid cancellation reasons per Lalamove v3 spec + internal audit
        const VALID_CANCEL_REASONS = [
          'USER_REQUESTED', 'DRIVER_UNRESPONSIVE', 'DRIVER_LATE',
          'DRIVER_ASKED_CHANGE', 'DRIVER_ASKED_CANCEL', 'DRIVER_RUDE',
          'DRIVER_ASKED_FOR_MORE_MONEY', 'DELIVERY_ETA_TOO_LONG',
          'PRICE_TOO_HIGH', 'INCORRECT_ORDER_DETAILS', 'MISTAKEN_ORDER',
          'WRONG_ADDRESS', 'NO_CAPACITY', 'OTHER',
        ] as const;
        const rawReason = typeof body.reason === 'string' ? body.reason : 'USER_REQUESTED';
        const cancellationReason = (VALID_CANCEL_REASONS as readonly string[]).includes(rawReason)
          ? rawReason
          : 'OTHER';
        const cancellationNotes = typeof body.notes === 'string' && body.notes.trim().length > 0
          ? body.notes.trim().slice(0, 1000)
          : null;

        result = await cancelOrder(cancelOrderId);
        if (!result.error) {
          // Extract caller from JWT for audit trail (best-effort)
          let cancelledBy: string | null = null;
          try {
            const authHeader = req.headers.get('Authorization') || '';
            const token = authHeader.replace(/^Bearer\s+/i, '');
            if (token) {
              const { data: userData } = await supabase.auth.getUser(token);
              cancelledBy = userData.user?.id ?? null;
            }
          } catch (_) { /* audit is best-effort */ }

          await supabase
            .from('lalamove_orders')
            .update({
              status: 'CANCELED',
              cancellation_reason: cancellationReason,
              cancellation_notes: cancellationNotes,
              cancelled_by: cancelledBy,
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('lalamove_id', cancelOrderId);
        }
        break;
      }

      // --- Priority Fee (Doc §5) — só pode aumentar, nunca reduzir. ---
      case 'priority-fee': {
        { const { error: re } = await requireRole(req, ['admin', 'manager', 'operator'], corsHeaders); if (re) return re; }
        const pfOrderId = body.orderId as string;
        // `fee` é o nome que a lalamove-gateway envia na query (src/lib/lalamove-api.ts:133).
        const rawAmount = body.amount ?? body.priorityFee ?? body.fee;
        const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null;

        if (!pfOrderId || rawAmount === undefined || rawAmount === null) {
          return new Response(
            JSON.stringify({ error: 'orderId e amount são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validação numérica: > 0, até 2 casas decimais, teto de segurança R$500.
        const amountNum = Number.parseFloat(String(rawAmount));
        if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > 500) {
          return new Response(
            JSON.stringify({ error: 'Valor inválido (deve ser numérico, > 0 e ≤ 500)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const amountStr = amountNum.toFixed(2);

        // Busca fee atual para validar aumento monotônico e auditar.
        const { data: current } = await adminDb
          .from('lalamove_orders')
          .select('id, priority_fee, currency')
          .eq('lalamove_id', pfOrderId)
          .maybeSingle();

        const previous = current?.priority_fee != null ? Number(current.priority_fee) : null;
        if (previous !== null && amountNum <= previous) {
          return new Response(
            JSON.stringify({ error: `Novo valor deve ser maior que o atual (R$ ${previous.toFixed(2)})` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Identifica o usuário para trilha de auditoria.
        const pfAuthHeader = req.headers.get('Authorization') || '';
        const pfToken = pfAuthHeader.replace(/^Bearer\s+/i, '');
        let changedBy: string | null = null;
        if (pfToken) {
          const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const { data: u } = await supabaseAuth.auth.getUser(pfToken);
          changedBy = u?.user?.id ?? null;
        }

        // Chamada à API oficial Lalamove.
        result = await addPriorityFee(pfOrderId, amountStr);

        // Persistência local (fire-and-forget não é aceitável aqui: precisa auditar).
        if (current?.id) {
          await adminDb
            .from('lalamove_orders')
            .update({
              priority_fee: amountNum,
              priority_fee_currency: current.currency || 'BRL',
              priority_fee_updated_at: new Date().toISOString(),
            })
            .eq('id', current.id);

          await adminDb
            .from('lalamove_priority_fee_history')
            .insert({
              order_id: current.id,
              lalamove_order_id: pfOrderId,
              previous_fee: previous,
              new_fee: amountNum,
              currency: current.currency || 'BRL',
              reason,
              changed_by: changedBy,
            });
        }
        break;
      }

      // --- Driver ---
      case 'get-driver': {
        const dOrderId = (body.orderId as string | undefined) ?? null;
        const dDriverId = (body.driverId as string | undefined) ?? null;
        if (!dOrderId || !dDriverId) {
          return new Response(
            JSON.stringify({ error: 'orderId and driverId are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // ERRATA: driverId is always string, never null. Only call when !== ""
        if (dDriverId === "") {
          return new Response(
            JSON.stringify({ error: 'driverId is empty — no driver assigned yet' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getDriver(dOrderId, dDriverId);
        break;
      }

      // --- Change Driver (Doc Section 6) ---
      case 'change-driver': {
        { const { error: re } = await requireRole(req, ['admin', 'manager', 'operator'], corsHeaders); if (re) return re; }
        const cdOrderId = body.orderId as string;
        const cdDriverId = body.driverId as string;
        const cdReason = (body.reason as string) || '';
        if (!cdOrderId || !cdDriverId || !cdReason) {
          return new Response(
            JSON.stringify({ error: 'orderId, driverId and reason are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (!CHANGE_DRIVER_REASONS.includes(cdReason as typeof CHANGE_DRIVER_REASONS[number])) {
          return new Response(
            JSON.stringify({
              error: 'Invalid reason',
              validReasons: CHANGE_DRIVER_REASONS,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await changeDriver(cdOrderId, cdDriverId, cdReason as typeof CHANGE_DRIVER_REASONS[number]);
        if (!result.error) {
          await supabase
            .from('lalamove_orders')
            .update({
              driver_id: null,
              driver_name: null,
              driver_phone: null,
              driver_plate: null,
              status: 'ASSIGNING_DRIVER',
              updated_at: new Date().toISOString(),
            })
            .eq('lalamove_id', cdOrderId);
          await supabase.from('lalamove_status_history').insert({
            lalamove_id: cdOrderId,
            status: 'DRIVER_CHANGED',
            metadata: { reason: cdReason, previous_driver_id: cdDriverId },
            changed_at: new Date().toISOString(),
          });
        }
        break;
      }

      // --- Webhook ---
      case 'set-webhook': {
        { const { error: re } = await requireRole(req, ['admin'], corsHeaders); if (re) return re; }
        const webhookUrl = body.url;
        if (!webhookUrl) {
          return new Response(
            JSON.stringify({ error: 'url is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await setWebhookUrl(webhookUrl);
        break;
      }

      // --- Webhook self-test (smoke test assinado) ---
      // Assina um payload v3 com o LALAMOVE_API_SECRET real (a mesma formula
      // que a Lalamove usa: v3_Webhook_v1.5.pdf p.8) e entrega no proprio
      // webhook. Prova a cadeia inteira — assinatura, normalizacao v3,
      // contrato e processamento — sem criar pedido pago nem despachar
      // motorista. O segredo nunca sai da edge.
      //
      // TRAVA DE SEGURANCA: so aceita orderId com o prefixo de teste, entao
      // nao e possivel forjar evento de pedido real por aqui.
      case 'webhook-selftest': {
        const SELFTEST_PREFIX = 'E2E-SELFTEST-';
        const orderId = typeof body.orderId === 'string' ? body.orderId : '';
        if (!orderId.startsWith(SELFTEST_PREFIX)) {
          return new Response(
            JSON.stringify({ error: `orderId deve comecar com ${SELFTEST_PREFIX}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const eventType = typeof body.eventType === 'string' ? body.eventType : 'ORDER_STATUS_CHANGED';
        const status = typeof body.status === 'string' ? body.status : 'ON_GOING';
        const nowIso = new Date().toISOString();

        const data: Record<string, unknown> = eventType === 'DRIVER_ASSIGNED'
          ? {
              driver: {
                driverId: `${SELFTEST_PREFIX}DRIVER`,
                phone: '+5541999999999',
                name: 'Motorista de Teste (self-test)',
                photo: '',
                plateNumber: 'TST0A00',
              },
              location: { lat: -25.4284, lng: -49.2733 },
              order: { orderId },
              updatedAt: nowIso,
            }
          : { order: { orderId, status, previousStatus: '', market: 'BR CWB' }, updatedAt: nowIso };

        const webhookPath = '/functions/v1/lalamove-webhook';
        const timestamp = Math.floor(Date.now() / 1000);
        const raw = `${timestamp}\r\nPOST\r\n${webhookPath}\r\n\r\n${JSON.stringify(data)}`;

        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw', encoder.encode(LALAMOVE_API_SECRET!),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
        );
        const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(raw));
        const signature = Array.from(new Uint8Array(sigBuf))
          .map(b => b.toString(16).padStart(2, '0')).join('');

        const payload = {
          apiKey: LALAMOVE_API_KEY,
          timestamp,
          signature,
          eventId: crypto.randomUUID(),
          eventType,
          eventVersion: 'v3',
          data,
        };

        const whRes = await fetch(`${SUPABASE_URL}${webhookPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const whBody = await whRes.text();
        result = {
          data: {
            delivered: whRes.ok,
            webhookStatus: whRes.status,
            webhookResponse: whBody.substring(0, 500),
            eventType,
            orderId,
          },
          status: whRes.status,
        };
        break;
      }

      // --- Sync ---
      case 'sync': {
        const syncResult = await syncActiveOrders(supabase);
        result = { data: syncResult, status: 200 };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action',
            availableActions: [
              'cities',
              'quotation', 'get-quotation',
              'order', 'get-order', 'fetch-order', 'fetch-orders-bulk', 'edit-order', 'cancel',
              'priority-fee',
              'get-driver', 'change-driver',
              'set-webhook', 'webhook-selftest',
              'sync',
            ]
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.status || 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    logger.error('Lalamove API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
