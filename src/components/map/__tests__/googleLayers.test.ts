import { describe, it, expect } from 'vitest';
import {
  DRIVER_ANIM_MS,
  TRAIL_MAX_POINTS,
  buildTrailPath,
  formatRouteBadge,
  haversineM,
  interpolatePosition,
  toGooglePath,
} from '../googleLayers';

describe('toGooglePath (etapa 77)', () => {
  it('converte expected_route em path do Google', () => {
    expect(toGooglePath([{ lat: -25.43, lng: -49.27 }, { lat: -25.44, lng: -49.28 }])).toEqual([
      { lat: -25.43, lng: -49.27 },
      { lat: -25.44, lng: -49.28 },
    ]);
  });

  it('devolve path vazio para rota ausente ou corrompida (nunca Polyline quebrada)', () => {
    expect(toGooglePath(null)).toEqual([]);
    expect(toGooglePath(undefined)).toEqual([]);
    expect(toGooglePath([{ lat: -25.43, lng: -49.27 }])).toEqual([]);
    expect(toGooglePath('rota')).toEqual([]);
    expect(toGooglePath([{ lat: 'x', lng: -49.27 }])).toEqual([]);
  });
});

describe('buildTrailPath (etapa 77)', () => {
  it('ordena cronologicamente mesmo recebendo o mais novo primeiro', () => {
    const path = buildTrailPath([
      { latitude: -25.44, longitude: -49.28, created_at: '2026-11-22T10:00:20Z' },
      { latitude: -25.43, longitude: -49.27, created_at: '2026-11-22T10:00:00Z' },
    ]);
    expect(path).toEqual([
      { lat: -25.43, lng: -49.27 },
      { lat: -25.44, lng: -49.28 },
    ]);
  });

  it('descarta pontos sem coordenada valida', () => {
    const path = buildTrailPath([
      { latitude: Number.NaN, longitude: -49.27, created_at: '2026-11-22T10:00:00Z' },
      { latitude: -25.43, longitude: -49.27, created_at: '2026-11-22T10:00:10Z' },
    ]);
    expect(path).toHaveLength(1);
  });

  it(`corta a trilha em ${TRAIL_MAX_POINTS} pontos mantendo os mais recentes`, () => {
    const events = Array.from({ length: TRAIL_MAX_POINTS + 5 }, (_, i) => ({
      latitude: -25.4 + i / 10_000,
      longitude: -49.2,
      created_at: new Date(Date.UTC(2026, 10, 22, 10, 0, i)).toISOString(),
    }));
    const path = buildTrailPath(events);
    expect(path).toHaveLength(TRAIL_MAX_POINTS);
    expect(path.at(-1)).toEqual({ lat: -25.4 + (TRAIL_MAX_POINTS + 4) / 10_000, lng: -49.2 });
  });

  it('trilha vazia nao desenha nada', () => {
    expect(buildTrailPath(null)).toEqual([]);
    expect(buildTrailPath([])).toEqual([]);
  });
});

describe('interpolatePosition (etapa 77)', () => {
  const from = { lat: -25.4, lng: -49.2 };
  const to = { lat: -25.5, lng: -49.4 };

  it('comeca na posicao anterior e termina exatamente na nova', () => {
    expect(interpolatePosition(from, to, 0)).toEqual(from);
    expect(interpolatePosition(from, to, DRIVER_ANIM_MS)).toEqual(to);
  });

  it('meio caminho em metade da janela de 10 s', () => {
    const mid = interpolatePosition(from, to, DRIVER_ANIM_MS / 2);
    expect(mid.lat).toBeCloseTo(-25.45, 6);
    expect(mid.lng).toBeCloseTo(-49.3, 6);
  });

  it('elapsed maior que a janela nao passa do destino (evita overshoot)', () => {
    expect(interpolatePosition(from, to, DRIVER_ANIM_MS * 5)).toEqual(to);
  });

  it('janela zero desativa a animacao e posiciona direto', () => {
    expect(interpolatePosition(from, to, 500, 0)).toEqual(to);
  });
});

describe('formatRouteBadge (etapa 77)', () => {
  it('metros abaixo de 1 km e km acima', () => {
    expect(formatRouteBadge(340, 6)).toEqual({ distance: '340 m', eta: '6 min' });
    expect(formatRouteBadge(2345, 21)).toEqual({ distance: '2.3 km', eta: '21 min' });
  });

  it('sem distancia informada mostra apenas o ETA', () => {
    expect(formatRouteBadge(null, 12)).toEqual({ distance: '--', eta: '12 min' });
    expect(formatRouteBadge(undefined, null)).toEqual({ distance: '--', eta: '--' });
  });
});

describe('haversineM (etapa 77)', () => {
  it('1 grau de latitude ~ 111 km', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(110_000);
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeLessThan(112_500);
  });

  it('mesmo ponto = 0', () => {
    expect(haversineM({ lat: -25.43, lng: -49.27 }, { lat: -25.43, lng: -49.27 })).toBe(0);
  });
});
