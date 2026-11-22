// ============================================================================
// EDGE FUNCTION: Job Worker
// Descrição: Processa jobs da fila de forma assíncrona
// Versão: 1.0.0
// Data: 2025-12-26
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logger } from '../_shared/logger.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================================
// TIPOS
// ============================================================================

// Espelha o CHECK de job_queue.type (20261122130100_geo_foundation.sql:271).
// Tipos sem caso no switch caem no default e queimam as 3 tentativas.
type JobType =
  | 'webhook' | 'notification' | 'evaluation' | 'bitrix_sync'
  | 'email' | 'whatsapp' | 'slack'
  | 'lalamove_sync' | 'pod_fetch'
  | 'geo_backfill' | 'route_plan' | 'eta_refresh';

interface JobPayload {
  jobId: string;
  type: JobType;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

interface JobResult {
  success: boolean;
  result?: any;
  error?: string;
  stack?: string;
  duration_ms?: number;
}

type NotificationChannel = 'email' | 'whatsapp' | 'slack';

// ============================================================================
// HELPERS
// ============================================================================

function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

function internalLogger(level: 'info' | 'warn' | 'error', message: string, metadata?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...metadata
  };
  
  if (level === 'error') {
    logger.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    logger.warn(JSON.stringify(logEntry));
  } else {
    logger.info(JSON.stringify(logEntry));
  }
}

// ============================================================================
// PROCESSADORES DE JOBS POR TIPO
// ============================================================================

