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

// Etapa 58: o provider de tiles vem do banco (`geo_settings.tiles`), então precisa
// de mock — o componente antes era Mapbox fixo.
const tilesState = { provider: 'mapbox' as 'mapbox' | 'google' | 'off' };
vi.mock('@/hooks/useMapProviderPolicy', () => ({
  useTilesProvider: () => ({ data: tilesState.provider }),
}));

const loadGoogleMapsMock = vi.fn(() => Promise.resolve());
vi.mock('../hooks/useGoogleMapsLoader', () => ({
  loadGoogleMaps: () => loadGoogleMapsMock(),
  getGoogleMapsMapId: () => undefined,
}));

// mapbox-gl não instancia em jsdom: stub mínimo da API usada pelo componente.
const mapStub = {
  on: (event: string, cb: () => void) => { if (event === 'style.load') cb(); },
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getSource: () => undefined,
  fitBounds: vi.fn(),
  remove: vi.fn(),
};
const MapMock = vi.fn();
function LngLatBoundsMock() { return { extend: () => ({}) }; }
vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: '',
    // Classe declarada dentro da factory: `vi.mock` é hoisted e não vê o escopo do módulo.
    Map: class { constructor(...args: unknown[]) { MapMock(...args); return mapStub as never; } },
    LngLatBounds: LngLatBoundsMock,
  },
}));

// Stub da Google Maps JS API (carregada por <script>, indisponível no jsdom).
const googleMapStub = { fitBounds: vi.fn() };
Object.assign(window, {
  google: {
    maps: {
      Map: function () { return googleMapStub; },
      Marker: function () { return { setMap: vi.fn() }; },
      Polyline: function () { return { setPath: vi.fn() }; },
      LatLngBounds: function () { return { extend: () => undefined }; },
      SymbolPath: { CIRCLE: 0 },
      event: { trigger: vi.fn() },
    },
  },
});

import { OrderTrackingMap } from '../OrderTrackingMap';
import { countMapLoad } from '@/lib/geo-gateway';

describe('OrderTrackingMap (etapa 58)', () => {
  beforeEach(() => {
    tokenState.token = null;
    tokenState.error = null;
    tilesState.provider = 'mapbox';
    setExpectedRouteMock.mockClear();
    loadGoogleMapsMock.mockClear();
    MapMock.mockClear();
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

  it('com geo_settings.tiles = google usa o canvas Google e não instancia o Mapbox', async () => {
    tilesState.provider = 'google';
    tokenState.token = 'pk.test';
    render(<OrderTrackingMap pickup={{ lat: -23.55, lng: -46.63 }} delivery={{ lat: -23.6, lng: -46.7 }} />);

    await vi.waitFor(() => expect(loadGoogleMapsMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(countMapLoad).toHaveBeenCalledWith('google'));

    // Nenhum map load do Mapbox é cobrado quando o Google desenha o mapa.
    expect(MapMock).not.toHaveBeenCalled();
    expect(countMapLoad).not.toHaveBeenCalledWith('mapbox');
    // A atribuição Mapbox não aparece no canvas Google.
    expect(screen.queryByText(/© Mapbox/)).toBeNull();
  });
});
