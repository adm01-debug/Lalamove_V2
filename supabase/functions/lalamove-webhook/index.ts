import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.190.0/encoding/hex.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { resolveContractVersion, parseJsonBody, validateContract, errorResponse } from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lalamove-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──
interface WebhookRecord { id: string }
interface OrderIdRecord { id: string }
interface OrderStatusRecord { status: string }
interface OrderDriverRecord { driver_id: string | null; customer_name?: string }
interface DriverRecord { id: string; name: string; risk_score: number; risk_level: string; total_deliveries: number; status: string }
interface DriverStatsRecord { completed_deliveries: number; total_deliveries: number }
interface TrackingRecord { id: string; driver_id: string }
interface AlertRecord { id: string }

// ── Rate Limiting ──
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_BLOCK_DURATION_MS = 300000;

const TRUSTED_IP_PATTERNS = [
  "52.76.0.0/16", "54.251.0.0/16", "13.228.0.0/16", "18.136.0.0/16",
  "127.0.0.1", "::1",
];

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isIpInCidr(ip: string, cidr: string): boolean {
  if (cidr.includes('/')) {
    const [range, bits] = cidr.split('/');
    const mask = ~((1 << (32 - parseInt(bits))) - 1);
    return (ipToNumber(ip) & mask) === (ipToNumber(range) & mask);
  }
  return ip === cidr;
}

function isIpTrusted(ip: string): boolean {
  const envTrustedIps = Deno.env.get("LALAMOVE_TRUSTED_IPS");
  const additionalIps = envTrustedIps ? envTrustedIps.split(',').map(s => s.trim()) : [];
  const allPatterns = [...TRUSTED_IP_PATTERNS, ...additionalIps];
  for (const pattern of allPatterns) {
    if (isIpInCidr(ip, pattern)) return true;
  }
  return false;
}

const rateLimitStore = new Map<string, { count: number; windowStart: number; blocked?: boolean; blockedUntil?: number }>();

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number; resetIn: number; blocked?: boolean } {
  const now = Date.now();
  const record = rateLimitStore.get(clientIp);
  
  if (record?.blocked && record.blockedUntil && now < record.blockedUntil) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((record.blockedUntil - now) / 1000), blocked: true };
  }
  if (record?.blocked && record.blockedUntil && now >= record.blockedUntil) {
    rateLimitStore.delete(clientIp);
  }
  
  const existing = rateLimitStore.get(clientIp);
  if (!existing || (now - existing.windowStart) > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(clientIp, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS / 1000 };
  }
  
  existing.count++;
  if (existing.count > RATE_LIMIT_MAX_REQUESTS) {
    existing.blocked = true;
    existing.blockedUntil = now + RATE_LIMIT_BLOCK_DURATION_MS;
    return { allowed: false, remaining: 0, resetIn: RATE_LIMIT_BLOCK_DURATION_MS / 1000, blocked: true };
  }
  
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - existing.count, resetIn: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - existing.windowStart)) / 1000) };
}

let requestCount = 0;
function cleanupRateLimitStore() {
  requestCount++;
  if (requestCount % 100 === 0) {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
      if ((now - record.windowStart) > 600000 && (!record.blocked || (record.blockedUntil && now >= record.blockedUntil))) {
        rateLimitStore.delete(ip);
      }
    }
  }
}

// ── Status Mapping ──
const statusMapping: Record<string, string> = {
  'ASSIGNING_DRIVER': 'PENDING',
  'ON_GOING': 'ON_GOING',
  'PICKED_UP': 'PICKED_UP',
  'COMPLETED': 'COMPLETED',
  'CANCELED': 'CANCELLED',
  'CANCELLED': 'CANCELLED',
  'REJECTED': 'REJECTED',
  'EXPIRED': 'EXPIRED',
};

// ── Timing-Safe Comparison ──
// Constant-time equality check to prevent timing attacks on signature comparison.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── Replay Protection ──
// Maximum age (in ms) of a webhook payload timestamp. Requests older than this
// are rejected to prevent replay attacks even when the signature is valid.
const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function validateTimestampFreshness(timestamp: string | null | undefined): { valid: boolean; reason?: string } {
  if (!timestamp) return { valid: true, reason: 'No timestamp provided (skipped)' };
  const parsed = new Date(timestamp).getTime();
  if (Number.isNaN(parsed)) return { valid: false, reason: 'Invalid timestamp format' };
  const age = Date.now() - parsed;
  if (age > WEBHOOK_MAX_AGE_MS) return { valid: false, reason: `Timestamp too old (${Math.round(age / 1000)}s)` };
  if (age < -WEBHOOK_MAX_AGE_MS) return { valid: false, reason: `Timestamp in the future (${Math.round(-age / 1000)}s)` };
  return { valid: true, reason: 'Timestamp fresh' };
}