async function processWebhook(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing webhook job', { payload });
  
  // Chamar Edge Function evaluate-driver
  const { data, error } = await supabase.functions.invoke('evaluate-driver', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

async function processNotification(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing notification job', { payload });
  
  // Chamar Edge Function send-notification
  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

async function processEvaluation(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing evaluation job', { payload });
  
  // Chamar Edge Function evaluate-driver
  const { data, error } = await supabase.functions.invoke('evaluate-driver', {
    body: {
      driverId: payload.driverId,
      orderId: payload.orderId,
      ...payload
    }
  });
  
  if (error) throw error;
  
  return data;
}

async function processBitrixSync(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing Bitrix24 sync job', { payload });
  
  // Chamar Edge Function bitrix24-sync
  const { data, error } = await supabase.functions.invoke('bitrix24-sync', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

async function processChannelNotification(
  supabase: any,
  channel: NotificationChannel,
  payload: any,
): Promise<any> {
  internalLogger('info', `Processing ${channel} notification job`, { payload });

  const notificationBody = {
    alert_id: payload.alert_id ?? payload.alertId ?? crypto.randomUUID(),
    type: payload.type ?? channel,
    severity: payload.severity ?? 'INFO',
    title: payload.title ?? `Notificação ${channel}`,
    message: payload.message ?? payload.body ?? '',
    order_id: payload.order_id ?? payload.orderId,
    driver_id: payload.driver_id ?? payload.driverId,
    metadata: {
      ...payload.metadata,
      requested_channel: channel,
      recipient: payload.recipient ?? payload.email ?? payload.phone ?? payload.channel,
    },
  };

  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: notificationBody,
  });

  if (error) throw error;

  return data;
}

// ============================================================================
// HANDLERS DE SYNC / GEO
// ============================================================================

/** Resposta JSON de uma edge function invocada por dentro do worker. */
async function invokeEdge(supabase: any, fn: string, body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // FunctionsHttpError guarda o corpo do erro em context — sem isso o log fica "non-2xx".
    let detail = error.message ?? String(error);
    try {
      const raw = await (error as { context?: Response }).context?.text?.();
      if (raw) detail = raw.slice(0, 800);
    } catch { /* corpo indisponível */ }
    throw new Error(`${fn}: ${detail}`);
  }
  return data;
}

/**
 * `lalamove_sync` — puxa da API Lalamove os pedidos com status ativo.
 * payload.orderId → sincroniza só esse pedido; sem ele, varre todos os ativos.
 */
async function processLalamoveSync(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing lalamove_sync job', { payload });

  const orderId = payload.orderId ?? payload.lalamove_id ?? payload.order_id;
  if (orderId) {
    return await invokeEdge(supabase, 'lalamove-api', {
      action: 'fetch-order',
      orderId: String(orderId),
    });
  }

  return await invokeEdge(supabase, 'lalamove-api', { action: 'sync' });
}

/**
 * `pod_fetch` — busca no provedor a prova de entrega de um pedido.
 * A gravação granular (lalamove_stops / lalamove_stop_proofs) é feita pelo
 * lalamove-webhook nos eventos POD_STATUS_CHANGED / POP_STATUS_CHANGED;
 * aqui reidratamos o pedido e reportamos o estado de POD observado.
 */
async function processPodFetch(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing pod_fetch job', { payload });

  const orderId = payload.orderId ?? payload.lalamove_id ?? payload.order_id;
  if (!orderId) {
    throw new Error('pod_fetch exige payload.orderId (lalamove_id ou uuid do pedido)');
  }

  const key = String(orderId);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

  // Aceita uuid interno ou lalamove_id e resolve sempre o lalamove_id.
  const { data: order, error: orderErr } = await supabase
    .from('lalamove_orders')
    .select('id, lalamove_id, status, pod_received')
    .eq(isUuid ? 'id' : 'lalamove_id', key)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) throw new Error(`pod_fetch: pedido ${key} não encontrado em lalamove_orders`);
  if (!order.lalamove_id) throw new Error(`pod_fetch: pedido ${key} sem lalamove_id — impossível consultar o provedor`);

  const synced = await invokeEdge(supabase, 'lalamove-api', {
    action: 'fetch-order',
    orderId: order.lalamove_id,
  });

  const { data: stops } = await supabase
    .from('lalamove_stops')
    .select('stop_index, pod_status, pod_image_url, pod_delivered_at')
    .eq('order_id', order.id)
    .order('stop_index', { ascending: true });

  return {
    order_id: order.id,
    lalamove_id: order.lalamove_id,
    status: order.status,
    pod_received: order.pod_received,
    synced,
    stops: stops ?? [],
  };
}

/**
 * `geo_backfill` — geocodificação permanente em lote.
 * payload.addresses: [{ address } | { structured, ... }] ou strings;
 * payload.persist (default true) usa o SKU permanente (permite guardar coordenada).
 * Provedor desligado/não configurado NÃO falha o job: devolve `skipped`.
 * Etapa 25: usa `geocode-batch` do geo-gateway (até 50 por chamada) quando o provedor
 * suporta; se o gateway devolver 501 (provedor sem lote), cai no laço unitário.
 */
async function processGeoBackfill(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing geo_backfill job', { payload });

  const raw: any[] = Array.isArray(payload.addresses)
    ? payload.addresses
    : (payload.address ? [payload.address] : []);

  if (raw.length === 0) {
    throw new Error('geo_backfill exige payload.addresses[] ou payload.address');
  }

  const persist = payload.persist !== false;
  const limited = raw.slice(0, 100);

  // ── caminho em lote (etapa 25) ─────────────────────────────────────────────
  // Só vale a pena quando há mais de um endereço; um item só é mais barato no unitário.
  if (limited.length > 1) {
    const batches: any[][] = [];
    for (let i = 0; i < limited.length; i += 50) batches.push(limited.slice(i, i + 50));

    const results: Array<Record<string, unknown>> = [];
    let batchOk = true;
    try {
      for (const chunk of batches) {
        const queries = chunk.map((item) => {
          if (typeof item === 'string') return { address: item };
          if (item?.structured) return { structured: item.structured };
          if (item?.address) return { address: item.address };
          return { address: '' }; // validado depois: o schema recusa item sem endereço
        });
        const body: Record<string, unknown> = { action: 'geocode-batch', queries, persist };
        if (payload.country) body.country = payload.country;
        if (payload.language) body.language = payload.language;
        const data = await invokeEdge(supabase, 'geo-gateway', body);
        const items: any[] = Array.isArray(data) ? data : (data?.items ?? []);
        items.forEach((it, idx) => {
          const best = it?.addresses?.[0];
          results.push({
            input: queries[idx]?.address ?? queries[idx]?.structured ?? null,
            status: best?.location ? 'geocoded' : 'not_found',
            formatted: best?.formatted ?? null,
            location: best?.location ?? null,
            place_id: best?.place_id ?? null,
            provider: best?.provider ?? null,
            precision: best?.precision ?? null,
          });
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 501 = provedor sem lote; qualquer outro erro cai no unitário, que isola a falha.
      batchOk = false;
      internalLogger('warn', 'geocode-batch indisponível, usando laço unitário', { error: msg });
    }

    if (batchOk) {
      const geocoded = results.filter((r) => r.status === 'geocoded').length;
      const notFound = results.filter((r) => r.status === 'not_found').length;
      return {
        requested: raw.length, geocoded, not_found: notFound, skipped: 0, failed: 0,
        mode: 'batch', batches: batches.length, results,
      };
    }
  }

  const results: Array<Record<string, unknown>> = [];
  let done = 0, skipped = 0, failed = 0;

  for (const item of limited) {
    const body: Record<string, unknown> = { action: 'geocode', persist };
    if (typeof item === 'string') {
      body.address = item;
    } else if (item?.structured) {
      body.structured = item.structured;
    } else if (item?.address) {
      body.address = item.address;
    } else {
      results.push({ input: item, status: 'invalid', error: 'item sem address nem structured' });
      failed++;
      continue;
    }
    if (payload.country) body.country = payload.country;
    if (payload.language) body.language = payload.language;

    try {
      const data = await invokeEdge(supabase, 'geo-gateway', body);
      const best = Array.isArray(data) ? data[0] : data;
      results.push({
        input: body.address ?? body.structured,
        status: best?.location ? 'geocoded' : 'not_found',
        formatted: best?.formatted ?? null,
        location: best?.location ?? null,
        place_id: best?.place_id ?? null,
        provider: best?.provider ?? null,
        precision: best?.precision ?? null,
      });
      done++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Provedor desligado / orçamento estourado / rate limit: não é falha do job.
      const isSkip = /GEO_UNAVAILABLE|est[áa] desligada|Nenhum provedor|RATE_LIMITED|429/i.test(msg);
      results.push({ input: body.address ?? body.structured, status: isSkip ? 'skipped' : 'error', error: msg });
      if (isSkip) skipped++; else failed++;
    }
  }

  return { requested: raw.length, geocoded: done, skipped, failed, mode: 'single', results };
}

/** Coordenada da próxima parada: lalamove_stops[index] com fallback nas colunas do pedido. */
async function resolveNextStop(
  supabase: any,
  tracking: { order_id: string; next_stop_index: number | null },
): Promise<{ lat: number; lng: number } | null> {
  const idx = tracking.next_stop_index ?? 0;

  const { data: stop } = await supabase
    .from('lalamove_stops')
    .select('latitude, longitude')
    .eq('order_id', tracking.order_id)
    .eq('stop_index', idx)
    .maybeSingle();

  if (stop?.latitude != null && stop?.longitude != null) {
    return { lat: Number(stop.latitude), lng: Number(stop.longitude) };
  }

  const { data: order } = await supabase
    .from('lalamove_orders')
    .select('pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude')
    .eq('id', tracking.order_id)
    .maybeSingle();

  if (!order) return null;
  const lat = idx === 0 ? order.pickup_latitude : order.delivery_latitude;
  const lng = idx === 0 ? order.pickup_longitude : order.delivery_longitude;
  if (lat == null || lng == null) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

/** Aceita uuid interno ou lalamove_id e devolve sempre o uuid de lalamove_orders. */
async function resolveOrderUuid(supabase: any, raw: unknown): Promise<string | null> {
  const key = String(raw);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  const { data } = await supabase
    .from('lalamove_orders')
    .select('id')
    .eq(isUuid ? 'id' : 'lalamove_id', key)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * `route_plan` — Directions `driving-traffic` do motorista até a próxima parada.
 * Grava `expected_route` como array [{lat,lng}] — formato que
 * `geo_point_to_polyline_m` (trigger geo_evaluate_tracking) lê como polyline.
 * payload.orderId (uuid ou lalamove_id) ou payload.trackingId; sem alvo, varre os ativos.
 */
async function processRoutePlan(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing route_plan job', { payload });

  const orderUuid = payload.orderId ? await resolveOrderUuid(supabase, payload.orderId) : null;
  if (payload.orderId && !orderUuid) {
    throw new Error(`route_plan: pedido ${payload.orderId} não encontrado em lalamove_orders`);
  }

  const trackingQuery = supabase
    .from('active_tracking')
    .select('id, order_id, driver_id, next_stop_index, current_latitude, current_longitude')
    .eq('tracking_status', 'ACTIVE');

  if (payload.trackingId) trackingQuery.eq('id', payload.trackingId);
  if (orderUuid) trackingQuery.eq('order_id', orderUuid);
  if (payload.driverId) trackingQuery.eq('driver_id', payload.driverId);

  const { data: trackings, error } = await trackingQuery.limit(payload.limit ?? 50);
  if (error) throw error;
  if (!trackings?.length) return { planned: 0, skipped: 0, failed: 0, results: [] };

  const results: Array<Record<string, unknown>> = [];
  let planned = 0, skipped = 0, failed = 0;

  for (const t of trackings) {
    if (t.current_latitude == null || t.current_longitude == null) {
      results.push({ tracking_id: t.id, status: 'skipped', error: 'sem posição do motorista' });
      skipped++;
      continue;
    }
    const stop = await resolveNextStop(supabase, t);
    if (!stop) {
      results.push({ tracking_id: t.id, status: 'skipped', error: 'próxima parada sem coordenada' });
      skipped++;
      continue;
    }

    try {
      const route = await invokeEdge(supabase, 'geo-gateway', {
        action: 'route',
        origin: { lat: Number(t.current_latitude), lng: Number(t.current_longitude) },
        destination: stop,
      });

      const polyline: Array<{ lat: number; lng: number }> = route?.polyline ?? [];
      if (polyline.length === 0) {
        results.push({ tracking_id: t.id, status: 'skipped', error: 'rota vazia' });
        skipped++;
        continue;
      }

      const { error: updErr } = await supabase
        .from('active_tracking')
        .update({
          expected_route: polyline,
          route_provider: route.provider ?? 'mapbox',
          route_distance_m: route.distance_m ?? null,
          route_duration_s: route.duration_s ?? null,
          route_computed_at: new Date().toISOString(),
        })
        .eq('id', t.id);

      if (updErr) throw updErr;

      results.push({
        tracking_id: t.id,
        status: 'planned',
        points: polyline.length,
        distance_m: route.distance_m,
        duration_s: route.duration_s,
        provider: route.provider,
      });
      planned++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isSkip = /GEO_UNAVAILABLE|est[áa] desligada|Nenhum provedor|RATE_LIMITED|429/i.test(msg);
      results.push({ tracking_id: t.id, status: isSkip ? 'skipped' : 'error', error: msg });
      if (isSkip) skipped++; else failed++;
    }
  }

  return { planned, skipped, failed, results };
}

/**
 * `eta_refresh` — Matrix 1×1 `driving-traffic` motorista → próxima parada.
 * `eta_minutes = ceil(duration_s / 60)`; provedor desligado mantém a estimativa
 * local já calculada por `geo_evaluate_tracking` (não sobrescreve com NULL).
 */
async function processEtaRefresh(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing eta_refresh job', { payload });

  const orderUuid = payload.orderId ? await resolveOrderUuid(supabase, payload.orderId) : null;
  if (payload.orderId && !orderUuid) {
    throw new Error(`eta_refresh: pedido ${payload.orderId} não encontrado em lalamove_orders`);
  }

  const trackingQuery = supabase
    .from('active_tracking')
    .select('id, order_id, driver_id, next_stop_index, current_latitude, current_longitude, eta_minutes')
    .eq('tracking_status', 'ACTIVE');

  if (payload.trackingId) trackingQuery.eq('id', payload.trackingId);
  if (orderUuid) trackingQuery.eq('order_id', orderUuid);
  if (payload.driverId) trackingQuery.eq('driver_id', payload.driverId);

  const { data: trackings, error } = await trackingQuery.limit(payload.limit ?? 50);
  if (error) throw error;
  if (!trackings?.length) return { refreshed: 0, skipped: 0, failed: 0, results: [] };

  const results: Array<Record<string, unknown>> = [];
  let refreshed = 0, skipped = 0, failed = 0;

  for (const t of trackings) {
    if (t.current_latitude == null || t.current_longitude == null) {
      skipped++;
      results.push({ tracking_id: t.id, status: 'skipped', error: 'sem posição do motorista' });
      continue;
    }
    const stop = await resolveNextStop(supabase, t);
    if (!stop) {
      skipped++;
      results.push({ tracking_id: t.id, status: 'skipped', error: 'próxima parada sem coordenada' });
      continue;
    }

    try {
      // Mapbox Matrix recusa 1x1 (mínimo 2 elementos) — usar route com tráfego.
      const route = await invokeEdge(supabase, 'geo-gateway', {
        action: 'route',
        origin: { lat: Number(t.current_latitude), lng: Number(t.current_longitude) },
        destination: stop,
        traffic: true,
      });

      const durationS = route?.duration_traffic_s ?? route?.duration_s;
      if (durationS == null) {
        skipped++;
        results.push({ tracking_id: t.id, status: 'skipped', error: 'rota sem duração' });
        continue;
      }

      const etaMinutes = Math.max(1, Math.ceil(Number(durationS) / 60));

      const { error: updErr } = await supabase
        .from('active_tracking')
        .update({
          eta_minutes: etaMinutes,
          eta_updated_at: new Date().toISOString(),
          eta_provider: route.provider ?? 'mapbox',
        })
        .eq('id', t.id);

      if (updErr) throw updErr;

      refreshed++;
      results.push({
        tracking_id: t.id,
        status: 'refreshed',
        eta_minutes: etaMinutes,
        duration_s: durationS,
        previous_eta_minutes: t.eta_minutes,
        provider: route.provider,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isSkip = /GEO_UNAVAILABLE|est[áa] desligada|Nenhum provedor|RATE_LIMITED|429/i.test(msg);
      results.push({ tracking_id: t.id, status: isSkip ? 'skipped' : 'error', error: msg });
      if (isSkip) skipped++; else failed++;
    }
  }

  return { refreshed, skipped, failed, results };
}

// ============================================================================
// PROCESSADOR PRINCIPAL
// ============================================================================

async function processJob(jobPayload: JobPayload): Promise<JobResult> {
  const startTime = Date.now();
  const supabase = createSupabaseClient();
  
  internalLogger('info', 'Starting job processing', {
    jobId: jobPayload.jobId,
    type: jobPayload.type
  });
  
  try {
    let result: any;
    
    // Processar baseado no tipo
    switch (jobPayload.type) {
      case 'webhook':
        result = await processWebhook(supabase, jobPayload.payload);
        break;
        
      case 'notification':
        result = await processNotification(supabase, jobPayload.payload);
        break;
        
      case 'evaluation':
        result = await processEvaluation(supabase, jobPayload.payload);
        break;
        
      case 'bitrix_sync':
        result = await processBitrixSync(supabase, jobPayload.payload);
        break;
        
      case 'email':
        result = await processChannelNotification(supabase, 'email', jobPayload.payload);
        break;
        
      case 'whatsapp':
        result = await processChannelNotification(supabase, 'whatsapp', jobPayload.payload);
        break;
        
      case 'slack':
        result = await processChannelNotification(supabase, 'slack', jobPayload.payload);
        break;

      case 'lalamove_sync':
        result = await processLalamoveSync(supabase, jobPayload.payload);
        break;

      case 'pod_fetch':
        result = await processPodFetch(supabase, jobPayload.payload);
        break;

      case 'geo_backfill':
        result = await processGeoBackfill(supabase, jobPayload.payload);
        break;

      case 'route_plan':
        result = await processRoutePlan(supabase, jobPayload.payload);
        break;

      case 'eta_refresh':
        result = await processEtaRefresh(supabase, jobPayload.payload);
        break;

      default: {
        // Inalcançável enquanto type for JobType: o CHECK do banco cobre os 12 tipos.
        const unknownType: never = jobPayload.type;
        throw new Error(`Unknown job type: ${unknownType}`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    internalLogger('info', 'Job completed successfully', {
      jobId: jobPayload.jobId,
      type: jobPayload.type,
      duration_ms: duration
    });
    
    // Marcar job como completo
    await supabase.rpc('mark_job_completed', {
      p_job_id: jobPayload.jobId,
      p_result: result
    });
    
    return {
      success: true,
      result,
      duration_ms: duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    internalLogger('error', 'Job failed', {
      jobId: jobPayload.jobId,
      type: jobPayload.type,
      error: errorMessage,
      stack: errorStack,
      duration_ms: duration
    });
    
    // Marcar job como falhado (com retry automático)
    await supabase.rpc('mark_job_failed', {
      p_job_id: jobPayload.jobId,
      p_error_message: errorMessage,
      p_error_stack: errorStack
    });
    
    return {
      success: false,
      error: errorMessage,
      stack: errorStack,
      duration_ms: duration
    };
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
      }
    });
  }
  
  try {
    // Verificar autenticação (apenas service role ou autenticado)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    
    // Parse request body
    const jobPayload: JobPayload = await req.json();
    
    // Validar payload
    if (!jobPayload.jobId || !jobPayload.type || !jobPayload.payload) {
      throw new Error('Invalid job payload: missing required fields');
    }
    
    internalLogger('info', 'Job worker invoked', {
      jobId: jobPayload.jobId,
      type: jobPayload.type
    });
    
    // Processar job
    const result = await processJob(jobPayload);
    
    const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];
    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowedOrigins[0]
        }
      }
    );
    
  } catch (error) {
    logger.error('Job worker error:', error);
    const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowedOrigins[0]
        }
      }
    );
  }
});

// ============================================================================
// FIM DA EDGE FUNCTION
// ============================================================================
