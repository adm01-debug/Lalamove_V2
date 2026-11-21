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
    };
  });
}

// Grava as paradas e as coordenadas de coleta/entrega do pedido.
// geocode_provider='lalamove' / geocode_precision='LALAMOVE' marca que a coordenada veio
// da cotação e portanto é permanente (etapa 93 do plano de 100 etapas).
// deno-lint-ignore no-explicit-any
export async function persistOrderCoordinates(supabase: any, orderId: string, stops: Array<Record<string, unknown>> | undefined) {
  const coords = stopsCoords(stops);
  const first = coords[0];
  const second = coords[1];
  if (!first?.lat && !second?.lat) return;

  const patch: Record<string, unknown> = {};
  if (first?.lat !== null && first?.lat !== undefined) {
    patch.pickup_latitude = first.lat;
    patch.pickup_longitude = first.lng;
    patch.geocode_provider = "lalamove";
    patch.geocode_precision = "LALAMOVE";
  }
  if (second?.lat !== null && second?.lat !== undefined) {
    patch.delivery_latitude = second.lat;
    patch.delivery_longitude = second.lng;
    patch.geocode_provider = "lalamove";
    patch.geocode_precision = "LALAMOVE";
  }
  if (Object.keys(patch).length === 0) return;

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

