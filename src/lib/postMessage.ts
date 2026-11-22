export const BITRIX24_CONNECTED = "bitrix24_connected";

/**
 * Valida a origem de um `postMessage` do OAuth do Bitrix24.
 *
 * O callback de sucesso é servido pela edge function `bitrix24-sync`, que roda
 * na origem do projeto Supabase (o redirect OAuth aponta para `SUPABASE_URL/functions/v1/bitrix24-sync`).
 * Por isso a whitelist aceita tanto a origem da própria página quanto a do Supabase.
 */
export function isTrustedBitrix24Origin(eventOrigin: string, pageOrigin: string, supabaseUrl: string): boolean {
  const supabaseOrigin = safeOrigin(supabaseUrl);
  return eventOrigin === pageOrigin || (supabaseOrigin !== null && eventOrigin === supabaseOrigin);
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
