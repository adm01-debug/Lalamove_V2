// ============================================================================
// EDGE FUNCTION: Job Worker
// Descrição: Processa jobs da fila de forma assíncrona
// Versão: 1.0.0
// Data: 2025-12-26
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logger } from '../_shared/logger.ts';
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

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

  // Etapa 39: modo lote por pedidos órfãos. Antes disto o job só geocodificava os
  // endereços que vinham no payload e devolvia o resultado — nada era gravado em
  // lalamove_orders, então pedido sem coordenada continuava sem coordenada para sempre.
  if (payload.source === 'orders') {
    return processGeoBackfillOrders(supabase, payload);
  }

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
      const isSkip = /GEO_UNAVAILABLE|GEO_BUDGET_EXCEEDED|est[áa] desligada|Nenhum provedor|RATE_LIMITED|429/i.test(msg);
      results.push({ input: body.address ?? body.structured, status: isSkip ? 'skipped' : 'error', error: msg });
      if (isSkip) skipped++; else failed++;
    }
  }

  return { requested: raw.length, geocoded: done, skipped, failed, mode: 'single', results };
}

/**
 * Etapa 39 — backfill de pedidos sem coordenada.
 *
 * Origem: pedidos de `bitrix24`/`uapi_import`/n8n anteriores à etapa 37, e pedidos em
 * que a cotação não devolveu `stops[].coordinates`. Sem ponto, o `/map` não desenha o
 * pedido e o cálculo de distância não roda.
 *
 * Regras de custo (o geocode é cobrado por chamada):
 * - prioriza status ativo: quem ainda vai ser executado precisa do ponto primeiro;
 * - `limit` default 100, teto de 500 por execução — o cap diário do provedor é
 *   controlado pelo `geo-gateway` (orçamento + rate limit), não aqui;
 * - precisão `low`/`unknown` ou endereço sem número liga `requires_address_review`:
 *   coordenada aproximada não pode passar como exata num pedido que será despachado.
 */
