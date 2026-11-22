import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSmsBody, dispatchSms } from "./sms-dispatch.ts";
import type { SmsChannel } from "../_shared/channels/sms.ts";

function fakeChannel(overrides: Partial<SmsChannel> = {}) {
  const sent: Array<{ to: string; text: string; ref?: string }> = [];
  const channel: SmsChannel = {
    name: "fake",
    send: async (to, text, ref) => {
      sent.push({ to, text, ref });
      return { success: true, providerId: "p1", segments: 1 };
    },
    parseDeliveryReport: () => null,
    parseInbound: () => null,
    ...overrides,
  };
  return { channel, sent };
}

Deno.test("buildSmsBody junta titulo, mensagem e pedido sem partes vazias", () => {
  assertEquals(buildSmsBody("Atraso", "Motorista a 10 min"), "Atraso. Motorista a 10 min");
  assertEquals(buildSmsBody("Atraso", "Motorista a 10 min", "LALA-1"), "Atraso. Motorista a 10 min. Pedido: LALA-1");
  assertEquals(buildSmsBody("Atraso", "", null), "Atraso");
  assertEquals(buildSmsBody("", "   ", undefined), "");
});

Deno.test("sem provedor configurado devolve erro explicito e nao envia", async () => {
  const result = await dispatchSms({ channel: null, number: "41999998888", title: "T", message: "M" });
  assertEquals(result.success, false);
  assertEquals(result.error, "SMS provider not configured");
  assertEquals(result.text, undefined);
});

Deno.test("dispatchSms repassa o texto montado e a referencia do pedido", async () => {
  const { channel, sent } = fakeChannel();
  const result = await dispatchSms({
    channel,
    number: "(41) 99999-8888",
    title: "Pedido cancelado",
    message: "O pedido LALA-9 foi cancelado",
    orderId: "LALA-9",
  });

  assertEquals(result.success, true);
  assertEquals(result.segments, 1);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].to, "(41) 99999-8888");
  assertEquals(sent[0].text, "Pedido cancelado. O pedido LALA-9 foi cancelado. Pedido: LALA-9");
  assertEquals(sent[0].ref, "LALA-9");
});

Deno.test("dispatchSms propaga a falha do provedor com o texto que tentou", async () => {
  const { channel } = fakeChannel({
    send: async () => ({ success: false, error: "Comtele API error: 401" }),
  });
  const result = await dispatchSms({ channel, number: "41999998888", title: "T", message: "M" });
  assertEquals(result.success, false);
  assertEquals(result.error, "Comtele API error: 401");
  assertEquals(result.text, "T. M");
});
Deno.test("etapa 125: share_link acompanha o SMS, mesmo fora do template", async () => {
  const sent: string[] = [];
  const fake = {
    name: "fake",
    send: (to: string, text: string) => {
      sent.push(text);
      return Promise.resolve({ success: true, segments: 1 });
    },
    parseDeliveryReport: () => null,
    parseInbound: () => null,
  };
  await dispatchSms({
    channel: fake as never,
    number: "5511999998888",
    title: "Motorista a caminho",
    message: "Chega em 10 min",
    orderId: "ORD-1",
    shareLink: "https://lalamo.ve/abc",
  });
  assertEquals(sent[0], "Motorista a caminho. Chega em 10 min. Pedido: ORD-1. https://lalamo.ve/abc");
});

Deno.test("etapa 125: link vazio nao deixa separador solto", () => {
  assertEquals(buildSmsBody("Titulo", "Corpo", "ORD-1", null), "Titulo. Corpo. Pedido: ORD-1");
  assertEquals(buildSmsBody("Titulo", "Corpo", null, "   "), "Titulo. Corpo");
});
