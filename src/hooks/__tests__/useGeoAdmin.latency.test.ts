import { describe, it, expect } from 'vitest';
import { aggregateGeoLatency } from '@/hooks/useGeoAdmin';

describe('aggregateGeoLatency (etapa 80)', () => {
  it('agrupa por provedor e função e calcula p50/p95', () => {
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((d) => ({
      operation: 'geo:mapbox',
      rpc_name: 'geocode',
      duration_ms: d,
    }));
    const [row] = aggregateGeoLatency(rows);
    expect(row).toMatchObject({ provider: 'mapbox', function: 'geocode', samples: 10 });
    expect(row.p50).toBe(55);
    expect(row.p95).toBe(96);
  });

  it('separa provedores e funções diferentes', () => {
    const rows = [
      { operation: 'geo:mapbox', rpc_name: 'route', duration_ms: 100 },
      { operation: 'geo:google', rpc_name: 'route', duration_ms: 200 },
      { operation: 'geo:mapbox', rpc_name: 'geocode', duration_ms: 300 },
    ];
    const out = aggregateGeoLatency(rows);
    expect(out.map((r) => `${r.provider}/${r.function}`)).toEqual([
      'google/route',
      'mapbox/geocode',
      'mapbox/route',
    ]);
    expect(out.every((r) => r.samples === 1)).toBe(true);
  });

  it('descarta linhas sem duração e operações que não são do geo-gateway', () => {
    const out = aggregateGeoLatency([
      { operation: 'geo:mapbox', rpc_name: 'geocode', duration_ms: null },
      { operation: 'lalamove', rpc_name: 'quote', duration_ms: 50 },
      { operation: 'geo:mapbox', rpc_name: 'geocode', duration_ms: 12 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].samples).toBe(1);
    expect(out[0].p50).toBe(12);
  });

  it('usa "—" quando a função não foi informada', () => {
    const [row] = aggregateGeoLatency([{ operation: 'geo:mapbox', rpc_name: null, duration_ms: 5 }]);
    expect(row.function).toBe('—');
  });

  it('retorna lista vazia sem amostras', () => {
    expect(aggregateGeoLatency([])).toEqual([]);
  });
});
