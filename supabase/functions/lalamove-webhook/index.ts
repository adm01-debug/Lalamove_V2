import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.190.0/encoding/hex.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";

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
    const computedSignature = new TextDecoder().decode(encode(new Uint8Array(signatureBuffer)));
    const signatureToCompare = signature.toLowerCase().replace(/^sha256=/, '');
    const isValid = computedSignature.toLowerCase() === signatureToCompare;
    
    if (!isValid) logger.log(`[Webhook] Signature mismatch. Expected: ${computedSignature}, Received: ${signatureToCompare}`);
    return { valid: isValid, reason: isValid ? 'Signature valid' : 'Signature mismatch' };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[Webhook] HMAC validation error:', errorMsg);
    return { valid: false, reason: `Validation error: ${errorMsg}` };
  }
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
      JSON.stringify({ error: "Rate limit exceeded", retryAfter: rateLimit.resetIn, blocked: rateLimit.blocked }),
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
        JSON.stringify({ error: 'Invalid signature', reason: hmacResult.reason }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const webhookSchema = z.object({
      event: z.string(),
      orderId: z.string().optional().nullable(),
      timestamp: z.string().optional().nullable(),
      data: z.any().optional(),
    }).passthrough();

    const parseResult = webhookSchema.safeParse(JSON.parse(rawBody));
    if (!parseResult.success) {
      logger.error(`[Webhook] Invalid payload:`, parseResult.error.format());
      return new Response(
        JSON.stringify({ error: 'Invalid payload format' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = parseResult.data;
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
            await supabase.from('lalamove_orders').update({ driver_id: driverId, status: 'MATCHED' }).eq('id', orderUuid);
            logger.log(`[Webhook] Linked driver ${driverId} to order ${orderUuid}`);
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
            const mappedStatus = statusMapping[newLalamoveStatus?.toUpperCase()] || 'ON_GOING';
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
