import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createZappChannel, normalizeZappNumber, zappChannelFromEnv } from "./zapp.ts";

function fakeFetch(status: number, body = "", captured: { url?: string; init?: RequestInit } = {}): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) => {
    captured.url = String(url);
    captured.init = init;
    return Promise.resolve(new Response(body, { status }));
  }) as typeof fetch;
}

Deno.test("zapp: envia POST com Bearer, número só com dígitos e corpo JSON", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com/",
    apiKey: "key-123",
    instance: "promo",
    fetchImpl: fakeFetch(200, "{}", captured),
  });

  const result = await channel.sendText("+55 (41) 99999-8888", "Olá");

  assertEquals(result, { success: true });
  assertEquals(captured.url, "https://zapp.example.com/messages/send-text");
  const headers = captured.init!.headers as Record<string, string>;
  assertEquals(headers.Authorization, "Bearer key-123");
  assertEquals(headers["Content-Type"], "application/json");
  assertEquals(JSON.parse(String(captured.init!.body)), {
    number: "5541999998888",
    text: "Olá",
    instance: "promo",
  });
});

Deno.test("zapp: omite instance quando ausente", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(200, "", captured),
  });

  await channel.sendText("5541999998888", "x");

  assert(!("instance" in JSON.parse(String(captured.init!.body))));
});

Deno.test("zapp: destinatário vazio não chama a API", async () => {
  let called = false;
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: ((..._a: unknown[]) => { called = true; return Promise.resolve(new Response("", { status: 200 })); }) as unknown as typeof fetch,
  });

  const result = await channel.sendText("****", "Olá");

  assertEquals(result.success, false);
  assert(result.error?.includes("inválido"));
  assertEquals(called, false);
});

Deno.test("zapp: erro HTTP devolve status e trecho do corpo", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(401, '{"message":"invalid token"}'),
  });

  const result = await channel.sendText("5541999998888", "x");

  assertEquals(result.success, false);
  assert(result.error?.includes("401"));
  assert(result.error?.includes("invalid token"));
});

Deno.test("zapp: falha de rede devolve erro sem lançar", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: (() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch,
  });

  const result = await channel.sendText("5541999998888", "x");

  assertEquals(result.success, false);
  assertEquals(result.error, "ECONNREFUSED");
});

Deno.test("zapp: timeout devolve mensagem de timeout", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    timeoutMs: 5,
    fetchImpl: ((_u: unknown, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new Error("The signal has been aborted")));
      })) as unknown as typeof fetch,
  });

  const result = await channel.sendText("5541999998888", "x");

  assertEquals(result.success, false);
  assert(result.error?.includes("timeout"));
});

Deno.test("zapp: sem secrets o canal é ausente (null), não quebrado", () => {
  assertEquals(zappChannelFromEnv(() => undefined), null);
  assertEquals(zappChannelFromEnv((k) => (k === "ZAPP_API_URL" ? "https://z.example.com" : undefined)), null);
  assertEquals(zappChannelFromEnv((k) => (k === "ZAPP_API_KEY" ? "key" : undefined)), null);
});

Deno.test("zapp: com os dois secrets monta o canal", () => {
  const channel = zappChannelFromEnv((k) =>
    k === "ZAPP_API_URL" ? "https://z.example.com" : k === "ZAPP_API_KEY" ? "key" : undefined
  );
  assert(channel !== null);
  assertEquals(channel!.name, "zapp");
});

Deno.test("normalizeZappNumber remove máscara e não-dígitos", () => {
  assertEquals(normalizeZappNumber("+55 (41) 99999-8888"), "5541999998888");
  assertEquals(normalizeZappNumber("****"), "");
  assertEquals(normalizeZappNumber(""), "");
});

// Etapa 68: imagem do trajeto. O data URL vira base64 puro + mimetype.
Deno.test("zapp: sendMedia envia imagem com caption e mimetype extraído do data URL", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "key-123",
    fetchImpl: fakeFetch(200, "{}", captured),
  });

  const result = await channel.sendMedia!(
    "+55 (41) 99999-8888",
    "data:image/png;base64,QUJD",
    "Motorista a 3 min",
  );

  assertEquals(result, { success: true });
  assertEquals(captured.url, "https://zapp.example.com/messages/send-media");
  const headers = captured.init!.headers as Record<string, string>;
  assertEquals(headers.Authorization, "Bearer key-123");
  assertEquals(JSON.parse(String(captured.init!.body)), {
    number: "5541999998888",
    mediatype: "image",
    mimetype: "image/png",
    media: "QUJD",
    caption: "Motorista a 3 min",
  });
});

