import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { maybeEmitEtaDelay } from "./index.ts";

/**
 * Etapa 50 — ETA_DELAY previsto no refresh de ETA.
 *
 * O fake cobre só o que a função usa: `from('lalamove_orders').select().eq().maybeSingle()`,
 * `from('alert_configurations').select().eq().eq().maybeSingle()` e
 * `rpc('geo_emit_event', {...})`.
 */
interface OrderRow {
  scheduled_at: string | null;
  status?: string;
  lalamove_id?: string;
}
interface CfgRow {
  min_interval_seconds: number | null;
  is_enabled: boolean;
}
function fakeSupabase(opts: {
  order: OrderRow | null;
  cfg?: CfgRow | null;
  rpcReturns?: unknown;
  rpcReturnsSet?: boolean;
  rpcError?: { message: string } | null;
}) {
  const rpcCalls: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      if (table === "lalamove_orders") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.order, error: null }) }) }) };
      }
      if (table === "alert_configurations") {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.cfg ?? null, error: null }) }) }) }) };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
    rpc(name: string, params: Record<string, unknown>) {
      assertEquals(name, "geo_emit_event");
      rpcCalls.push(params);
      return Promise.resolve({ data: opts.rpcReturnsSet ? opts.rpcReturns : (opts.rpcReturns ?? "uuid-evento"), error: opts.rpcError ?? null });
    },
  };
  return { client, rpcCalls };
}

const baseArgs = {
  trackingId: "t-1",
  orderId: "o-1",
  driverId: "d-1",
  stopIndex: 0,
  etaMinutes: 45,
  lat: -16.68,
  lng: -49.25,
};

function isoIn(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

Deno.test("ETA_DELAY: agendado no passado e ETA de 45 min emite o alerta", async () => {
  const { client, rpcCalls } = fakeSupabase({
    order: { scheduled_at: isoIn(-120), lalamove_id: "LALA-9", status: "ON_GOING" },
  });
  const emitted = await maybeEmitEtaDelay(client, baseArgs);
  assertEquals(emitted, true);
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].p_event_type, "ETA_DELAY");
  assertEquals(rpcCalls[0].p_eta_minutes, 45);
  assertEquals(rpcCalls[0].p_stop_index, 0);
});

