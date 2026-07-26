/**
 * Etapa 16 do scorecard — normalização contábil do extrato UAPI.
 *
 * A UAPI devolve valores em `fen` (centavos) e epoch em segundos. Um lançamento
 * contábil precisa de: data ISO, natureza (crédito/débito), valor absoluto com
 * ponto decimal e saldo — nunca de strings já formatadas em pt-BR, que quebram
 * a importação em qualquer ERP.
 */

import type { UapiWalletTransaction } from '@/hooks/useLalamoveUapi';

export interface AccountingRow {
  data: string;
  descricao: string;
  natureza: 'CREDITO' | 'DEBITO';
  valor: string;
  saldo: string;
  identificador: string;
}

/** Epoch UAPI (segundos ou milissegundos) → ISO 8601; `''` quando ausente. */
export function toIsoDate(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
  const ms = value > 1e11 ? value : value * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** Centavos → string decimal com 2 casas e ponto (formato de importação). */
export function fenToDecimal(fen?: number | null): string {
  const cents = typeof fen === 'number' && Number.isFinite(fen) ? fen : 0;
  return (cents / 100).toFixed(2);
}

export function toAccountingRows(transactions: UapiWalletTransaction[]): AccountingRow[] {
  return transactions.map((tx, index) => {
    const amount = typeof tx.amount_fen === 'number' ? tx.amount_fen : 0;
    return {
      data: toIsoDate(tx.create_time),
      descricao: tx.remark?.trim() || 'Movimentação Lalamove',
      natureza: amount < 0 ? 'DEBITO' : 'CREDITO',
      valor: fenToDecimal(Math.abs(amount)),
      saldo: fenToDecimal(tx.balance_fen),
      identificador: tx.flow_id ?? tx.id ?? `linha-${index + 1}`,
    };
  });
}

/** Totais do período — conferência rápida antes do lançamento. */
export function summarizeAccountingRows(rows: AccountingRow[]): {
  creditos: string;
  debitos: string;
  saldoFinal: string;
  lancamentos: number;
} {
  let creditos = 0;
  let debitos = 0;
  for (const row of rows) {
    const value = Number(row.valor);
    if (row.natureza === 'CREDITO') creditos += value;
    else debitos += value;
  }
  return {
    creditos: creditos.toFixed(2),
    debitos: debitos.toFixed(2),
    saldoFinal: rows.length ? rows[rows.length - 1].saldo : '0.00',
    lancamentos: rows.length,
  };
}
