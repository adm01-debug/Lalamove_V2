import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import fixture from "../../tests/fixtures/route_curitiba.json" with { type: "json" };
import { bearingDeg, remainingM, replaySteps, type ReplayFixture } from "./replay.ts";

const fx = fixture as ReplayFixture;

Deno.test("replay: primeiro passo pula o ponto 0 (posicao inicial) e chega ao 1", () => {
  const [step] = replaySteps(fx, 0, 1);
  assertEquals(step.seq, fx.points[1].seq);
  assertEquals(step.lat, fx.points[1].lat);
  assertEquals(step.lng, fx.points[1].lng);
});

Deno.test("replay: e deterministico — mesma entrada, mesma saida", () => {
  assertEquals(replaySteps(fx, 5, 3), replaySteps(fx, 5, 3));
});

Deno.test("replay: percorre a fixture inteira e para no ultimo ponto", () => {
  const steps = replaySteps(fx, 0, 1000);
  assertEquals(steps.length, fx.points.length - 1);
  const last = steps[steps.length - 1];
  assertEquals(last.seq, fx.points[fx.points.length - 1].seq);
  // No destino o ETA zera e o motorista nao fica "parado" no meio do trajeto
  assertEquals(last.eta_minutes, 0);
  assertEquals(last.is_stopped, false);
});

Deno.test("replay: ETA decresce ao longo do trajeto", () => {
  const first = replaySteps(fx, 0, 1)[0];
  const last = replaySteps(fx, 0, 1000).slice(-1)[0];
  assert(first.eta_minutes > last.eta_minutes, `${first.eta_minutes} !> ${last.eta_minutes}`);
});

Deno.test("replay: distancia restante zera no ultimo ponto e bate com o total no inicio", () => {
  assertEquals(remainingM(fx.points, fx.points.length - 1), 0);
  const total = remainingM(fx.points, 0);
  // 2% de tolerancia: coordenada arredondada a 7 casas no fixture
  assert(Math.abs(total - (fx.total_distance_m ?? 0)) < (fx.total_distance_m ?? 1) * 0.02,
    `remainingM ${Math.round(total)} vs total ${fx.total_distance_m}`);
});

Deno.test("bearing: norte puro = 0, leste puro = 90", () => {
  const o = { lat: 0, lng: 0 };
  assertEquals(Math.round(bearingDeg(o, { lat: 1, lng: 0 })), 0);
  assertEquals(Math.round(bearingDeg(o, { lat: 0, lng: 1 })), 90);
});

Deno.test("replay: heading sempre finito e entre 0 e 360", () => {
  for (const s of replaySteps(fx, 0, 1000)) {
    assert(Number.isFinite(s.heading), `heading invalido em seq ${s.seq}`);
    assert(s.heading >= 0 && s.heading <= 360, `heading fora da faixa em seq ${s.seq}: ${s.heading}`);
  }
});
