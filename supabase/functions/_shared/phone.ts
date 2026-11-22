/**
 * Etapa 59 do plano Google Maps (D1) — resolução e normalização de telefone.
 *
 * O trigger `geo_evaluate_tracking` grava `metadata.recipients[].to` direto do
 * cadastro (`pickup_contact_phone`, `lalamove_stops.contact_phone`). Esses
 * campos chegam em formatos que o provedor de WhatsApp recusa: `(41) 99999-8888`,
 * `+55 41 99999-8888`, `41999998888`. Pior: pedido sem contato às vezes vem com
 * máscara (`****`), que parece telefone e não é.
 *
 * Aqui o número vira E.164 (`+5541999998888`) ou é rejeitado explicitamente, para
 * o descarte ser visível no log em vez de virar erro 400 do provedor.
 */

/** Marcador de telefone censurado — comum em exportações de CRM/ERP. */
const MASK_CHARS = /[*#xX]/;

/**
 * Telefone brasileiro em E.164. Aceita fixo (10 dígitos) e celular (11), com ou
 * sem DDI 55 e com ou sem o `0` de discagem. Devolve `null` quando não há número
 * utilizável — quem chama decide o que fazer (log, `no_recipient`, fallback).
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Máscara (`****`, `##`, `9999****`) não é número: rejeitar antes de tirar os
  // não-dígitos, senão `****` viraria string vazia e depois `null` por acidente.
  if (MASK_CHARS.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (digits === "") return null;

  // `00` de operadora internacional e `0` de discagem local.
  if (digits.startsWith("00")) digits = digits.slice(2);
  while (digits.startsWith("0")) digits = digits.slice(1);

  // DDI 55 na frente: 12 ou 13 dígitos totais.
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length !== 10 && digits.length !== 11) return null;

  // DDD válido no Brasil: 11-99 (não existe 00-10).
  const ddd = Number(digits.slice(0, 2));
  if (!Number.isFinite(ddd) || ddd < 11 || ddd > 99) return null;

  // Celular (11 dígitos) precisa começar com 9 depois do DDD; 10 dígitos é fixo
  // e começa com 2-5. Qualquer outra coisa é digitação errada.
  if (digits.length === 11 && digits[2] !== "9") return null;
  if (digits.length === 10 && !/^[2-5]/.test(digits[2])) return null;

  return `+55${digits}`;
}

/** Telefone utilizável? Atalho para os pontos que só precisam decidir. */
export function isDeliverablePhone(raw: unknown): boolean {
  return normalizePhone(raw) !== null;
}

/**
 * Etapa 59 (D1) — ordem de resolução do destinatário do aviso.
 *
 * `pickup_contact_phone` → `supplier_contact` (só quando `auto_notify_supplier`)
 * → telefone da parada de coleta. Devolve `null` quando nenhum candidato é
 * número válido, e o chamador marca `no_recipient`.
 *
 * A ordem importa: quem pediu a coleta é o destinatário natural, e o fornecedor
 * só entra se o pedido autorizou avisá-lo — avisar fornecedor sem autorização é
 * o tipo de erro que gera reclamação comercial, não bug de código.
 */
export function resolveGeoRecipient(order: {
  pickup_contact_phone?: unknown;
  supplier_contact?: unknown;
  auto_notify_supplier?: unknown;
  stop_contact_phone?: unknown;
}): { phone: string; source: "pickup_contact" | "supplier_contact" | "stop_contact" } | null {
  const pickup = normalizePhone(order.pickup_contact_phone);
  if (pickup) return { phone: pickup, source: "pickup_contact" };

  if (order.auto_notify_supplier === true) {
    const supplier = normalizePhone(order.supplier_contact);
    if (supplier) return { phone: supplier, source: "supplier_contact" };
  }

  const stop = normalizePhone(order.stop_contact_phone);
  if (stop) return { phone: stop, source: "stop_contact" };

  return null;
}