export async function processGeoBackfillOrders(supabase: any, payload: any): Promise<any> {
  const limit = Math.min(Math.max(Number(payload.limit) || 100, 1), 500);
  const activeStatuses = ['ASSIGNING_DRIVER', 'ON_GOING', 'PICKED_UP', 'COMPLETED'];

  // Pedido entra no backfill quando falta o ponto de coleta OU o de entrega.
  const { data: orders, error } = await supabase
    .from('lalamove_orders')
    .select('id, pickup_address, delivery_address, pickup_latitude, delivery_latitude, lalamove_status, created_at')
    .or('pickup_latitude.is.null,delivery_latitude.is.null')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`geo_backfill orders: ${error.message}`);

  const rows = (orders ?? []) as Array<Record<string, any>>;
  // Ativos primeiro (sort estável), o resto na ordem em que veio.
  rows.sort((a, b) => {
    const ai = activeStatuses.includes(String(a.lalamove_status ?? '')) ? 0 : 1;
    const bi = activeStatuses.includes(String(b.lalamove_status ?? '')) ? 0 : 1;
    return ai - bi;
  });

  let geocoded = 0, notFound = 0, skipped = 0, failed = 0, review = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const order of rows) {
    const patch: Record<string, unknown> = {};
    let needsReview = false;

    for (const side of ['pickup', 'delivery'] as const) {
      if (order[`${side}_latitude`] != null) continue;
      const address = String(order[`${side}_address`] ?? '').trim();
      if (address.length < 5) { notFound++; continue; }

      try {
        const data = await invokeEdge(supabase, 'geo-gateway', {
          action: 'geocode',
          address,
          country: payload.country ?? 'br',
          language: payload.language ?? 'pt',
          limit: 1,
        });
        const best = Array.isArray(data) ? data[0] : data;
        const loc = best?.location;
        if (loc?.lat == null || loc?.lng == null) { notFound++; continue; }

        patch[`${side}_latitude`] = loc.lat;
        patch[`${side}_longitude`] = loc.lng;
        if (best?.place_id) patch[`${side}_place_id`] = best.place_id;
        patch.geocode_provider = best?.provider ?? null;
        patch.geocode_precision = best?.precision ?? null;
        if (best?.precision === 'low' || best?.precision === 'unknown') needsReview = true;
        if (!best?.components?.number) needsReview = true;
        geocoded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isSkip = /GEO_UNAVAILABLE|GEO_BUDGET_EXCEEDED|est[áa] desligada|Nenhum provedor|RATE_LIMITED|429/i.test(msg);
        if (isSkip) skipped++; else failed++;
        results.push({ order_id: order.id, side, status: isSkip ? 'skipped' : 'error', error: msg.slice(0, 200) });
      }
    }

    if (Object.keys(patch).length === 0) continue;
    if (needsReview) { patch.requires_address_review = true; review++; }

    const { error: upErr } = await supabase.from('lalamove_orders').update(patch).eq('id', order.id);
    if (upErr) {
      failed++;
      results.push({ order_id: order.id, status: 'update_error', error: upErr.message });
      continue;
    }
    results.push({ order_id: order.id, status: 'updated', fields: Object.keys(patch) });
  }

  return {
    requested: rows.length, geocoded, not_found: notFound,
    skipped, failed, requires_review: review, mode: 'orders', results,
  };
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
      // Etapa 49: `traffic:false` explícito no tracado. O polilinha de longo prazo
      // do pedido nao precisa de transito — ele e recalculado a cada 30 min e a
      // cada desvio, e o transito entra na conta pelo `eta_refresh`, que liga
      // `traffic:true` so quando o ETA ja esta perto (<= 15 min). Passar `true`
      // aqui pagava a SKU com transito em toda recalculada sem mudar a decisao.
      const route = await invokeEdge(supabase, 'geo-gateway', {
        action: 'route',
        origin: { lat: Number(t.current_latitude), lng: Number(t.current_longitude) },
        destination: stop,
        traffic: false,
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
      const isSkip = /GEO_UNAVAILABLE|GEO_BUDGET_EXCEEDED|est[áa] desligada|Nenhum provedor|RATE_LIMITED|429/i.test(msg);
      results.push({ tracking_id: t.id, status: isSkip ? 'skipped' : 'error', error: msg });
      if (isSkip) skipped++; else failed++;
    }
  }

  return { planned, skipped, failed, results };
}

/**
 * Encaixa a posição do motorista na via com Map Matching (etapa 47) antes do
 * geofence/ETA. Sem isto o pino do GPS oscila 10–30 m e o trigger `near_stop_cycles`
 * dispara "motorista chegou" com o veículo ainda na quadra anterior.
 *
 * Usa os últimos pontos de `tracking_events` + a posição atual. Best-effort: erro,
 * menos de 2 pontos ou provedor fora do ar mantêm a posição crua do GPS.
 */
