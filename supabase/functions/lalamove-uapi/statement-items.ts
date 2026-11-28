/**
 * Página do extrato montada pela identidade do lançamento.
 *
 * O gateway pagina por posição e não informa id por lançamento. Como o coletor
 * guarda cada lançamento pela própria identidade (chave definida em
 * `scripts/uapi-collector/collect.mjs`), a página passa a ser montada por chave:
 * lançamento novo entra uma vez e nada é repetido nem pulado na fronteira entre
 * a janela recente e o histórico congelado.
 */

import { STATEMENT_PAGE_SIZE } from './statement-history.ts';

export type StatementItem = Record<string, unknown>;

/** Faixa de linhas da página (mesma regra do `range` do PostgREST). */
export function statementPageRange(page: number, pageSize: number = STATEMENT_PAGE_SIZE): { from: number; to: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : STATEMENT_PAGE_SIZE;
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1 };
}

/** Resposta no mesmo formato da UAPI, que é o que o painel consome. */
export function buildStatementPage(items: StatementItem[]): {
  ret: number;
  msg: string;
  data: { flow_item_arr: StatementItem[] };
} {
  return { ret: 0, msg: 'Sucesso', data: { flow_item_arr: items } };
}
