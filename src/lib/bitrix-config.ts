/**
 * Verifica se as credenciais Bitrix24 estão configuradas no backend
 * Usado para desabilitar chamadas que retornariam 500
 */

const BITRIX_CONFIGURED_KEY = 'bitrix24_configured';

export function isBitrixConfigured(): boolean {
  try {
    return localStorage.getItem(BITRIX_CONFIGURED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBitrixConfigured(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(BITRIX_CONFIGURED_KEY, 'true');
    } else {
      localStorage.removeItem(BITRIX_CONFIGURED_KEY);
    }
  } catch {
    // ignore
  }
}