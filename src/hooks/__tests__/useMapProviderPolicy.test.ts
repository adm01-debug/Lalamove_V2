import { describe, it, expect } from 'vitest';
import { allowedProvidersFor, PROVIDER_FAMILY } from '../useMapProviderPolicy';

describe('allowedProvidersFor', () => {
  it('libera tudo quando a política é off (fail-open)', () => {
    expect(allowedProvidersFor('off')).toEqual(Object.keys(PROVIDER_FAMILY));
  });

  it('restrito a mapbox mantém raster gratuito e tira Google', () => {
    const allowed = allowedProvidersFor('mapbox');
    expect(allowed).toEqual(expect.arrayContaining(['mapbox-dark', 'mapbox-sat', 'osm', 'esri-sat']));
    expect(allowed).not.toContain('google-roadmap');
    expect(allowed).not.toContain('google-3d');
  });

  it('restrito a google mantém raster gratuito e tira Mapbox', () => {
    const allowed = allowedProvidersFor('google');
    expect(allowed).toEqual(expect.arrayContaining(['google-roadmap', 'google-hybrid', 'google-3d', 'osm']));
    expect(allowed).not.toContain('mapbox-dark');
  });
});