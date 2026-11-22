import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { costGuardSkipReason, localEtaMinutes, haversineM, avgSpeedMps } from "./index.ts";

/**
 * Etapa 48 do plano (D9) — cadencia de custo do `eta_refresh`.
 *
 * Medir sempre custa uma chamada paga por ciclo por pedido. A regra: so mede de
 * novo quando o numero mudou o suficiente para importar — dentro da janela de
 * aproximacao (<= 15 min), ou quando o motorista andou mais de 300 m desde o
 * ultimo recalculo. Fora disso devolve o ETA local calculado sem custo.
 */
function fakeSb(prev: { lat: number; lng: number } | null, throwOn?: string) {
  return {
    from(table: string) {
      if (throwOn && table === throwOn) throw new Error("nao deveria consultar");
      assertEquals(table, "driver_locations");
      const rows = prev
        ? [{ latitude: prev.lat, longitude: prev.lng, recorded_at: new Date(now - 60_000).toISOString() }]
        : [];
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: rows, error: null }),
            }),
          }),
        }),
      };
    },
  };
}

const now = Date.parse("2026-11-23T12:00:00Z");
// Curitiba: 0,0027° de latitude ~ 300 m.
const base = {
  driver_id: "d-1",
  current_latitude: -25.45,
  current_longitude: -49.27,
};

Deno.test("nunca medido: nao pula (primeira medicao sempre acontece)", async () => {
  const t = { ...base, eta_minutes: null, eta_updated_at: null };
  assertEquals(await costGuardSkipReason(fakeSb(null), t, now), null);
});

Deno.test("ETA na janela de aproximacao sempre mede, mesmo recem-medido e parado", async () => {
  const t = {
    ...base,
    eta_minutes: 12,
    eta_updated_at: new Date(now - 5_000).toISOString(),
    distance_to_next_stop_m: 4_000,
  };
  // ETA 12 <= 15 -> mede sempre. driver_locations nao chega a ser consultado.
  assertEquals(await costGuardSkipReason(fakeSb(null, "driver_locations"), t, now), null);
});

Deno.test("ETA 15 (fronteira) ainda mede; 16 ja entra na regra de custo", async () => {
  const fif = { ...base, eta_minutes: 15, eta_updated_at: new Date(now - 5_000).toISOString() };
  assertEquals(await costGuardSkipReason(fakeSb(null, "driver_locations"), fif, now), null);

  const sixteen = { ...base, eta_minutes: 16, eta_updated_at: new Date(now - 5_000).toISOString() };
  assert((await costGuardSkipReason(fakeSb(null), sixteen, now)) !== null);
});

Deno.test("motorista andou mais de 300 m: mede mesmo com ETA alto", async () => {
  const t = {
    ...base,
    eta_minutes: 40,
    eta_updated_at: new Date(now - 120_000).toISOString(),
  };
  // -25,450 -> -25,447 = 0,003° ~ 334 m
  assertEquals(await costGuardSkipReason(fakeSb({ lat: -25.447, lng: -49.27 }), t, now), null);
});

Deno.test("motorista andou menos de 300 m com ETA fresco: pula e explica", async () => {
  const t = {
    ...base,
    eta_minutes: 40,
    eta_updated_at: new Date(now - 30_000).toISOString(),
  };
  const reason = await costGuardSkipReason(fakeSb({ lat: -25.4499, lng: -49.27 }), t, now);
  assert(reason != null);
  assert(reason!.includes("fresco"));
});

Deno.test("parado por muito tempo: pula mesmo fora da janela de 60 s", async () => {
  const t = {
    ...base,
    eta_minutes: 40,
    eta_updated_at: new Date(now - 600_000).toISOString(),
  };
  const reason = await costGuardSkipReason(fakeSb({ lat: -25.45, lng: -49.27 }), t, now);
  assert(reason != null);
  assert(reason!.includes("andou"));
});

Deno.test("ETA local usa a velocidade media dos ultimos 5 pontos", () => {
  // distancia 1.200 m a 1,67 m/s => 719 s => 12 min
  assertEquals(localEtaMinutes({ distance_to_next_stop_m: 1_200 }, 1.6667), 12);
});

Deno.test("ETA local sem velocidade confiavel cai na media urbana de 30 km/h", () => {
  // 9.000 m a 8,33 m/s = 1080 s = 18 min
  assertEquals(localEtaMinutes({ distance_to_next_stop_m: 9_000 }, null), 18);
  // velocidade irrisoria (<0,5 m/s) tambem cai no fallback: motorista parado
  // nao gera ETA absurdo.
  assertEquals(localEtaMinutes({ distance_to_next_stop_m: 9_000 }, 0.05), 18);
});

Deno.test("ETA local minimo 1 min; sem distancia devolve null", () => {
  assertEquals(localEtaMinutes({ distance_to_next_stop_m: 5 }, null), 1);
  assertEquals(localEtaMinutes({ distance_to_next_stop_m: null }, null), null);
});

Deno.test("avgSpeedMps mede sobre os pontos em ordem cronologica", () => {
  // ~334 m em 120 s => ~2,78 m/s
  const pts = [
    { lat: -25.447, lng: -49.27, at: now },
    { lat: -25.45, lng: -49.27, at: now - 120_000 },
  ];
  const v = avgSpeedMps(pts)!;
  assert(Math.abs(v - 2.78) < 0.1, `esperado ~2,78 m/s, veio ${v}`);
});

Deno.test("avgSpeedMps precisa de 2 pontos e de tempo decorrido", () => {
  assertEquals(avgSpeedMps([]), null);
  assertEquals(avgSpeedMps([{ lat: 0, lng: 0, at: now }]), null);
  assertEquals(avgSpeedMps([{ lat: 0, lng: 0, at: now }, { lat: 1, lng: 0, at: now }]), null);
});

Deno.test("haversine bate com 1 grau de latitude = 111,2 km", () => {
  const d = haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert(Math.abs(d - 111_195) < 200, `esperado ~111.195 m, veio ${d}`);
});
