import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CONFIRMATION_DUE_MIN,
  CONFIRMATION_LOOKBACK_HOURS,
  SCHEDULED_REMINDER_WINDOW_MIN,
  sendConfirmationNudges,
  sendScheduledReminders,
  shouldSendNextStop,
} from "./auto-notices.ts";

/** M6/M11 — plano de mensageria, etapas 106 e 111. */

function stopsClient(total: number, open: number) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => Promise.resolve({ count: open }),
          then: (resolve: (v: unknown) => void) => resolve({ count: total }),
        }),
      }),
    }),
  };
}

Deno.test("M6: pedido de 2 paradas nao gera aviso de proxima parada", async () => {
  assertEquals(await shouldSendNextStop(stopsClient(2, 1) as never, "ordem-1"), false);
});

Deno.test("M6: multi-parada com parada em aberto gera aviso", async () => {
  assertEquals(await shouldSendNextStop(stopsClient(3, 2) as never, "ordem-1"), true);
});

Deno.test("M6: multi-parada sem parada em aberto nao gera aviso", async () => {
  assertEquals(await shouldSendNextStop(stopsClient(3, 0) as never, "ordem-1"), false);
});
interface FakeOpts {
  orders: Array<Record<string, unknown>>;
  ledger: Set<string>;
  windowArgs?: Record<string, unknown>;
}

