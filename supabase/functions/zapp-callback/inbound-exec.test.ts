import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { LedgerClient, LedgerQuery, QueryResult } from "./ledger.ts";
import { executeInboundPlan, type InboundRow } from "./inbound-exec.ts";
import { planInboundAction } from "../_shared/messaging/inbound-actions.ts";
import { classifyReply } from "../_shared/messaging/inbound-event.ts";

interface Write {
  table: string;
  op: "insert" | "update";
  values: Record<string, unknown>;
}

/** Fake so do que o executor usa; `selects` responde o maybeSingle por tabela. */
function fakeClient(options: {
  selects?: Record<string, Record<string, unknown> | null>;
  errors?: Record<string, QueryResult["error"]>;
}) {
  const writes: Write[] = [];
  const builder = (table: string): LedgerQuery => {
    const self: LedgerQuery = {
      select: () => self,
      insert: (values) => {
        writes.push({ table, op: "insert", values });
        return self;
      },
      update: (values) => {
        writes.push({ table, op: "update", values });
        return self;
      },
      eq: () => self,
      is: () => self,
      order: () => self,
      limit: () => self,
      maybeSingle: async () => ({
        data: options.selects?.[table] ?? null,
        error: options.errors?.[table] ?? null,
      }),
      single: async () => ({ data: { id: `${table}-1` }, error: options.errors?.[table] ?? null }),
      then: (resolve) =>
        Promise.resolve({ data: null, error: options.errors?.[table] ?? null }).then(resolve),
    };
    return self;
  };
  const client = { from: (table: string) => builder(table) } as unknown as LedgerClient;
  return { client, writes };
}

const ROW: InboundRow = {
  orderId: "ord-1",
  driverId: "drv-1",
  stopId: null,
  phone: "5541988887777",
  messageId: "msg-in-1",
  text: "1",
  mediaUrl: null,
  position: { lat: -30.1, lng: -51.2 },
};

function planFor(event: string, text: string, row: InboundRow = ROW) {
  return planInboundAction(classifyReply(event, text), {
    orderId: row.orderId,
    driverId: row.driverId,
    hasDriverPosition: !!row.position,
    stopId: row.stopId,
    mediaUrl: row.mediaUrl,
  });
}

Deno.test("etapa 114: coleta carimba o pedido e grava evento de rastreio", async () => {
  const { client, writes } = fakeClient({ selects: { lalamove_orders: { metadata: {} } } });
  const result = await executeInboundPlan(client, planFor("DRIVER_ARRIVED_PICKUP", "1"), ROW);
  assert(result.applied.includes("order_metadata:driver_pickup_confirmed_at"));
  assert(result.applied.includes("tracking_event:COLLECTED"));
  const patch = writes.find((w) => w.table === "lalamove_orders" && w.op === "update");
  assertEquals(typeof (patch?.values.metadata as Record<string, unknown>).driver_pickup_confirmed_at, "string");
  const track = writes.find((w) => w.table === "tracking_events");
  assertEquals(track?.values.event_type, "COLLECTED");
  assertEquals(track?.values.latitude, -30.1);
});

Deno.test("etapa 114: carimbo nao sobrescreve o que ja aconteceu", async () => {
  const { client, writes } = fakeClient({
    selects: { lalamove_orders: { metadata: { driver_pickup_confirmed_at: "2026-01-01T00:00:00Z" } } },
  });
  const result = await executeInboundPlan(client, planFor("DRIVER_ARRIVED_PICKUP", "1"), ROW);
  assert(result.applied.includes("order_metadata:driver_pickup_confirmed_at:ja_carimbado"));
  assertEquals(writes.filter((w) => w.table === "lalamove_orders").length, 0);
});

