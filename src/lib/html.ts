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
