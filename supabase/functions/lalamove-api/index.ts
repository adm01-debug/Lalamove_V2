import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";

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

        return { error: errorDetail, status: response.status, rateLimits, attempts: attempt };
      }

      const data = responseText ? JSON.parse(responseText) : {};
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

async function createQuotation(request: QuotationRequest) {
  const body = {
    data: {
      serviceType: request.serviceType,
      language: request.language || 'pt_BR',
      stops: request.stops,
      ...(request.scheduleAt && { scheduleAt: request.scheduleAt }),
      ...(request.isRouteOptimized !== undefined && { isRouteOptimized: request.isRouteOptimized }),
      ...(request.specialRequests?.length && { specialRequests: request.specialRequests }),
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

async function createOrder(request: OrderRequest) {
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
    const bodyResult = z.record(z.any()).safeParse(req.method !== 'GET' ? await req.json().catch(() => ({})) : {});
    
    if (!bodyResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawBody = bodyResult.data;
    // Accept action from query string OR body
    const action = url.searchParams.get('action') || rawBody.action || null;
    const body = rawBody.action ? (({ action: _a, ...rest }: Record<string, unknown>) => rest)(rawBody) : rawBody;

    let result: ApiResult;

    switch (action) {
      // --- Cities & Services ---
      case 'cities':
        result = await getCities();
        break;

      // --- Quotations ---
      case 'quotation':
        result = await createQuotation(body);
        break;

      case 'get-quotation': {
        const qId = url.searchParams.get('quotationId');
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
        result = await createOrder(body);
        if (result.data && !result.error) {
          const orderData = (result.data as Record<string, unknown>).data as Record<string, unknown>;
          const priceBreakdown = orderData.priceBreakdown as Record<string, string> | undefined;
          const distance = orderData.distance as Record<string, string> | undefined;
          const stops = orderData.stops as Array<Record<string, unknown>> | undefined;
          
          await supabase.from('lalamove_orders').insert({
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
          });
        }
        break;
      }

      case 'get-order': {
        const orderId = url.searchParams.get('orderId');
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
        const fetchOrderId = url.searchParams.get('orderId') || body.orderId as string;
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
        const editOrderId = url.searchParams.get('orderId');
        if (!editOrderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await editOrder(editOrderId, body);
        break;
      }

      case 'cancel': {
        const cancelOrderId = url.searchParams.get('orderId');
        if (!cancelOrderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await cancelOrder(cancelOrderId);
        if (!result.error) {
          // ERRATA: cancelParty/cancelledReason don't exist in BR API
          await supabase
            .from('lalamove_orders')
            .update({ status: 'CANCELED', updated_at: new Date().toISOString() })
            .eq('lalamove_id', cancelOrderId);
        }
        break;
      }

      // --- Priority Fee ---
      case 'priority-fee': {
        const pfOrderId = url.searchParams.get('orderId');
        const amount = body.amount || body.priorityFee;
        if (!pfOrderId || !amount) {
          return new Response(
            JSON.stringify({ error: 'orderId and amount are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await addPriorityFee(pfOrderId, String(amount));
        break;
      }

      // --- Driver ---
      case 'get-driver': {
        const dOrderId = url.searchParams.get('orderId');
        const dDriverId = url.searchParams.get('driverId');
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
        const cdOrderId = url.searchParams.get('orderId') || (body.orderId as string);
        const cdDriverId = url.searchParams.get('driverId') || (body.driverId as string);
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
              'set-webhook',
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
