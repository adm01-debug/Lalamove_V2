import { describe, it, expect } from 'vitest';
import {
  evaluateOrderOperation,
  isTerminalStatus,
  normalizeOrderStatus,
  validatePriorityFee,
  MAX_PRIORITY_FEE_BRL,
} from '../lalamoveOrderEdit';

describe('normalizeOrderStatus', () => {
  it('mapeia aliases legados para o enum canônico', () => {
    expect(normalizeOrderStatus('PENDING')).toBe('ASSIGNING_DRIVER');
    expect(normalizeOrderStatus('MATCHED')).toBe('ON_GOING');
    expect(normalizeOrderStatus('cancelled')).toBe('CANCELED');
  });

  it('devolve null para valores desconhecidos', () => {
    expect(normalizeOrderStatus('FOO')).toBeNull();
    expect(normalizeOrderStatus(null)).toBeNull();
  });
});

describe('isTerminalStatus', () => {
  it.each(['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'])('%s é terminal', (s) => {
    expect(isTerminalStatus(s)).toBe(true);
  });

  it('ON_GOING não é terminal', () => {
    expect(isTerminalStatus('ON_GOING')).toBe(false);
  });
});

describe('evaluateOrderOperation — edit', () => {
  it('bloqueia edição durante ASSIGNING_DRIVER com ERR_ORDER_EDIT', () => {
    const v = evaluateOrderOperation('edit', { status: 'ASSIGNING_DRIVER' });
    expect(v.allowed).toBe(false);
    expect(v.expectedError).toBe('ERR_ORDER_EDIT');
  });

  it('libera edição com motorista atribuído antes da coleta', () => {
    expect(evaluateOrderOperation('edit', { status: 'ON_GOING', driverId: 'd1' }).allowed).toBe(true);
  });

  it('bloqueia edição após a coleta', () => {
    const v = evaluateOrderOperation('edit', { status: 'PICKED_UP', driverId: 'd1' });
    expect(v.allowed).toBe(false);
    expect(v.expectedError).toBe('ERR_ORDER_EDIT');
  });

  it('bloqueia em estado terminal', () => {
    expect(evaluateOrderOperation('edit', { status: 'COMPLETED' }).allowed).toBe(false);
  });
});

describe('evaluateOrderOperation — cancel', () => {
  it('permite cancelar enquanto procura motorista', () => {
    expect(evaluateOrderOperation('cancel', { status: 'PENDING' }).allowed).toBe(true);
  });

  it('bloqueia cancelamento após a coleta com ERR_CANCELLATION', () => {
    const v = evaluateOrderOperation('cancel', { status: 'DELIVERING', driverId: 'd1' });
    expect(v.allowed).toBe(false);
    expect(v.expectedError).toBe('ERR_CANCELLATION');
  });
});

describe('evaluateOrderOperation — priorityFee e changeDriver', () => {
  it('permite bônus antes da coleta', () => {
    expect(evaluateOrderOperation('priorityFee', { status: 'ASSIGNING_DRIVER' }).allowed).toBe(true);
  });

  it('bloqueia bônus após a coleta', () => {
    expect(evaluateOrderOperation('priorityFee', { status: 'PICKED_UP' }).expectedError).toBe(
      'ERR_INVALID_TIPS',
    );
  });

  it('exige motorista para troca (errata: driverId vazio)', () => {
    expect(evaluateOrderOperation('changeDriver', { status: 'ON_GOING', driverId: '' }).allowed).toBe(
      false,
    );
    expect(evaluateOrderOperation('changeDriver', { status: 'ON_GOING', driverId: 'd1' }).allowed).toBe(
      true,
    );
  });

  it('status desconhecido bloqueia tudo', () => {
    expect(evaluateOrderOperation('cancel', { status: 'XPTO' }).allowed).toBe(false);
  });
});

describe('validatePriorityFee', () => {
  it('aceita incremento válido com vírgula decimal', () => {
    expect(validatePriorityFee('12,50', 10)).toEqual({ valid: true, amount: 12.5, error: null });
  });

  it('recusa valores não numéricos ou <= 0', () => {
    expect(validatePriorityFee('abc').valid).toBe(false);
    expect(validatePriorityFee('0').valid).toBe(false);
  });

  it('recusa valor menor ou igual ao bônus atual', () => {
    expect(validatePriorityFee('10', 10).valid).toBe(false);
    expect(validatePriorityFee('9', 10).error).toContain('só pode ser aumentado');
  });

  it('respeita o teto de R$ 500', () => {
    expect(validatePriorityFee(String(MAX_PRIORITY_FEE_BRL + 1)).valid).toBe(false);
    expect(validatePriorityFee(String(MAX_PRIORITY_FEE_BRL)).valid).toBe(true);
  });
});
