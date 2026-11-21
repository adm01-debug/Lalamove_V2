import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const tokenState = { token: null as string | null, error: null as string | null };

vi.mock('../hooks/useMapboxToken', () => ({
  useMapboxToken: () => ({ mapboxToken: tokenState.token, error: tokenState.error }),
}));

const setExpectedRouteMock = vi.fn();
vi.mock('../mapLayers', () => ({
  setupMapLayers: vi.fn(),
  applyRasterOverlay: vi.fn(),
  setDriverTrail: vi.fn(),
  setExpectedRoute: (...args: unknown[]) => setExpectedRouteMock(...args),
}));

vi.mock('@/lib/geo-gateway', () => ({ countMapLoad: vi.fn() }));

// mapbox-gl não instancia em jsdom: stub mínimo da API usada pelo componente.
const mapStub = {
  on: (event: string, cb: () => void) => { if (event === 'style.load') cb(); },
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getSource: () => undefined,
  fitBounds: vi.fn(),
  remove: vi.fn(),
};
function MapMock() { return mapStub; }
function LngLatBoundsMock() { return { extend: () => ({}) }; }
vi.mock('mapbox-gl', () => ({
  default: { accessToken: '', Map: MapMock, LngLatBounds: LngLatBoundsMock },
}));

import { OrderTrackingMap } from '../OrderTrackingMap';

describe('OrderTrackingMap (etapa 58)', () => {
  beforeEach(() => {
    tokenState.token = null;
    tokenState.error = null;
    setExpectedRouteMock.mockClear();
  });

  it('mostra aviso quando o token do Mapbox não está disponível', () => {
    tokenState.error = 'Token Mapbox não configurado';
    render(<OrderTrackingMap className="h-56" />);
    expect(screen.getByText('Mapa indisponível no momento.')).toBeTruthy();
  });

  it('expõe a região com rótulo acessível quando há token', () => {
    tokenState.token = 'pk.test';
    render(<OrderTrackingMap className="h-56" />);
    expect(screen.getByRole('img', { name: /Mapa do trajeto do pedido/i })).toBeTruthy();
  });

  it('não quebra sem coordenadas nem rota', () => {
    tokenState.token = 'pk.test';
    const { container } = render(<OrderTrackingMap />);
    expect(container.querySelector('[role="img"]')).toBeTruthy();
  });
});
