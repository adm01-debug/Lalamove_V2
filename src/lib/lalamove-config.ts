/**
 * Verifica se as credenciais Lalamove estão configuradas no backend.
 *
 * O marcador só existe no navegador e nenhum fluxo o gravava, então
 * `=== 'true'` desabilitava permanentemente todas as consultas das telas
 * Lalamove e UAPI (saldo, perfil, extrato, veículos e áreas nunca eram
 * buscados). O padrão passa a ser "tenta": o erro real do backend aparece na
 * tela com botão de nova tentativa. `setLalamoveConfigured(false)` continua
 * disponível para desligar as consultas quando o backend responder que não há
 * credenciais.
 */

const LALAMOVE_CONFIGURED_KEY = 'lalamove_configured';

export function isLalamoveConfigured(): boolean {
  try {
    return localStorage.getItem(LALAMOVE_CONFIGURED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setLalamoveConfigured(value: boolean): void {
  try {
    if (value) {
      localStorage.removeItem(LALAMOVE_CONFIGURED_KEY);
    } else {
      localStorage.setItem(LALAMOVE_CONFIGURED_KEY, 'false');
    }
  } catch {
    // ignore
  }
}