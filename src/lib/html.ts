/**
 * Escapa texto para interpolação segura em HTML (defesa contra dados imprevistos).
 *
 * Fonte de verdade única para o escape de valores de usuário (nomes, endereços,
 * IDs) antes de interpolação em `innerHTML`/`setHTML`. Cobre as 5 entidades
 * essenciais de HTML.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Abre uma URL externa em nova aba com `noopener,noreferrer`.
 *
 * `noopener` impede que a nova janela obtenha referência a `window.opener`,
 * evitando que um site externo manipule a origem; `noreferrer` também oculta o
 * `Referer`. Sempre usar para links externos, nunca para janelas de mesmo
 * domínio que precisam da referência retornada (ex.: impressão).
 */
export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
