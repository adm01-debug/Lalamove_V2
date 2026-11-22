import { parseExpectedRoute } from './hooks/useMapMarkers';

export type LatLngLiteral = { lat: number; lng: number };

/**
 * Etapa 77: janela de interpolacao do marker do motorista. O polling do
 * `active_tracking` e de 5 s, mas o plano pede 10 s — usar o mesmo numero do
 * plano evita que o marker "salte" quando o intervalo real for maior.
 */
export const DRIVER_ANIM_MS = 10_000;

/** Maximo de pontos de trilha por pedido: `tracking_events` cresce sem limite. */
export const TRAIL_MAX_POINTS = 60;

/**
 * `expected_route` chega como `jsonb` do banco. Delega a validacao para
 * `parseExpectedRoute()` — a mesma usada pelo Mapbox — para que um JSON
 * corrompido nunca vire Polyline quebrada no Google.
 */
export function toGooglePath(value: unknown): LatLngLiteral[] {
  return parseExpectedRoute(value) ?? [];
}

/**
 * Trilha do motorista a partir de `tracking_events`. Ordena por horario (o
 * PostgREST nao garante ordem) e corta os pontos mais antigos.
 */
export function buildTrailPath(
  events: Array<{ latitude: number; longitude: number; created_at: string }> | null | undefined,
  maxPoints: number = TRAIL_MAX_POINTS,
): LatLngLiteral[] {
  if (!Array.isArray(events) || events.length === 0) return [];
  const valid = events.filter(
    (e) => Number.isFinite(e?.latitude) && Number.isFinite(e?.longitude),
  );
  const ordered = [...valid].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return ordered.slice(-maxPoints).map((e) => ({ lat: e.latitude, lng: e.longitude }));
}

/**
 * Posicao exibida do marker: interpola linearmente da posicao anterior para a
 * nova ao longo de `durationMs`. Sem isso, cada poll de 5 s reposiciona o carro
 * de forma abrupta e o trajeto parece teleporte.
 */
export function interpolatePosition(
  from: LatLngLiteral,
  to: LatLngLiteral,
  elapsedMs: number,
  durationMs: number = DRIVER_ANIM_MS,
): LatLngLiteral {
  if (durationMs <= 0) return to;
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

/** Distancia (m) entre dois pontos por haversine — espelha o calculo do backend. */
export function haversineM(a: LatLngLiteral, b: LatLngLiteral): number {
  const R = 6_371_000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Badge do HUD. Usa `distance_to_next_stop_m` (escrito pelo trigger
 * `geo_evaluate_tracking`) e cai no `eta_minutes` quando a distancia ainda nao
 * foi calculada — exibir `null` esconderia o painel inteiro.
 */
export function formatRouteBadge(
  distanceM: number | null | undefined,
  etaMinutes: number | null | undefined,
): { distance: string; eta: string } {
  const dist =
    typeof distanceM === 'number' && Number.isFinite(distanceM)
      ? distanceM >= 1000
        ? `${(distanceM / 1000).toFixed(1)} km`
        : `${Math.round(distanceM)} m`
      : '--';
  const eta =
    typeof etaMinutes === 'number' && Number.isFinite(etaMinutes) ? `${etaMinutes} min` : '--';
  return { distance: dist, eta };
}
