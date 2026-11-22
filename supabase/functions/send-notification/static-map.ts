/**
 * Etapa 68 do plano Google Maps: imagem do trajeto no WhatsApp.
 *
 * O `geo-gateway` (action `static`) devolve um data URL PNG com os markers do
 * motorista/coleta/entrega e a rota. Este módulo monta o body e decide o que
 * fazer quando o orçamento bloqueia — o alerta não pode morrer por causa da
 * imagem: sem orçamento sobra o texto, que é o contrato da etapa
 * ("se orçamento bloquear, manda só texto").
 *
 * As coordenadas não vêm no metadata do trigger (`geo_evaluate_tracking` grava
 * endereços e contatos, não lat/lng), então são lidas do banco: `lalamove_orders`
 * para coleta/entrega, `active_tracking` para o motorista e a rota esperada.
 */
import { logger } from "../_shared/logger.ts";

/** Tipos que ganham imagem: as duas aproximações (coleta e entrega). */
const MEDIA_ALERT_TYPES = new Set([
  "DRIVER_APPROACHING_PICKUP",
  "DRIVER_APPROACHING_DELIVERY",
]);

export interface GeoPointLatLng {
  lat: number;
  lng: number;
}

export interface StaticMapMarker extends GeoPointLatLng {
  color?: string;
  label?: string;
}

export interface StaticMapRequestOptions {
  markers: StaticMapMarker[];
  path?: GeoPointLatLng[];
  center?: GeoPointLatLng;
  width?: number;
  height?: number;
}

/** `DRIVER_APPROACHING_*` é o único caso que recebe imagem (etapa 68). */
export function shouldAttachStaticMap(type: string): boolean {
  return MEDIA_ALERT_TYPES.has(type);
}

/**
 * Códigos que significam "não gaste mais agora" e não são falha retentável:
 * orçamento estourado, provedor desligado ou nenhum provedor configurado.
 * Mesmo critério que o `job-worker` usa para `GEO_BUDGET_EXCEEDED`
 * (`geo-gateway/budget-error.test.ts:51`).
 */
const NON_RETRYABLE = /GEO_UNAVAILABLE|GEO_BUDGET_EXCEEDED|Nenhum provedor|GEO_OFF|desligad/i;

export function isNonRetryableGeoError(message: string): boolean {
  return NON_RETRYABLE.test(message);
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function point(lat: unknown, lng: unknown): GeoPointLatLng | null {
  const a = toNum(lat);
  const b = toNum(lng);
  return a != null && b != null ? { lat: a, lng: b } : null;
}

/** Converte o `expected_route` jsonb ([{lat,lng}]) na polyline do `static`. */
export function parseRoute(raw: unknown): GeoPointLatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: GeoPointLatLng[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const r = p as Record<string, unknown>;
    const pt = point(r.lat, r.lng);
    if (pt) out.push(pt);
  }
  return out;
}

/**
 * Monta o body do `static`. Devolve `null` quando não há nenhum ponto — sem
 * marker não há imagem para desenhar (`geo-gateway/providers/google.ts:353`
 * exige center, markers ou path).
 */
export function buildStaticMapRequest(input: {
  pickup?: GeoPointLatLng | null;
  delivery?: GeoPointLatLng | null;
  driver?: GeoPointLatLng | null;
  route?: GeoPointLatLng[] | null;
  width?: number;
  height?: number;
}): StaticMapRequestOptions | null {
  const markers: StaticMapMarker[] = [];
  if (input.pickup) markers.push({ ...input.pickup, color: "22c55e", label: "C" });
  if (input.delivery) markers.push({ ...input.delivery, color: "3b82f6", label: "E" });
  if (input.driver) markers.push({ ...input.driver, color: "f44336", label: "M" });
  if (markers.length === 0) return null;

  const route = input.route ?? [];
  return {
    markers,
    ...(route.length >= 2 ? { path: route } : {}),
    width: input.width ?? 600,
    height: input.height ?? 300,
  };
}

/** Monta o request a partir das linhas carregadas do banco. */
export function buildStaticMapRequestFromRows(
  order: Record<string, unknown> | null | undefined,
  tracking: Record<string, unknown> | null | undefined,
): StaticMapRequestOptions | null {
  return buildStaticMapRequest({
    pickup: order ? point(order.pickup_latitude, order.pickup_longitude) : null,
    delivery: order ? point(order.delivery_latitude, order.delivery_longitude) : null,
    driver: tracking ? point(tracking.current_latitude, tracking.current_longitude) : null,
    route: tracking ? parseRoute(tracking.expected_route) : [],
  });
}

/** Extrai o data URL de uma resposta `static` do gateway. */
export function extractDataUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const image = (payload as Record<string, unknown>).image;
  return typeof image === "string" && image.startsWith("data:image/") ? image : null;
}

export interface StaticMapDeps {
  invoke: (body: Record<string, unknown>) => Promise<unknown>;
  env?: (key: string) => string | undefined;
}

/**
 * Chama `geo-gateway` action `static` e devolve o data URL, ou `null` quando a
 * imagem não deve/não pode ser enviada. Nunca lança: falhar a imagem não pode
 * impedir o texto de sair.
 */
export async function fetchStaticMap(
  deps: StaticMapDeps,
  options: StaticMapRequestOptions,
): Promise<string | null> {
  const env = deps.env ?? ((k: string) => Deno.env.get(k));
  // Desligar a imagem sem deploy: útil quando o orçamento está apertado.
  if (env("GEO_STATIC_MAP_IN_WHATSAPP") === "false") return null;
  try {
    const data = await deps.invoke({ action: "static", ...options });
    const url = extractDataUrl(data);
    if (!url) {
      logger.log("[Notification] static map sem data URL — enviando só texto");
      return null;
    }
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isNonRetryableGeoError(message)) {
      logger.log(`[Notification] static map bloqueado pelo orçamento/provedor — só texto: ${message}`);
    } else {
      logger.error("[Notification] falha ao gerar static map:", message);
    }
    return null;
  }
}
