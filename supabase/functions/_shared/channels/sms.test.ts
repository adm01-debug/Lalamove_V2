import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  composeSmsText,
  createComteleChannel,
  createZenviaChannel,
  normalizeSmsNumber,
  smsChannelFromEnv,
  smsSegments,
  toGsm7,
} from "./sms.ts";

function fakeFetch(status: number, body: unknown) {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

Deno.test("toGsm7 remove acento para nao pagar 2 segmentos", () => {
  assertEquals(toGsm7("Atraso na coleta em Curitiba"), "Atraso na coleta em Curitiba");
  assertEquals(toGsm7("Atraso na coleta. Ação à vista, coração"), "Atraso na coleta. Acao a vista, coracao");
  // Qualquer resto fora do GSM-7 vira "?" em vez de dobrar o custo em UCS-2.
  assertEquals(toGsm7("日本"), "??");
});

Deno.test("smsSegments conta 160 no primeiro e 153 nos seguintes", () => {
  assertEquals(smsSegments(""), 0);
  assertEquals(smsSegments("a".repeat(160)), 1);
  assertEquals(smsSegments("a".repeat(161)), 2);
  assertEquals(smsSegments("a".repeat(153 * 2)), 2);
  assertEquals(smsSegments("a".repeat(153 * 2 + 1)), 3);
});

Deno.test("composeSmsText corta no espaco e sinaliza truncamento", () => {
  const long = "Atraso na coleta ".repeat(30);
  const out = composeSmsText(long, 160);
  assertEquals(out.truncated, true);
  assertEquals(out.text.endsWith("..."), true);
  assertEquals(out.text.length <= 163, true);
  assertEquals(out.text.includes("  "), false);
  // 320 e o teto padrao: 2 segmentos no pior caso.
  assertEquals(composeSmsText("a".repeat(500)).segments <= 3, true);
});

Deno.test("composeSmsText nao trunca mensagem curta", () => {
  const out = composeSmsText("Pedido 1234 saiu para entrega");
  assertEquals(out.truncated, false);
  assertEquals(out.segments, 1);
});

Deno.test("normalizeSmsNumber deixa so digitos", () => {
  assertEquals(normalizeSmsNumber("(41) 99999-8888"), "41999998888");
  assertEquals(normalizeSmsNumber("+55 41 99999-8888"), "5541999998888");
  assertEquals(normalizeSmsNumber(""), "");
});

Deno.test("Comtele envia transliterado e devolve providerId e segmentos", async () => {
  let sent: { body?: any; headers?: any } = {};
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent = { body: JSON.parse(String(init?.body)), headers: init?.headers };
    return new Response(JSON.stringify({ data: { id: "cmt-1" } }), { status: 200 });
  }) as typeof fetch;

  const channel = createComteleChannel({ apiKey: "k", sender: "PromoBrindes", fetchImpl });
  const result = await channel.send("(41) 99999-8888", "Ação na coleta", "order-1");

  assertEquals(result.success, true);
  assertEquals(result.providerId, "cmt-1");
  assertEquals(result.segments, 1);
  assertEquals(sent.body.receiver, "41999998888");
  assertEquals(sent.body.content, "Acao na coleta");
  assertEquals(sent.body.tag, "order-1");
  assertEquals((sent.headers as Record<string, string>)["auth-key"], "k");
});

Deno.test("Comtele devolve erro legivel quando o provedor recusa", async () => {
  const channel = createComteleChannel({ apiKey: "k", fetchImpl: fakeFetch(401, { error: "invalid key" }) });
  const result = await channel.send("41999998888", "oi");
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? "", "401");
});

Deno.test("canal sem destinatario nao chama a API", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const result = await createComteleChannel({ apiKey: "k", fetchImpl }).send("   ", "oi");
  assertEquals(result.success, false);
  assertEquals(called, false);
});

Deno.test("Comtele interpreta DLR em portugues e resposta inbound", () => {
  const channel = createComteleChannel({ apiKey: "k" });
  assertEquals(channel.parseDeliveryReport({ data: { id: "x", status: "entregue" } })?.status, "delivered");
  assertEquals(channel.parseDeliveryReport({ data: { id: "x", status: "falha" } })?.status, "failed");
  assertEquals(channel.parseDeliveryReport({ data: { id: "x", status: "enviado" } })?.status, "sent");
  assertEquals(channel.parseDeliveryReport({ data: { id: "x", status: "??" } })?.status, "unknown");
  assertEquals(channel.parseDeliveryReport({}), null);

  assertEquals(channel.parseInbound({ data: { cellphone: "5541999998888", message: "1" } }), {
    from: "5541999998888",
    text: "1",
    providerId: undefined,
  });
  assertEquals(channel.parseInbound({ data: { message: "1" } }), null);
});

Deno.test("Zenvia prefixa 55 sem duplicar e interpreta os codigos de status", async () => {
  let sent: any = {};
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "zv-1" }), { status: 200 });
  }) as typeof fetch;

  const channel = createZenviaChannel({ apiKey: "k", sender: "PromoBrindes", fetchImpl });
  const result = await channel.send("41999998888", "oi", "order-1");

  assertEquals(result.success, true);
  assertEquals(sent.to, "5541999998888");
  assertEquals(channel.parseDeliveryReport({ id: "zv-1", messageStatus: { code: 400 } })?.status, "delivered");
  assertEquals(channel.parseDeliveryReport({ id: "zv-1", messageStatus: { code: 500 } })?.status, "failed");
  assertEquals(channel.parseDeliveryReport({ id: "zv-1", messageStatus: { code: 100 } })?.status, "sent");
  assertEquals(channel.parseInbound({ id: "zv-1", from: "5541999998888", contents: [{ text: "SAIR" }] })?.text, "SAIR");
});

Deno.test("seletor devolve null sem secret e escolhe por SMS_PROVIDER", () => {
  assertEquals(smsChannelFromEnv(() => undefined), null);
  assertEquals(smsChannelFromEnv((k) => (k === "SMS_PROVIDER_API_KEY" ? "k" : undefined))?.name, "comtele");
  assertEquals(
    smsChannelFromEnv((k) => (k === "SMS_PROVIDER_API_KEY" ? "k" : k === "SMS_PROVIDER" ? "zenvia" : undefined))?.name,
    "zenvia",
  );
  // Provedor desconhecido nao vira canal quebrado.
  assertEquals(
    smsChannelFromEnv((k) => (k === "SMS_PROVIDER_API_KEY" ? "k" : k === "SMS_PROVIDER" ? "twilio" : undefined)),
    null,
  );
});