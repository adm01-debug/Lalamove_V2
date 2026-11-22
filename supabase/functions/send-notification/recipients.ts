/**
 * Etapa 66 do plano Google Maps: destinatários por pedido.
 *
 * Um alerta pode ser entregue a dois conjuntos de destinatários que **não se
 * substituem**:
 *   1. os do pedido (`metadata.recipients` no v1 e `recipients` no v2 — quem o
 *      trigger geo preenche com o contato da coleta/entrega);
 *   2. os da configuração do tipo de alerta (`alert_configurations`:
 *      `whatsapp_numbers`, `email_addresses`, `slack_channels`, ...).
 *
 * Antes da etapa 66 a união era acidental: os dois laços rodavam, mas ninguém
 * impedia o mesmo telefone configurado **e** enviado pelo pedido de receber o
 * alerta duas vezes. Este módulo concentra a normalização e a deduplicação,
 * para que a união seja explícita e testável fora do handler.
 */

export type RecipientRole = "pickup_contact" | "delivery_contact" | "internal";

export interface NotificationRecipient {
  channel: string;
  to: string;
  role?: string;
  /** Nome do contato, usado nas variáveis de template (etapa 67). */
  name?: string;
}

/** Chave de deduplicação: canal + destino já normalizado. */
export function recipientKey(channel: string, to: string): string {
  return `${channel}:${to.trim().toLowerCase()}`;
}

/**
 * Aceita o formato tolerante que vem do trigger (`{channel, to, role, name}`) e
 * descarta o que não dá para enviar — entrada inválida nunca deve lançar, senão
 * um pedido sem telefone derrubaria o alerta inteiro.
 */
export function normalizeRecipients(raw: unknown): NotificationRecipient[] {
  if (!Array.isArray(raw)) return [];
  const out: NotificationRecipient[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const channel = typeof r.channel === "string" ? r.channel.trim() : "";
    const to = typeof r.to === "string" ? r.to.trim() : "";
    if (!channel || !to) continue;
    out.push({
      channel,
      to,
      ...(typeof r.role === "string" && r.role ? { role: r.role } : {}),
      ...(typeof r.name === "string" && r.name ? { name: r.name } : {}),
    });
  }
  return out;
}

/**
 * União na ordem em que os conjuntos foram passados (pedido primeiro, depois o
 * declarado), removendo repetições de canal+destino. `slack` e `n8n` têm
 * destinos que são URLs/canais, mas a mesma regra de chave vale.
 */
export function unionRecipients(...lists: NotificationRecipient[][]): NotificationRecipient[] {
  const seen = new Set<string>();
  const out: NotificationRecipient[] = [];
  for (const list of lists) {
    for (const r of list) {
      const key = recipientKey(r.channel, r.to);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

/** Primeiro destinatário de um papel — alimenta `{{pickup_contact_name}}` etc. */
export function firstByRole(
  list: NotificationRecipient[],
  role: RecipientRole,
): NotificationRecipient | undefined {
  return list.find((r) => r.role === role);
}
