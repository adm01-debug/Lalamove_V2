import { logger } from '../_shared/logger.ts';

// Etapa 37 do plano de 100 etapas: geocodificacao server-side de fallback.
//
// Pedidos que entram por `bitrix24`, `uapi_import` ou n8n chegam sem lat/lng: essas
// fontes mandam so o texto do endereco, e quem grava o pedido nao tem como chamar o
// navegador para resolver a coordenada. Sem coordenada o /map nao desenha o pedido e o
// calculo de distancia/ETA nao roda. Este modulo resolve isso dentro da edge, chamando o
// `geo-gateway` (unico ponto de acesso a provedor de mapa — nao chama Mapbox/Google
// direto, para nao furar cache, metering e budget).
//
// Precisao `APPROXIMATE` (ou ausencia de numero no endereco) liga
// `requires_address_review=true` e cria um alerta `APPROVAL_REQUIRED`, porque uma
// coordenada aproximada pode mandar o motorista para o quarteirao errado.

/** Precisao que exige revisao humana antes de despachar o pedido. */
const LOW_PRECISION = new Set(['low', 'unknown']);

export interface GeocodeFallbackResult {
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  precision: string | null;
  provider: string | null;
  formatted: string | null;
  /** true quando a coordenada nao e confiavel e o pedido precisa de revisao */
  requires_review: boolean;
}

export interface GeocodeFallbackDeps {
  /** `SUPABASE_URL` do projeto (base para o `functions/v1/geo-gateway`) */
  supabaseUrl: string;
  /** service_role: o gateway exige JWT e a edge fala como service */
  serviceRoleKey: string;
  fetchFn?: typeof fetch;
}

/**
 * Chama `geo-gateway` action `geocode` para um endereco em texto livre.
 *
 * Nunca lanca: devolve `null` quando o endereco nao pode ser resolvido, para o pedido
 * continuar entrando (a Lalamove e a fonte da verdade da coordenada na cotacao). O que
 * nao pode acontecer e o pedido falhar por causa do geocode.
 */
export async function geocodeAddress(
  address: string | null | undefined,
  deps: GeocodeFallbackDeps,
): Promise<GeocodeFallbackResult | null> {
  const query = (address ?? '').trim();
  if (query.length < 3) return null;

  const doFetch = deps.fetchFn ?? fetch;
  try {
    const res = await doFetch(`${deps.supabaseUrl}/functions/v1/geo-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deps.serviceRoleKey}`,
      },
      body: JSON.stringify({ action: 'geocode', address: query, country: 'br', limit: 1 }),
    });
    if (!res.ok) {
      logger.error(`[geocode-fallback] geo-gateway respondeu ${res.status}`);
      return null;
    }
    const json = await res.json() as {
      data?: Array<{
        location?: { lat: number; lng: number } | null;
        place_id?: string | null;
        precision?: string | null;
        provider?: string | null;
        formatted?: string | null;
        components?: { number?: string } | null;
      }>;
    };
    const hit = json.data?.[0];
    if (!hit?.location) return null;

    // Endereco sem numero ("Rua XV de Novembro, Curitiba") geocodifica no meio da rua e
    // o motorista nao acha o ponto: trata como impreciso mesmo que o provedor diga
    // `high`, porque para despacho o numero e o que define o destino.
    const noNumber = !(hit.components?.number ?? '').trim();
    const precision = hit.precision ?? null;
    const requires_review = noNumber || (precision !== null && LOW_PRECISION.has(precision));

    return {
      lat: hit.location.lat,
      lng: hit.location.lng,
      place_id: hit.place_id ?? null,
      precision,
      provider: hit.provider ?? null,
      formatted: hit.formatted ?? null,
      requires_review,
    };
  } catch (e) {
    logger.error('[geocode-fallback] falha ao chamar geo-gateway:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Geocodifica um pedido sem coordenada e devolve o `patch` a gravar em `lalamove_orders`.
 *
 * `geocode_provider`/`geocode_precision` recebem o provedor que resolveu (nao 'lalamove')
 * porque a coordenada nao veio da cotacao — e o que permite auditar depois de onde saiu
 * cada ponto. Ordem de tentativa: coleta, depois entrega; sem endereco, sem patch.
 */
export async function geocodeOrderFallback(
  pickupAddress: string | null | undefined,
  deliveryAddress: string | null | undefined,
  deps: GeocodeFallbackDeps,
): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = {};
  let needsReview = false;

  const pickup = await geocodeAddress(pickupAddress, deps);
  if (pickup) {
    patch.pickup_latitude = pickup.lat;
    patch.pickup_longitude = pickup.lng;
    if (pickup.place_id) patch.pickup_place_id = pickup.place_id;
    patch.geocode_provider = pickup.provider;
    patch.geocode_precision = pickup.precision;
    needsReview ||= pickup.requires_review;
  }

  const delivery = await geocodeAddress(deliveryAddress, deps);
  if (delivery) {
    patch.delivery_latitude = delivery.lat;
    patch.delivery_longitude = delivery.lng;
    if (delivery.place_id) patch.delivery_place_id = delivery.place_id;
    patch.geocode_provider = delivery.provider;
    patch.geocode_precision = delivery.precision;
    needsReview ||= delivery.requires_review;
  }

  if (Object.keys(patch).length === 0) return {};
  // Etapa 37: precisao aproximada trava o pedido para revisao humana.
  patch.requires_address_review = needsReview;
  return patch;
}