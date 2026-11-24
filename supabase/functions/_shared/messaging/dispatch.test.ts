/**
 * Etapas 88-95: cada teste aqui e um caso que custa dinheiro ou credibilidade —
 * mensagem em numero sem WhatsApp, rajada, madrugada, orcamento do mes, texto
 * com placeholder nao resolvido, fallback que nao dispara.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  dispatchDriverMessage,
  planDriverMessage,
  type ChannelSenders,
  type DriverSnapshot,
  type PlanInput,
} from "./dispatch.ts";
import { DEFAULT_ROUTES, type RouteRule } from "./router.ts";
import {
  SAFE_SETTINGS,
  type MessageTemplate,
  type MessagingSettings,
} from "./registry.ts";

const TEMPLATE: MessageTemplate = {
  key: "M8_CANCELAMENTO",
  event: "ORDER_CANCELLED",
  role: "driver",
  channel: "whatsapp",
  version: 1,
  body: "Pedido {{order_number}} cancelado.",
  variables: ["order_number"],
  maxLength: null,
};

const SMS_TEMPLATE: MessageTemplate = {
  ...TEMPLATE,
  channel: "sms",
  body: "Promo: pedido {{order_number}} cancelado.",
  maxLength: 160,
};

const TEMPLATES = {
  whatsapp: TEMPLATE,
  sms: SMS_TEMPLATE,
};

const DRIVER: DriverSnapshot = {
  phone: "5541999998888",
  whatsappStatus: "valid",
  preferredChannel: "auto",
  optedOut: false,
  hasActiveOrder: false,
  sendsInWindow: 0,
  monthCostCents: 0,
};

const CANCEL_ROUTE: RouteRule = {
  event: "ORDER_CANCELLED",
  role: "driver",
  channels: ["sms", "whatsapp"],
  fallback_after_min: 0,
  requires_reply: false,
  reply_timeout_min: 0,
  is_enabled: true,
};

function settings(over: Partial<MessagingSettings> = {}): MessagingSettings {
  return {
    ...SAFE_SETTINGS,
    whatsappProvider: "zapp",
    smsProvider: "comtele",
    shadowMode: false,
    ...over,
  };
}

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    event: "ORDER_CANCELLED",
    role: "driver",
    settings: settings(),
    routes: [CANCEL_ROUTE],
    templates: TEMPLATES,
    driver: { ...DRIVER },
    now: new Date("2026-11-24T15:00:00Z"),
    ...over,
  };
}

function senders(log: string[]): ChannelSenders {
  return {
    whatsapp: (phone) => {
      log.push(`whatsapp:${phone}`);
      return Promise.resolve({ success: true, providerMessageId: "wa-1" });
    },
    sms: (phone) => {
      log.push(`sms:${phone}`);
      return Promise.resolve({ success: true, providerId: "sms-1" });
    },
  };
}

const VARS = { order_number: "ABC-123" };

Deno.test("etapa 145: modo sombra decide o canal e nao envia nada", async () => {
  const log: string[] = [];
  const result = await dispatchDriverMessage({
    ...input({ settings: settings({ shadowMode: true }) }),
    senders: senders(log),
    variables: VARS,
    clientMessageId: "c1",
  });
  assertEquals(result.outcome, "shadow");
  assertEquals(result.plan.channels, ["sms", "whatsapp"]);
  assertEquals(log, []);
});

Deno.test("etapa 88: a rota do banco define a ordem (cancelamento sai por SMS)", async () => {
  const log: string[] = [];
  const result = await dispatchDriverMessage({
    ...input(),
    senders: senders(log),
    variables: VARS,
    clientMessageId: "c2",
  });
  assertEquals(result.outcome, "sent");
  assertEquals(result.sentChannel, "sms");
  assertEquals(log, ["sms:5541999998888"]);
});

Deno.test("etapa 88: whatsapp desligado no kill switch sobra o SMS", () => {
  const plan = planDriverMessage(
    input({ settings: settings({ whatsappProvider: "off" }) }),
  );
  assertEquals(plan.action, "send");
  assertEquals(plan.channels, ["sms"]);
});

Deno.test("etapa 79: numero sem whatsapp nao insiste no whatsapp", () => {
  const plan = planDriverMessage(
    input({ driver: { ...DRIVER, whatsappStatus: "invalid" } }),
  );
  assertEquals(plan.channels, ["sms"]);
});

Deno.test("etapa 79: preferencia do motorista reordena mas nao bloqueia", () => {
  const plan = planDriverMessage(
    input({
      driver: { ...DRIVER, preferredChannel: "whatsapp" },
      routes: [{ ...CANCEL_ROUTE, channels: ["sms", "whatsapp"] }],
    }),
  );
  assertEquals(plan.channels, ["whatsapp", "sms"]);
});

Deno.test("etapa 79: preferencia por canal que a rota nao tem nao descarta a rota", () => {
  const plan = planDriverMessage(
    input({
      driver: { ...DRIVER, preferredChannel: "whatsapp" },
      routes: [{ ...CANCEL_ROUTE, channels: ["sms"] }],
    }),
  );
  assertEquals(plan.channels, ["sms"]);
});

Deno.test("opt-out vence qualquer rota", () => {
  const plan = planDriverMessage(
    input({ driver: { ...DRIVER, optedOut: true } }),
  );
  assertEquals(plan.action, "suppress");
  assertEquals(plan.reason, "opt_out");
});

Deno.test("Z9: madrugada silencia o motorista parado", () => {
  const plan = planDriverMessage(
    input({
      settings: settings({
        quietHoursByRole: { driver: { start: 22, end: 6 } },
      }),
      now: new Date("2026-11-24T06:00:00Z"),
    }),
  );
  assertEquals(plan.action, "suppress");
  assertEquals(plan.reason, "horario_silencio");
});

Deno.test("Z9: madrugada nao cala o motorista com pedido em andamento", () => {
  const plan = planDriverMessage(
    input({
      settings: settings({
        quietHoursByRole: { driver: { start: 22, end: 6 } },
      }),
      now: new Date("2026-11-24T06:00:00Z"),
      driver: { ...DRIVER, hasActiveOrder: true },
    }),
  );
  assertEquals(plan.action, "send");
});

Deno.test("etapa 95: rajada de mensagens no mesmo motorista e limitada", () => {
  const plan = planDriverMessage(
    input({ driver: { ...DRIVER, sendsInWindow: 6 } }),
  );
  assertEquals(plan.reason, "limite_motorista");
});

Deno.test("etapa 95: evento de chegada passa mesmo no limite", () => {
  const plan = planDriverMessage(
    input({
      event: "DRIVER_ARRIVED_PICKUP",
      routes: [...DEFAULT_ROUTES],
      templates: TEMPLATES,
      driver: { ...DRIVER, sendsInWindow: 9 },
    }),
  );
  assert(["send", "shadow"].includes(plan.action));
});

Deno.test("Z5: teto do mes corta o SMS pago e mantem o WhatsApp", () => {
  const plan = planDriverMessage(
    input({
      settings: settings({ monthlyBudgetCents: 5000 }),
      driver: { ...DRIVER, monthCostCents: 5000 },
    }),
  );
  assertEquals(plan.channels, ["whatsapp"]);
});

Deno.test("Z5: sem canal gratuito o envio para no teto", () => {
  const plan = planDriverMessage(
    input({
      settings: settings({ monthlyBudgetCents: 5000 }),
      templates: { sms: SMS_TEMPLATE },
      driver: { ...DRIVER, monthCostCents: 9000 },
    }),
  );
  assertEquals(plan.action, "suppress");
  assertEquals(plan.reason, "orcamento_estourado");
});

Deno.test("etapa 77: evento sem template ativo nao inventa texto", () => {
  const plan = planDriverMessage(input({ templates: {} }));
  assertEquals(plan.action, "suppress");
  assertEquals(plan.reason, "sem_template");
});

Deno.test("etapa 88: evento sem rota nao sai por canal nenhum", () => {
  const plan = planDriverMessage(input({ event: "EVENTO_SEM_ROTA" }));
  assertEquals(plan.action, "suppress");
  assertEquals(plan.reason, "sem_rota");
});

Deno.test("etapa 145: rota desligada no painel nao envia nada", () => {
  const plan = planDriverMessage(
    input({ routes: [{ ...CANCEL_ROUTE, is_enabled: false }] }),
  );
  assertEquals(plan.action, "suppress");
  assertEquals(plan.reason, "evento_desligado");
  assertEquals(plan.channels.length, 0);
});

Deno.test("etapa 91: numero invalido no WhatsApp cai no SMS na hora", async () => {
  const log: string[] = [];
  const result = await dispatchDriverMessage({
    ...input({
      routes: [{ ...CANCEL_ROUTE, channels: ["whatsapp", "sms"] }],
      templates: { whatsapp: TEMPLATE, sms: SMS_TEMPLATE },
    }),
    senders: {
      whatsapp: () => {
        log.push("whatsapp");
        return Promise.resolve({
          success: false,
          error: "numero invalido",
          errorCode: "invalid_number",
        });
      },
      sms: () => {
        log.push("sms");
        return Promise.resolve({ success: true, providerId: "sms-9" });
      },
    },
    variables: VARS,
    clientMessageId: "c3",
  });
  assertEquals(result.outcome, "sent");
  assertEquals(result.sentChannel, "sms");
  assertEquals(log, ["whatsapp", "sms"]);
});

Deno.test("etapa 90: erro que pode passar espera o fallback temporizado", async () => {
  const log: string[] = [];
  const result = await dispatchDriverMessage({
    ...input({ routes: [{ ...CANCEL_ROUTE, channels: ["whatsapp", "sms"] }] }),
    senders: {
      whatsapp: () => {
        log.push("whatsapp");
        return Promise.resolve({ success: false, errorCode: "rate_limited" });
      },
      sms: () => {
        log.push("sms");
        return Promise.resolve({ success: true });
      },
    },
    variables: VARS,
    clientMessageId: "c4",
  });
  assertEquals(result.outcome, "failed");
  assertEquals(log, ["whatsapp"]);
});

Deno.test("placeholder nao resolvido nao vira mensagem quebrada", async () => {
  const log: string[] = [];
  const result = await dispatchDriverMessage({
    ...input(),
    senders: senders(log),
    variables: {},
    clientMessageId: "c5",
  });
  assertEquals(result.outcome, "failed");
  assertEquals(log, []);
  assert(result.attempts[0].errorCode === "variaveis_faltando");
});

Deno.test("motorista sem telefone nao gera tentativa", () => {
  const plan = planDriverMessage(
    input({ driver: { ...DRIVER, phone: null } }),
  );
  assertEquals(plan.reason, "sem_telefone");
});
