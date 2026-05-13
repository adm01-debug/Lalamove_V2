import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getElapsedTime, formatElapsedTimeCompact, formatElapsedTimeDetailed, type ElapsedTime } from '../timeUtils';

describe('getElapsedTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve calcular segundos corretamente', () => {
    const result = getElapsedTime(new Date('2026-03-15T11:59:30Z'));
    expect(result.seconds).toBe(30);
    expect(result.minutes).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.days).toBe(0);
    expect(result.totalMinutes).toBe(0);
  });

  it('deve calcular minutos corretamente', () => {
    const result = getElapsedTime(new Date('2026-03-15T11:45:00Z'));
    expect(result.minutes).toBe(15);
    expect(result.totalMinutes).toBe(15);
  });

  it('deve calcular horas corretamente', () => {
    const result = getElapsedTime(new Date('2026-03-15T09:30:00Z'));
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
    expect(result.totalHours).toBe(2);
    expect(result.totalMinutes).toBe(150);
  });

  it('deve calcular dias corretamente', () => {
    const result = getElapsedTime(new Date('2026-03-13T12:00:00Z'));
    expect(result.days).toBe(2);
    expect(result.hours).toBe(0);
    expect(result.totalDays).toBe(2);
  });

  it('deve lidar com combinação dias+horas+minutos+segundos', () => {
    // 1 dia, 3 horas, 25 minutos, 10 segundos atrás
    const pastDate = new Date('2026-03-14T08:34:50Z');
    const result = getElapsedTime(pastDate);
    expect(result.days).toBe(1);
    expect(result.hours).toBe(3);
    expect(result.minutes).toBe(25);
    expect(result.seconds).toBe(10);
  });

  it('deve retornar 0 para agora', () => {
    const result = getElapsedTime(new Date('2026-03-15T12:00:00Z'));
    expect(result.totalMinutes).toBe(0);
    expect(result.totalHours).toBe(0);
    expect(result.totalDays).toBe(0);
  });

  it('deve lidar com strings de data', () => {
    const result = getElapsedTime(new Date('2026-03-15T11:00:00Z'));
    expect(result.totalMinutes).toBe(60);
  });
});

describe('formatElapsedTimeCompact', () => {
  it('deve formatar apenas segundos', () => {
    const elapsed: ElapsedTime = { days: 0, hours: 0, minutes: 0, seconds: 45, totalMinutes: 0, totalHours: 0, totalDays: 0 };
    expect(formatElapsedTimeCompact(elapsed)).toBe('45s');
  });

  it('deve formatar minutos e segundos', () => {
    const elapsed: ElapsedTime = { days: 0, hours: 0, minutes: 5, seconds: 30, totalMinutes: 5, totalHours: 0, totalDays: 0 };
    expect(formatElapsedTimeCompact(elapsed)).toBe('5m 30s');
  });

  it('deve formatar horas e minutos', () => {
    const elapsed: ElapsedTime = { days: 0, hours: 2, minutes: 15, seconds: 0, totalMinutes: 135, totalHours: 2, totalDays: 0 };
    expect(formatElapsedTimeCompact(elapsed)).toBe('2h 15m');
  });

  it('deve formatar dias e horas', () => {
    const elapsed: ElapsedTime = { days: 3, hours: 5, minutes: 30, seconds: 0, totalMinutes: 4830, totalHours: 77, totalDays: 3 };
    expect(formatElapsedTimeCompact(elapsed)).toBe('3d 5h');
  });

  it('deve formatar 0 segundos', () => {
    const elapsed: ElapsedTime = { days: 0, hours: 0, minutes: 0, seconds: 0, totalMinutes: 0, totalHours: 0, totalDays: 0 };
    expect(formatElapsedTimeCompact(elapsed)).toBe('0s');
  });

  it('deve priorizar dias sobre horas', () => {
    const elapsed: ElapsedTime = { days: 1, hours: 0, minutes: 30, seconds: 0, totalMinutes: 1470, totalHours: 24, totalDays: 1 };
    expect(formatElapsedTimeCompact(elapsed)).toBe('1d 0h');
  });
});

describe('formatElapsedTimeDetailed', () => {
  it('deve formatar apenas segundos', () => {
    const elapsed: ElapsedTime = { days: 0, hours: 0, minutes: 0, seconds: 15, totalMinutes: 0, totalHours: 0, totalDays: 0 };
    expect(formatElapsedTimeDetailed(elapsed)).toBe('15s');
  });

  it('deve formatar minutos e segundos', () => {
    const elapsed: ElapsedTime = { days: 0, hours: 0, minutes: 10, seconds: 20, totalMinutes: 10, totalHours: 0, totalDays: 0 };
    expect(formatElapsedTimeDetailed(elapsed)).toBe('10m 20s');
  });

  it('deve formatar horas minutos segundos', () => {
    const elapsed: ElapsedTime = { days: 0, hours: 1, minutes: 30, seconds: 45, totalMinutes: 90, totalHours: 1, totalDays: 0 };
    expect(formatElapsedTimeDetailed(elapsed)).toBe('1h 30m 45s');
  });

  it('deve formatar dias horas minutos', () => {
    const elapsed: ElapsedTime = { days: 2, hours: 4, minutes: 10, seconds: 5, totalMinutes: 3130, totalHours: 52, totalDays: 2 };
    expect(formatElapsedTimeDetailed(elapsed)).toBe('2d 4h 10m');
  });
});