async function snapDriverPosition(
  supabase: any,
  tracking: { id: string; order_id: string; driver_id: string | null; current_latitude: unknown; current_longitude: unknown },
  radius_m = 25,
): Promise<{ lat: number; lng: number; confidence: number | null; snapped: boolean } | null> {
  const curLat = Number(tracking.current_latitude);
  const curLng = Number(tracking.current_longitude);
  if (!Number.isFinite(curLat) || !Number.isFinite(curLng)) return null;

  const { data: recent } = await supabase
    .from('tracking_events')
    .select('latitude, longitude, created_at')
    .eq('order_id', tracking.order_id)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false })
    .limit(9);

  const points = [
    ...((recent ?? []) as Array<{ latitude: unknown; longitude: unknown }>)
      .reverse()
      .map((e) => ({ lat: Number(e.latitude), lng: Number(e.longitude) })),
    { lat: curLat, lng: curLng },
  ].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (points.length < 2) return { lat: curLat, lng: curLng, confidence: null, snapped: false };

  try {
    const res = await invokeEdge(supabase, 'geo-gateway', { action: 'snap', points, radius_m });
    const snapped = (res?.points ?? []) as Array<{ lat: number; lng: number }>;
    const last = snapped[snapped.length - 1];
    const confidence = res?.confidence == null ? null : Number(res.confidence);
    // Confiança baixa = o trace não casa com nenhuma via (GPS saltando, pontos
    // simulados, túnel). Mover o pino nesse caso piora o geofence: mantém o cru.
    if (!last || !Number.isFinite(Number(last.lat)) || (confidence != null && confidence < 0.3)) {
      return { lat: curLat, lng: curLng, confidence, snapped: false };
    }
    return { lat: Number(last.lat), lng: Number(last.lng), confidence, snapped: true };
  } catch (err) {
    internalLogger('warn', 'snap indisponível; mantendo posição crua do GPS', {
      tracking_id: tracking.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { lat: curLat, lng: curLng, confidence: null, snapped: false };
  }
}

/**
 * ETA_DELAY (etapa 50 do plano Google): o ETA e o melhor lugar para prever atraso
 * — `geo_evaluate_tracking` so roda quando lat/lng/eta mudam, e o atraso depende
 * de `scheduled_at` versus `now() + eta_minutes`. Dispara pelo mesmo
 * `geo_emit_event` dos avisos de aproximacao, que ja deduplica por
 * (order_id, event_type, stop_index) e respeita `alert_configurations`.
 *
 * Teto: `alert_configurations.LATE_DELIVERY.min_interval_seconds` (default 900,
 * `20261121193000:24`). O dedup do `geo_emit_event` e por pedido+parada para
 * sempre, entao o alerta sai uma vez quando o atraso e detectado.
 */
export async function maybeEmitEtaDelay(
  supabase: any,
  args: {
    trackingId: string;
    orderId: string;
    driverId: string | null;
    stopIndex: number;
    etaMinutes: number;
    lat: number;
    lng: number;
    /** Instante de referência; injetável para testes de fronteira de tempo. */
    nowMs?: number;
  },
): Promise<boolean> {
  const { data: order } = await supabase
    .from('lalamove_orders')
    .select('scheduled_at, lalamove_id, driver_name, driver_plate, pickup_address, delivery_address, supplier_contact, pickup_contact_name, pickup_contact_phone, share_link, delivery_contact_name, delivery_contact_phone, status')
    .eq('id', args.orderId)
    .maybeSingle();
  if (!order?.scheduled_at) return false;

  // Alerta so faz sentido para pedido vivo: encerrado/cancelado nao atrasa.
  const status = String(order.status ?? '').toUpperCase();
  if (['COMPLETED', 'CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'DELIVERED'].includes(status)) return false;

  // Janela de tolerancia: `LATE_DELIVERY` das alert_configurations; sem linha,
  // cai no padrao do plano (15 min) para nao ficar sem alerta por falta de seed.
  const { data: cfg } = await supabase
    .from('alert_configurations')
    .select('min_interval_seconds, is_enabled')
    .eq('alert_type', 'LATE_DELIVERY')
    .eq('channel', 'email')
    .maybeSingle();
  if (cfg && cfg.is_enabled === false) return false;
  const thresholdMin = Math.max(1, Math.round(Number(cfg?.min_interval_seconds ?? 900) / 60));

  const arrivalMs = (args.nowMs ?? Date.now()) + args.etaMinutes * 60_000;
  const lateMs = new Date(order.scheduled_at).getTime() + thresholdMin * 60_000;
  if (!Number.isFinite(lateMs) || arrivalMs <= lateMs) return false;

  const { data: emitted, error } = await supabase.rpc('geo_emit_event', {
    p_order_id: args.orderId,
    p_driver_id: args.driverId,
    p_event_type: 'ETA_DELAY',
    p_stop_index: args.stopIndex,
    p_latitude: args.lat,
    p_longitude: args.lng,
    p_distance_m: null,
    p_eta_minutes: args.etaMinutes,
    p_title: 'Atraso previsto',
    p_message: `O pedido ${order.lalamove_id ?? args.orderId} deve atrasar: previsao de chegada em ${args.etaMinutes} min (agendado ${new Date(order.scheduled_at).toISOString()}).`,
    p_notify: true,
    // Sem `always_send`: respeita horario de silencio, ao contrario dos avisos
    // de chegada do motorista.
    p_metadata: {
      order_ref: order.lalamove_id,
      driver_name: order.driver_name,
      driver_plate: order.driver_plate,
      pickup_address: order.pickup_address,
      delivery_address: order.delivery_address,
      share_link: order.share_link,
      scheduled_at: order.scheduled_at,
      threshold_min: thresholdMin,
      recipients: args.stopIndex === 0
        ? [{ role: 'pickup_contact', channel: 'whatsapp',
             name: order.pickup_contact_name ?? order.supplier_contact,
             to: order.pickup_contact_phone ?? order.supplier_contact }]
        : [{ role: 'delivery_contact', channel: 'whatsapp',
             name: order.delivery_contact_name ?? null,
             to: order.delivery_contact_phone ?? null }],
    },
  });

  if (error) {
    // Nao derruba o refresh do ETA: o alerta e efeito colateral.
    internalLogger('warn', 'ETA_DELAY nao emitido', { tracking_id: args.trackingId, error: error.message });
    return false;
  }
  return emitted != null;
}

/** Etapa 49: acima disto o refresh usa `driving` (sem transito) e economiza a SKU. */
const ETA_TRAFFIC_THRESHOLD_MIN = 15;
/** Etapa 48 (D9): janela minima entre recálculos pagos. */
const ETA_MIN_INTERVAL_MS = 60_000;
/** Etapa 48 (D9): deslocamento minimo para justificar nova medicao. */
const ETA_MIN_MOVED_M = 300;

/** Distancia (m) entre dois pontos — haversine, mesma formula do SQL. */
export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Etapa 48 (D9): le os ultimos 5 pontos do motorista. Serve para dois calculos:
 * deslocamento desde o ultimo recálculo pago (`movedM`) e velocidade media real
 * (`speedMps`) — que alimenta o ETA local sem custo entre refreshes.
 * Devolve nulls quando nao ha historico; quem chama decide o fallback.
 */
async function recentDriverHistory(
  supabase: any,
  driverId: string | null | undefined,
): Promise<{ points: Array<{ lat: number; lng: number; at: number }> }> {
  if (!driverId) return { points: [] };
  const { data } = await supabase
    .from('driver_locations')
    .select('latitude, longitude, recorded_at')
    .eq('driver_id', driverId)
    .order('recorded_at', { ascending: false })
    .limit(5);
  const points = (data ?? [])
    .map((r: any) => ({
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      at: new Date(String(r.recorded_at)).getTime(),
    }))
    .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.at));
  return { points };
}

/** Velocidade media (m/s) sobre os pontos do mais antigo ao mais novo. */
export function avgSpeedMps(points: Array<{ lat: number; lng: number; at: number }>): number | null {
  if (points.length < 2) return null;
  const ordered = [...points].sort((a, b) => a.at - b.at);
  let dist = 0;
  for (let i = 1; i < ordered.length; i++) dist += haversineM(ordered[i - 1], ordered[i]);
  const spanS = (ordered[ordered.length - 1].at - ordered[0].at) / 1000;
  if (spanS <= 0) return null;
  return dist / spanS;
}

/**
 * Etapa 48: ETA local sem custo — `distance_to_next_stop_m / velocidade media
 * dos ultimos 5 pontos`. Sem velocidade confiavel, assume 30 km/h (media urbana
 * de Curitiba): ordem de grandeza para o campo nao ficar vazio entre refreshes.
 */
export function localEtaMinutes(
  t: { distance_to_next_stop_m: unknown },
  speedMps: number | null,
): number | null {
  const dist = t.distance_to_next_stop_m == null ? null : Number(t.distance_to_next_stop_m);
  if (dist == null || !Number.isFinite(dist)) return null;
  const v = speedMps != null && speedMps > 0.5 ? speedMps : 30_000 / 3600;
  return Math.max(1, Math.ceil(dist / v / 60));
}

/**
 * Etapa 48 (D9): decide se vale gastar a medicao paga. Mede sempre que:
 *  - o ETA conhecido esta na janela de aproximacao (`<= 15 min`), onde errar o
 *    numero quebra o aviso ao destinatario;
 *  - nunca foi medido (`eta_updated_at` nulo);
 *  - o motorista andou mais de 300 m desde o ultimo recálculo.
 * Caso contrario devolve o motivo do skip (vai para o log do job).
 */
export async function costGuardSkipReason(
  supabase: any,
  t: any,
  nowMs: number,
): Promise<string | null> {
  const eta = t.eta_minutes == null ? null : Number(t.eta_minutes);
  const updatedMs = t.eta_updated_at ? new Date(String(t.eta_updated_at)).getTime() : null;

  if (eta == null || updatedMs == null || !Number.isFinite(updatedMs)) return null;
  if (eta <= ETA_TRAFFIC_THRESHOLD_MIN) return null;

  const { points } = await recentDriverHistory(supabase, t.driver_id);
  const latest = points[0];
  const moved = latest
    ? haversineM(latest, { lat: Number(t.current_latitude), lng: Number(t.current_longitude) })
    : null;
  if (moved != null && moved > ETA_MIN_MOVED_M) return null;

  if (nowMs - updatedMs < ETA_MIN_INTERVAL_MS) {
    return `eta fresco (<${ETA_MIN_INTERVAL_MS / 1000} s) fora da janela de aproximacao`;
  }
  return moved == null
    ? 'sem deslocamento mensuravel desde o ultimo recalculo'
    : `motorista andou ${Math.round(moved)} m (<${ETA_MIN_MOVED_M} m) desde o ultimo recalculo`;
}

async function processEtaRefresh(supabase: any, payload: any): Promise<any> {
  internalLogger('info', 'Processing eta_refresh job', { payload });

  const orderUuid = payload.orderId ? await resolveOrderUuid(supabase, payload.orderId) : null;
  if (payload.orderId && !orderUuid) {
    throw new Error(`eta_refresh: pedido ${payload.orderId} não encontrado em lalamove_orders`);
  }

  const trackingQuery = supabase
    .from('active_tracking')
    .select('id, order_id, driver_id, next_stop_index, current_latitude, current_longitude, eta_minutes, eta_updated_at, distance_to_next_stop_m, last_updated, route_provider')
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

    // Etapa 47: encaixa na via antes de medir o geofence. Best-effort — sem snap
    // o ETA sai da posição crua, como antes.
    const rawPoint = { lat: Number(t.current_latitude), lng: Number(t.current_longitude) };
    const snap = payload.snap === false
      ? { ...rawPoint, confidence: null as number | null, snapped: false }
      : (await snapDriverPosition(supabase, t)) ?? { ...rawPoint, confidence: null as number | null, snapped: false };

    // Etapa 48 do plano (D9): nao gastar chamada quando o ETA nao mudou o
    // suficiente. Regra: so recalcula se passou mais de 60 s do ultimo refresh
    // E (o motorista andou mais de 300 m OU o ETA ja esta em 15 min ou menos).
    // O agendador ja limita a 1 job a cada 5 min por tracking, entao a janela de
    // 60 s so barra reprocessamento manual; o que economiza de verdade e a
    // segunda condicao: pedido parado no transito com ETA alto nao precisa de
    // nova medicao paga a cada slot.
    const nowMs = Date.now();
    const skipReason = await costGuardSkipReason(supabase, t, nowMs);
    if (skipReason) {
      skipped++;
      const { points } = await recentDriverHistory(supabase, t.driver_id);
      results.push({
        tracking_id: t.id,
        status: 'skipped',
        error: skipReason,
        // ETA local (gratuito) para o campo nao ficar velho ate o proximo recálculo.
        local_eta_minutes: localEtaMinutes(t, avgSpeedMps(points)),
      });
      continue;
    }

    try {
      // Etapa 49 do plano: transito so quando importa. A janela do aviso de
      // aproximacao e `approach_eta_min` (default 5 min), entao a rota com
      // transito vale a pena quando o ETA ja esta em 15 min ou menos; antes
      // disso o desvio tipico de transito em Curitiba nao muda a hora de saida
      // e cada refresh com transito custa a SKU mais cara do provedor.
      // A decisao usa o ETA conhecido (t.eta_minutes); sem ETA ainda, a primeira
      // medicao sai sem transito e a proxima — dentro de 5 min — ja decide.
      const wantsTraffic = t.eta_minutes != null && Number(t.eta_minutes) <= ETA_TRAFFIC_THRESHOLD_MIN;
      const route = await invokeEdge(supabase, 'geo-gateway', {
        action: 'route',
        origin: { lat: snap.lat, lng: snap.lng },
        destination: stop,
        traffic: wantsTraffic,
      });

      const durationS = route?.duration_traffic_s ?? route?.duration_s;
      if (durationS == null) {
        skipped++;
        results.push({ tracking_id: t.id, status: 'skipped', error: 'rota sem duração' });
        continue;
      }

      const etaMinutes = Math.max(1, Math.ceil(Number(durationS) / 60));

      // Posição encaixada na via alimenta o trigger `geo_evaluate_tracking`
      // (distance_to_route_m, off_route_cycles, near_stop_cycles). Só escreve
      // quando o snap moveu o ponto — evita UPDATE no-op a cada ciclo.
      const movedM = snap.snapped
        ? Math.abs(snap.lat - Number(t.current_latitude)) + Math.abs(snap.lng - Number(t.current_longitude))
        : 0;

      const { error: updErr } = await supabase
        .from('active_tracking')
        .update({
          eta_minutes: etaMinutes,
          eta_updated_at: new Date().toISOString(),
          eta_provider: route.provider ?? 'mapbox',
          ...(snap.snapped && movedM > 0.00001
            ? { current_latitude: snap.lat, current_longitude: snap.lng }
            : {}),
        })
        .eq('id', t.id);

      if (updErr) throw updErr;

      const etaDelayed = await maybeEmitEtaDelay(supabase, {
        trackingId: t.id,
        orderId: t.order_id,
        driverId: t.driver_id ?? null,
        stopIndex: t.next_stop_index ?? 0,
        etaMinutes,
        lat: snap.lat,
        lng: snap.lng,
      });

      refreshed++;
      results.push({
        tracking_id: t.id,
        status: 'refreshed',
        eta_minutes: etaMinutes,
        eta_delay_emitted: etaDelayed,
        traffic: wantsTraffic,
        duration_s: durationS,
        previous_eta_minutes: t.eta_minutes,
        provider: route.provider,
        snapped: snap.snapped,
        snap_confidence: snap.confidence,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isSkip = /GEO_UNAVAILABLE|GEO_BUDGET_EXCEEDED|est[áa] desligada|Nenhum provedor|RATE_LIMITED|429/i.test(msg);
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

const jobWorkerCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...jobWorkerCorsHeaders,
      }
    });
  }
  
  try {
    // Verificar autenticação (apenas service role ou autenticado)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    
    // Contrato de entrada (422 no formato único + versão v1/v2). O contrato
    // valida SÓ o envelope { jobId, type, payload }: as regras por tipo (ex.:
    // pod_fetch exige orderId) continuam como throw DENTRO de processJob,
    // porque um 422 devolvido antes dele não passa por `mark_job_failed` e
    // `mark_job_processing` não incrementa `attempts`
    // (supabase/migrations/20261122120200_job_queue_system.sql:105-111),
    // o que deixaria o job em loop PROCESSING→PENDING.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage('job-worker', contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, jobWorkerCorsHeaders);
    const contract = validateContract(
      getSchema('job-worker', contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) {
      // Envelope inválido: tira a linha do limbo de 10 min quando há jobId.
      const rejectedJobId = (parsedBody.value as { jobId?: unknown } | null)?.jobId;
      if (typeof rejectedJobId === 'string' && rejectedJobId) {
        // best-effort: o 422 é devolvido mesmo se a marcação falhar.
        try {
          await createSupabaseClient().rpc('mark_job_failed', {
            p_job_id: rejectedJobId,
            p_error_message: 'Envelope do job rejeitado pelo contrato (422)',
          });
        } catch (markError) {
          internalLogger('warn', 'Falha ao marcar job rejeitado como FAILED', {
            jobId: rejectedJobId,
            error: markError instanceof Error ? markError.message : String(markError),
          });
        }
      }
      return errorResponse(contract, jobWorkerCorsHeaders);
    }

    const jobPayload = contract.data as JobPayload;
    
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
