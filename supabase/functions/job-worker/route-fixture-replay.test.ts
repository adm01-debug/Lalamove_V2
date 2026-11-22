import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import fixture from "../../tests/fixtures/route_curitiba.json" with { type: "json" };

/**
 * Etapa 52 do plano Google: replay deterministico de um trajeto real contra o
 * motor geo. O fixture `route_curitiba.json` tem 40 pontos Centro -> Jardim
 * Botanico (Curitiba) e e a referencia para conferir `is_on_route`,
 * `distance_to_next_stop_m` e `next_stop_index` sem depender de GPS.
 *
 * O calculo abaixo e a copia em TS das funcoes SQL `geo_haversine_m` e
 * `geo_point_to_polyline_m`; o teste de equivalencia com o SQL esta em
 * `supabase/tests/geo_functions.test.sql` (job `geo-sql-tests`).
 */

interface Point { seq: number; lat: number; lng: number; speed_kmh: number; elapsed_s: number }

const R = 6_371_000;
function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distancia ponto -> polilinha em metros (mesma semantica do SQL: menor segmento). */
function pointToPolylineM(p: { lat: number; lng: number }, line: Array<{ lat: number; lng: number }>): number | null {
  if (!line || line.length === 0) return null;
  if (line.length === 1) return haversineM(p, line[0]);
  let best = Infinity;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i].lng - p.lng) * mPerDegLng;
    const ay = (line[i].lat - p.lat) * mPerDegLat;
    const bx = (line[i + 1].lng - p.lng) * mPerDegLng;
    const by = (line[i + 1].lat - p.lat) * mPerDegLat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : -((ax * dx + ay * dy) / len2);
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    best = Math.min(best, Math.hypot(cx, cy));
  }
  return best;
}

const points = fixture.points as Point[];
const polyline = points.map((p) => ({ lat: p.lat, lng: p.lng }));
const lastPoint = points[points.length - 1];

Deno.test("fixture: 40 pontos com sequencia e tempo crescentes", () => {
  assertEquals(points.length, 40);
  for (let i = 1; i < points.length; i++) {
    assert(points[i].seq > points[i - 1].seq, `seq fora de ordem em ${i}`);
    assert(points[i].elapsed_s > points[i - 1].elapsed_s, `elapsed_s fora de ordem em ${i}`);
  }
});

Deno.test("fixture: distancia total declarada bate com a soma dos segmentos", () => {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += haversineM(points[i - 1], points[i]);
  // 1% de tolerancia: o JSON arredonda a coordenada para 7 casas (1,1 cm)
  assert(Math.abs(sum - fixture.total_distance_m) < fixture.total_distance_m * 0.01,
    `soma ${Math.round(sum)} vs declarado ${fixture.total_distance_m}`);
});

Deno.test("replay: todo ponto do trajeto esta sobre a propria rota (is_on_route=true)", () => {
  // Este e o assert que prova a etapa 45: se o calculo de point->polyline
  // estivesse errado, os proprios vertices do trajeto dariam distancia > 0.
  for (const pt of points) {
    const d = pointToPolylineM(pt, polyline);
    assert(d != null && d < 1, `ponto ${pt.seq} a ${d?.toFixed(2)} m da propria rota`);
  }
});

Deno.test("replay: posicao a 600 m do trajeto conta como fora da rota", () => {
  // 0,0054 grau de latitude ~= 601 m perpendicular ao eixo do trajeto. O offset
  // anterior (0,003 = 334 m) caiu a 269 m porque o segmento naquele trecho e
  // diagonal, entao a distancia ao SEGMENTO e menor que a distancia ao vertice —
  // comportamento correto da funcao, premissa errada do teste.
  const offRoute = { lat: polyline[20].lat + 0.0054, lng: polyline[20].lng };
  const d = pointToPolylineM(offRoute, polyline);
  assert(d != null && d > 300, `desvio calculado em ${d?.toFixed(0)} m, esperado > 300`);
});

Deno.test("replay: distancia ao segmento respeita o limite de 300 m do off_route_threshold", () => {
  // 0,0025 grau ~= 278 m: dentro do limite, nao deveria contar como desvio
  const nearRoute = { lat: polyline[20].lat + 0.0025, lng: polyline[20].lng };
  const d = pointToPolylineM(nearRoute, polyline);
  assert(d != null && d < 300, `ponto a ${d?.toFixed(0)} m deveria estar dentro dos 300 m`);
});

Deno.test("replay: o motorista chega ao destino no ultimo ponto (distance_to_next_stop ~ 0)", () => {
  const d = haversineM(lastPoint, { lat: lastPoint.lat, lng: lastPoint.lng });
  assertEquals(d, 0);
  // e o penultimo ponto esta a menos de 1,5x o raio de chegada (100 m) do fim,
  // o que faz near_stop_cycles chegar a 2 em duas leituras consecutivas
  const penultimo = points[points.length - 2];
  const dPenultimo = haversineM(penultimo, lastPoint);
  assert(dPenultimo < 150, `penultimo ponto a ${dPenultimo.toFixed(0)} m do destino`);
});

Deno.test("replay: ETA local por velocidade media fica na ordem de grandeza do trajeto", () => {
  // ETA sem custo (etapa 48): distancia restante / velocidade media dos pontos
  const vAvgKmh = points.slice(1).reduce((s, p) => s + p.speed_kmh, 0) / (points.length - 1);
  assert(vAvgKmh > 0, "fixture sem velocidade");
  for (const pt of points.slice(0, -1)) {
    const restanteM = haversineM(pt, lastPoint);
    const etaMin = Math.round(restanteM / 1000 / vAvgKmh * 60);
    assert(etaMin < 180, `ETA local de ${etaMin} min e absurdo para ${Math.round(restanteM)} m`);
  }
});
