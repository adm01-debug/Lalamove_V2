import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyReply, choicesForEvent } from "./inbound-event.ts";

Deno.test("M4: responder 1 e coleta confirmada", () => {
  const result = classifyReply("DRIVER_ARRIVED_PICKUP", "1");
  assertEquals(result.kind, "intent");
  if (result.kind === "intent") assertEquals(result.intent, "collected");
});

Deno.test("M4: responder 2 e problema", () => {
  const result = classifyReply("DRIVER_ARRIVED_PICKUP", "2");
  assertEquals(result.kind, "intent");
  if (result.kind === "intent") assertEquals(result.intent, "problem");
});

Deno.test("M2: responder 1 e confirmacao de que esta a caminho", () => {
  const result = classifyReply("DRIVER_CONFIRMATION_DUE", "1");
  assertEquals(result.kind, "intent");
  if (result.kind === "intent") assertEquals(result.intent, "confirm");
});

Deno.test("M10: 1 e transito, 2 e problema no veiculo", () => {
  const transito = classifyReply("ETA_DELAY", "1");
  assertEquals(transito.kind, "intent");
  if (transito.kind === "intent") assertEquals(transito.intent, "on_the_way");

  const veiculo = classifyReply("ETA_DELAY", "2");
  assertEquals(veiculo.kind, "intent");
  if (veiculo.kind === "intent") assertEquals(veiculo.intent, "problem");
});

Deno.test("M11 e M7: responder 1 confirma", () => {
  for (const event of ["ORDER_SCHEDULED_REMINDER", "ORDER_EDITED"]) {
    const result = classifyReply(event, "1");
    assertEquals(result.kind, "intent");
    if (result.kind === "intent") assertEquals(result.intent, "confirm");
  }
});

Deno.test("evento sem mapa de opcoes segue palavra-chave", () => {
  const result = classifyReply("MISSING_POD", "coletei");
  assertEquals(result.kind, "intent");
  if (result.kind === "intent") assertEquals(result.intent, "collected");
});

Deno.test("digito fora do mapa nao vira opcao", () => {
  // ORDER_EDITED so oferece 1: um "2" solto nao pode ser lido como recusa.
  assertEquals(classifyReply("ORDER_EDITED", "2").kind, "free_text");
});

Deno.test("SAIR vence qualquer digito", () => {
  const result = classifyReply("DRIVER_ARRIVED_PICKUP", "sair");
  assertEquals(result.kind, "intent");
  if (result.kind === "intent") assertEquals(result.intent, "optout");
});

Deno.test("sem evento, as opcoes do envio resolvem o digito", () => {
  const result = classifyReply(null, "2", [{ id: "problema", digit: "2" }]);
  assertEquals(result.kind, "intent");
  if (result.kind === "intent") assertEquals(result.intent, "problem");
});

Deno.test("choicesForEvent devolve lista vazia para evento desconhecido", () => {
  assertEquals(choicesForEvent("EVENTO_NOVO"), []);
  assertEquals(choicesForEvent(null), []);
});