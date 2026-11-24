import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyCallback, type LedgerClient, type LedgerQuery, type QueryResult } from "./ledger.ts";
import { parseCallback } from "./payload.ts";

interface Call {
  op: "select" | "insert" | "update";
  table: string;
  values?: Record<string, unknown>;
  filters: Record<string, unknown>;
}

/**
 * Fake de query builder: registra a chamada e devolve o que o teste configurou.
 * Reproduz so o encadeamento usado por ledger.ts (select/eq/maybeSingle/...).
 */
function fakeClient(options: {
  selectResult?: Record<string, unknown> | null;
  selectError?: QueryResult["error"];
  writeResult?: { data?: unknown; error?: QueryResult["error"] };
  calls: Call[];
}): LedgerClient {
  const builder = (table: string, op: Call["op"], values?: Record<string, unknown>): LedgerQuery => {
    const call: Call = { op, table, values, filters: {} };
    options.calls.push(call);
    const self: LedgerQuery = {
      select: () => self,
      insert: (v) => {
        call.op = "insert";
        call.values = v;
        return self;
      },
      update: (v) => {
        call.op = "update";
        call.values = v;
        return self;
      },
      eq: (column, value) => {
        call.filters[column] = value;
        return self;
      },
      is: (column, value) => {
        call.filters[column] = value;
        return self;
      },
      order: () => self,
      limit: () => self,
      maybeSingle: async () => ({
        data: options.selectError ? null : options.selectResult ?? null,
        error: options.selectError ?? null,
      }),
      single: async () => ({
        data: options.writeResult?.data ?? null,
        error: options.writeResult?.error ?? null,
      }),
      then: (resolve) =>
        Promise.resolve({
          data: options.writeResult?.data ?? null,
          error: options.writeResult?.error ?? null,
        }).then(resolve),
    };
    return self;
  };
  return {
    from: (table: string) => builder(table, "select"),
  };
}

Deno.test("status delivered atualiza a linha e grava delivered_at", async () => {
  const calls: Call[] = [];
  const client = fakeClient({
    selectResult: { id: "msg-1", status: "sent" },
    writeResult: { data: null, error: null },
    calls,
  });
  const write = parseCallback({
    event: "message.status",
    client_message_id: "cm-1",
    message_id: "pm-1",
    status: "delivered",
    occurred_at: "2026-11-25T12:00:00Z",
  });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "updated");
  assertEquals(result.messageId, "msg-1");
  const update = calls.find((c) => c.op === "update");
  assertEquals(update?.values?.status, "delivered");
  assertEquals(update?.values?.delivered_at, "2026-11-25T12:00:00Z");
});

Deno.test("status atrasado nao regride o ledger", async () => {
  const calls: Call[] = [];
  const client = fakeClient({ selectResult: { id: "msg-1", status: "read" }, calls });
  const write = parseCallback({ event: "message.status", message_id: "pm-1", status: "delivered" });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "ignored");
  assertEquals(result.reason, "transicao_invalida");
  assertEquals(calls.some((c) => c.op === "update"), false);
});

Deno.test("status de mensagem desconhecida nao inventa linha", async () => {
  const calls: Call[] = [];
  const client = fakeClient({ selectResult: null, calls });
  const write = parseCallback({ event: "message.status", message_id: "pm-404", status: "sent" });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "not_found");
  assertEquals(calls.some((c) => c.op === "insert"), false);
});

Deno.test("status failed grava failed_at e o codigo do erro", async () => {
  const calls: Call[] = [];
  const client = fakeClient({ selectResult: { id: "msg-2", status: "sent" }, calls });
  const write = parseCallback({
    event: "message.status",
    message_id: "pm-2",
    status: "failed",
    code: "invalid_number",
  });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "updated");
  const update = calls.find((c) => c.op === "update");
  assertEquals(update?.values?.status, "failed");
  assertEquals(update?.values?.error_code, "invalid_number");
  assertEquals(typeof update?.values?.failed_at, "string");
});

Deno.test("inbound conhecido grava linha nova com in_reply_to", async () => {
  const calls: Call[] = [];
  const client = fakeClient({
    selectResult: { id: "msg-1", status: "delivered" },
    writeResult: { data: { id: "in-1" }, error: null },
    calls,
  });
  const write = parseCallback({
    event: "message.inbound",
    message_id: "inbound-pm-1",
    client_message_id: "cm-1",
    text: "ok",
  });
  const result = await applyCallback({ client, write, senderPhone: "5541999998888" });
  assertEquals(result.outcome, "inserted");
  assertEquals(result.messageId, "in-1");
  const insert = calls.find((c) => c.op === "insert");
  assertEquals(insert?.values?.direction, "inbound");
  assertEquals(insert?.values?.recipient_phone, "5541999998888");
  const meta = insert?.values?.metadata as Record<string, unknown>;
  assertEquals(meta.in_reply_to, "msg-1");
});

