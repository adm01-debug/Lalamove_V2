/**
 * Verifica se as credenciais Lalamove estão configuradas no backend
 * Usado para desabilitar chamadas que retornariam 500
 */

const LALAMOVE_CONFIGURED_KEY = 'lalamove_configured';

export function isLalamoveConfigured(): boolean {
  try {
    return localStorage.getItem(LALAMOVE_CONFIGURED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLalamoveConfigured(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(LALAMOVE_CONFIGURED_KEY, 'true');
    } else {
      localStorage.removeItem(LALAMOVE_CONFIGURED_KEY);
    }
  } catch {
    // ignore
  }
}