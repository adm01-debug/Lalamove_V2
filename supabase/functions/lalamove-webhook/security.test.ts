// Testes do gate de assinatura HMAC do webhook (fail-closed).
// Rodam in-memory (só WebCrypto local, sem rede). Executados no job contract-tests do CI.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { encode } from "https://deno.land/std@0.190.0/encoding/hex.ts";
import { timingSafeEqual, validateHmacSignature, classifySignatureFailure } from "./security.ts";

const SECRET = "test-secret-abc123";

async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return new TextDecoder().decode(encode(new Uint8Array(buf)));
}

Deno.test("[HMAC] FAIL-CLOSED: secret ausente rejeita mesmo com assinatura válida presente", async () => {
  const body = '{"event":"ORDER_STATUS_CHANGED","orderId":"ORD-1"}';
  const validSig = await sign(body, SECRET);
  const r = await validateHmacSignature(body, validSig, "");
  assertEquals(r.valid, false);
});

Deno.test("[HMAC] assinatura correta é aceita", async () => {
  const body = '{"event":"ORDER_STATUS_CHANGED","orderId":"ORD-1"}';
  const sig = await sign(body, SECRET);
  const r = await validateHmacSignature(body, sig, SECRET);
  assertEquals(r.valid, true);
});

Deno.test("[HMAC] assinatura incorreta é rejeitada", async () => {
  const r = await validateHmacSignature('{"event":"X"}', "deadbeefdeadbeef", SECRET);
  assertEquals(r.valid, false);
});

Deno.test("[HMAC] prefixo sha256= e caixa alta são normalizados", async () => {
  const body = '{"a":1}';
  const sig = await sign(body, SECRET);
  const r = await validateHmacSignature(body, "sha256=" + sig.toUpperCase(), SECRET);
  assertEquals(r.valid, true);
});

Deno.test("[HMAC] com secret configurado, header de assinatura ausente é rejeitado", async () => {
  const r = await validateHmacSignature('{"a":1}', null, SECRET);
  assertEquals(r.valid, false);
});

Deno.test("[HMAC] corpo adulterado invalida a assinatura", async () => {
  const sig = await sign('{"amount":10}', SECRET);
  const r = await validateHmacSignature('{"amount":99999}', sig, SECRET);
  assertEquals(r.valid, false);
});

Deno.test("[HMAC] timingSafeEqual: igualdade, diferença e tamanhos distintos", () => {
  assertEquals(timingSafeEqual("abc", "abc"), true);
  assertEquals(timingSafeEqual("abc", "abd"), false);
  assertEquals(timingSafeEqual("abc", "ab"), false);
});

// ── Assinatura v3 no corpo (formula oficial) ──
import { validateLalamoveV3Signature } from "./security.ts";
import { normalizeLalamoveV3Payload } from "./normalize.ts";

const WEBHOOK_PATH = "/functions/v1/lalamove-webhook";

async function signV3(timestamp: number | string, path: string, data: unknown, secret: string): Promise<string> {
  const raw = `${timestamp}\r\nPOST\r\n${path}\r\n\r\n${JSON.stringify(data)}`;
  return await sign(raw, secret);
}

Deno.test("[HMAC v3] assinatura valida no corpo e aceita", async () => {
  const data = { order: { orderId: "3463513590991397204", status: "ASSIGNING_DRIVER" }, updatedAt: "2026-04-01T15:10:00.00Z" };
  const ts = 1775027436;
  const payload = { timestamp: ts, signature: await signV3(ts, WEBHOOK_PATH, data, SECRET), data };
  const r = await validateLalamoveV3Signature(payload, [WEBHOOK_PATH], SECRET);
  assertEquals(r.valid, true);
});

Deno.test("[HMAC v3] assinatura errada e rejeitada", async () => {
  const data = { order: { orderId: "1" } };
  const payload = { timestamp: 1775027436, signature: "deadbeef", data };
  const r = await validateLalamoveV3Signature(payload, [WEBHOOK_PATH], SECRET);
  assertEquals(r.valid, false);
});

Deno.test("[HMAC v3] FAIL-CLOSED sem secret", async () => {
  const data = { order: { orderId: "1" } };
  const ts = 1775027436;
  const payload = { timestamp: ts, signature: await signV3(ts, WEBHOOK_PATH, data, SECRET), data };
  const r = await validateLalamoveV3Signature(payload, [WEBHOOK_PATH], "");
  assertEquals(r.valid, false);
});

Deno.test("[HMAC v3] path alternativo na lista tambem valida", async () => {
  const data = { x: 1 };
  const ts = 1775027436;
  const payload = { timestamp: ts, signature: await signV3(ts, "/lalamove-webhook", data, SECRET), data };
  const r = await validateLalamoveV3Signature(payload, [WEBHOOK_PATH, "/lalamove-webhook"], SECRET);
  assertEquals(r.valid, true);
});

// ── Normalizacao v3 -> contrato interno (payloads oficiais do PDF v1.5) ──

Deno.test("[v3 normalize] ORDER_STATUS_CHANGED (PDF p.14): event/orderId/status/timestamp", () => {
  const raw = JSON.stringify({
    apiKey: "pk_test_x", timestamp: 1775027436, signature: "s",
    eventId: "DFAF4ABA-B8EA-4CD8-9A9E-F0BEDA70C803",
    eventType: "ORDER_STATUS_CHANGED", eventVersion: "v3",
    data: {
      order: { orderId: "3463513590991397204", scheduleAt: "2026-04-01T15:10:00.00Z", market: "HK_HKG", driverId: "", previousStatus: "", status: "ASSIGNING_DRIVER" },
      updatedAt: "2026-04-01T15:10:00.00Z",
    },
  });
  const out = JSON.parse(normalizeLalamoveV3Payload(JSON.parse(raw), raw));
  assertEquals(out.event, "ORDER_STATUS_CHANGED");
  assertEquals(out.orderId, "3463513590991397204");
  assertEquals(out.data.status, "ASSIGNING_DRIVER");
  assertEquals(out.timestamp, "2026-04-01T15:10:00.00Z");
  assertEquals(out.eventId, "DFAF4ABA-B8EA-4CD8-9A9E-F0BEDA70C803");
});

