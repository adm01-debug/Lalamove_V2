/**
 * Etapa 113: tabela de casos do interpretador de respostas.
 *
 * Cada caso aqui e uma frase que motorista de verdade manda no WhatsApp. O que
 * importa nao e o texto casar bonito, e sim a ordem: numero de opcao vence
 * palavra-chave, palavra-chave vence texto livre, e "nao consigo chegar" e
 * problema — nunca confirmacao.
 */
import { assertEquals } from "jsr:@std/assert@1";
import {
  classifyInbound,
  type InboundChoice,
  normalizeInboundText,
} from "./inbound.ts";

const choices: InboundChoice[] = [
  { id: "opt-confirmar", digit: "1" },
  { id: "opt-problema", digit: "2" },
  { id: "opt-ajuda", digit: "3" },
];

Deno.test("etapa 113: id da opcao tem prioridade sobre qualquer palavra", () => {
  const r = classifyInbound("opt-problema", choices);
  assertEquals(r.kind, "choice");
  if (r.kind === "choice") assertEquals(r.optionId, "opt-problema");
});

Deno.test("etapa 113: digito escolhe a opcao oferecida no envio", () => {
  const r = classifyInbound("2", choices);
  assertEquals(r.kind, "choice");
  if (r.kind === "choice") {
    assertEquals(r.optionId, "opt-problema");
    assertEquals(r.digit, "2");
  }
});

Deno.test("etapa 113: digito sem mapa de opcoes nao vira escolha", () => {
  assertEquals(classifyInbound("2").kind, "free_text");
});

Deno.test("etapa 113: variacoes de chegada caem na mesma intencao", () => {
  for (
    const text of ["Cheguei", "cheguei no portao", "estou no local", "CHEGANDO"]
  ) {
    const r = classifyInbound(text);
    assertEquals(r.kind, "intent", text);
    if (r.kind === "intent") assertEquals(r.intent, "arrived", text);
  }
});

Deno.test("etapa 113: coletado e a caminho sao intencoes distintas", () => {
  const coletado = classifyInbound("coletei a carga");
  assertEquals(coletado.kind, "intent");
  if (coletado.kind === "intent") assertEquals(coletado.intent, "collected");

  const indo = classifyInbound("ja estou indo");
  assertEquals(indo.kind, "intent");
  if (indo.kind === "intent") assertEquals(indo.intent, "on_the_way");
});

Deno.test("etapa 113: 'nao consigo chegar' e problema, nao recusa nem chegada", () => {
  const r = classifyInbound("nao consigo chegar, pneu furou");
  assertEquals(r.kind, "intent");
  if (r.kind === "intent") assertEquals(r.intent, "problem");
});

Deno.test("etapa 113: acento e caixa alta nao mudam a classificacao", () => {
  assertEquals(normalizeInboundText("  Cheguei   AGORA  "), "cheguei agora");
  const comAcento = classifyInbound("Não consigo chegar");
  assertEquals(comAcento.kind, "intent");
  if (comAcento.kind === "intent") assertEquals(comAcento.intent, "problem");
});

Deno.test("etapa 113: palavra dentro de outra palavra nao casa", () => {
  // "assim" contem "sim" — nao pode virar confirmacao.
  assertEquals(classifyInbound("assim que der eu vou").kind, "free_text");
  assertEquals(classifyInbound("chegadinha").kind, "free_text");
});

Deno.test("etapa 113: texto livre preserva o original para o operador ler", () => {
  const r = classifyInbound("o cliente pediu para ligar no 11 99999-0000");
  assertEquals(r.kind, "free_text");
  if (r.kind === "free_text") {
    assertEquals(r.text, "o cliente pediu para ligar no 11 99999-0000");
  }
});

Deno.test("etapa 113: mensagem vazia nao quebra", () => {
  assertEquals(classifyInbound("   ").kind, "free_text");
  assertEquals(classifyInbound("").kind, "free_text");
});
