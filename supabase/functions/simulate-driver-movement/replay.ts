/**
 * Etapa 53 do PLANO_MAPBOX_100_ETAPAS: replay deterministico de trajeto.
 *
 * A simulacao original movia o motorista em direcao ao destino usando
 * `Math.random()` — nunca tocava a fixture `route_curitiba.json` nem passava a
 * rota pelo provedor, entao um erro de polilinha/heading/ETA do Mapbox nao
 * aparecia. Aqui o passo vem da fixture: mesma entrada, mesmo resultado.
 */

export interface ReplayPoint {
  seq: number;
  lat: number;
  lng: number;
  speed_kmh?: number;
  heading?: number;
  elapsed_s?: number;
}

export interface ReplayFixture {
  name: string;
  vehicle_type?: string;
  total_distance_m?: number;
  points: ReplayPoint[];
}

export interface ReplayStep {
  seq: number;
  lat: number;
  lng: number;
  heading: number;
  speed_kmh: number;
  eta_minutes: number;
  is_stopped: boolean;
}

/** Rumo (graus, 0 = norte) entre dois pontos; mesma semantica do `heading` do provider. */
export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI + 360 % 360;
}

/** Distancia restante do ponto `from` ate o fim da fixture, em metros. */
export function remainingM(points: ReplayPoint[], from: number): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  let sum = 0;
  for (let i = from; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dp = rad(b.lat - a.lat);
    const dl = rad(b.lng - a.lng);
    const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dl / 2) ** 2;
    sum += 2 * R * Math.asin(Math.sqrt(h));
  }
  return sum;
}

/**
 * Converte a fixture numa sequencia de passos prontos para gravar em
 * `active_tracking`. `cursor` e o indice do ultimo ponto ja aplicado, para que
 * chamadas sucessivas avancem o trajeto em vez de reiniciar.
 *
 * `is_stopped` vem da propria fixture (`speed_kmh === 0` no primeiro ponto), nao
 * de sorteio: o replay precisa reproduzir o trajeto real.
 */
export function replaySteps(fixture: ReplayFixture, cursor = 0, steps = 1): ReplayStep[] {
  const pts = fixture.points;
  const out: ReplayStep[] = [];
  for (let i = 1; i <= steps; i++) {
    const idx = Math.min(cursor + i, pts.length - 1);
    const p = pts[idx];
    const prev = pts[idx - 1] ?? p;
    const speed = p.speed_kmh ?? prev.speed_kmh ?? 0;
    const remaining = remainingM(pts, idx);
    // ETA pela velocidade declarada quando existe; senao assume 30 km/h urbano.
    const kmh = speed > 0 ? speed : 30;
    out.push({
      seq: p.seq,
      lat: p.lat,
      lng: p.lng,
      heading: p.heading ?? bearingDeg(prev, p),
      speed_kmh: speed,
      eta_minutes: Math.round((remaining / 1000 / kmh) * 60),
      is_stopped: speed === 0 && idx !== pts.length - 1,
    });
    if (idx === pts.length - 1) break;
  }
  return out;
}
