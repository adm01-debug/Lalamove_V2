/**
 * Etapas 88-95: cada teste aqui representa um caso que ja custou (ou custaria)
 * dinheiro ou credibilidade com o motorista — mensagem duplicada, rajada de 20
 * SMS, aviso as 3h da manha, fallback que nunca dispara.
 */
import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyQuietHours,
  clientMessageId,
  DEDUP_SEVERITY_FREE_EVENTS,
  DEFAULT_QUIET_HOURS,
  DEFAULT_ROUTES,
  findRoute,
  isInQuietHours,
  isRateLimited,
  localHour,
  needsImmediateFallback,
  resolveChannels,
  shouldFallback,
  suppressionReason,
} from "./router.ts";

Deno.test("etapa 88: ORDER_CANCELLED para o motorista sai por whatsapp e cai para sms", () => {
  assertEquals(resolveChannels("ORDER_CANCELLED", "driver"), [
    "whatsapp",
    "sms",
  ]);
});

Deno.test("etapa 88: evento ou papel sem rota nao envia nada", () => {
  assertEquals(resolveChannels("EVENTO_INEXISTENTE", "driver"), []);
  assertEquals(resolveChannels("ORDER_CANCELLED", "internal"), []);
});

Deno.test("etapa 88: rota desabilitada devolve lista vazia (desligado e desligado)", () => {
  const routes = [{ ...DEFAULT_ROUTES[0], is_enabled: false }];
  assertEquals(resolveChannels(routes[0].event, routes[0].role, routes), []);
});

Deno.test("etapa 88: resolveChannels nao devolve a referencia interna do catalogo", () => {
  const first = resolveChannels("ORDER_CANCELLED", "driver");
  first.push("email");
  assertEquals(resolveChannels("ORDER_CANCELLED", "driver"), [
    "whatsapp",
    "sms",
  ]);
});

Deno.test("etapa 88: findRoute devolve a regra com fallback e reply_timeout", () => {
  const rule = findRoute("ETA_DELAY", "driver");
  assert(rule);
  assertEquals(rule!.requires_reply, true);
  assertEquals(rule!.reply_timeout_min, 15);
  assertEquals(findRoute("ETA_DELAY", "internal"), null);
});

Deno.test("etapa 89: mesma entrada gera o mesmo id (webhook repetido nao duplica)", () => {
  const a = clientMessageId(
    "ord-1",
    "DRIVER_ASSIGNED",
    "driver",
    "(41) 99999-8888",
    0,
  );
  const b = clientMessageId(
    "ord-1",
    "DRIVER_ASSIGNED",
    "driver",
    "41999998888",
    0,
  );
  assertEquals(a, b);
});

Deno.test("etapa 89: seq diferente no mesmo evento gera id diferente (2o aviso e legitimo)", () => {
  const a = clientMessageId("ord-1", "ETA_DELAY", "driver", "41999998888", 0);
  const b = clientMessageId("ord-1", "ETA_DELAY", "driver", "41999998888", 1);
  assert(a !== b);
});

Deno.test("etapa 90: fallback temporizado so dispara depois da janela", () => {
  const sent = new Date("2026-11-21T10:00:00Z");
  assertFalse(shouldFallback(sent, new Date("2026-11-21T10:09:59Z"), 10));
  assert(shouldFallback(sent, new Date("2026-11-21T10:10:00Z"), 10));
});

Deno.test("etapa 90: sem envio previo ou janela 0 nao ha fallback temporizado", () => {
  assertFalse(shouldFallback(null, new Date("2026-11-21T10:00:00Z"), 10));
  assertFalse(
    shouldFallback(
      new Date("2026-11-21T09:00:00Z"),
      new Date("2026-11-21T10:00:00Z"),
      0,
    ),
  );
});

Deno.test("etapa 91: os quatro motivos viram SMS na hora", () => {
  for (
    const reason of [
      "invalid_number",
      "instance_unavailable",
      "recipient_blocked",
      "channel_down",
    ]
  ) {
    assert(needsImmediateFallback(reason), reason);
  }
  assertFalse(needsImmediateFallback("timeout"));
  assertFalse(needsImmediateFallback(null));
});

