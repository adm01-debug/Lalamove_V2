import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SERVICE_TYPES, ORDER_STATUSES } from '@/types/lalamove';
import { buildOrderTimeline, normalizeOrderStatus } from '@/lib/lalamoveTimeline';
import { evaluateOrderOperation } from '@/lib/lalamoveOrderEdit';
import { resolveUapiError } from '@/lib/uapiErrors';

/**
 * Etapas 25–26 — testes de contrato com fixtures reais da documentação
 * Lalamove v3 BR + regressão da errata (campos que NÃO existem na API).
 */

// ── Fixtures capturadas da documentação oficial v3 (BR) ────────────────────
const QUOTATION_RESPONSE = {
  data: {
    quotationId: '2779385992909390000',
    scheduleAt: '2026-07-26T12:00:00.00Z',
    expiresAt: '2026-07-26T12:05:00.00Z',
    serviceType: 'MOTORCYCLE_BR' as const,
    priceBreakdown: { base: '10.00', totalExcludePriorityFee: '10.00', total: '10.00', currency: 'BRL' },
    stops: [
      { stopId: '2779386', coordinates: { lat: '-23.55', lng: '-46.63' }, address: 'Av. Paulista, 1000' },
      { stopId: '2779387', coordinates: { lat: '-23.56', lng: '-46.65' }, address: 'Rua Augusta, 500' },
    ],
  },
};

const ORDER_RESPONSE = {
  data: {
    orderId: '158472612993',
    quotationId: '2779385992909390000',
    priceBreakdown: { total: '10.00', currency: 'BRL' },
    driverId: '',
    shareLink: 'https://share.lalamove.com/?BR_SAO_100',
    status: 'ASSIGNING_DRIVER',
  },
};

const WEBHOOK_STATUS_EVENT = {
  eventId: 'a5b4c3',
  eventType: 'ORDER_STATUS_CHANGED',
  eventVersion: 'v3',
  data: { order: { orderId: '158472612993', status: 'PICKED_UP' } },
};

const UAPI_EXPIRED_SESSION = { ret: 10007, msg: 'token invalid', data: null };

describe('contrato Lalamove — fixtures reais', () => {
  it('parseia a resposta de cotação preservando o TTL de 5 minutos', () => {
    const { scheduleAt, expiresAt, priceBreakdown, stops } = QUOTATION_RESPONSE.data;
    const ttlMs = new Date(expiresAt).getTime() - new Date(scheduleAt).getTime();
    expect(ttlMs).toBe(5 * 60 * 1000);
    expect(priceBreakdown.currency).toBe('BRL');
    expect(stops).toHaveLength(2);
  });

  it('trata driverId vazio na criação como "sem motorista"', () => {
    expect(ORDER_RESPONSE.data.driverId).toBe('');
    const verdict = evaluateOrderOperation('changeDriver', {
      status: ORDER_RESPONSE.data.status,
      driverId: ORDER_RESPONSE.data.driverId,
    });
    expect(verdict.allowed).toBe(false);
  });

  it('normaliza o status do webhook para o enum canônico', () => {
    const status = normalizeOrderStatus(WEBHOOK_STATUS_EVENT.data.order.status);
    expect(status).toBe('PICKED_UP');
    const timeline = buildOrderTimeline([
      { status: 'ASSIGNING_DRIVER', at: '2026-07-26T12:00:00Z' },
      { status: 'ON_GOING', at: '2026-07-26T12:05:00Z' },
      { status: WEBHOOK_STATUS_EVENT.data.order.status, at: '2026-07-26T12:20:00Z' },
    ]);
    expect(timeline.stages.some((stage) => stage.state === 'current')).toBe(true);
  });

  it('traduz sessão UAPI expirada (10007) para mensagem acionável', () => {
    const info = resolveUapiError(UAPI_EXPIRED_SESSION.ret, UAPI_EXPIRED_SESSION.msg);
    expect(info.critical).toBe(true);
    expect(info.message).toContain('Sessão UAPI');
  });
});

// ── Etapa 26 — regressão da errata ─────────────────────────────────────────
const ERRATA_FIELDS = ['serviceTypes', 'cancelParty'] as const;
const GUARDED_FILES = [
  'src/types/lalamove.ts',
  'src/lib/lalamoveCatalog.ts',
  'src/lib/lalamoveOrderEdit.ts',
  'src/lib/lalamoveTimeline.ts',
];

describe('errata Lalamove — campos inexistentes não podem reaparecer', () => {
  it.each(GUARDED_FILES)('%s não referencia campos da errata', (relativePath) => {
    const source = readFileSync(join(process.cwd(), relativePath), 'utf-8');
    for (const field of ERRATA_FIELDS) {
      expect(source.includes(field)).toBe(false);
    }
  });

  it('o catálogo BR não contém serviceTypes fictícios', () => {
    for (const forbidden of ['MOTORCYCLE', 'MPV', 'TRUCK175']) {
      expect(SERVICE_TYPES).not.toContain(forbidden);
    }
    expect(SERVICE_TYPES).toContain('LALAGO');
  });

  it('o enum de status usa CANCELED (grafia oficial da v3)', () => {
    expect(ORDER_STATUSES).toContain('CANCELED');
    expect(ORDER_STATUSES).not.toContain('CANCELLED');
  });
});
