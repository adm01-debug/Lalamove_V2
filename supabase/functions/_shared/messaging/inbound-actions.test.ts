import { assertEquals } from "jsr:@std/assert@1";
import { classifyInbound } from "./inbound.ts";
import { planInboundAction } from "./inbound-actions.ts";
import type { InboundContext } from "./inbound-actions.ts";

const FULL: InboundContext = {
  orderId: "o1",
  driverId: "d1",
  hasDriverPosition: true,
};

/** Atalho: entra com a frase crua do motorista, sai com o plano. */
function planFor(raw: string, ctx: InboundContext = FULL) {
  return planInboundAction(classifyInbound(raw), ctx);
}

Deno.test("etapa 114: confirmacao carimba o pedido e abre evento de rastreio", () => {
  const plan = planFor("sim, confirmo o pedido");
  assertEquals(plan.skipped, []);
  assertEquals(plan.effects[0], {
    kind: "order_metadata",
    key: "driver_confirmed_at",
    value: "@now",
  });
  assertEquals(plan.effects[1], {
    kind: "tracking_event",
    eventType: "DRIVER_CONFIRMED",
  });
});

Deno.test("etapa 114: chegada carimba driver_arrived_at", () => {
  const plan = planFor("cheguei no ponto de coleta");
  assertEquals(plan.effects[0], {
    kind: "order_metadata",
    key: "driver_arrived_at",
    value: "@now",
  });
});

Deno.test("etapa 114: problema abre incidente, nao confirmacao", () => {
  const plan = planFor("estou com problema, pneu furou");
  const incident = plan.effects.find((e) => e.kind === "incident");
  assertEquals(incident?.kind, "incident");
  if (incident?.kind === "incident") {
    assertEquals(incident.type, "DAMAGE");
    assertEquals(incident.severity, "HIGH");
  }
});

Deno.test("etapa 114: atraso sem avaria e LATE_DELIVERY e severidade MEDIUM", () => {
  const plan = planFor("vou me atrasar, nao consigo chegar na hora");
  const incident = plan.effects.find((e) => e.kind === "incident");
  if (incident?.kind === "incident") {
    assertEquals(incident.type, "LATE_DELIVERY");
    assertEquals(incident.severity, "MEDIUM");
  }
});

Deno.test("etapa 114: recusa nao vira incidente — vira carimbo e badge", () => {
  const plan = planFor("vou cancelar essa corrida");
  assertEquals(plan.effects.some((e) => e.kind === "incident"), false);
  assertEquals(plan.effects[0].kind, "order_metadata");
  if (plan.effects[0].kind === "order_metadata") {
    assertEquals(plan.effects[0].key, "driver_declined_at");
  }
  assertEquals(plan.effects[1], {
    kind: "operator_badge",
    reason: "motorista_recusou",
  });
});

Deno.test("etapa 114: sem posicao conhecida nao inventa tracking_event", () => {
  const plan = planFor("cheguei", {
    orderId: "o1",
    driverId: "d1",
    hasDriverPosition: false,
  });
  assertEquals(plan.effects.some((e) => e.kind === "tracking_event"), false);
  assertEquals(plan.skipped[0].reason, "sem_posicao");
  // O carimbo do pedido continua: nao depende de coordenada.
  assertEquals(plan.effects[0].kind, "order_metadata");
});

Deno.test("etapa 114: sem motorista o tracking_event tambem nao existe", () => {
  const plan = planFor("cheguei", {
    orderId: "o1",
    driverId: null,
    hasDriverPosition: true,
  });
  assertEquals(plan.effects.some((e) => e.kind === "tracking_event"), false);
  assertEquals(plan.skipped[0].reason, "sem_motorista");
});

Deno.test("etapa 114: problema sem motorista vira badge, nao incidente orfao", () => {
  const plan = planFor("bati o carro", {
    orderId: "o1",
    driverId: null,
    hasDriverPosition: true,
  });
  assertEquals(plan.effects.some((e) => e.kind === "incident"), false);
  assertEquals(plan.effects[0], {
    kind: "operator_badge",
    reason: "problema_sem_motorista",
  });
  assertEquals(plan.skipped[0].reason, "sem_motorista");
});

Deno.test("etapa 114: sem pedido nada e gravado, mas o motivo fica registrado", () => {
  const plan = planFor("cheguei", {
    orderId: null,
    driverId: "d1",
    hasDriverPosition: true,
  });
  assertEquals(plan.effects, []);
  assertEquals(plan.skipped, [{ reason: "sem_pedido", effect: "arrived" }]);
});

Deno.test("etapa 114: opt-out vale sem pedido — e do telefone, nao da corrida", () => {
  const plan = planFor("SAIR", {
    orderId: null,
    driverId: null,
    hasDriverPosition: false,
  });
  assertEquals(plan.effects, [{ kind: "optout" }]);
});

Deno.test("etapa 114: texto livre (etapa 115) vira badge para o operador", () => {
  const plan = planFor("o cliente pediu para ligar no 11 99999-0000");
  assertEquals(plan.effects, [{
    kind: "operator_badge",
    reason: "texto_livre",
  }]);
});

Deno.test("etapa 114: opcao numerada vira badge com o digito escolhido", () => {
  const choices = [{ id: "opt-1", digit: "2" }];
  const plan = planInboundAction(classifyInbound("2", choices), FULL);
  assertEquals(plan.effects, [{ kind: "operator_badge", reason: "opcao 2" }]);
});