function reminderClient(opts: FakeOpts) {
  return {
    from(table: string) {
      if (table === "lalamove_orders") {
        const chain = {
          select: () => chain,
          gte: (_col: string, value: string) => {
            opts.windowArgs = { ...(opts.windowArgs ?? {}), gte: value };
            return chain;
          },
          lte: (_col: string, value: string) => {
            opts.windowArgs = { ...(opts.windowArgs ?? {}), lte: value };
            return chain;
          },
          not: () => chain,
          limit: () => Promise.resolve({ data: opts.orders }),
        };
        return chain;
      }
      if (table === "notification_messages") {
        let orderId = "";
        const chain = {
          select: () => chain,
          eq: (col: string, value: string) => {
            if (col === "order_id") orderId = value;
            return chain;
          },
          limit: () => chain,
          maybeSingle: () =>
            Promise.resolve({ data: opts.ledger.has(orderId) ? { id: "ledger-1" } : null }),
        };
        return chain;
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

const NOW = new Date("2026-11-24T12:00:00.000Z");

Deno.test("M11: avisa uma vez o pedido agendado dentro de 30 min", async () => {
  const opts: FakeOpts = {
    orders: [
      { id: "o1", driver_id: "d1", scheduled_at: "2026-11-24T12:20:00.000Z", status: "MATCHED" },
      { id: "o2", driver_id: "d2", scheduled_at: "2026-11-24T12:29:00.000Z", status: "PENDING" },
    ],
    ledger: new Set<string>(),
  };
  const avisos: Array<[string, string, string]> = [];
  const r = await sendScheduledReminders(reminderClient(opts) as never, NOW, async (e, d, o) => {
    avisos.push([e, d, o]);
    opts.ledger.add(o);
  });
  assertEquals(r, { checked: 2, sent: 2 });
  assertEquals(avisos.map((a) => a[0]), ["ORDER_SCHEDULED_REMINDER", "ORDER_SCHEDULED_REMINDER"]);
});

Deno.test("M11: segunda passada do cron nao repete o lembrete", async () => {
  const opts: FakeOpts = {
    orders: [
      { id: "o1", driver_id: "d1", scheduled_at: "2026-11-24T12:20:00.000Z", status: "MATCHED" },
    ],
    ledger: new Set<string>(["o1"]),
  };
  let calls = 0;
  const r = await sendScheduledReminders(reminderClient(opts) as never, NOW, async () => {
    calls++;
  });
  assertEquals(r, { checked: 1, sent: 0 });
  assertEquals(calls, 0);
});

Deno.test("M11: pedido cancelado, concluido, coletado ou sem motorista nao avisa", async () => {
  const opts: FakeOpts = {
    orders: [
      { id: "c1", driver_id: "d1", scheduled_at: "2026-11-24T12:10:00.000Z", status: "CANCELLED" },
      { id: "c2", driver_id: "d1", scheduled_at: "2026-11-24T12:10:00.000Z", status: "completed" },
      { id: "p1", driver_id: "d1", scheduled_at: "2026-11-24T12:10:00.000Z", status: "PICKED_UP" },
      { id: "g1", driver_id: "d1", scheduled_at: "2026-11-24T12:10:00.000Z", status: "ON_GOING" },
      { id: "n1", driver_id: null, scheduled_at: "2026-11-24T12:10:00.000Z", status: "PENDING" },
    ],
    ledger: new Set<string>(),
  };
  let calls = 0;
  const r = await sendScheduledReminders(reminderClient(opts) as never, NOW, async () => {
    calls++;
  });
  assertEquals(r, { checked: 0, sent: 0 });
  assertEquals(calls, 0);
});

Deno.test("M11: janela de busca e now até now+30min", async () => {
  const opts: FakeOpts = { orders: [], ledger: new Set<string>() };
  await sendScheduledReminders(reminderClient(opts) as never, NOW, async () => {});
  assertEquals(opts.windowArgs?.gte, "2026-11-24T12:00:00.000Z");
  assertEquals(
    opts.windowArgs?.lte,
    new Date(NOW.getTime() + SCHEDULED_REMINDER_WINDOW_MIN * 60_000).toISOString(),
  );
});

/* ------------------------------------------------------------------ */
/* M2 (etapa 102) — pedido de confirmacao 2 min depois da atribuicao. */
/* ------------------------------------------------------------------ */

interface NudgeOpts {
  notices: Array<{ order_id: string | null }>;
  orders: Record<string, Record<string, unknown>>;
  /** Pedidos que ja tem `DRIVER_CONFIRMATION_DUE` outbound no ledger. */
  dup: Set<string>;
  windowArgs?: Record<string, string>;
}

function nudgeClient(opts: NudgeOpts) {
  let ledgerCall = 0;
  return {
    from(table: string) {
      if (table === "notification_messages") {
        ledgerCall++;
        const buscaDeAvisos = ledgerCall === 1;
        let orderId = "";
        const chain = {
          select: () => chain,
          eq: (col: string, value: string) => {
            if (col === "order_id") orderId = value;
            return chain;
          },
          gte: (_col: string, value: string) => {
            opts.windowArgs = { ...(opts.windowArgs ?? {}), gte: value };
            return chain;
          },
          lte: (_col: string, value: string) => {
            opts.windowArgs = { ...(opts.windowArgs ?? {}), lte: value };
            return chain;
          },
          not: () => chain,
          limit: () =>
            buscaDeAvisos ? Promise.resolve({ data: opts.notices }) : chain,
          maybeSingle: () =>
            Promise.resolve({ data: opts.dup.has(orderId) ? { id: "ledger-dup" } : null }),
        };
        return chain;
      }
      if (table === "lalamove_orders") {
        let id = "";
        const chain = {
          select: () => chain,
          eq: (_col: string, value: string) => {
            id = value;
            return chain;
          },
          maybeSingle: () => Promise.resolve({ data: opts.orders[id] ?? null }),
        };
        return chain;
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

Deno.test("M2: aviso de atribuicao entregue ha mais de 2 min pede confirmacao", async () => {
  const opts: NudgeOpts = {
    notices: [{ order_id: "o1" }],
    orders: { o1: { id: "o1", driver_id: "d1", status: "MATCHED", metadata: {} } },
    dup: new Set<string>(),
  };
  const avisos: Array<[string, string, string]> = [];
  const r = await sendConfirmationNudges(nudgeClient(opts) as never, NOW, async (e, d, o) => {
    avisos.push([e, d, o]);
  });
  assertEquals(r, { checked: 1, sent: 1 });
  assertEquals(avisos, [["DRIVER_CONFIRMATION_DUE", "d1", "o1"]]);
});

Deno.test("M2: motorista ja confirmou a coleta — nao cobra de novo", async () => {
  const opts: NudgeOpts = {
    notices: [{ order_id: "o1" }],
    orders: {
      o1: {
        id: "o1",
        driver_id: "d1",
        status: "MATCHED",
        metadata: { driver_pickup_confirmed_at: "2026-11-24T11:59:00.000Z" },
      },
    },
    dup: new Set<string>(),
  };
  let calls = 0;
  const r = await sendConfirmationNudges(nudgeClient(opts) as never, NOW, async () => {
    calls++;
  });
  assertEquals(r, { checked: 1, sent: 0 });
  assertEquals(calls, 0);
});

Deno.test("M2: cobranca ja registrada no ledger nao vira segunda mensagem", async () => {
  const opts: NudgeOpts = {
    notices: [{ order_id: "o1" }],
    orders: { o1: { id: "o1", driver_id: "d1", status: "MATCHED", metadata: {} } },
    dup: new Set<string>(["o1"]),
  };
  let calls = 0;
  const r = await sendConfirmationNudges(nudgeClient(opts) as never, NOW, async () => {
    calls++;
  });
  assertEquals(r, { checked: 1, sent: 0 });
  assertEquals(calls, 0);
});

Deno.test("M2: pedido coletado, cancelado, concluido ou sem motorista nao cobra", async () => {
  const opts: NudgeOpts = {
    notices: [{ order_id: "p" }, { order_id: "c" }, { order_id: "g" }, { order_id: "x" }, { order_id: "n" }],
    orders: {
      p: { id: "p", driver_id: "d1", status: "PICKED_UP", metadata: {} },
      c: { id: "c", driver_id: "d1", status: "CANCELLED", metadata: {} },
      g: { id: "g", driver_id: "d1", status: "ON_GOING", metadata: {} },
      x: { id: "x", driver_id: "d1", status: "COMPLETED", metadata: {} },
      n: { id: "n", driver_id: null, status: "PENDING", metadata: {} },
    },
    dup: new Set<string>(),
  };
  let calls = 0;
  const r = await sendConfirmationNudges(nudgeClient(opts) as never, NOW, async () => {
    calls++;
  });
  assertEquals(r, { checked: 5, sent: 0 });
  assertEquals(calls, 0);
});

Deno.test("M2: aviso sem pedido associado e ignorado e pedido sumido nao quebra", async () => {
  const opts: NudgeOpts = {
    notices: [{ order_id: null }, { order_id: "fantasma" }],
    orders: {},
    dup: new Set<string>(),
  };
  const r = await sendConfirmationNudges(nudgeClient(opts) as never, NOW, async () => {});
  assertEquals(r, { checked: 1, sent: 0 });
});

Deno.test("M2: janela = aviso entre now-6h e now-2min", async () => {
  const opts: NudgeOpts = { notices: [], orders: {}, dup: new Set<string>() };
  await sendConfirmationNudges(nudgeClient(opts) as never, NOW, async () => {});
  assertEquals(
    opts.windowArgs?.gte,
    new Date(NOW.getTime() - CONFIRMATION_LOOKBACK_HOURS * 3_600_000).toISOString(),
  );
  assertEquals(
    opts.windowArgs?.lte,
    new Date(NOW.getTime() - CONFIRMATION_DUE_MIN * 60_000).toISOString(),
  );
});