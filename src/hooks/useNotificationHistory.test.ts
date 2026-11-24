import { describe, it, expect } from 'vitest';
import {
  mapLedgerRow,
  summarizeNotificationStatus,
  type NotificationLedgerRow,
} from './useNotificationHistory';

const LEDGER_ROW: NotificationLedgerRow = {
  id: 'm1',
  alert_id: 'a1',
  channel: 'sms',
  recipient_phone: '41999998888',
  status: 'read',
  sent_at: '2026-11-24T01:00:00Z',
  delivered_at: '2026-11-24T01:00:05Z',
  error_code: null,
  attempt: 3,
  event: 'ORDER_CANCELLED',
  role: 'driver',
  provider: 'zapp',
  template_key: 'M12',
  body_preview: 'Pedido 123 concluido',
  direction: 'outbound',
  created_at: '2026-11-24T00:59:59Z',
  alert: {
    id: 'a1',
    title: 'Pedido cancelado',
    type: 'ORDER_CANCELLED',
    severity: 'high',
    message: 'O pedido 123 foi cancelado',
  },
};

describe('historico de notificacoes lendo o ledger (etapa 138)', () => {
  it('mapeia a linha de notification_messages para a timeline', () => {
    const mapped = mapLedgerRow(LEDGER_ROW);

    expect(mapped).toMatchObject({
      id: 'm1',
      alert_id: 'a1',
      channel: 'sms',
      recipient: '41999998888',
      status: 'read',
      delivered_at: '2026-11-24T01:00:05Z',
      retry_count: 2,
      created_at: '2026-11-24T00:59:59Z',
    });
    expect(mapped.metadata).toMatchObject({
      event: 'ORDER_CANCELLED',
      role: 'driver',
      provider: 'zapp',
      body_preview: 'Pedido 123 concluido',
    });
    expect(mapped.alert?.title).toBe('Pedido cancelado');
  });

  it('linha sem telefone, alerta ou tentativa continua renderizavel', () => {
    const mapped = mapLedgerRow({
      ...LEDGER_ROW,
      alert_id: null,
      alert: null,
      recipient_phone: null,
      attempt: null,
    });

    expect(mapped.recipient).toBe('');
    expect(mapped.alert).toBeUndefined();
    expect(mapped.retry_count).toBe(0);
  });

  it('soma ledger e legado no mesmo criterio dos cards', () => {
    const stats = summarizeNotificationStatus([
      { status: 'sent' },
      { status: 'delivered' },
      { status: 'read' },
      { status: 'failed' },
      { status: 'expired' },
      { status: 'uncertain' },
      { status: 'suppressed' },
      { status: 'pending' },
      { status: 'queued' },
      { status: null },
    ]);

    expect(stats).toEqual({ total: 10, sent: 1, delivered: 2, failed: 4, pending: 2 });
  });
});