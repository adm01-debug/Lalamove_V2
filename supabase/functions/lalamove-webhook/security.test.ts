// Testes do gate de assinatura HMAC do webhook (fail-closed).
// Rodam in-memory (só WebCrypto local, sem rede). Executados no job contract-tests do CI.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { encode } from "https://deno.land/std@0.190.0/encoding/hex.ts";
import { timingSafeEqual, validateHmacSignature } from "./security.ts";

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
