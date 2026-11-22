/**
 * Despacho de SMS do `send-notification` (etapas 119/120/124 do plano de mensageria).
 *
 * Fica fora do `index.ts` porque la o `serve()` roda no import e nada e testavel.
 * O canal entra por parametro, entao o teste injeta um fake e confere o texto
 * exato que sai — que e onde o custo mora: um acento a mais dobra os segmentos.
 */
import type { SmsChannel } from "../_shared/channels/sms.ts";

export interface SmsDispatchInput {
  channel: SmsChannel | null;
  number: string;
  title: string;
  message: string;
  orderId?: string | null;
}

export interface SmsDispatchResult {
  success: boolean;
  error?: string;
  /** Segmentos cobrados; `undefined` quando nada foi enviado. */
  segments?: number;
  /** Texto efetivamente enviado, para o log e para o ledger. */
  text?: string;
}

/**
 * SMS nao tem markdown nem emoji de severidade: o texto e `titulo. mensagem.
 * Pedido: <id>`, unido por ". " e sem partes vazias. Quem corta e translitera
 * e o canal (`composeSmsText`).
 */
export function buildSmsBody(title: string, message: string, orderId?: string | null): string {
  return [title, message, orderId ? `Pedido: ${orderId}` : ""]
    .filter((part) => part && part.trim() !== "")
    .join(". ");
}

export async function dispatchSms(input: SmsDispatchInput): Promise<SmsDispatchResult> {
  const { channel, number, title, message, orderId } = input;
  // Sem secret o canal e `null` — devolver erro explicito em vez de fingir envio
  // e deixar o alerta morrer sem rastro em `alerts_sent`.
  if (!channel) return { success: false, error: "SMS provider not configured" };

  const text = buildSmsBody(title, message, orderId);
  const result = await channel.send(number, text, orderId ?? undefined);
  if (!result.success) return { success: false, error: result.error, text };
  return { success: true, segments: result.segments, text };
}