// ── HMAC Validation ──
async function validateHmacSignature(
  body: string, signature: string | null, secret: string
): Promise<{ valid: boolean; reason?: string }> {
  if (!signature) return { valid: false, reason: 'Missing signature header' };
  if (!secret) {
    logger.warn('[Webhook] LALAMOVE_API_SECRET not configured, skipping signature validation');
    return { valid: true, reason: 'Secret not configured, validation skipped' };
  }
  
  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(body));
    const computedSignature = new TextDecoder().decode(encode(new Uint8Array(signatureBuffer))).toLowerCase();
    const signatureToCompare = signature.toLowerCase().replace(/^sha256=/, '').trim();
    const isValid = timingSafeEqual(computedSignature, signatureToCompare);
    
    if (!isValid) logger.log(`[Webhook] Signature mismatch (constant-time check failed)`);
    return { valid: isValid, reason: isValid ? 'Signature valid' : 'Signature mismatch' };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[Webhook] HMAC validation error:', errorMsg);
    return { valid: false, reason: `Validation error: ${errorMsg}` };
  }
}

// ── Idempotency Key ──
// Compute a stable dedup key from body content to detect duplicate webhook deliveries.
async function computeIdempotencyKey(body: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return new TextDecoder().decode(encode(new Uint8Array(hash)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  
  if (!isIpTrusted(clientIp)) {
    logger.warn(`[Webhook] BLOCKED - Unauthorized IP: ${clientIp}`);
    return new Response(
      JSON.stringify({ error: "Access denied" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  cleanupRateLimitStore();
  const rateLimit = checkRateLimit(clientIp);
  const rateLimitHeaders = {
    ...corsHeaders,
    "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": rateLimit.resetIn.toString(),
  };
  
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      { status: 429, headers: { ...rateLimitHeaders, "Content-Type": "application/json", "Retry-After": rateLimit.resetIn.toString() } }
    );
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const rawBody = await req.text();
    
    // HMAC validation
    const lalamoveSecret = Deno.env.get("LALAMOVE_API_SECRET");
    const signature = req.headers.get("x-lalamove-signature") || req.headers.get("X-Lalamove-Signature");
    const hmacResult = await validateHmacSignature(rawBody, signature, lalamoveSecret || '');
    
    if (!hmacResult.valid && lalamoveSecret) {
      logger.warn(`[Webhook] HMAC validation failed: ${hmacResult.reason}`);
      await supabase.from('webhook_events').insert({
        event_type: 'SIGNATURE_INVALID',
        raw_payload: { body: rawBody.substring(0, 1000), signature, reason: hmacResult.reason },
        processed: true,
        error_message: hmacResult.reason,
      });
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("lalamove-webhook", contractVersion);
    const parsedBody = await parseJsonBody(
      new Request(req.url, { method: "POST", body: rawBody }),
      contractVersion,
    );
    if (!parsedBody.ok) {
      logger.error(`[Webhook] Invalid JSON body`);
      return errorResponse(parsedBody, corsHeaders);
    }

    const webhookSchema = (getSchema("lalamove-webhook", contractVersion) as z.ZodObject<z.ZodRawShape>).passthrough();
    const contract = validateContract(webhookSchema, parsedBody.value, contractVersion);
    if (!contract.ok) {
      logger.error(`[Webhook] Invalid payload:`, contract.body.error.fields);
      return errorResponse(contract, corsHeaders);
    }

    const payload = contract.data as {
      event?: string;
      orderId?: string | null;
      timestamp?: string | null;
      status?: string;
      reason?: string;
      data?: Record<string, unknown> & { status?: string; stopIndex?: number; reason?: string };
    };
    logger.log(`[Webhook] Received: ${payload.event} (HMAC: ${hmacResult.reason})`);
    
    const eventType: string = payload.event?.toUpperCase() || 'UNKNOWN';
    const lalamoveOrderId: string | null = payload.orderId || null;
    
    // Store webhook event
    const { data: webhook, error } = await supabase
      .from('webhook_events')
      .insert({ event_type: eventType, lalamove_order_id: lalamoveOrderId, raw_payload: payload, processed: false })
      .select('id')
      .single();
    
    if (error) throw error;
    const webhookId = (webhook as WebhookRecord).id;
    
    // ── Helpers ──
    async function getOrderUuid(lalamoveId: string): Promise<string | null> {
      const { data } = await supabase
        .from('lalamove_orders').select('id').eq('lalamove_id', lalamoveId).maybeSingle();
      return data ? (data as OrderIdRecord).id : null;
    }
    
    async function updateOrderStatus(orderUuid: string, newStatus: string, metadata?: Record<string, unknown>) {
      const { data: currentOrder } = await supabase
        .from('lalamove_orders').select('status').eq('id', orderUuid).single();
      
      const oldStatus = currentOrder ? (currentOrder as OrderStatusRecord).status : null;
      const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'COMPLETED') updateData.actual_delivery = new Date().toISOString();
      
      await supabase.from('lalamove_orders').update(updateData).eq('id', orderUuid);
      await supabase.from('lalamove_status_history').insert({
        order_id: orderUuid, status: newStatus, old_status: oldStatus,
        change_reason: `Webhook: ${eventType}`, metadata: metadata || {},
      });
      logger.log(`[Webhook] Order ${orderUuid} status: ${oldStatus} -> ${newStatus}`);
    }
    
    async function sendNotification(type: string, title: string, message: string, severity: string, driverId?: string, orderId?: string) {
      const { data: alert } = await supabase
        .from('alerts')
        .insert({ type, severity, title, message, driver_id: driverId || null, order_id: orderId || null })
        .select('id')
        .single();
      
      if (alert) {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ alertId: (alert as AlertRecord).id, type, severity, title, message, driverId, orderId }),
          });
        } catch (e) {
          logger.error('[Webhook] Notification dispatch failed:', e);
        }
      }
    }
    
    // ── Process Events ──
    switch (eventType) {
      case 'DRIVER_ASSIGNED':
      case 'DRIVER_CHANGED': {
        const driverData = payload.data || {};
        const lalamoveDriverId = driverData.driverId || driverData.driver_id;
        logger.log(`[Webhook] Processing ${eventType} for driver: ${lalamoveDriverId}, order: ${lalamoveOrderId}`);
        
        if (lalamoveDriverId) {
          const orderUuid = lalamoveOrderId ? await getOrderUuid(lalamoveOrderId) : null;
          
          const { data: existing } = await supabase
            .from('drivers')
            .select('id, name, risk_score, risk_level, total_deliveries, status')
            .eq('lalamove_id', lalamoveDriverId)
            .maybeSingle();
          
          let driverId: string;
          let isNewDriver = false;
          
          if (existing) {
            const driver = existing as DriverRecord;
            driverId = driver.id;
            logger.log(`[Webhook] Found existing driver: ${driver.name} (ID: ${driverId})`);
            logger.log(`[Webhook] Current stats - Risk: ${driver.risk_score}, Level: ${driver.risk_level}, Deliveries: ${driver.total_deliveries}, Status: ${driver.status}`);
          } else {
            isNewDriver = true;
            const { data: newDriver, error: createError } = await supabase
              .from('drivers')
              .insert({
                lalamove_id: lalamoveDriverId,
                name: driverData.driverName || 'Unknown',
                phone: driverData.driverPhone,
                vehicle_type: 'MOTORCYCLE',
                status: 'PENDING_APPROVAL',
                risk_score: 5.0,
                risk_level: 'HIGH',
              })
              .select('id')
              .single();
            
            if (createError) {
              logger.error(`[Webhook] Failed to create driver: ${createError.message}`);
              throw createError;
            }
            
            driverId = (newDriver as OrderIdRecord).id;
            logger.log(`[Webhook] Created NEW driver: ${driverData.driverName || 'Unknown'} (ID: ${driverId})`);
          }
          
          if (orderUuid) {
            const { data: orderData } = await supabase
              .from('lalamove_orders')
              .update({ driver_id: driverId, status: 'MATCHED' })
              .eq('id', orderUuid)
              .select('auto_notify_supplier, supplier_contact, customer_name, internal_order_id, pickup_address')
              .single();
            
            logger.log(`[Webhook] Linked driver ${driverId} to order ${orderUuid}`);

            // GUARDIAN: Automate supplier notification
            if (orderData?.auto_notify_supplier && orderData?.supplier_contact) {
              logger.log(`[Guardian] Automating notification to supplier: ${orderData.supplier_contact}`);
              try {
                // Call Bitrix24 or direct Notification service
                await supabase.functions.invoke('send-notification', {
                  body: {
                    type: 'SUPPLIER_ALERT',
                    recipient: orderData.supplier_contact,
                    message: `Olá! O motorista ${driverData.driverName || 'da Lalamove'} foi designado para a coleta do pedido ${orderData.internal_order_id || orderUuid}. Ele está a caminho de ${orderData.pickup_address}.`,
                    metadata: { orderId: orderUuid, driverName: driverData.driverName }
                  }
                });
              } catch (notifyError) {
                logger.error(`[Guardian] Failed to notify supplier: ${notifyError}`);
              }
            }
          }
          
          // Evaluate driver
          logger.log(`[Webhook] Starting driver evaluation...`);
          const evalStartTime = Date.now();
          
          try {
            const evalResponse = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/evaluate-driver`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                body: JSON.stringify({ driverId, orderId: orderUuid, driverName: driverData.driverName }),
              }
            );
            
            const evalDuration = Date.now() - evalStartTime;
            const evalResultText = await evalResponse.text();
            logger.log(`[Webhook] Evaluation completed in ${evalDuration}ms (HTTP ${evalResponse.status})`);
            
            if (evalResponse.ok) {
              try {
                const evalResult = JSON.parse(evalResultText);
                logger.log(`[Webhook] ===== EVALUATION: ${evalResult.driver?.name || 'Unknown'} =====`);
                logger.log(`[Webhook] Approved: ${evalResult.evaluation?.approved}, Score: ${evalResult.evaluation?.riskAnalysis?.score?.toFixed(2)}, Level: ${evalResult.evaluation?.riskAnalysis?.level}`);
                
                if (evalResult.evaluation?.riskAnalysis?.factors?.length > 0) {
                  for (const factor of evalResult.evaluation.riskAnalysis.factors) {
                    logger.log(`[Webhook]   - ${factor.name}: ${factor.score?.toFixed(2)} (weight: ${factor.weight})`);
                  }
                }
                
                if (evalResult.evaluation?.autoBlocked) {
                  await sendNotification('DRIVER_BLOCKED', 'Motorista Bloqueado', 
                    `${evalResult.driver?.name || 'Motorista'} bloqueado. Risco: ${evalResult.evaluation?.riskAnalysis?.score?.toFixed(1)}`,
                    'CRITICAL', driverId, orderUuid || undefined);
                } else if (evalResult.evaluation?.requiresManualApproval) {
                  await sendNotification('APPROVAL_REQUIRED', 'Aprovação Necessária',
                    `${evalResult.driver?.name || 'Motorista'} requer aprovação. ${evalResult.evaluation?.recommendation}`,
                    'WARNING', driverId, orderUuid || undefined);
                }
              } catch (parseError) {
                logger.error(`[Webhook] Failed to parse evaluation: ${parseError}`);
              }
            } else {
              logger.error(`[Webhook] Evaluation failed: ${evalResultText.substring(0, 500)}`);
            }
          } catch (evalError) {
            logger.error(`[Webhook] Evaluation request failed: ${evalError}`);
          }
        }
        break;
      }
      
      case 'ORDER_STATUS_CHANGED': {
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          if (orderUuid) {
            const newLalamoveStatus = payload.data?.status || payload.status;
            const mappedStatus = statusMapping[(newLalamoveStatus ?? '').toUpperCase()] || 'ON_GOING';
            await updateOrderStatus(orderUuid, mappedStatus, { lalamove_status: newLalamoveStatus, timestamp: payload.timestamp });
          } else {
            logger.log(`[Webhook] Order ${lalamoveOrderId} not found in database`);
          }
        }
        break;
      }
      
      case 'ORDER_PICKED_UP': {
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          if (orderUuid) {
            await updateOrderStatus(orderUuid, 'PICKED_UP', { picked_up_at: payload.timestamp || new Date().toISOString() });
            const stopIndex = payload.data?.stopIndex || 0;
            await supabase.from('lalamove_stops').update({ completed_at: new Date().toISOString() }).eq('order_id', orderUuid).eq('stop_index', stopIndex);
          }
        }
        break;
      }
      
      case 'ORDER_COMPLETED': {
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          if (orderUuid) {
            await updateOrderStatus(orderUuid, 'COMPLETED', { completed_at: payload.timestamp || new Date().toISOString() });
            
            const { data: order } = await supabase.from('lalamove_orders').select('driver_id').eq('id', orderUuid).single();
            const orderData = order as OrderDriverRecord | null;
            
            if (orderData?.driver_id) {
              const { data: driver } = await supabase.from('drivers').select('completed_deliveries, total_deliveries').eq('id', orderData.driver_id).single();
              const driverStats = driver as DriverStatsRecord | null;
              
              if (driverStats) {
                await supabase.from('drivers').update({
                  completed_deliveries: (driverStats.completed_deliveries || 0) + 1,
                  total_deliveries: (driverStats.total_deliveries || 0) + 1,
                  last_active_at: new Date().toISOString(),
                }).eq('id', orderData.driver_id);
              }
            }
            logger.log(`[Webhook] Order ${lalamoveOrderId} completed`);
          }
        }
        break;
      }
      
      case 'ORDER_CANCELLED':
      case 'ORDER_CANCELED': {
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          if (orderUuid) {
            const reason = payload.data?.reason || payload.reason || 'Cancelado via Lalamove';
            await updateOrderStatus(orderUuid, 'CANCELLED', { cancel_reason: reason, cancelled_at: payload.timestamp || new Date().toISOString() });
            
            const { data: order } = await supabase.from('lalamove_orders').select('customer_name, driver_id').eq('id', orderUuid).single();
            const orderData = order as OrderDriverRecord | null;
            
            await sendNotification('ORDER_CANCELLED', 'Pedido Cancelado',
              `Pedido ${lalamoveOrderId} para ${orderData?.customer_name || 'cliente'} cancelado. Motivo: ${reason}`,
              'WARNING', orderData?.driver_id || undefined, orderUuid);
            
            logger.log(`[Webhook] Order ${lalamoveOrderId} cancelled: ${reason}`);
          }
        }
        break;
      }
      
      case 'DRIVER_LOCATION_UPDATED': {
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          const locationData = payload.data || {};
          
          if (orderUuid && locationData.latitude && locationData.longitude) {
            const { data: tracking } = await supabase
              .from('active_tracking').select('id, driver_id').eq('order_id', orderUuid).maybeSingle();
            const trackingData = tracking as TrackingRecord | null;
            
            if (trackingData) {
              await supabase.from('active_tracking').update({
                current_latitude: locationData.latitude,
                current_longitude: locationData.longitude,
                speed: locationData.speed || 0,
                heading: locationData.heading || 0,
                last_updated: new Date().toISOString(),
              }).eq('id', trackingData.id);
              
              await supabase.from('driver_locations').insert({
                tracking_id: trackingData.id,
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                speed_kmh: locationData.speed || 0,
                heading_degrees: locationData.heading || 0,
              });
            }
            
            const { data: order } = await supabase.from('lalamove_orders').select('driver_id').eq('id', orderUuid).single();
            const orderData = order as OrderDriverRecord | null;
            
            if (orderData?.driver_id) {
              await supabase.from('tracking_events').insert({
                order_id: orderUuid,
                driver_id: orderData.driver_id,
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                speed: locationData.speed || 0,
                heading: locationData.heading || 0,
                event_type: 'LOCATION_UPDATE',
              });
            }
          }
        }
        break;
      }

      // ── Etapa 1: cobertura completa de eventos oficiais Lalamove v3 ──

      case 'POD_STATUS_CHANGED': {
        // Payload: { orderId, data: { stopId, stopIndex, status, image, deliveredAt } }
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          const podData = payload.data || {};
          const stopStatus = (podData.status as string | undefined)?.toUpperCase() || 'PENDING';
          const stopIndex = typeof podData.stopIndex === 'number' ? podData.stopIndex : null;
          const stopId = (podData as Record<string, unknown>).stopId as string | undefined;
          const imageUrl = (podData as Record<string, unknown>).image as string | undefined;
          const deliveredAt = (podData as Record<string, unknown>).deliveredAt as string | undefined;

          if (orderUuid) {
            const normalizedPod = ['delivered','failed','pending'].includes(stopStatus.toLowerCase())
              ? stopStatus.toLowerCase() : 'pending';
            const deliveredIso = deliveredAt ?? ((stopStatus === 'DELIVERED' || stopStatus === 'SIGNED') ? new Date().toISOString() : null);
            const updates: Record<string, unknown> = {
              pod_status: normalizedPod,
              pod_image_url: imageUrl ?? null,
              pod_delivered_at: deliveredIso,
            };
            let q = supabase.from('lalamove_stops').update(updates).eq('order_id', orderUuid);
            if (stopIndex !== null) q = q.eq('stop_index', stopIndex);
            const { error: podErr } = await q;
            if (podErr) logger.error(`[Webhook] POD update failed: ${podErr.message}`);

            // Etapa 2: persistir POD granular em lalamove_stop_proofs (upsert por stop_id)
            let stopRow: { id: string } | null = null;
            if (stopIndex !== null) {
              const { data: sRow } = await supabase.from('lalamove_stops')
                .select('id').eq('order_id', orderUuid).eq('stop_index', stopIndex).maybeSingle();
              stopRow = sRow as { id: string } | null;
            }
            if (stopRow?.id) {
              const { error: proofErr } = await supabase.from('lalamove_stop_proofs').upsert({
                stop_id: stopRow.id,
                order_id: orderUuid,
                pod_status: normalizedPod,
                pod_image_url: imageUrl ?? null,
                pod_delivered_at: deliveredIso,
                raw_payload: payload as unknown as Record<string, unknown>,
              }, { onConflict: 'stop_id' });
              if (proofErr) logger.error(`[Webhook] stop_proof POD upsert failed: ${proofErr.message}`);
            }

            if (stopStatus === 'DELIVERED' || stopStatus === 'SIGNED') {
              await supabase.from('lalamove_orders').update({ pod_received: true }).eq('id', orderUuid);
            }

            await supabase.from('lalamove_status_history').insert({
              order_id: orderUuid,
              status: stopStatus === 'FAILED' ? 'FAILED' : 'PICKED_UP',
              change_reason: `POD_STATUS_CHANGED: ${stopStatus}`,
              metadata: { stopId, stopIndex, image: imageUrl, deliveredAt },
            });

            if (stopStatus === 'FAILED') {
              await sendNotification('POD_FAILED', 'Falha na Prova de Entrega',
                `Pedido ${lalamoveOrderId} — stop ${stopIndex ?? '?'} não pôde ser entregue.`,
                'WARNING', undefined, orderUuid);
            }
            logger.log(`[Webhook] POD ${stopStatus} for order ${lalamoveOrderId} stop ${stopIndex}`);
          }
        }
        break;
      }

      case 'POP_STATUS_CHANGED': {
        // Payload: { orderId, data: { stopId, stopIndex, image, pickedUpAt } }
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          const popData = payload.data || {};
          const stopIndex = typeof popData.stopIndex === 'number' ? popData.stopIndex : 0;
          const stopId = (popData as Record<string, unknown>).stopId as string | undefined;
          const imageUrl = (popData as Record<string, unknown>).image as string | undefined;
          const pickedUpAt = (popData as Record<string, unknown>).pickedUpAt as string | undefined;

          if (orderUuid) {
            // Etapa 2: persistir POP granular em lalamove_stop_proofs
            const { data: sRow } = await supabase.from('lalamove_stops')
              .select('id').eq('order_id', orderUuid).eq('stop_index', stopIndex).maybeSingle();
            if (sRow?.id) {
              const { error: proofErr } = await supabase.from('lalamove_stop_proofs').upsert({
                stop_id: (sRow as { id: string }).id,
                order_id: orderUuid,
                pop_status: 'picked_up',
                pop_image_url: imageUrl ?? null,
                pop_picked_up_at: pickedUpAt ?? new Date().toISOString(),
                raw_payload: payload as unknown as Record<string, unknown>,
              }, { onConflict: 'stop_id' });
              if (proofErr) logger.error(`[Webhook] stop_proof POP upsert failed: ${proofErr.message}`);
            }

            await supabase.from('lalamove_status_history').insert({
              order_id: orderUuid,
              status: 'PICKED_UP',
              change_reason: 'POP_STATUS_CHANGED',
              metadata: { stopId, stopIndex, pop_image_url: imageUrl, picked_up_at: pickedUpAt },
            });
            logger.log(`[Webhook] POP received for order ${lalamoveOrderId} stop ${stopIndex}`);
          }
        }
        break;
      }

      case 'DELIVERY_CODE_STATUS_CHANGED': {
        // Payload: { orderId, data: { code, status } } — Etapa 3 adiciona colunas dedicadas.
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          const codeData = payload.data || {};
          const code = (codeData as Record<string, unknown>).code as string | undefined;
          const codeStatus = ((codeData as Record<string, unknown>).status as string | undefined)?.toUpperCase();

          if (orderUuid) {
            await supabase.from('lalamove_status_history').insert({
              order_id: orderUuid,
              status: 'ON_GOING',
              change_reason: `DELIVERY_CODE_STATUS_CHANGED: ${codeStatus ?? 'UNKNOWN'}`,
              metadata: { delivery_code: code, delivery_code_status: codeStatus },
            });
            logger.log(`[Webhook] Delivery code ${code} status=${codeStatus} for order ${lalamoveOrderId}`);
          }
        }
        break;
      }

      case 'ORDER_REPLACED': {
        // Payload: { orderId (novo), data: { previousOrderId | oldOrderId, reason } }
        // Etapa 4: registra trilha de auditoria idempotente em `lalamove_order_replacements`.
        const replaceData = (payload.data ?? {}) as Record<string, unknown>;
        const previousOrderId = (replaceData.previousOrderId as string | undefined)
          ?? (replaceData.oldOrderId as string | undefined);
        const reason = (replaceData.reason as string | undefined) ?? null;

        if (!previousOrderId || !lalamoveOrderId) {
          logger.log('[Webhook] ORDER_REPLACED: payload incompleto', { previousOrderId, lalamoveOrderId });
          break;
        }

        if (previousOrderId === lalamoveOrderId) {
          logger.log('[Webhook] ORDER_REPLACED: IDs iguais, ignorando', { lalamoveOrderId });
          break;
        }

        // Resolve o UUID pelo ID anterior; se já foi migrado antes, tenta pelo novo (idempotência).
        let orderUuid = await getOrderUuid(previousOrderId);
        if (!orderUuid) {
          orderUuid = await getOrderUuid(lalamoveOrderId);
        }

        if (!orderUuid) {
          logger.log(`[Webhook] ORDER_REPLACED: pedido não encontrado (${previousOrderId} -> ${lalamoveOrderId})`);
          break;
        }

        // Trilha de auditoria idempotente (unique em previous+new).
        const { error: auditError } = await supabase
          .from('lalamove_order_replacements')
          .upsert(
            {
              order_id: orderUuid,
              previous_lalamove_id: previousOrderId,
              new_lalamove_id: lalamoveOrderId,
              reason,
              raw_payload: payload as unknown as Record<string, unknown>,
            },
            { onConflict: 'previous_lalamove_id,new_lalamove_id', ignoreDuplicates: true },
          );

        if (auditError) {
          logger.error('[Webhook] ORDER_REPLACED: falha ao gravar trilha', auditError);
        }

        // Atualiza lalamove_id somente se ainda estiver no ID antigo (evita sobrescrever migrações posteriores).
        const { data: updated, error: updateError } = await supabase
          .from('lalamove_orders')
          .update({ lalamove_id: lalamoveOrderId, updated_at: new Date().toISOString() })
          .eq('id', orderUuid)
          .eq('lalamove_id', previousOrderId)
          .select('id');

        if (updateError) {
          logger.error('[Webhook] ORDER_REPLACED: falha ao atualizar lalamove_id', updateError);
        }

        // Só registra no histórico quando a substituição foi efetivamente aplicada agora.
        if (updated && updated.length > 0) {
          await supabase.from('lalamove_status_history').insert({
            order_id: orderUuid,
            status: 'ON_GOING',
            change_reason: `ORDER_REPLACED: ${previousOrderId} -> ${lalamoveOrderId}`,
            metadata: { previous_order_id: previousOrderId, new_order_id: lalamoveOrderId, reason },
          });
          logger.log(`[Webhook] Order replaced: ${previousOrderId} -> ${lalamoveOrderId}`);
        } else {
          logger.log(`[Webhook] ORDER_REPLACED: já processado anteriormente (${previousOrderId} -> ${lalamoveOrderId})`);
        }
        break;
      }

      case 'ORDER_EDITED': {
        // Payload: { orderId, data: { stops?, priceBreakdown? } }
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          const editData = payload.data || {};
          const priceBreakdown = (editData as Record<string, unknown>).priceBreakdown as Record<string, unknown> | undefined;

          if (orderUuid) {
            if (priceBreakdown?.total !== undefined) {
              const totalNum = Number(priceBreakdown.total);
              if (!Number.isNaN(totalNum)) {
                await supabase.from('lalamove_orders')
                  .update({ total_cost: totalNum, updated_at: new Date().toISOString() })
                  .eq('id', orderUuid);
              }
            }
            await supabase.from('lalamove_status_history').insert({
              order_id: orderUuid,
              status: 'ON_GOING',
              change_reason: 'ORDER_EDITED',
              metadata: { priceBreakdown, stops: (editData as Record<string, unknown>).stops },
            });
            logger.log(`[Webhook] Order ${lalamoveOrderId} edited`);
          }
        }
        break;
      }

      case 'ORDER_CREATED': {
        // Pedidos originados fora do app (ex.: dashboard Lalamove).
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          if (!orderUuid) {
            const createData = payload.data || {};
            logger.log(`[Webhook] External ORDER_CREATED ${lalamoveOrderId} — not in our DB, registering minimal record`);
            await supabase.from('lalamove_orders').insert({
              lalamove_id: lalamoveOrderId,
              status: 'ASSIGNING_DRIVER',
              pickup_address: (createData as Record<string, unknown>).pickupAddress as string ?? 'External',
              delivery_address: (createData as Record<string, unknown>).deliveryAddress as string ?? 'External',
              customer_name: (createData as Record<string, unknown>).customerName as string ?? 'External',
              customer_phone: (createData as Record<string, unknown>).customerPhone as string ?? '',
              vehicle_type: 'MOTORCYCLE',
              quotation_id: (createData as Record<string, unknown>).quotationId as string ?? null,
              share_link: (createData as Record<string, unknown>).shareLink as string ?? null,
              tags: ['external'],
              metadata: createData,
            });
          } else {
            logger.log(`[Webhook] ORDER_CREATED ${lalamoveOrderId} already known internally`);
          }
        }
        break;
      }

      case 'ORDER_AMOUNT_CHANGED': {
        // Payload: { orderId, data: { priceBreakdown, priorityFee } }
        if (lalamoveOrderId) {
          const orderUuid = await getOrderUuid(lalamoveOrderId);
          const amountData = payload.data || {};
          const priceBreakdown = (amountData as Record<string, unknown>).priceBreakdown as Record<string, unknown> | undefined;
          const priorityFee = (amountData as Record<string, unknown>).priorityFee as string | number | undefined;

          if (orderUuid) {
            if (priceBreakdown?.total !== undefined) {
              const totalNum = Number(priceBreakdown.total);
              if (!Number.isNaN(totalNum)) {
                await supabase.from('lalamove_orders')
                  .update({ total_cost: totalNum, updated_at: new Date().toISOString() })
                  .eq('id', orderUuid);
              }
            }
            await supabase.from('lalamove_status_history').insert({
              order_id: orderUuid,
              status: 'ON_GOING',
              change_reason: `ORDER_AMOUNT_CHANGED (priorityFee=${priorityFee ?? 'n/a'})`,
              metadata: { priceBreakdown, priorityFee },
            });
            logger.log(`[Webhook] Order ${lalamoveOrderId} amount changed. Priority fee: ${priorityFee}`);
          }
        }
        break;
      }

      case 'WALLET_BALANCE_CHANGED': {
        // Payload: { data: { balance, currency, delta, reason } } — sem orderId.
        const walletData = payload.data || {};
        const balance = (walletData as Record<string, unknown>).balance as string | number | undefined;
        const currency = (walletData as Record<string, unknown>).currency as string | undefined;
        const delta = (walletData as Record<string, unknown>).delta as string | number | undefined;
        logger.log(`[Webhook] Wallet balance changed: ${balance} ${currency ?? ''} (delta=${delta})`);

        const balanceNum = Number(balance ?? NaN);
        // Alerta se saldo baixo (< 50 unidades da moeda)
        if (!Number.isNaN(balanceNum) && balanceNum < 50) {
          await sendNotification('WALLET_LOW_BALANCE', 'Saldo Lalamove Baixo',
            `Saldo atual ${balanceNum} ${currency ?? ''}. Faça um top-up para evitar bloqueio de pedidos.`,
            'WARNING');
        }
        break;
      }

      default:
        logger.log(`[Webhook] Unhandled event type: ${eventType}`);
    }
    
    // Mark processed
    await supabase.from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', webhookId);
    
    return new Response(
      JSON.stringify({ success: true, webhookId, eventType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("[Webhook] Internal Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
