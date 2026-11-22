/**
 * Etapa 86 (campo `client_message_id`) com a chave da etapa 89.
 *
 * O id precisa ser **estável** para o mesmo evento: o Zapp devolve esse valor no
 * callback (etapa 96) e o ledger usa para casar as duas pontas. Um id aleatório
 * por tentativa quebraria a idempotência — reprocessar o mesmo alerta criaria
 * linha nova em `notification_messages` e uma segunda mensagem ao motorista.
 *
 * Formato: `v5(order_id|event|role|telefone|seq)` achatado em hex. Não usa UUID
 * de verdade (sem SHA-1 namespace) porque a coluna é `text` e o consumidor é
 * humano lendo log — determinismo e curto-circuito de colisão bastam.
 */

/** FNV-1a de 32 bits, duas passadas com sementes diferentes = 64 bits. */
function hash64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + c) >>> 0;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export interface MessageIdParts {
  orderId?: string | null;
  event: string;
  role: string;
  phone: string;
  /** Contador da janela de deduplicação; 0 é o envio original. */
  seq?: number;
}

/**
 * Devolve o `client_message_id` determinístico do evento. Ordem e separador são
 * fixos: mudar aqui invalida a correlação com callbacks já emitidos.
 */
export function buildClientMessageId(parts: MessageIdParts): string {
  const phone = (parts.phone ?? "").replace(/\D/g, "");
  const key = [
    parts.orderId ?? "-",
    parts.event,
    parts.role,
    phone || "-",
    String(parts.seq ?? 0),
  ].join("|");
  const digest = hash64(key);
  return `${digest.slice(0, 8)}-${digest.slice(8, 16)}-${parts.event.length.toString(16).padStart(4, "0")}`;
}

/** Correlação legível no log e no callback: `EVENTO:pedido|motorista:canal`. */
export function buildCorrelation(parts: MessageIdParts, channel: string): string {
  const ref = parts.orderId ?? parts.phone ?? "global";
  return `${parts.event}:${ref}:${parts.role}:${channel}`;
}
