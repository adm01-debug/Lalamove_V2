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
