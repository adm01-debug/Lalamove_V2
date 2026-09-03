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