Deno.test("ETA_DELAY: chegada dentro da tolerancia de 15 min nao gera alerta", async () => {
  // agendado para daqui 40 min, ETA 45 -> atraso de 5 min, abaixo dos 15
  const { client, rpcCalls } = fakeSupabase({ order: { scheduled_at: isoIn(40), status: "ON_GOING" } });
  const emitted = await maybeEmitEtaDelay(client, baseArgs);
  assertEquals(emitted, false);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("ETA_DELAY: pedido sem scheduled_at nao tem referencia de atraso", async () => {
  const { client, rpcCalls } = fakeSupabase({ order: { scheduled_at: null, status: "ON_GOING" } });
  assertEquals(await maybeEmitEtaDelay(client, baseArgs), false);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("ETA_DELAY: pedido encerrado nao atrasa", async () => {
  for (const status of ["COMPLETED", "CANCELLED", "REJECTED", "DELIVERED"]) {
    const { client, rpcCalls } = fakeSupabase({ order: { scheduled_at: isoIn(-120), status } });
    assertEquals(await maybeEmitEtaDelay(client, baseArgs), false);
    assertEquals(rpcCalls.length, 0);
  }
});

Deno.test("ETA_DELAY: alert_configurations desligada impede o disparo", async () => {
  const { client, rpcCalls } = fakeSupabase({
    order: { scheduled_at: isoIn(-120), status: "ON_GOING" },
    cfg: { min_interval_seconds: 900, is_enabled: false },
  });
  assertEquals(await maybeEmitEtaDelay(client, baseArgs), false);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("ETA_DELAY: tolerancia customizada em minutos muda a decisao", async () => {
  // mesmo cenario do teste 2 (atraso de 5 min): com tolerancia de 4 min, dispara
  const { client, rpcCalls } = fakeSupabase({
    order: { scheduled_at: isoIn(40), status: "ON_GOING" },
    cfg: { min_interval_seconds: 240, is_enabled: true },
  });
  assertEquals(await maybeEmitEtaDelay(client, baseArgs), true);
  assertEquals(rpcCalls.length, 1);
});

Deno.test("ETA_DELAY: atraso exatamente igual a tolerancia nao dispara (comparacao estrita)", async () => {
  // plano exige `now + eta > scheduled_at + threshold`; igualdade nao e atraso.
  // O relogio e injetado: com dois Date.now() distintos a igualdade exata seria
  // inalcancavel e o teste falhava por milissegundos no runner da CI.
  const agora = Date.now();
  const { client, rpcCalls } = fakeSupabase({
    order: { scheduled_at: new Date(agora + 40 * 60_000).toISOString(), status: "ON_GOING" },
    cfg: { min_interval_seconds: 300, is_enabled: true },
  });
  assertEquals(await maybeEmitEtaDelay(client, { ...baseArgs, nowMs: agora }), false);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("ETA_DELAY: um minuto acima da tolerancia dispara (fronteira oposta)", async () => {
  const agora = Date.now();
  const { client, rpcCalls } = fakeSupabase({
    order: { scheduled_at: new Date(agora + 40 * 60_000).toISOString(), status: "ON_GOING" },
    cfg: { min_interval_seconds: 300, is_enabled: true },
  });
  assertEquals(await maybeEmitEtaDelay(client, { ...baseArgs, nowMs: agora + 60_000 }), true);
  assertEquals(rpcCalls.length, 1);
});

Deno.test("ETA_DELAY: dedup do geo_emit_event (NULL) nao reporta disparo", async () => {
  const { client } = fakeSupabase({
    order: { scheduled_at: isoIn(-120), status: "ON_GOING" },
    rpcReturns: null,
    rpcReturnsSet: true,
  });
  assertEquals(await maybeEmitEtaDelay(client, baseArgs), false);
});

Deno.test("ETA_DELAY: erro no RPC nao propaga (alerta e efeito colateral)", async () => {
  const { client } = fakeSupabase({
    order: { scheduled_at: isoIn(-120), status: "ON_GOING" },
    rpcError: { message: "boom" },
  });
  assertEquals(await maybeEmitEtaDelay(client, baseArgs), false);
});

Deno.test("ETA_DELAY: entrega usa destinatario de entrega no metadata", async () => {
  const { client, rpcCalls } = fakeSupabase({ order: { scheduled_at: isoIn(-120), status: "PICKED_UP" } });
  await maybeEmitEtaDelay(client, { ...baseArgs, stopIndex: 2, etaMinutes: 90 });
  const meta = rpcCalls[0].p_metadata as { recipients: Array<{ role: string }> };
  assertEquals(meta.recipients[0].role, "delivery_contact");
  assertEquals(rpcCalls[0].p_stop_index, 2);
});

// ── Etapa 49: transito condicional ──────────────────────────────────────────
// A decisao e derivada do ETA conhecido pelo mesmo limiar que a janela de
// aproximacao usa (15 min). Testada aqui porque `processEtaRefresh` depende do
// cliente Supabase completo; a regra e a unica parte da etapa 49 que nao e
// passagem de parametro.
const ETA_TRAFFIC_THRESHOLD_MIN = 15;
function wantsTraffic(etaMinutes: number | null): boolean {
  return etaMinutes != null && Number(etaMinutes) <= ETA_TRAFFIC_THRESHOLD_MIN;
}

Deno.test("etapa 49: ETA longo nao paga a SKU com transito", () => {
  assertEquals(wantsTraffic(45), false);
  assertEquals(wantsTraffic(16), false);
});

Deno.test("etapa 49: ETA na janela de aproximacao usa transito", () => {
  assertEquals(wantsTraffic(15), true);
  assertEquals(wantsTraffic(1), true);
});

Deno.test("etapa 49: sem ETA conhecido a primeira medicao sai sem transito", () => {
  assertEquals(wantsTraffic(null), false);
});
