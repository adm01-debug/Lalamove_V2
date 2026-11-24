import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { whatsAppTestSender, WHATSAPP_TEST_MISSING_CONFIG } from "./whatsapp-test.ts";

const envFrom = (map: Record<string, string>): ((key: string) => string | undefined) =>
  (key) => map[key];

function fakeFetch(
  status: number,
  body = "",
  captured: { url?: string; init?: RequestInit } = {},
): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) => {
    captured.url = String(url);
    captured.init = init;
    return Promise.resolve(new Response(body, { status }));
  }) as typeof fetch;
}

Deno.test("teste whatsapp: usa Zapp quando ZAPP_API_URL/KEY existem", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const sender = whatsAppTestSender(
    envFrom({ ZAPP_API_URL: "https://zapp.example.com", ZAPP_API_KEY: "zkey" }),
    fakeFetch(202, JSON.stringify({ message_id: "m-1" }), captured),
  );

  assert(sender);
  assertEquals(sender.name, "zapp");
  const result = await sender.send("+55 41 99999-8888", "teste");

  assertEquals(result.success, true);
  assertEquals(result.providerMessageId, "m-1");
  assertEquals(captured.url, "https://zapp.example.com/messages/send-text");
  const headers = captured.init!.headers as Record<string, string>;
  assertEquals(headers.Authorization, "Bearer zkey");
});

Deno.test("teste whatsapp: cai no Evolution quando so ele tem secrets", async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const sender = whatsAppTestSender(
    envFrom({
      EVOLUTION_API_URL: "https://evo.example.com/",
      EVOLUTION_API_KEY: "ekey",
      EVOLUTION_INSTANCE_NAME: "promo",
    }),
    fakeFetch(200, "{}", captured),
  );

  assert(sender);
  assertEquals(sender.name, "evolution");
  const result = await sender.send("(41) 99999-8888", "teste");

  assertEquals(result.success, true);
  assertEquals(captured.url, "https://evo.example.com/message/sendText/promo");
  const headers = captured.init!.headers as Record<string, string>;
  assertEquals(headers.apikey, "ekey");
  assertEquals(JSON.parse(String(captured.init!.body)), {
    number: "41999998888",
    text: "teste",
  });
});

Deno.test("teste whatsapp: sem secrets devolve null e mensagem de configuracao", () => {
  const sender = whatsAppTestSender(envFrom({}), fakeFetch(200));
  assertEquals(sender, null);
  assert(WHATSAPP_TEST_MISSING_CONFIG.includes("ZAPP_API_URL"));
});

Deno.test("teste whatsapp: 401 do Evolution vira provider_rejected/give_up", async () => {
  const sender = whatsAppTestSender(
    envFrom({ EVOLUTION_API_URL: "https://evo.example.com", EVOLUTION_API_KEY: "ekey" }),
    fakeFetch(401, "unauthorized"),
  );

  assert(sender);
  const result = await sender.send("41999998888", "teste");

  assertEquals(result.success, false);
  assertEquals(result.errorCode, "provider_rejected");
  assertEquals(result.action, "give_up");
  assertEquals(result.httpStatus, 401);
});

Deno.test("teste whatsapp: numero vazio no Evolution nao chama a rede", async () => {
  let called = false;
  const fetchImpl = (() => {
    called = true;
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as unknown as typeof fetch;

  const sender = whatsAppTestSender(
    envFrom({ EVOLUTION_API_URL: "https://evo.example.com", EVOLUTION_API_KEY: "ekey" }),
    fetchImpl,
  );

  assert(sender);
  const result = await sender.send("   ", "teste");

  assertEquals(result.success, false);
  assertEquals(result.errorCode, "invalid_number");
  assertEquals(called, false);
});