Deno.test("[v3 normalize] DRIVER_ASSIGNED (PDF p.22): campos do driver sobem renomeados", () => {
  const raw = JSON.stringify({
    timestamp: 1775027622, signature: "s", eventId: "E", eventType: "DRIVER_ASSIGNED", eventVersion: "v3",
    data: {
      driver: { driverId: "79973", phone: "+85288888888", name: "TestDriver 88888", photo: "", plateNumber: "VP7815702" },
      location: { lng: 114.055, lat: 22.575 },
      order: { orderId: "3463513590991397204" },
      updatedAt: "2026-04-01T15:13:00.00Z",
    },
  });
  const out = JSON.parse(normalizeLalamoveV3Payload(JSON.parse(raw), raw));
  assertEquals(out.event, "DRIVER_ASSIGNED");
  assertEquals(out.orderId, "3463513590991397204");
  assertEquals(out.data.driverId, "79973");
  assertEquals(out.data.driverName, "TestDriver 88888");
  assertEquals(out.data.driverPhone, "+85288888888");
  assertEquals(out.data.driverPlate, "VP7815702");
});

Deno.test("[v3 normalize] WALLET_BALANCE_CHANGED (PDF p.26): balance vira escalar, sem orderId", () => {
  const raw = JSON.stringify({
    timestamp: 1775026642, signature: "s", eventType: "WALLET_BALANCE_CHANGED", eventVersion: "v3",
    data: { balance: { amount: "99858", currency: "HKD" }, updatedAt: "2026-04-01T14:57:00.00Z" },
  });
  const out = JSON.parse(normalizeLalamoveV3Payload(JSON.parse(raw), raw));
  assertEquals(out.event, "WALLET_BALANCE_CHANGED");
  assertEquals(out.orderId, null);
  assertEquals(out.data.balance, "99858");
  assertEquals(out.data.currency, "HKD");
});

Deno.test("[v3 normalize] ORDER_AMOUNT_CHANGED (PDF p.24): priceBreakdown e priorityFee", () => {
  const raw = JSON.stringify({
    timestamp: 1775029438, signature: "s", eventType: "ORDER_AMOUNT_CHANGED", eventVersion: "v3",
    data: {
      balance: { amount: "99802", currency: "HKD" },
      order: { orderId: "3463486036435772011", market: "HK_HKG", price: { totalPrice: "104", priorityFee: "10", currency: "HKD", subTotal: "94" }, status: "ASSIGNING_DRIVER" },
      updatedAt: "2026-04-01T15:43:00.00Z",
    },
  });
  const out = JSON.parse(normalizeLalamoveV3Payload(JSON.parse(raw), raw));
  assertEquals(out.data.priceBreakdown.total, "104");
  assertEquals(out.data.priorityFee, "10");
  assertEquals(out.orderId, "3463486036435772011");
});

Deno.test("[v3 normalize] corpo legado (formato interno) passa intacto", () => {
  const raw = '{"event":"ORDER_STATUS_CHANGED","orderId":"X","data":{"status":"COMPLETED"}}';
  assertEquals(normalizeLalamoveV3Payload(JSON.parse(raw), raw), raw);
});

Deno.test("[v3 normalize] timestamp epoch em segundos vira ISO quando nao ha updatedAt", () => {
  const raw = JSON.stringify({ timestamp: 1775027436, signature: "s", eventType: "ORDER_STATUS_CHANGED", data: { order: { orderId: "1" } } });
  const out = JSON.parse(normalizeLalamoveV3Payload(JSON.parse(raw), raw));
  assertEquals(out.timestamp, new Date(1775027436 * 1000).toISOString());
});

// ── Classificacao de rejeicao: probe sem assinatura x falha real ──
// Sem essa separacao, toda varredura externa que bate no endpoint virava
// alerta CRITICAL INTEGRATION_FAILURE (1.331 alertas abertos em producao).
Deno.test("[classify] request sem nenhuma assinatura vira SIGNATURE_MISSING (nao alerta)", () => {
  assertEquals(classifySignatureFailure(false), "SIGNATURE_MISSING");
});

Deno.test("[classify] assinatura presente e invalida continua SIGNATURE_INVALID (alerta)", () => {
  assertEquals(classifySignatureFailure(true), "SIGNATURE_INVALID");
});

Deno.test("[classify] corpo vazio e sem header: probe real de producao", async () => {
  const res = await validateHmacSignature("{}", null, SECRET);
  assertEquals(res.valid, false);
  assertEquals(res.reason, "Missing signature header");
  const hasAnySignature = Boolean(null);
  assertEquals(classifySignatureFailure(hasAnySignature), "SIGNATURE_MISSING");
});

Deno.test("[classify] assinatura errada no header permanece falha real", async () => {
  const res = await validateHmacSignature('{"a":1}', "deadbeef", SECRET);
  assertEquals(res.valid, false);
  assertEquals(classifySignatureFailure(Boolean("deadbeef")), "SIGNATURE_INVALID");
});