Deno.test("inbound repetido (unique violation) vira duplicate", async () => {
  const calls: Call[] = [];
  const client = fakeClient({
    selectResult: null,
    writeResult: { data: null, error: { message: "duplicate key value", code: "23505" } },
    calls,
  });
  const write = parseCallback({ event: "message.inbound", message_id: "in-dup", text: "oi" });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "duplicate");
});

Deno.test("inbound sem mensagem original ainda e gravado", async () => {
  const calls: Call[] = [];
  const client = fakeClient({
    selectResult: null,
    writeResult: { data: { id: "in-solta" }, error: null },
    calls,
  });
  const write = parseCallback({
    event: "message.inbound",
    message_id: "in-x",
    text: "bom dia",
    media_url: "https://cdn/x.jpg",
  });
  const result = await applyCallback({ client, write, senderPhone: "5541988887777" });
  assertEquals(result.outcome, "inserted");
  const insert = calls.find((c) => c.op === "insert");
  const meta = insert?.values?.metadata as Record<string, unknown>;
  assertEquals(meta.media_url, "https://cdn/x.jpg");
  assertEquals(insert?.values?.body_preview, "bom dia");
});

Deno.test("outbound_manual atualiza quando a conversa existe", async () => {
  const calls: Call[] = [];
  const client = fakeClient({ selectResult: { id: "msg-5", status: "sent" }, calls });
  const write = parseCallback({
    event: "message.outbound_manual",
    client_message_id: "cm-5",
    text: "Estou chegando",
  });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "updated");
  const update = calls.find((c) => c.op === "update");
  const meta = update?.values?.metadata as Record<string, unknown>;
  assertEquals(typeof meta.manual_reply_at, "string");
});

Deno.test("outbound_manual sem conversa e not_found", async () => {
  const calls: Call[] = [];
  const client = fakeClient({ selectResult: null, calls });
  const write = parseCallback({ event: "message.outbound_manual", client_message_id: "cm-x", text: "oi" });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "not_found");
});

Deno.test("escrita ignorada nao toca o banco", async () => {
  const calls: Call[] = [];
  const client = fakeClient({ selectResult: { id: "x" }, calls });
  const write = parseCallback({ event: "message.status", message_id: "pm", status: "?" });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "ignored");
  assertEquals(calls.length, 0);
});

Deno.test("erro do update e reportado, nao engolido", async () => {
  const calls: Call[] = [];
  const client = fakeClient({
    selectResult: { id: "msg-9", status: "sent" },
    writeResult: { data: null, error: { message: "boom" } },
    calls,
  });
  const write = parseCallback({ event: "message.status", message_id: "pm-9", status: "delivered" });
  const result = await applyCallback({ client, write });
  assertEquals(result.outcome, "ignored");
  assertEquals(result.reason, "update_falhou: boom");
});
Deno.test("etapa 114: responder 1 ao M4 carimba a coleta no pedido", async () => {
  const calls: Call[] = [];
  const client = fakeClient({
    selectResult: {
      id: "msg-m4",
      status: "delivered",
      order_id: "ord-1",
      driver_id: "drv-1",
      stop_id: null,
      event: "DRIVER_ARRIVED_PICKUP",
      metadata: {},
    },
    writeResult: { data: { id: "in-1" }, error: null },
    calls,
  });
  const write = parseCallback({ event: "message.inbound", message_id: "in-m4", text: "1" });
  const result = await applyCallback({ client, write, senderPhone: "5541988887777" });

  assertEquals(result.outcome, "inserted");
  assertEquals(result.effects?.includes("order_metadata:driver_pickup_confirmed_at"), true);
  // Sem posicao no fake, o evento de rastreio fica de fora — e isso e dito.
  assertEquals(result.skipped?.some((s) => s.reason === "sem_posicao"), true);
  // A linha inbound nasce amarrada ao pedido: e o que a faz aparecer no cartao.
  const inbound = calls.find((c) => c.op === "insert" && c.table === "notification_messages");
  assertEquals(inbound?.values?.order_id, "ord-1");
  assertEquals(inbound?.values?.driver_id, "drv-1");
});

Deno.test("etapa 114: texto livre nao vira incidente nem alerta", async () => {
  const calls: Call[] = [];
  const client = fakeClient({
    selectResult: { id: "msg-x", status: "delivered", order_id: "ord-2", driver_id: "drv-2", event: "DRIVER_ASSIGNED" },
    writeResult: { data: { id: "in-2" }, error: null },
    calls,
  });
  const write = parseCallback({ event: "message.inbound", message_id: "in-x", text: "obrigado bom dia" });
  const result = await applyCallback({ client, write });

  assertEquals(result.outcome, "inserted");
  assertEquals(result.effects?.length, 0);
  const incident = calls.find((c) => c.table === "driver_incidents");
  assertEquals(incident, undefined);
});
