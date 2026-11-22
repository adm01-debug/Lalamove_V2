import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

/**
 * Etapa 80 — o map load é contabilizado no provedor que realmente desenhou o mapa.
 * Antes deste fix `GoogleMapsCanvas`/`Google3DCanvas` instanciavam o mapa e nada
 * chegava em `geo-gateway count-map-load`, então o custo do Google era invisível.
 */

const countMapLoadMock = vi.fn();
vi.mock('@/lib/geo-gateway', () => ({ countMapLoad: (p: string) => countMapLoadMock(p) }));

vi.mock('../hooks/useTrackingData', () => ({ useTrackingData: () => ({ trackingData: [] }) }));
vi.mock('../hooks/useTrackingTrails', () => ({ useTrackingTrails: () => ({}) }));

const loaderState = { ready: true, error: null as Error | null, configured: true };
vi.mock('../hooks/useGoogleMapsLoader', () => ({
  useGoogleMapsLoader: () => loaderState,
  getGoogleMapsMapId: () => undefined,
}));

function MapCtor(this: Record<string, unknown>) {
  this.setMapTypeId = vi.fn();
  this.panTo = vi.fn();
  this.setZoom = vi.fn();
  this.getDiv = () => document.createElement('div');
}
function InfoWindowCtor(this: Record<string, unknown>) {
  this.open = vi.fn();
  this.setContent = vi.fn();
  this.close = vi.fn();
}

vi.stubGlobal('google', { maps: { Map: MapCtor, InfoWindow: InfoWindowCtor } });

import { GoogleMapsCanvas } from '../GoogleMapsCanvas';

describe('GoogleMapsCanvas — contagem de map load (etapa 80)', () => {
  beforeEach(() => {
    countMapLoadMock.mockClear();
    loaderState.ready = true;
    loaderState.error = null;
    loaderState.configured = true;
  });

  it('cobra o load no provedor google, não no mapbox', () => {
    render(<GoogleMapsCanvas initialCenter={[-46.6, -23.5]} initialZoom={12} mapTypeId="roadmap" />);
    expect(countMapLoadMock).toHaveBeenCalledWith('google');
    expect(countMapLoadMock).not.toHaveBeenCalledWith('mapbox');
  });

  it('não cobra load quando o mapa não chega a ser instanciado', () => {
    loaderState.ready = false;
    render(<GoogleMapsCanvas initialCenter={[-46.6, -23.5]} initialZoom={12} mapTypeId="roadmap" />);
    expect(countMapLoadMock).not.toHaveBeenCalled();
  });
});