Deno.test("etapa 93: silencio noturno no fuso de Sao Paulo (20h-7h)", () => {
  // 23:30 UTC = 20:30 em SP (-3).
  assert(isInQuietHours(new Date("2026-11-22T23:30:00Z"), DEFAULT_QUIET_HOURS));
  // 14:00 UTC = 11:00 em SP.
  assertFalse(
    isInQuietHours(new Date("2026-11-22T14:00:00Z"), DEFAULT_QUIET_HOURS),
  );
  // 09:00 UTC = 06:00 em SP: ainda dentro da janela.
  assert(isInQuietHours(new Date("2026-11-22T09:00:00Z"), DEFAULT_QUIET_HOURS));
  // 10:00 UTC = 07:00 em SP: janela fechada.
  assertFalse(
    isInQuietHours(new Date("2026-11-22T10:00:00Z"), DEFAULT_QUIET_HOURS),
  );
});

Deno.test("etapa 93: localHour aplica o deslocamento do fuso", () => {
  assertEquals(localHour(new Date("2026-11-22T23:30:00Z"), -180), 20);
  assertEquals(localHour(new Date("2026-11-22T02:00:00Z"), -180), 23);
});

Deno.test("etapa 93: motorista com pedido ativo nunca e silenciado; fornecedor e", () => {
  const night = new Date("2026-11-22T23:30:00Z");
  assertEquals(applyQuietHours("driver", night, true).suppressed, false);
  assertEquals(
    applyQuietHours("pickup_contact", night, false).suppressed,
    true,
  );
  assertEquals(applyQuietHours("driver", night, false).suppressed, true);
});

Deno.test("etapa 93: adiamento devolve o instante em que a janela abre", () => {
  // 20:30 em SP -> abre as 07:00 locais = 10:00 UTC.
  const decision = applyQuietHours(
    "pickup_contact",
    new Date("2026-11-22T23:30:00Z"),
    false,
  );
  assert(decision.releaseAt);
  assertEquals(decision.releaseAt!.getTime() > Date.now() - 3_600_000, true);
  assertEquals(localHour(decision.releaseAt!, -180), 7);
});

Deno.test("etapa 95: sexta mensagem em 10 min ainda passa, setima bloqueia", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const six = Array.from(
    { length: 6 },
    (_, i) => new Date(now.getTime() - i * 60_000),
  );
  assertFalse(
    isRateLimited({ recentSends: six.slice(1), now, event: "ETA_DELAY" }),
  );
  assert(isRateLimited({ recentSends: six, now, event: "ETA_DELAY" }));
});

Deno.test("etapa 95: envios fora da janela de 10 min nao contam", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const old = Array.from(
    { length: 20 },
    (_, i) => new Date(now.getTime() - 11 * 60_000 - i * 60_000),
  );
  assertFalse(isRateLimited({ recentSends: old, now, event: "ETA_DELAY" }));
});

Deno.test("etapa 95: motorista chegou (M8) fura o limite — o aviso e o que importa", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const many = Array.from(
    { length: 20 },
    (_, i) => new Date(now.getTime() - i * 1_000),
  );
  assertFalse(
    isRateLimited({ recentSends: many, now, event: "DRIVER_ARRIVED_PICKUP" }),
  );
});

Deno.test("etapa 92: opt-out vence o limite de taxa na razao registrada", () => {
  assertEquals(suppressionReason(true, true), "opted_out");
  assertEquals(suppressionReason(false, true), "rate_limited");
  assertEquals(suppressionReason(false, false), null);
});
Deno.test("etapa 94: evento de rastreio nao leva severidade na chave de dedup", () => {
  // ETA oscila WARNING <-> CRITICAL a cada atualizacao de posicao; sem isso cada
  // oscilacao abriria uma mensagem nova para o mesmo pedido.
  for (
    const ev of ["ETA_DELAY", "DRIVER_APPROACHING_PICKUP", "ORDER_CANCELLED"]
  ) {
    assert(DEDUP_SEVERITY_FREE_EVENTS.has(ev), ev);
  }
  assertFalse(DEDUP_SEVERITY_FREE_EVENTS.has("INTEGRATION_FAILURE"));
});
