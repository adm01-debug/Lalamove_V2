import { describe, it, expect } from 'vitest';
import {
  buildOrderTimeline,
  normalizeOrderStatus,
  formatDuration,
  CANONICAL_STAGES,
} from '@/lib/lalamoveTimeline';

const t = (h: number) => new Date(Date.UTC(2026, 6, 26, h, 0, 0)).toISOString();

describe('normalizeOrderStatus', () => {
  it('mapeia aliases legados e UAPI', () => {
    expect(normalizeOrderStatus('PENDING')).toBe('ASSIGNING_DRIVER');
    expect(normalizeOrderStatus('matched')).toBe('ON_GOING');
    expect(normalizeOrderStatus('CANCELLED')).toBe('CANCELED');
    expect(normalizeOrderStatus('in transit')).toBe('DELIVERING');
    expect(normalizeOrderStatus('picked-up')).toBe('PICKED_UP');
  });

  it('retorna null para valores inválidos', () => {
    expect(normalizeOrderStatus('FOO')).toBeNull();
    expect(normalizeOrderStatus(undefined)).toBeNull();
    expect(normalizeOrderStatus(42)).toBeNull();
  });
});

describe('buildOrderTimeline', () => {
  it('marca etapas do fluxo feliz', () => {
    const tl = buildOrderTimeline([
      { id: '1', status: 'PENDING', created_at: t(1) },
      { id: '2', status: 'ON_GOING', created_at: t(2) },
      { id: '3', status: 'PICKED_UP', created_at: t(3) },
    ]);
    expect(tl.currentStatus).toBe('PICKED_UP');
    expect(tl.isTerminal).toBe(false);
    expect(tl.stages.map((s) => s.state)).toEqual([
      'done',
      'done',
      'current',
      'pending',
      'pending',
    ]);
    expect(tl.stages).toHaveLength(CANONICAL_STAGES.length);
  });

  it('detecta eventos fora de ordem sem regredir o status', () => {
    const tl = buildOrderTimeline([
      { id: '1', status: 'ON_GOING', created_at: t(1) },
      { id: '2', status: 'PICKED_UP', created_at: t(2) },
      { id: '3', status: 'ON_GOING', created_at: t(3) },
    ]);
    expect(tl.currentStatus).toBe('PICKED_UP');
    expect(tl.events[2].outOfOrder).toBe(true);
    expect(tl.events[1].outOfOrder).toBe(false);
  });

  it('sinaliza etapas puladas', () => {
    const tl = buildOrderTimeline([
      { id: '1', status: 'ASSIGNING_DRIVER', created_at: t(1) },
      { id: '2', status: 'COMPLETED', created_at: t(4) },
    ]);
    expect(tl.stages[1].state).toBe('skipped');
    expect(tl.stages[4].state).toBe('current');
    expect(tl.isTerminal).toBe(true);
    expect(tl.abortedAs).toBeNull();
  });

  it('marca fluxo abortado em cancelamento', () => {
    const tl = buildOrderTimeline([
      { id: '1', status: 'ASSIGNING_DRIVER', created_at: t(1) },
      { id: '2', status: 'CANCELLED', created_at: t(2) },
    ]);
    expect(tl.abortedAs).toBe('CANCELED');
    expect(tl.stages[4].state).toBe('aborted');
  });

  it('calcula durações entre eventos e total', () => {
    const tl = buildOrderTimeline([
      { id: '1', status: 'ASSIGNING_DRIVER', created_at: t(1) },
      { id: '2', status: 'ON_GOING', created_at: t(3) },
    ]);
    expect(tl.events[0].durationMsFromPrevious).toBeNull();
    expect(tl.events[1].durationMsFromPrevious).toBe(2 * 3600 * 1000);
    expect(tl.totalDurationMs).toBe(2 * 3600 * 1000);
  });

  it('ordena eventos recebidos embaralhados', () => {
    const tl = buildOrderTimeline([
      { id: '2', status: 'ON_GOING', created_at: t(3) },
      { id: '1', status: 'ASSIGNING_DRIVER', created_at: t(1) },
    ]);
    expect(tl.events.map((e) => e.id)).toEqual(['1', '2']);
  });

  it('suporta histórico vazio', () => {
    const tl = buildOrderTimeline([]);
    expect(tl.events).toEqual([]);
    expect(tl.currentStatus).toBeNull();
    expect(tl.totalDurationMs).toBeNull();
    expect(tl.stages.every((s) => s.state === 'pending')).toBe(true);
  });

  it('preserva status desconhecido como rótulo bruto', () => {
    const tl = buildOrderTimeline([{ id: '1', status: 'WEIRD', created_at: t(1) }]);
    expect(tl.events[0].canonical).toBeNull();
    expect(tl.events[0].label).toBe('WEIRD');
    expect(tl.events[0].outOfOrder).toBe(false);
  });
});

describe('formatDuration', () => {
  it.each([
    [null, null],
    [-1, null],
    [5_000, '5s'],
    [90_000, '1m'],
    [3_600_000, '1h'],
    [4_320_000, '1h 12m'],
    [90_000_000, '1d 1h'],
  ])('formata %s', (input, expected) => {
    expect(formatDuration(input as number | null)).toBe(expected);
  });
});