Deno.test("etapa 114: problema vira incidente do motorista", async () => {
  const { client, writes } = fakeClient({});
  const row = { ...ROW, text: "2 bati o pneu na saida" };
  const result = await executeInboundPlan(
    client,
    planFor("DRIVER_ARRIVED_PICKUP", row.text),
    row,
  );
  assert(result.applied.includes("incident:DAMAGE"));
  const incident = writes.find((w) => w.table === "driver_incidents");
  assertEquals(incident?.values.driver_id, "drv-1");
  assertEquals(incident?.values.severity, "HIGH");
  assertEquals(incident?.values.reported_by, "whatsapp");
  // Problema ja aparece na tela de incidentes: nao duplica alerta.
  assertEquals(writes.filter((w) => w.table === "alerts").length, 0);
});

Deno.test("etapa 114: sem posicao conhecida nao inventa evento de rastreio", async () => {
  const { client, writes } = fakeClient({ selects: { lalamove_orders: { metadata: {} } } });
  const row = { ...ROW, position: null };
  const plan = planFor("DRIVER_ARRIVED_PICKUP", "1", row);
  const result = await executeInboundPlan(client, plan, row);
  assert(plan.skipped.some((s) => s.reason === "sem_posicao"));
  assertEquals(writes.filter((w) => w.table === "tracking_events").length, 0);
  // O carimbo do pedido continua valendo: so o rastreio depende da posicao.
  assert(result.applied.includes("order_metadata:driver_pickup_confirmed_at"));
});

Deno.test("etapa 114: SAIR grava opt-out e tolera telefone ja cadastrado", async () => {
  const { client, writes } = fakeClient({
    errors: { notification_optouts: { message: "duplicate key value", code: "23505" } },
  });
  const result = await executeInboundPlan(client, planFor("DRIVER_ARRIVED_PICKUP", "sair"), ROW);
  assert(result.applied.includes("optout:ja_estava"));
  const optout = writes.find((w) => w.table === "notification_optouts");
  assertEquals(optout?.values.phone, "5541988887777");
});

Deno.test("etapa 114: recusa abre alerta para a operacao", async () => {
  const { client, writes } = fakeClient({ selects: { lalamove_orders: { metadata: {} } } });
  const result = await executeInboundPlan(
    client,
    planFor("DRIVER_ARRIVED_PICKUP", "nao vou conseguir"),
    { ...ROW, text: "nao vou conseguir" },
  );
  // "nao vou conseguir" e problema, nao recusa: o incidente e o registro certo.
  assert(result.applied.some((a) => a.startsWith("incident:")));
});

Deno.test("etapa 114: recusa pura vira alerta DRIVER_NO_CONFIRMATION", async () => {
  const { client, writes } = fakeClient({ selects: { lalamove_orders: { metadata: {} } } });
  const result = await executeInboundPlan(
    client,
    planFor("DRIVER_CONFIRMATION_DUE", "nao"),
    { ...ROW, text: "nao" },
  );
  // "nao" casa recusa (decline) — alerta interno, sem incidente.
  assert(result.applied.includes("alert:DRIVER_NO_CONFIRMATION"));
  assertEquals(writes.filter((w) => w.table === "driver_incidents").length, 0);
});

Deno.test("etapa 114: foto sem parada fica no inbox, nao inventa comprovante", async () => {
  const { client, writes } = fakeClient({});
  const row = { ...ROW, text: "", mediaUrl: "https://cdn/zapp/comprovante.jpg" };
  const plan = planInboundAction(classifyReply("MISSING_POD", ""), {
    orderId: row.orderId,
    driverId: row.driverId,
    hasDriverPosition: true,
    stopId: null,
    mediaUrl: row.mediaUrl,
  });
  const result = await executeInboundPlan(client, plan, row);
  assert(result.skipped.some((s) => s.reason === "badge_no_inbox"));
  assertEquals(writes.filter((w) => w.op === "insert").length, 0);
});

Deno.test("etapa 114: ultima resposta do motorista e carimbada", async () => {
  const { client, writes } = fakeClient({ selects: { lalamove_orders: { metadata: {} } } });
  await executeInboundPlan(client, planFor("ORDER_SCHEDULED_REMINDER", "1"), ROW);
  const driver = writes.find((w) => w.table === "drivers" && w.op === "update");
  assertEquals(typeof driver?.values.last_reply_at, "string");
});