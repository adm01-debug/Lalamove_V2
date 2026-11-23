/**
 * Etapas 89/97/100: o caminho completo do aviso ao motorista com o banco
 * dublado. O que este arquivo protege: nao enviar quando o motorista e
 * desconhecido, nao enviar duas vezes o mesmo evento e registrar no ledger
 * mesmo quando a mensagem nao sai (modo sombra/suprimida).
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { notifyDriver, loadOrderVariables, type MessagingClient } from "./notify-driver.ts";

interface WriteRecord {
  table: string;
  op: "insert" | "update";
  // deno-lint-ignore no-explicit-any
  payload: any;
}

interface FakeSpec {
  drivers?: unknown;
  routes?: unknown;
  templates?: unknown;
  settings?: unknown;
  orders?: unknown;
  sends?: unknown;
  optOut?: unknown;
  cost?: unknown;
  ledgerInsert?: unknown;
  /** Fila de respostas para `lalamove_stops` (contagem, depois proximo stop). */
  stops?: unknown[];
}

interface FakeDb {
  client: MessagingClient;
  writes: WriteRecord[];
  rpcCalls: Array<{ name: string; args: unknown }>;
}

function fakeDb(spec: FakeSpec): FakeDb {
  const writes: WriteRecord[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const reads: Record<string, unknown> = {
    drivers: spec.drivers ?? { data: { id: "d1", phone: "5541999998888" }, error: null },
    notification_routes: spec.routes ?? {
      data: [{
        event: "ORDER_CANCELLED",
        role: "driver",
        channels: ["sms"],
        fallback_after_min: 0,
        requires_reply: false,
        reply_timeout_min: 0,
        is_enabled: true,
      }],
      error: null,
    },
    message_templates: spec.templates ?? {
      data: [{
        key: "M8_CANCELAMENTO",
        event: "ORDER_CANCELLED",
        role: "driver",
        channel: "sms",
        version: 1,
        body: "Pedido {{order_number}} cancelado.",
        variables: ["order_number"],
        max_length: 160,
      }],
      error: null,
    },
    messaging_settings: spec.settings ?? {
      data: {
        whatsapp_provider: "off",
        sms_provider: "comtele",
        shadow_mode: false,
      },
      error: null,
    },
    lalamove_orders: spec.orders ?? { count: 1, data: null, error: null },
    notification_messages: spec.sends ?? { count: 0, data: null, error: null },
  };

  // deno-lint-ignore no-explicit-any
  const builder = (table: string, result: unknown): any => {
    // deno-lint-ignore no-explicit-any
    const q: any = {};
    const self = () => q;
    for (const method of ["select", "eq", "in", "is", "gte", "order", "limit"]) {
      q[method] = self;
    }
    q.insert = (payload: unknown) => {
      writes.push({ table, op: "insert", payload });
      return builder(table, table === "notification_messages" && spec.ledgerInsert
        ? spec.ledgerInsert
        : { data: { id: "ledger-1" }, error: null });
    };
    q.update = (payload: unknown) => {
      writes.push({ table, op: "update", payload });
      return builder(table, { data: null, error: null });
    };
    q.maybeSingle = () => Promise.resolve(result);
    q.single = () => Promise.resolve(result);
    q.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
      Promise.resolve(result).then(ok, bad);
    return q;
  };

  const stops: unknown[] = [...(spec.stops ?? [])];
  const client = {
    from: (table: string) => {
      const result = table === "lalamove_stops" && stops.length
        ? stops.shift()
        : (reads[table] ?? { data: null, error: null });
      return builder(table, result);
    },
    rpc: (name: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ name, args: args ?? {} });
      if (name === "is_phone_opted_out") {
        return Promise.resolve({ data: spec.optOut ?? false, error: null });
      }
      if (name === "messaging_month_cost_cents") {
        return Promise.resolve({ data: spec.cost ?? 0, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as MessagingClient;

  return { client, writes, rpcCalls };
}

const REQ = {
  event: "ORDER_CANCELLED",
  driverId: "3f0d6c4e-0000-0000-0000-000000000001",
  orderId: "9c1f0000-0000-0000-0000-000000000002",
  variables: { order_number: "ABC-123" },
};

Deno.test("etapa 86: pedido vira variaveis do catalogo", async () => {
  const db = fakeDb({
    orders: {
      data: {
        lalamove_id: "LMV-777",
        pickup_address: "Av. Paulista, 1000",
        delivery_address: "Rua B, 2",
        customer_name: "Joao",
        customer_phone: "41988887777",
        pickup_contact_name: "Maria",
        pickup_contact_phone: "41999990000",
        scheduled_at: "2026-11-24T14:00:00.000Z",
        estimated_delivery: "2026-11-24T18:30:00.000Z",
        share_link: "https://share/abc",
        internal_notes: "portaria 2",
        requires_pod: true,
        pickup_latitude: -23.5613,
        pickup_longitude: -46.6565,
        driver_name: "Carlos",
      },
      error: null,
    },
    stops: [
      { count: 2, data: null, error: null },
      { data: { address: "Rua C, 3", contact_name: "Ana", contact_phone: "41977776666" }, error: null },
    ],
  });
  const variables = await loadOrderVariables(db.client, "order-1");
  assertEquals(variables.order_number, "LMV-777");
  assertEquals(variables.pickup_contact, "Maria - 41999990000");
  // 14:00Z e 11:00 em Sao Paulo: o motorista le horario local, nao UTC.
  assertEquals(variables.pickup_window, "24/11 11:00");
  assertEquals(variables.delivery_window, "24/11 15:30");
  assertEquals(variables.pickup_location_link, "https://www.google.com/maps/search/?api=1&query=-23.5613,-46.6565");
  assertEquals(variables.pod_requirement, "\nComprovante: obrigatorio.");
  assertEquals(variables.volume_count, 2);
  assertEquals(variables.next_stop_address, "Rua C, 3");
  assertEquals(variables.next_stop_contact, "Ana - 41977776666");
});

Deno.test("etapa 86: pedido incompleto nao inventa valor nem placeholder vazio", async () => {
  const db = fakeDb({
    orders: {
      data: {
        lalamove_id: "LMV-778",
        requires_pod: false,
        pickup_latitude: 0,
        pickup_longitude: 0,
      },
      error: null,
    },
  });
  const variables = await loadOrderVariables(db.client, "order-2");
  assertEquals(variables.order_number, "LMV-778");
  assertEquals(Object.keys(variables).sort(), ["order_number"]);
});

Deno.test("etapa 86: pedido sem uuid nao consulta nada", async () => {
  const db = fakeDb({});
  assertEquals(await loadOrderVariables(db.client, null), {});
});

Deno.test("motorista desconhecido nao gera mensagem", async () => {
  const db = fakeDb({ drivers: { data: null, error: null } });
  const result = await notifyDriver(db.client, REQ);
  assertEquals(result.outcome, "ignored");
  assertEquals(result.reason, "motorista_desconhecido");
  assertEquals(db.writes, []);
});

Deno.test("etapa 145: modo sombra registra suppressed e nao envia", async () => {
  const db = fakeDb({
    settings: {
      data: {
        whatsapp_provider: "off",
        sms_provider: "comtele",
        shadow_mode: true,
      },
      error: null,
    },
  });
  let chamou = false;
  const result = await notifyDriver(db.client, REQ, {
    senders: {
      sms: () => {
        chamou = true;
        return Promise.resolve({ success: true });
      },
    },
  });
  assertEquals(result.outcome, "shadow");
  assertEquals(result.reason, "modo_sombra");
  assertEquals(chamou, false);
  const insert = db.writes.find((w) => w.table === "notification_messages");
  assertEquals(insert?.payload.status, "suppressed");
  assertEquals(insert?.payload.metadata.reason, "modo_sombra");
});

Deno.test("etapa 97: envio grava sent no ledger e o consumo", async () => {
  const db = fakeDb({});
  const result = await notifyDriver(db.client, REQ, {
    senders: { sms: () => Promise.resolve({ success: true, providerId: "sms-1" }) },
  });
  assertEquals(result.outcome, "sent");
  assertEquals(result.channel, "sms");
  assertEquals(result.ledgerId, "ledger-1");
  const update = db.writes.find((w) => w.op === "update");
  assertEquals(update?.payload.status, "sent");
  assertEquals(update?.payload.provider, "comtele");
  assert(String(update?.payload.body_preview).includes("ABC-123"));
  assert(db.rpcCalls.some((c) => c.name === "record_messaging_usage"));
});

Deno.test("etapa 89: evento repetido nao vira segunda mensagem", async () => {
  const db = fakeDb({
    ledgerInsert: { data: null, error: { code: "23505", message: "duplicate key" } },
  });
  let envios = 0;
  const result = await notifyDriver(db.client, REQ, {
    senders: {
      sms: () => {
        envios += 1;
        return Promise.resolve({ success: true });
      },
    },
  });
  assertEquals(result.outcome, "duplicate");
  assertEquals(envios, 1);
});

Deno.test("opt-out registra a supressao sem chamar o provedor", async () => {
  const db = fakeDb({ optOut: true });
  let chamou = false;
  const result = await notifyDriver(db.client, REQ, {
    senders: {
      sms: () => {
        chamou = true;
        return Promise.resolve({ success: true });
      },
    },
  });
  assertEquals(result.outcome, "suppressed");
  assertEquals(result.reason, "opt_out");
  assertEquals(chamou, false);
});

Deno.test("erro de leitura do motorista nao derruba o chamador", async () => {
  const db = fakeDb({ drivers: { data: null, error: { message: "timeout" } } });
  const result = await notifyDriver(db.client, REQ);
  assertEquals(result.outcome, "ignored");
  assertEquals(result.reason, "erro_ao_ler_motorista");
});
