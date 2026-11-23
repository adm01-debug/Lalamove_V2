import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeSignature,
  parseSignatureHeader,
  REPLAY_WINDOW_SECONDS,
  timingSafeEqual,
  verifyCallbackSignature,
} from "./security.ts";

const SECRET = "zapp-callback-secret-de-teste";
const NOW_MS = Date.UTC(2026, 10, 25, 12, 0, 0); // 2026-11-25T12:00:00Z
const NOW_S = Math.floor(NOW_MS / 1000);

async function sign(body: string, ts = NOW_S, secret = SECRET) {
  const v1 = await computeSignature(ts, body, secret);
  return `t=${ts},v1=${v1}`;
}

Deno.test("parseSignatureHeader le t e v1", () => {
  const parsed = parseSignatureHeader("t=1700000000,v1=ABC123");
  assertExists(parsed);
  assertEquals(parsed.timestamp, 1700000000);
  assertEquals(parsed.signature, "abc123");
});

Deno.test("parseSignatureHeader aceita espacos e ordem invertida", () => {
  const parsed = parseSignatureHeader(" v1=deadbeef , t=1700000000 ");
  assertExists(parsed);
  assertEquals(parsed.timestamp, 1700000000);
  assertEquals(parsed.signature, "deadbeef");
});

Deno.test("parseSignatureHeader rejeita header ausente ou malformado", () => {
  assertEquals(parseSignatureHeader(null), null);
  assertEquals(parseSignatureHeader(""), null);
  assertEquals(parseSignatureHeader("t=abc,v1=aa"), null);
  assertEquals(parseSignatureHeader("t=1700000000"), null);
  assertEquals(parseSignatureHeader("v1=deadbeef"), null);
  assertEquals(parseSignatureHeader("t=0,v1=aa"), null);
  assertEquals(parseSignatureHeader("t=1700000000,v1=naohex"), null);
});

Deno.test("timingSafeEqual compara conteudo e tamanho", () => {
  assertEquals(timingSafeEqual("abc", "abc"), true);
  assertEquals(timingSafeEqual("abc", "abd"), false);
  assertEquals(timingSafeEqual("abc", "abcd"), false);
});

Deno.test("assinatura valida passa", async () => {
  const body = JSON.stringify({ event: "message.status", message_id: "m1", status: "delivered" });
  const header = await sign(body);
  const result = await verifyCallbackSignature({ secret: SECRET, rawBody: body, header, now: NOW_MS });
  assertEquals(result.valid, true);
  assertEquals(result.timestamp, NOW_S);
});

Deno.test("corpo alterado invalida a assinatura", async () => {
  const body = JSON.stringify({ event: "message.status", message_id: "m1", status: "delivered" });
  const header = await sign(body);
  const alterado = body.replace("delivered", "failed");
  const result = await verifyCallbackSignature({ secret: SECRET, rawBody: alterado, header, now: NOW_MS });
  assertEquals(result.valid, false);
  assertEquals(result.reason, "signature_mismatch");
});

Deno.test("segredo diferente invalida a assinatura", async () => {
  const body = '{"event":"message.status"}';
  const header = await sign(body, NOW_S, "outro-segredo");
  const result = await verifyCallbackSignature({ secret: SECRET, rawBody: body, header, now: NOW_MS });
  assertEquals(result.valid, false);
  assertEquals(result.reason, "signature_mismatch");
});

Deno.test("sem segredo configurado rejeita (fail-closed)", async () => {
  const body = '{"event":"message.status"}';
  const header = await sign(body);
  const result = await verifyCallbackSignature({ secret: "", rawBody: body, header, now: NOW_MS });
  assertEquals(result.valid, false);
  assertEquals(result.reason, "callback_secret_not_configured");
});

Deno.test("sem header rejeita", async () => {
  const result = await verifyCallbackSignature({
    secret: SECRET,
    rawBody: "{}",
    header: null,
    now: NOW_MS,
  });
  assertEquals(result.valid, false);
  assertEquals(result.reason, "malformed_signature_header");
});

Deno.test("carimbo velho alem da janela e replay", async () => {
  const body = '{"event":"message.status"}';
  const ts = NOW_S - REPLAY_WINDOW_SECONDS - 1;
  const header = await sign(body, ts);
  const result = await verifyCallbackSignature({ secret: SECRET, rawBody: body, header, now: NOW_MS });
  assertEquals(result.valid, false);
  assertEquals(result.reason, "timestamp_expired");
});

Deno.test("carimbo no limite da janela ainda passa", async () => {
  const body = '{"event":"message.status"}';
  const ts = NOW_S - REPLAY_WINDOW_SECONDS;
  const header = await sign(body, ts);
  const result = await verifyCallbackSignature({ secret: SECRET, rawBody: body, header, now: NOW_MS });
  assertEquals(result.valid, true);
});

Deno.test("carimbo no futuro alem da janela e rejeitado", async () => {
  const body = '{"event":"message.status"}';
  const ts = NOW_S + REPLAY_WINDOW_SECONDS + 5;
  const header = await sign(body, ts);
  const result = await verifyCallbackSignature({ secret: SECRET, rawBody: body, header, now: NOW_MS });
  assertEquals(result.valid, false);
  assertEquals(result.reason, "timestamp_in_future");
});

Deno.test("janela customizada e respeitada", async () => {
  const body = '{"event":"message.status"}';
  const ts = NOW_S - 30;
  const header = await sign(body, ts);
  const estrito = await verifyCallbackSignature({
    secret: SECRET,
    rawBody: body,
    header,
    now: NOW_MS,
    windowSeconds: 10,
  });
  assertEquals(estrito.valid, false);
  assertEquals(estrito.reason, "timestamp_expired");
});