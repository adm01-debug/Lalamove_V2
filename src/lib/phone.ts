/**
 * Validação e normalização de telefones no padrão E.164 (Lalamove v3).
 *
 * Referência oficial: https://developers.lalamove.com/
 * Requisitos do endpoint /quotations e /orders:
 *   - `phone` deve estar em E.164 (`+` seguido de 8–15 dígitos).
 *   - Para BR o operador é celular (9 dígitos após o DDD).
 *
 * A função é pura, sem side effects, e retorna sempre a mesma forma
 * canônica para o telefone quando válido.
 */

export type PhoneValidationResult =
  | { valid: true; e164: string; national: string; country: 'BR' }
  | { valid: false; error: string; e164: null };

/**
 * Normaliza um telefone brasileiro para E.164.
 *
 * Aceita formatos comuns:
 *   - "(11) 98765-4321"
 *   - "11987654321"
 *   - "+55 11 98765-4321"
 *   - "5511987654321"
 *
 * Rejeita:
 *   - Fixos (8 dígitos após DDD) — Lalamove exige celular para SMS de status.
 *   - DDD inválido (< 11 ou > 99).
 *   - Nono dígito ausente.
 */
export function validateBrazilianPhone(input: string): PhoneValidationResult {
  const raw = (input ?? '').trim();
  if (!raw) {
    return { valid: false, error: 'Telefone é obrigatório', e164: null };
  }

  // Extrai apenas dígitos, preservando o + inicial se existir.
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) {
    return { valid: false, error: 'Formato inválido — informe apenas números', e164: null };
  }

  // Normaliza para dígitos nacionais brasileiros (sem o 55).
  let national = digits;
  if (digits.startsWith('55') && digits.length >= 12) {
    national = digits.slice(2);
  }

  // Celular BR: 11 dígitos (DDD 2 + 9 + 8 dígitos do assinante).
  if (national.length !== 11) {
    return {
      valid: false,
      error: 'Celular brasileiro deve conter DDD + 9 dígitos (ex.: 11 98765-4321)',
      e164: null,
    };
  }

  const ddd = Number.parseInt(national.slice(0, 2), 10);
  if (Number.isNaN(ddd) || ddd < 11 || ddd > 99) {
    return { valid: false, error: 'DDD inválido', e164: null };
  }

  // Nono dígito obrigatório para celular (primeiro dígito do assinante = 9).
  if (national[2] !== '9') {
    return {
      valid: false,
      error: 'Número deve ser celular (nono dígito obrigatório após o DDD)',
      e164: null,
    };
  }

  const e164 = `+55${national}`;
  // E.164: 8–15 dígitos após o +.
  if (e164.replace('+', '').length > 15) {
    return { valid: false, error: 'Número excede 15 dígitos (E.164)', e164: null };
  }

  return { valid: true, e164, national, country: 'BR' };
}

/**
 * Máscara de exibição para telefones BR: (DD) 9XXXX-XXXX.
 * Não altera o valor armazenado — apenas o texto visível ao usuário.
 */
export function maskBrazilianPhone(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^55/, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Monta a URL de abertura do WhatsApp para um número brasileiro.
 * Garante o DDI 55 mesmo quando o número vem sem ele, e aplica E.164.
 * Retorna `null` quando o número não é um celular BR válido.
 */
export function toWhatsAppUrl(phone: string, message?: string): string | null {
  const normalized = validateBrazilianPhone(phone);
  if (!normalized.valid) return null;
  const base = `https://wa.me/${normalized.e164}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
