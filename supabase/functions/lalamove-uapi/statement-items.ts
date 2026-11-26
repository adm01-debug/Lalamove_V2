/**
 * Página do extrato montada pela identidade do lançamento.
 *
 * O gateway pagina por posição e não informa id por lançamento. Guardando cada
 * lançamento pela identidade dele (conteúdo do item), a página passa a ser
 * montada por chave: lançamento novo entra uma vez e nada é repetido nem pulado
 * na fronteira entre a janela recente e o histórico congelado.
 */

import { EMPTY_STATEMENT_PAGE, STATEMENT_PAGE_SIZE } from './statement-history.ts';

export type StatementItem = Record<string, unknown>;

const text = (value: unknown): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);

/**
 * Identidade do lançamento. Sem id do gateway, a identidade é o conteúdo: dois
 * lançamentos idênticos no mesmo segundo e no mesmo pedido são, para o gateway,
 * a mesma linha.
 */
export function statementItemKey(item: StatementItem, cityId?: number | null): string | null {
  const dateTime = text(item?.date_time).trim();
  if (!dateTime) return null;
  return [
    cityId ?? '',
    dateTime,
    text(item?.amount),
    text(item?.order_display_id),
    text(item?.name),
    text(item?.sub_name),
    text(item?.user_fid),
    text(item?.topup_tx_no),
  ].join('|');
}

/** `date_time` do gateway (`YYYY-MM-DD HH:mm:ss`), normalizado para ordenar. */
export function parseOccurredAtLocal(dateTime: unknown): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text(dateTime).trim());
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
}

/** Faixa de linhas da página (mesma regra do `range` do PostgREST). */
export function statementPageRange(page: number, pageSize: number = STATEMENT_PAGE_SIZE): { from: number; to: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : STATEMENT_PAGE_SIZE;
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1 };
}

/** `true` quando a página pedida começa depois do último lançamento coletado. */
export function isBeyondItemCount(from: number, total: number): boolean {
  return total > 0 && from >= total;
}

/** Resposta da UAPI no formato que o painel consome. */
export function buildStatementPage(items: StatementItem[]): { ret: number; msg: string; data: { flow_item_arr: StatementItem[] } } {
  return { ret: 0, msg: 'Sucesso', data: { flow_item_arr: items } };
}

export { EMPTY_STATEMENT_PAGE };
