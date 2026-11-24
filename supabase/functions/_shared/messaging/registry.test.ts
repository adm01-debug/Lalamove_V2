/**
 * Etapa 88: as rotas/textos/configuracao vem do banco, mas a ausencia da tabela
 * nao pode mudar o comportamento do sistema — o fallback e o catalogo do codigo
 * e a configuracao conservadora (nenhum provedor, modo sombra).
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  loadMessagingSettings,
  loadRoutes,
  loadTemplates,
  SAFE_SETTINGS,
} from "./registry.ts";
import { DEFAULT_ROUTES } from "./router.ts";

// deno-lint-ignore no-explicit-any
function builder(result: unknown): any {
  // deno-lint-ignore no-explicit-any
  const q: any = {};
  const self = () => q;
  for (const method of ["select", "eq", "in", "gte", "order", "limit"]) {
    q[method] = self;
  }
  q.maybeSingle = () => Promise.resolve(result);
  q.single = () => Promise.resolve(result);
  q.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
    Promise.resolve(result).then(ok, bad);
  return q;
}

function client(tables: Record<string, unknown>): { from(t: string): unknown } {
  return {
    from: (table: string) => builder(tables[table] ?? { data: null, error: null }),
  };
}

Deno.test("etapa 88: tabela ausente devolve o catalogo do codigo", async () => {
  const routes = await loadRoutes(
    client({ notification_routes: { data: null, error: { message: "nao existe" } } }),
  );
  assertEquals(routes, DEFAULT_ROUTES);
});

Deno.test("etapa 88: tabela vazia tambem cai no catalogo do codigo", async () => {
  const routes = await loadRoutes(client({ notification_routes: { data: [], error: null } }));
  assertEquals(routes, DEFAULT_ROUTES);
});

Deno.test("etapa 88: rota do banco e lida e canal desconhecido e descartado", async () => {
  const routes = await loadRoutes(client({
    notification_routes: {
      data: [{
        event: "ORDER_CANCELLED",
        role: "driver",
        channels: ["sms", "telegram", "whatsapp"],
        fallback_after_min: 5,
        requires_reply: true,
        reply_timeout_min: 10,
        is_enabled: true,
      }],
      error: null,
    },
  }));
  assertEquals(routes.length, 1);
  assertEquals(routes[0].channels, ["sms", "whatsapp"]);
  assertEquals(routes[0].fallback_after_min, 5);
  assertEquals(routes[0].requires_reply, true);
});

Deno.test("etapa 145: rota desligada continua vindo do banco com is_enabled falso", async () => {
  const routes = await loadRoutes(client({
    notification_routes: {
      data: [
        {
          event: "ORDER_CANCELLED",
          role: "driver",
          channels: ["whatsapp"],
          fallback_after_min: 0,
          requires_reply: false,
          reply_timeout_min: 0,
          is_enabled: false,
        },
        {
          event: "ETA_DELAY",
          role: "driver",
          channels: ["sms"],
          fallback_after_min: 0,
          requires_reply: false,
          reply_timeout_min: 0,
          is_enabled: true,
        },
      ],
      error: null,
    },
  }));
  assertEquals(routes.length, 2);
  assertEquals(routes[0].is_enabled, false);
  assertEquals(routes[1].is_enabled, true);
});

Deno.test("etapa 75: erro na leitura da configuracao nao liga nenhum provedor", async () => {
  const settings = await loadMessagingSettings(
    client({ messaging_settings: { data: null, error: { message: "offline" } } }),
  );
  assertEquals(settings, SAFE_SETTINGS);
  assertEquals(settings.whatsappProvider, "off");
  assertEquals(settings.shadowMode, true);
});

Deno.test("etapa 75: configuracao real e lida com a janela de silencio por papel", async () => {
  const settings = await loadMessagingSettings(client({
    messaging_settings: {
      data: {
        whatsapp_provider: "zapp",
        sms_provider: "comtele",
        sms_fallback_after_min: 15,
        monthly_budget_cents: 12000,
        quiet_hours_by_role: { driver: { start: 22, end: 6 }, supplier: null },
        pilot_mode: true,
        shadow_mode: false,
      },
      error: null,
    },
  }));
  assertEquals(settings.whatsappProvider, "zapp");
  assertEquals(settings.smsProvider, "comtele");
  assertEquals(settings.smsFallbackAfterMin, 15);
  assertEquals(settings.monthlyBudgetCents, 12000);
  assertEquals(settings.quietHoursByRole.driver, { start: 22, end: 6 });
  assertEquals(settings.quietHoursByRole.supplier, null);
  assertEquals(settings.shadowMode, false);
  assertEquals(settings.pilotMode, true);
});

Deno.test("etapa 75: provedor desconhecido cai no default seguro", async () => {
  const settings = await loadMessagingSettings(client({
    messaging_settings: {
      data: { whatsapp_provider: "telegram", sms_provider: "zapzap" },
      error: null,
    },
  }));
  assertEquals(settings.whatsappProvider, "off");
  assertEquals(settings.smsProvider, "none");
});

Deno.test("etapa 77: templates viram mapa por canal", async () => {
  const templates = await loadTemplates(
    client({
      message_templates: {
        data: [
          { key: "M8", event: "ORDER_CANCELLED", role: "driver", channel: "whatsapp", version: 2, body: "wa", variables: ["order_number"], max_length: null },
          { key: "M8", event: "ORDER_CANCELLED", role: "driver", channel: "sms", version: 1, body: "sms", variables: ["order_number"], max_length: 160 },
          { key: "M8", event: "ORDER_CANCELLED", role: "driver", channel: "telegram", version: 1, body: "x", variables: [], max_length: null },
          { key: "M8", event: "ORDER_CANCELLED", role: "driver", channel: "sms", version: 3, body: "   ", variables: [], max_length: null },
        ],
        error: null,
      },
    }),
    "ORDER_CANCELLED",
    "driver",
  );
  assert(templates.whatsapp?.version === 2);
  assert(templates.sms?.maxLength === 160);
  assertEquals(Object.keys(templates).sort(), ["sms", "whatsapp"]);
});

Deno.test("etapa 77: com dois templates no canal vence o primeiro (deterministico)", async () => {
  const templates = await loadTemplates(
    client({
      message_templates: {
        data: [
          { key: "M1_BRIEFING", event: "DRIVER_ASSIGNED", role: "driver", channel: "whatsapp", version: 1, body: "briefing", variables: [], max_length: null },
          { key: "M3_LOCALIZACAO", event: "DRIVER_ASSIGNED", role: "driver", channel: "whatsapp", version: 1, body: "local", variables: [], max_length: null },
        ],
        error: null,
      },
    }),
    "DRIVER_ASSIGNED",
    "driver",
  );
  assertEquals(templates.whatsapp?.key, "M1_BRIEFING");
});

Deno.test("etapa 77: erro na leitura de templates nao inventa texto", async () => {
  const templates = await loadTemplates(
    client({ message_templates: { data: null, error: { message: "offline" } } }),
    "ORDER_CANCELLED",
    "driver",
  );
  assertEquals(templates, {});
});
