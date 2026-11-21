// HMAC signature verification for the Lalamove webhook.
// Extracted from index.ts so the security-critical logic is unit-testable.
import { encode } from "https://deno.land/std@0.190.0/encoding/hex.ts";
import { logger } from "../_shared/logger.ts";

// ── Timing-Safe Comparison ──
// Constant-time equality check to prevent timing attacks on signature comparison.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── HMAC Validation (FAIL-CLOSED) ──
// If the signing secret is not configured, the request is REJECTED — the webhook
// never accepts an unverified payload. This prevents forged deliveries whenever
// LALAMOVE_API_SECRET is missing (rotation gap, misconfiguration, fresh env).
export async function validateHmacSignature(
  body: string, signature: string | null, secret: string
): Promise<{ valid: boolean; reason?: string }> {
  if (!secret) {
    logger.error('[Webhook] LALAMOVE_API_SECRET not configured — rejecting webhook (fail-closed)');
    return { valid: false, reason: 'Server misconfiguration: signing secret not configured' };
  }
  if (!signature) return { valid: false, reason: 'Missing signature header' };

  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(body));
    const computedSignature = new TextDecoder().decode(encode(new Uint8Array(signatureBuffer))).toLowerCase();
    const signatureToCompare = signature.toLowerCase().replace(/^sha256=/, '').trim();
    const isValid = timingSafeEqual(computedSignature, signatureToCompare);

    if (!isValid) logger.log(`[Webhook] Signature mismatch (constant-time check failed)`);
    return { valid: isValid, reason: isValid ? 'Signature valid' : 'Signature mismatch' };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[Webhook] HMAC validation error:', errorMsg);
    return { valid: false, reason: `Validation error: ${errorMsg}` };
  }
}

// ── Lalamove v3 body-signature validation ──
// Formula oficial (v3_Webhook_v1.5.pdf p.8 + sample code da Lalamove):
//   raw      = `${timestamp}\r\nPOST\r\n${path}\r\n\r\n${JSON.stringify(data)}`
//   expected = hex(HMAC_SHA256(raw, API_SECRET))
//   valido quando expected === payload.signature
// path = caminho da URL registrada apos o dominio (ex: /functions/v1/lalamove-webhook).
// Aceita uma lista de paths candidatos porque o runtime pode reescrever o
// pathname visto pela function; a assinatura continua obrigatoria em todos.
export async function validateLalamoveV3Signature(
  payload: { timestamp?: unknown; signature?: unknown; data?: unknown },
  paths: string[],
  secret: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!secret) {
    logger.error('[Webhook] LALAMOVE_API_SECRET not configured — rejecting webhook (fail-closed)');
    return { valid: false, reason: 'Server misconfiguration: signing secret not configured' };
  }
  const { timestamp, signature, data } = payload;
  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') {
    return { valid: false, reason: 'Missing timestamp in body' };
  }
  if (typeof signature !== 'string' || !signature) {
    return { valid: false, reason: 'Missing signature in body' };
  }
  if (data === undefined) return { valid: false, reason: 'Missing data in body' };

  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const body = JSON.stringify(data);
    const expected = signature.toLowerCase().trim();
    for (const path of [...new Set(paths)]) {
      const raw = `${timestamp}\r\nPOST\r\n${path}\r\n\r\n${body}`;
      const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(raw));
      const computed = new TextDecoder().decode(encode(new Uint8Array(sigBuf))).toLowerCase();
      if (timingSafeEqual(computed, expected)) {
        return { valid: true, reason: 'Signature valid (v3 body)' };
      }
    }
    return { valid: false, reason: 'Signature mismatch (v3 body)' };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[Webhook] HMAC v3 validation error:', errorMsg);
    return { valid: false, reason: `Validation error: ${errorMsg}` };
  }
}
