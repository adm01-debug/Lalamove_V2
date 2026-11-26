import { describe, it, expect } from 'vitest';
import {
  CHANGE_DRIVER_REASONS,
  CANCEL_ORDER_REASONS,
  changeDriverReasonOptions,
  cancelOrderReasonOptions,
  isChangeDriverReason,
  isCancelOrderReason,
  reasonLabel,
} from '@/lib/lalamoveReasons';
import {
  toAccountingRows,
  summarizeAccountingRows,
  toIsoDate,
  fenToDecimal,
} from '@/lib/uapiStatement';

describe('motivos canônicos Lalamove', () => {
  it('todo motivo tem rótulo PT-BR (nenhum fallback para o código)', () => {
    for (const code of [...CHANGE_DRIVER_REASONS, ...CANCEL_ORDER_REASONS]) {
      expect(reasonLabel(code)).not.toBe(code);
    }
  });

  it('não há códigos duplicados dentro de cada lista', () => {
    expect(new Set(CHANGE_DRIVER_REASONS).size).toBe(CHANGE_DRIVER_REASONS.length);
    expect(new Set(CANCEL_ORDER_REASONS).size).toBe(CANCEL_ORDER_REASONS.length);
  });

  it('as opções de UI espelham exatamente o contrato', () => {
    expect(changeDriverReasonOptions.map((o) => o.value)).toEqual([...CHANGE_DRIVER_REASONS]);
    expect(cancelOrderReasonOptions.map((o) => o.value)).toEqual([...CANCEL_ORDER_REASONS]);
  });

  it('rejeita motivos fora do contrato', () => {
    expect(isChangeDriverReason('DRIVER_LATE')).toBe(true);
    expect(isChangeDriverReason('MOTIVO_LIVRE')).toBe(false);
    expect(isCancelOrderReason('OTHER')).toBe(true);
    expect(isCancelOrderReason('DRIVER_RUDE')).toBe(false);
  });

  it('devolve o próprio código quando o rótulo é desconhecido', () => {
    expect(reasonLabel('CODIGO_NOVO')).toBe('CODIGO_NOVO');
  });
});

describe('extrato contábil UAPI', () => {
  it('converte epoch em segundos e em milissegundos para ISO', () => {
    expect(toIsoDate(1_769_000_000)).toBe(new Date(1_769_000_000_000).toISOString());
    expect(toIsoDate(1_769_000_000_000)).toBe(new Date(1_769_000_000_000).toISOString());
    expect(toIsoDate(0)).toBe('');
    expect(toIsoDate(undefined)).toBe('');
  });

  it('converte centavos com ponto decimal e duas casas', () => {
    expect(fenToDecimal(12_345)).toBe('123.45');
    expect(fenToDecimal(-500)).toBe('-5.00');
    expect(fenToDecimal(undefined)).toBe('0.00');
  });

  it('classifica natureza e mantém o valor absoluto', () => {
    const rows = toAccountingRows([
      { flow_id: 'a', amount_fen: -2_500, balance_fen: 7_500, create_time: 1_769_000_000, remark: 'Corrida' },
      { flow_id: 'b', amount_fen: 10_000, balance_fen: 17_500, create_time: 1_769_003_600 },
    ]);
    expect(rows[0]).toMatchObject({ natureza: 'DEBITO', valor: '25.00', descricao: 'Corrida' });
    expect(rows[1]).toMatchObject({ natureza: 'CREDITO', valor: '100.00', descricao: 'Movimentação Lalamove' });
  });

  it('gera identificador estável mesmo sem flow_id', () => {
    const [row] = toAccountingRows([{ amount_fen: 100 }]);
    expect(row.identificador).toBe('linha-1');
  });

  it('totaliza créditos, débitos e saldo final', () => {
    const rows = toAccountingRows([
      { flow_id: 'a', amount_fen: -2_500, balance_fen: 7_500 },
      { flow_id: 'b', amount_fen: 10_000, balance_fen: 17_500 },
    ]);
    expect(summarizeAccountingRows(rows)).toEqual({
      creditos: '100.00',
      debitos: '25.00',
      saldoFinal: '175.00',
      lancamentos: 2,
    });
  });

  it('deixa o saldo vazio quando a movimentação não informa saldo', () => {
    const [row] = toAccountingRows([{ flow_id: 'a', amount_fen: -5_092 }]);
    expect(row.saldo).toBe('');
  });

  it('mantém 0,00 quando o saldo é zero explícito', () => {
    const [row] = toAccountingRows([{ flow_id: 'a', amount_fen: 0, balance_fen: 0 }]);
    expect(row.saldo).toBe('0.00');
  });

  it('ignora saldos ausentes ao totalizar', () => {
    const rows = toAccountingRows([
      { flow_id: 'a', amount_fen: -2_500, balance_fen: 7_500 },
      { flow_id: 'b', amount_fen: 10_000 },
    ]);
    expect(summarizeAccountingRows(rows).saldoFinal).toBe('75.00');
  });

  it('lida com extrato vazio sem quebrar', () => {
    expect(summarizeAccountingRows([])).toEqual({
      creditos: '0.00',
      debitos: '0.00',
      saldoFinal: '0.00',
      lancamentos: 0,
    });
  });
});
