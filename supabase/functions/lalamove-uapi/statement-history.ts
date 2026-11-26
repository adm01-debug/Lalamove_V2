/**
 * Fim do histórico do extrato.
 *
 * O gateway pagina por posição e não informa quando o histórico acaba: pedir a
 * página seguinte à última devolve erro (ret 10010) e o painel mostrava falha
 * em vez de "fim do histórico". A última página do histórico sempre vem com
 * menos itens que o tamanho pedido, então o tamanho da página anterior prova o
 * fim sem nenhuma chamada nova ao gateway.
 */

/** Tamanho de página que o coletor grava e o painel pede no extrato. */
export const STATEMENT_PAGE_SIZE = 20;

/**
 * Página vazia no mesmo formato da UAPI: o painel recebe lista vazia (e não
 * erro) e desabilita o "Próxima" sozinho.
 */
export const EMPTY_STATEMENT_PAGE = {
  ret: 0,
  msg: 'Sucesso',
  data: { flow_item_arr: [] as unknown[], total: 0 },
};

/**
 * `true` quando a página anterior veio incompleta — logo não existe página
 * seguinte. `null`/`undefined` (página anterior fora do snapshot) não prova
 * nada e a edge devolve o erro real do gateway.
 */
export function isBeyondHistory(
  previousPageItems: number | null | undefined,
  pageSize: number = STATEMENT_PAGE_SIZE,
): boolean {
  return typeof previousPageItems === 'number' && previousPageItems < pageSize;
}

/** Quantidade de itens de `data.flow_item_arr` no snapshot do extrato. */
export function statementItems(payload: unknown): number | null {
  const items = (payload as { data?: { flow_item_arr?: unknown } } | null)?.data?.flow_item_arr;
  return Array.isArray(items) ? items.length : null;
}
