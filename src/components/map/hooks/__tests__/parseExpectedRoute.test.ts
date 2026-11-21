import { describe, it, expect, vi } from 'vitest';

vi.mock('mapbox-gl', () => ({ default: { Marker: vi.fn(), Popup: vi.fn() } }));
vi.mock('@/hooks/useMapbox', () => ({ getDirections: vi.fn() }));

const { parseExpectedRoute } = await import('../useMapMarkers');

describe('parseExpectedRoute', () => {
  it('aceita array de {lat,lng} com 2+ pontos', () => {
    expect(parseExpectedRoute([{ lat: -23.5, lng: -46.6 }, { lat: -23.6, lng: -46.7 }])).toEqual([
      { lat: -23.5, lng: -46.6 },
      { lat: -23.6, lng: -46.7 },
    ]);
  });

  it('devolve null para valores que não são polyline válida', () => {
    expect(parseExpectedRoute(null)).toBeNull();
    expect(parseExpectedRoute(undefined)).toBeNull();
    expect(parseExpectedRoute('polyline')).toBeNull();
    expect(parseExpectedRoute([])).toBeNull();
    expect(parseExpectedRoute([{ lat: -23.5, lng: -46.6 }])).toBeNull();
    expect(parseExpectedRoute([[-46.6, -23.5], [-46.7, -23.6]])).toBeNull();
    expect(parseExpectedRoute([{ lat: 'x', lng: -46.6 }, { lat: -23.6, lng: -46.7 }])).toBeNull();
    expect(parseExpectedRoute([{ lat: NaN, lng: -46.6 }, { lat: -23.6, lng: -46.7 }])).toBeNull();
  });
});