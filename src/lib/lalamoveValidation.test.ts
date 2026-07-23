import { describe, it, expect } from 'vitest';
import {
  validateScheduleAt,
  validateSpecialRequests,
  SPECIAL_REQUESTS_BY_VEHICLE,
} from '@/lib/lalamoveValidation';

describe('validateScheduleAt', () => {
  const NOW = new Date('2026-07-23T12:00:00.000Z');

  it('aceita string vazia como imediato', () => {
    const r = validateScheduleAt('', NOW);
    expect(r.valid).toBe(true);
    expect(r.iso).toBe('');
  });

  it('rejeita data inválida', () => {
    expect(validateScheduleAt('not-a-date', NOW).valid).toBe(false);
    expect(validateScheduleAt('2026-13-40T99:99', NOW).valid).toBe(false);
  });

  // Fronteira inferior: 30 minutos.
  const belowMin = [0, 1, 5, 15, 29, 29.9];
  it.each(belowMin)('rejeita %s minutos à frente (< 30)', (m) => {
    const dt = new Date(NOW.getTime() + m * 60000).toISOString();
    const r = validateScheduleAt(dt, NOW);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/30 minutos/);
  });

  const atOrAboveMin = [30, 31, 60, 120, 1440, 60 * 24 * 15];
  it.each(atOrAboveMin)('aceita %s minutos à frente', (m) => {
    const dt = new Date(NOW.getTime() + m * 60000).toISOString();
    expect(validateScheduleAt(dt, NOW).valid).toBe(true);
  });

  // Fronteira superior: 30 dias.
  const overMax = [30 * 24 * 60 + 1, 30 * 24 * 60 + 60, 60 * 24 * 60];
  it.each(overMax)('rejeita %s minutos (> 30 dias)', (m) => {
    const dt = new Date(NOW.getTime() + m * 60000).toISOString();
    const r = validateScheduleAt(dt, NOW);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/30 dias/);
  });

  it('rejeita datas no passado', () => {
    for (const m of [1, 60, 24 * 60, 365 * 24 * 60]) {
      const dt = new Date(NOW.getTime() - m * 60000).toISOString();
      expect(validateScheduleAt(dt, NOW).valid).toBe(false);
    }
  });

  it('retorna ISO canônico quando válido', () => {
    const dt = new Date(NOW.getTime() + 60 * 60000);
    const r = validateScheduleAt(dt.toISOString(), NOW);
    expect(r.iso).toBe(dt.toISOString());
  });
});

describe('validateSpecialRequests', () => {
  const vehicles = Object.keys(SPECIAL_REQUESTS_BY_VEHICLE);

  it('aceita lista vazia para todo veículo válido', () => {
    for (const v of vehicles) {
      expect(validateSpecialRequests(v, []).valid).toBe(true);
    }
  });

  it('aceita todas as requests permitidas por veículo', () => {
    for (const v of vehicles) {
      const allowed = SPECIAL_REQUESTS_BY_VEHICLE[v];
      const r = validateSpecialRequests(v, [...allowed]);
      expect(r.valid).toBe(true);
    }
  });

  it('aceita qualquer subconjunto individual das requests permitidas', () => {
    for (const v of vehicles) {
      for (const req of SPECIAL_REQUESTS_BY_VEHICLE[v]) {
        expect(validateSpecialRequests(v, [req]).valid).toBe(true);
      }
    }
  });

  it('rejeita cross-vehicle: toda request não permitida em outro veículo', () => {
    for (const target of vehicles) {
      const allowedSet = new Set(SPECIAL_REQUESTS_BY_VEHICLE[target]);
      for (const other of vehicles) {
        for (const req of SPECIAL_REQUESTS_BY_VEHICLE[other]) {
          if (allowedSet.has(req)) continue;
          const r = validateSpecialRequests(target, [req]);
          expect(r.valid).toBe(false);
          expect(r.invalid).toContain(req);
        }
      }
    }
  });

  it('rejeita veículo desconhecido', () => {
    const r = validateSpecialRequests('SPACESHIP', ['TOLL_FEE']);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/desconhecido/);
  });

  it('rejeita valores completamente fora do catálogo', () => {
    for (const v of vehicles) {
      const r = validateSpecialRequests(v, ['UNKNOWN_REQUEST']);
      expect(r.valid).toBe(false);
      expect(r.invalid).toContain('UNKNOWN_REQUEST');
    }
  });

  it('detecta duplicatas quando todas são permitidas', () => {
    const r = validateSpecialRequests('VAN', ['TOLL_FEE', 'TOLL_FEE']);
    expect(r.valid).toBe(false);
    expect(r.duplicates).toContain('TOLL_FEE');
  });

  it('MOTORCYCLE não aceita ROUND_TRIP nem MOVING_SERVICE nem LOADING_SERVICE', () => {
    for (const forbidden of ['ROUND_TRIP', 'MOVING_SERVICE', 'LOADING_SERVICE']) {
      expect(validateSpecialRequests('MOTORCYCLE', [forbidden]).valid).toBe(false);
    }
  });

  it('TRUCK175/TRUCK330 não aceitam HELP_BUY, THERMAL_BAG_1 ou PURCHASE_SERVICE_1', () => {
    for (const v of ['TRUCK175', 'TRUCK330']) {
      for (const forbidden of ['HELP_BUY', 'THERMAL_BAG_1', 'PURCHASE_SERVICE_1']) {
        expect(validateSpecialRequests(v, [forbidden]).valid).toBe(false);
      }
    }
  });
});
