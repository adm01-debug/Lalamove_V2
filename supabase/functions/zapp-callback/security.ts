/**
 * Etapa 96 do plano de mensageria: assinatura e janela anti-replay do callback
 * do Zapp.
 *
 * Formato do header (etapa 15): X-Zapp-Signature: t=<unix_ts>,v1=<hmac_sha256>
 * onde o HMAC cobre `${t}.${corpoCru}`. O corpo precisa ser o texto literal da
 * requisicao - reasserializar o JSON muda espacos e quebra a assinatura.
 *
 * Igual ao webhook da Lalamove, a validacao e fail-closed: sem
 * ZAPP_CALLBACK_SECRET a edge rejeita. Um callback nao autenticado escreve no
 * ledger de mensagens, entao aceitar sem segredo seria pior que ficar fora do ar.
 */

import { encode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

/** Janela aceita entre o t do header e o relogio do servidor (etapa 15: 5 min). */
export const REPLAY_WINDOW_SECONDS = 5 * 60;

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export interface ParsedSignature {
  timestamp: number;
  signature: string;
}

/**
 * Le t=...,v1=... . Devolve null em qualquer formato inesperado - quem chama
 * responde 401 sem tentar adivinhar.
 */
export function parseSignatureHeader(header: string | null | undefined): ParsedSignature | null {
  if (!header) return null;
  let timestamp: number | null = null;
  let signature: string | null = null;
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      timestamp = Math.floor(parsed);
    } else if (key === "v1") {
      if (!/^[0-9a-fA-F]+$/.test(value)) return null;
      signature = value.toLowerCase();
    }
  }
  if (timestamp === null || !signature) return null;
  return { timestamp, signature };
}

export async function computeSignature(
  timestamp: number,
  rawBody: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp + "." + rawBody));
  return new TextDecoder().decode(encode(new Uint8Array(buf))).toLowerCase();
}

export interface VerifyOptions {
  secret: string;
  rawBody: string;
  header: string | null | undefined;
  /** Injetado nos testes; default Date.now. */
  now?: number;
  windowSeconds?: number;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  /** Presente so quando a assinatura e valida - o handler grava para auditoria. */
  timestamp?: number;
}

export async function verifyCallbackSignature(options: VerifyOptions): Promise<VerifyResult> {
  const { secret, rawBody, header } = options;
  if (!secret) return { valid: false, reason: "callback_secret_not_configured" };

  const parsed = parseSignatureHeader(header);
  if (!parsed) return { valid: false, reason: "malformed_signature_header" };

  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const window = options.windowSeconds ?? REPLAY_WINDOW_SECONDS;
  // Simetrico de proposito: rejeita carimbo velho ou no futuro. Um relogio do
  // Zapp adiantado em segundos nao pode virar 401 intermitente.
  if (parsed.timestamp < nowSeconds - window) {
    return { valid: false, reason: "timestamp_expired" };
  }
  if (parsed.timestamp > nowSeconds + window) {
    return { valid: false, reason: "timestamp_in_future" };
  }

  const expected = await computeSignature(parsed.timestamp, rawBody, secret);
  if (!timingSafeEqual(expected, parsed.signature)) {
    return { valid: false, reason: "signature_mismatch" };
  }
  return { valid: true, timestamp: parsed.timestamp };
}