Deno.test("zapp: sendMedia recusa mídia que não é data URL de imagem", async () => {
  const captured: { url?: string } = {};
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(200, "{}", captured as never),
  });

  const result = await channel.sendMedia!("5541999998888", "https://exemplo/x.png");

  assertEquals(result.success, false);
  assertEquals(captured.url, undefined);
});

Deno.test("zapp: sendMedia com destinatário vazio não chama a API", async () => {
  const captured: { url?: string } = {};
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(200, "{}", captured as never),
  });

  const result = await channel.sendMedia!("   ", "data:image/png;base64,QUJD");

  assertEquals(result.success, false);
  assertEquals(captured.url, undefined);
});

// ── Etapa 86: correlação, 202 {message_id} e códigos da etapa 14 ──────────────

Deno.test("etapa 86: envia client_message_id, correlation e expires_at", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(202, '{"message_id":"msg-1"}', captured),
  });

  await channel.sendText("5541999998888", "oi", {
    clientMessageId: "3f2a-uuid",
    correlation: "ORDER_DELAYED:order-9:driver",
    expiresAt: "2026-11-25T18:00:00.000Z",
  });

  const body = JSON.parse(String(captured.init!.body));
  assertEquals(body.client_message_id, "3f2a-uuid");
  assertEquals(body.correlation, "ORDER_DELAYED:order-9:driver");
  assertEquals(body.expires_at, "2026-11-25T18:00:00.000Z");
});

Deno.test("etapa 86: ttlMinutes vira expires_at calculado sobre o relógio injetado", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(202, "{}", captured),
  });

  await channel.sendText("5541999998888", "oi", { ttlMinutes: 10 });
  const body = JSON.parse(String(captured.init!.body));
  const delta = new Date(body.expires_at).getTime() - Date.now();
  assert(delta > 9 * 60_000 && delta <= 10 * 60_000 + 2_000, `delta inesperado: ${delta}`);
});

Deno.test("etapa 86: sem options o corpo não ganha campo de correlação", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(202, "{}", captured),
  });

  await channel.sendText("5541999998888", "oi");
  const body = JSON.parse(String(captured.init!.body));
  assert(!("client_message_id" in body));
  assert(!("correlation" in body));
});

Deno.test("etapa 86: lê 202 {message_id} e devolve providerMessageId", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(202, '{"message_id":"wamid.abc"}'),
  });

  const result = await channel.sendText("5541999998888", "oi", { clientMessageId: "c1" });
  assertEquals(result.success, true);
  assertEquals(result.providerMessageId, "wamid.abc");
});

Deno.test("etapa 86: 202 sem id aceita o envio e não inventa id", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(202, '{"ok":true}'),
  });

  const result = await channel.sendText("5541999998888", "oi");
  assertEquals(result, { success: true });
});

Deno.test("etapa 86: 404 vira invalid_number com fallback imediato para SMS", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(404, '{"error":"number not on whatsapp"}'),
  });

  const result = await channel.sendText("5541999998888", "oi");
  assertEquals(result.success, false);
  assertEquals(result.errorCode, "invalid_number");
  assertEquals(result.action, "fallback");
});

Deno.test("etapa 86: 401 vira unauthorized com give_up (não adianta repetir)", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(401, ""),
  });

  const result = await channel.sendText("5541999998888", "oi");
  assertEquals(result.errorCode, "unauthorized");
  assertEquals(result.action, "give_up");
});

Deno.test("etapa 86: 429 vira rate_limited com retry", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(429, ""),
  });

  const result = await channel.sendText("5541999998888", "oi");
  assertEquals(result.errorCode, "rate_limited");
  assertEquals(result.action, "retry");
});

Deno.test("etapa 86: 503 vira instance_unavailable com fallback", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(503, ""),
  });

  const result = await channel.sendText("5541999998888", "oi");
  assertEquals(result.errorCode, "instance_unavailable");
  assertEquals(result.action, "fallback");
});

Deno.test("etapa 86: error.code do corpo tem precedência sobre o status HTTP", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(400, '{"error":{"code":"recipient_opted_out"}}'),
  });

  const result = await channel.sendText("5541999998888", "oi");
  assertEquals(result.errorCode, "recipient_opted_out");
  assertEquals(result.action, "fallback");
});

Deno.test("etapa 86: código desconhecido pede alerta à operação", async () => {
  const channel = createZappChannel({
    apiUrl: "https://zapp.example.com",
    apiKey: "k",
    fetchImpl: fakeFetch(400, '{"error":{"code":"codigo_novo_do_provedor"}}'),
  });

  const result = await channel.sendText("5541999998888", "oi");
  assertEquals(result.action, "alert");
});
