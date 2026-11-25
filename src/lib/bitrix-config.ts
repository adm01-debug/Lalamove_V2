/**
 * Habilita o cadastro externo (ação `external-companies` da Edge Function) e a
 * página /external-data.
 *
 * O gate exigia `bitrix24_configured=true` no localStorage, mas nenhum código
 * grava essa flag — nem existe tela para isso. Resultado: a busca de endereço do
 * cadastro e a página de dados externos nunca ligavam, mesmo com o banco de
 * produto acessível (EXTERNAL_SUPABASE_URL/EXTERNAL_SUPABASE_SERVICE_ROLE_KEY).
 * Agora o padrão é ligado e o desligamento explícito continua respeitado.
 */

const BITRIX_CONFIGURED_KEY = 'bitrix24_configured';

export function isBitrixConfigured(): boolean {
  try {
    return localStorage.getItem(BITRIX_CONFIGURED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setBitrixConfigured(value: boolean): void {
  try {
    localStorage.setItem(BITRIX_CONFIGURED_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}