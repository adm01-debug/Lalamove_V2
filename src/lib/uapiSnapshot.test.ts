import { describe, it, expect } from 'vitest';
import { describeSnapshotAge, SNAPSHOT_STALE_MINUTES } from '@/lib/uapiSnapshot';

const NOW = Date.parse('2026-11-25T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const snapshot = (minutes: number) => ({
  servedFromSnapshot: true,
  snapshotCollectedAt: minutesAgo(minutes),
});

describe('describeSnapshotAge', () => {
  it('marca leitura direta como ao vivo', () => {
    expect(describeSnapshotAge({ servedFromSnapshot: false }, NOW).tone).toBe('live');
    expect(describeSnapshotAge(undefined, NOW).label).toBe('Ao vivo');
  });

  it('mostra a idade da coleta em minutos', () => {
    const info = describeSnapshotAge(snapshot(12), NOW);
    expect(info.tone).toBe('fresh');
    expect(info.label).toBe('Coleta há 12 minutos');
  });

  it('usa singular na primeira unidade', () => {
    expect(describeSnapshotAge(snapshot(1), NOW).label).toBe('Coleta há 1 minuto');
    expect(describeSnapshotAge(snapshot(60), NOW).label).toBe('Coleta há 1 hora');
  });

  it('colapsa idades abaixo de um minuto', () => {
    expect(describeSnapshotAge(snapshot(0), NOW).label).toBe('Coleta há agora');
  });

  it('escala para horas e dias', () => {
    expect(describeSnapshotAge(snapshot(150), NOW).label).toBe('Coleta há 2 horas');
    expect(describeSnapshotAge(snapshot(60 * 26), NOW).label).toBe('Coleta há 1 dia');
  });

  it('trata 60 min como velho e 59 min como fresco', () => {
    expect(SNAPSHOT_STALE_MINUTES).toBe(60);
    expect(describeSnapshotAge(snapshot(59), NOW).tone).toBe('fresh');
    expect(describeSnapshotAge(snapshot(60), NOW).tone).toBe('stale');
    expect(describeSnapshotAge(snapshot(60), NOW).title).toContain('robô pode estar parado');
  });

  it('avisa quando a coleta veio sem horário', () => {
    const info = describeSnapshotAge({ servedFromSnapshot: true, snapshotCollectedAt: null }, NOW);
    expect(info.tone).toBe('stale');
    expect(info.label).toBe('Coleta sem horário');
  });

  it('não quebra com horário inválido nem com relógio adiantado', () => {
    const invalid = describeSnapshotAge({ servedFromSnapshot: true, snapshotCollectedAt: 'ontem' }, NOW);
    expect(invalid.tone).toBe('stale');
    expect(describeSnapshotAge(snapshot(-30), NOW).label).toBe('Coleta há agora');
  });
});