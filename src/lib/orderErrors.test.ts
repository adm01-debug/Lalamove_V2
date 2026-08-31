import { describe, it, expect } from 'vitest';
import { parseOrderError } from '@/lib/orderErrors';

describe('parseOrderError', () => {
  it('identifica telefone do remetente (guard server)', () => {
    const r = parseOrderError('Telefone inválido em sender: esperado formato E.164 (+5511...)');
    expect(r.field).toBe('senderPhone');
    expect(r.title).toMatch(/remetente/i);
  });

  it('identifica telefone do destinatário e captura o índice', () => {
    const r = parseOrderError('Telefone inválido em recipients[2]: esperado E.164');
    expect(r.field).toBe('recipientPhone');
    expect(r.recipientIndex).toBe(2);
  });

  it('mapeia INVALID_PHONE_NUMBER da API Lalamove', () => {
    const r = parseOrderError('Lalamove API: 400 - INVALID_PHONE_NUMBER');
    expect(r.field).toBe('senderPhone');
    expect(r.title).toMatch(/Lalamove/i);
  });

  it('mapeia phone invalid genérico', () => {
    const r = parseOrderError('The provided phone is invalid for BR');
    expect(r.field).toBe('senderPhone');
  });

  it('mapeia erros de agendamento', () => {
    expect(parseOrderError('Invalid schedule window').field).toBe('schedule');
  });

  it('mapeia erros de endereço', () => {
    expect(parseOrderError('Invalid stop address').field).toBe('address');
  });

  it('mantém mensagem original em fallback quando não identifica', () => {
    const r = parseOrderError('Timeout desconhecido');
    expect(r.field).toBeNull();
    expect(r.description).toContain('Timeout desconhecido');
  });

  it('trata string vazia sem quebrar', () => {
    const r = parseOrderError('');
    expect(r.field).toBeNull();
    expect(r.title.length).toBeGreaterThan(0);
  });
});
