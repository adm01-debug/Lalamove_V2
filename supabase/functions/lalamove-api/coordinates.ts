import { logger } from '../_shared/logger.ts';

// Coordenadas do pedido: a cotação da Lalamove já geocodificou os endereços para cobrar a
// distância, então `stops[].coordinates` é a fonte da verdade (docs/planos/
// PLANO_MAPBOX_100_ETAPAS.md, M2). Reter geocode temporário do Mapbox é proibido pelos
// termos; reter o da Lalamove não. Antes disto `pickup_latitude`/`delivery_latitude`
// ficavam NULL em 100% dos pedidos e o /map não desenhava coleta nem entrega.

// Extrai as coordenadas de uma lista de paradas no formato da Lalamove v3
// (`coordinates: { lat, lng }` como STRING). A API é a fonte da verdade da coordenada:
// a cotação já geocodifica o endereço para cobrar a distância (docs/planos/
// PLANO_MAPBOX_100_ETAPAS.md, M2) — gravar isso é gratuito e não fere os termos do
// Mapbox, que proíbem reter coordenada de geocode temporário.
export function stopsCoords(stops: Array<Record<string, unknown>> | undefined): Array<{
  stopId: string | null; lat: number | null; lng: number | null; address: string | null;
  name: string | null; phone: string | null;
}> {
  return (stops ?? []).map((s) => {
    const c = (s.coordinates ?? {}) as Record<string, unknown>;
    const lat = Number.parseFloat(String(c.lat));
    const lng = Number.parseFloat(String(c.lng));
    return {
      stopId: (s.stopId as string) ?? null,
      // 0,0 é o placeholder que a própria Lalamove rejeita; nunca gravar como real.
      lat: Number.isFinite(lat) && !(lat === 0 && lng === 0) ? lat : null,
      lng: Number.isFinite(lng) && !(lat === 0 && lng === 0) ? lng : null,
      address: (s.address as string) ?? null,
      name: (s.name as string) || null,
      phone: (s.phone as string) || null,
    };
  });
}

// Grava as paradas e as coordenadas de coleta/entrega do pedido.
// geocode_provider='lalamove' / geocode_precision='LALAMOVE' marca que a coordenada veio
// da cotação e portanto é permanente (etapa 93 do plano de 100 etapas).
// deno-lint-ignore no-explicit-any
export async function persistOrderCoordinates(
  supabase: any,
  orderId: string,
  stops: Array<Record<string, unknown>> | undefined,
  // Etapa 36: quando o pedido veio do formulário, o autocomplete já resolveu um
  // place_id do provedor (google:/mapbox:) — ele identifica o ENDEREÇO e não pode
  // ser sobrescrito pelo id da parada da Lalamove. Sem preferência, o id da parada é
  // o que existe para guardar.
  preferred?: {
    pickupPlaceId?: string | null;
    deliveryPlaceId?: string | null;
    // Etapa 35/36: o autocomplete do formulário resolveu o ponto (e a coordenada
    // persistida é a da cotação). Sem estes overrides, a atribuição do geocode era
    // sobrescrita para 'lalamove' mesmo quando o endereço veio do Google/Mapbox,
    // quebrando a auditoria de custo (etapa 93).
    pickupGeocodeProvider?: string | null;
    pickupGeocodePrecision?: string | null;
    deliveryGeocodeProvider?: string | null;
    deliveryGeocodePrecision?: string | null;
  },
) {
  const coords = stopsCoords(stops);
  const first = coords[0];
  const second = coords[1];
  // A parada pode ter contato sem coordenada (cotação rejeitou 0,0). Nesse caso ainda
  // vale gravar o contato: é ele que define o destinatário do alerta.
  if (!first?.lat && !second?.lat && !first?.phone && !first?.name) return;

  const patch: Record<string, unknown> = {};
  if (first?.lat !== null && first?.lat !== undefined) {
    patch.pickup_latitude = first.lat;
    patch.pickup_longitude = first.lng;
    // A coordenada que persistimos é a da cotação (fonte da verdade do ponto real),
    // mas a atribuição de quem resolveu o endereço pode ser do provedor do autocomplete.
    patch.geocode_provider = preferred?.pickupGeocodeProvider ?? "lalamove";
    patch.geocode_precision = preferred?.pickupGeocodePrecision ?? "LALAMOVE";
    patch.geocode_match_confidence = "LALAMOVE"; // etapa 13: coordenada da cotação, permanente
    // Etapa 14: `pickup_place_id`/`delivery_place_id` existem desde a geo_foundation mas
    // nunca eram escritos (100% NULL em produção) — ficavam como coluna morta e o ponto
    // de coleta/entrega não tinha identidade estável por provedor.
    const placeId = preferred?.pickupPlaceId ?? (first.stopId ? `lalamove:${first.stopId}` : null);
    if (placeId) patch.pickup_place_id = placeId;
  }
  if (second?.lat !== null && second?.lat !== undefined) {
    patch.delivery_latitude = second.lat;
    patch.delivery_longitude = second.lng;
    patch.geocode_provider = preferred?.deliveryGeocodeProvider ?? "lalamove";
    patch.geocode_precision = preferred?.deliveryGeocodePrecision ?? "LALAMOVE";
    patch.geocode_match_confidence = "LALAMOVE";
    const placeId = preferred?.deliveryPlaceId ?? (second.stopId ? `lalamove:${second.stopId}` : null);
    if (placeId) patch.delivery_place_id = placeId;
  }
  if (Object.keys(patch).length === 0) return;

  // O alerta de COLETA usa COALESCE(o.pickup_contact_name, o.supplier_contact) e
  // COALESCE(o.pickup_contact_phone, stops[0].contact_phone) (geo_foundation.sql:480-481).
  // As duas colunas pickup_contact_* de lalamove_orders nunca foram escritas por ninguém
  // no repo, então o nome do fornecedor caía em supplier_contact (NULL quando o pedido
  // veio da UI). A cotação já traz name/phone na parada 0: gravar aqui é gratuito.
  if (first?.name) patch.pickup_contact_name = first.name;
  if (first?.phone) patch.pickup_contact_phone = first.phone;

  const { error } = await supabase.from("lalamove_orders").update(patch).eq("id", orderId);
  if (error) { logger.error("Error saving order coordinates:", error); return; }

  const rows = coords
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.lat !== null && c.lng !== null)
    .map(({ c, i }) => ({
      order_id: orderId,
      stop_index: i,
      address: c.address ?? "N/A",
      latitude: c.lat,
      longitude: c.lng,
      geocode_precision: "LALAMOVE",
      geocode_match_confidence: "LALAMOVE",
      // Etapa 36: `contact_name`/`contact_phone` de `lalamove_stops` eram 100% NULL
      // (nenhum escritor no repo), e o trigger geo_evaluate_tracking monta os
      // destinatários da notificação de aproximação/chegada da ENTREGA lendo
      // exatamente estas duas colunas (geo_foundation.sql:484-485). Sem elas o alerta
      // saía sem `to` e o envio por WhatsApp falhava silenciosamente em toda entrega.
      ...(c.name ? { contact_name: c.name } : {}),
      ...(c.phone ? { contact_phone: c.phone } : {}),
      ...(c.stopId ? { place_id: `lalamove:${c.stopId}` } : {}),
    }));
  if (rows.length > 0) {
    const { error: stopError } = await supabase
      .from("lalamove_stops")
      .upsert(rows, { onConflict: "order_id,stop_index" });
    // Conflito ausente na tabela não pode derrubar o pedido: o pedido já existe na Lalamove.
    if (stopError) logger.error("Error saving lalamove_stops:", stopError);
  }
}

