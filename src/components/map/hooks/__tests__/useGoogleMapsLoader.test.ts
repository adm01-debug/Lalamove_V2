import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/**
 * O loader é singleton de módulo: cada teste recarrega o módulo para resetar
 * `loaderPromise` e reler `import.meta.env`.
 */
async function loadModule(browserKey?: string, opts: { ownKey?: string; mapId?: string } = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY', browserKey ?? '');
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', opts.ownKey ?? '');
  vi.stubEnv('VITE_GOOGLE_MAPS_MAP_ID', opts.mapId ?? '');
  return import('../useGoogleMapsLoader');
}

describe('useGoogleMapsLoader', () => {
  beforeEach(() => {
    delete (window as { google?: unknown }).google;
    delete (window as { __lovableInitGmaps?: unknown }).__lovableInitGmaps;
    document.head.querySelectorAll('script').forEach(s => s.remove());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reporta não configurado quando falta a chave do conector', async () => {
    const mod = await loadModule();
    expect(mod.isGoogleMapsConfigured()).toBe(false);
    const { result } = renderHook(() => mod.useGoogleMapsLoader());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toMatch(/não configurado/i);
    expect(result.current.configured).toBe(false);
  });

  it('respeita a chave injetada via env do conector', async () => {
    const mod = await loadModule('fake-key');
    expect(mod.isGoogleMapsConfigured()).toBe(true);
  });

  it('resolve imediatamente quando window.google já existe', async () => {
    (window as { google?: unknown }).google = { maps: { Map: function Map() {} } };
    const mod = await loadModule();
    await expect(mod.loadGoogleMaps()).resolves.toBeUndefined();
    expect(document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('injetar o script uma vez só (singleton) e resolver pelo callback', async () => {
    const mod = await loadModule('fake-key');
    const p1 = mod.loadGoogleMaps();
    const p2 = mod.loadGoogleMaps();
    expect(p1).toBe(p2);

    const script = document.head.querySelector('script');
    expect(script).not.toBeNull();
    expect(script!.src).toContain('key=fake-key');
    expect(script!.src).toContain('v=beta');
    expect(script!.src).toContain('libraries=maps3d%2Cmarker');
    expect(script!.src).toContain('callback=__lovableInitGmaps');

    (window as { __lovableInitGmaps?: () => void }).__lovableInitGmaps?.();
    await expect(p1).resolves.toBeUndefined();
  });

  it('etapa 75: chave propria usa v=weekly, libraries maps/marker/routes e expoe o Map ID', async () => {
    const mod = await loadModule(undefined, { ownKey: 'own-key', mapId: 'map-abc' });
    expect(mod.USING_OWN_KEY).toBe(true);
    expect(mod.getGoogleMapsMapId()).toBe('map-abc');
    const p = mod.loadGoogleMaps();
    const script = document.head.querySelector('script');
    expect(script!.src).toContain('key=own-key');
    expect(script!.src).toContain('v=weekly');
    expect(script!.src).toContain('libraries=maps%2Cmarker%2Croutes');
    (window as { __lovableInitGmaps?: () => void }).__lovableInitGmaps?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('etapa 75: sem chave propria o conector gerenciado nao recebe mapId', async () => {
    const mod = await loadModule('fake-key', { mapId: 'map-abc' });
    expect(mod.USING_OWN_KEY).toBe(false);
    expect(mod.getGoogleMapsMapId()).toBeUndefined();
  });

  it('rejeita e libera o singleton quando o script falha', async () => {
    const mod = await loadModule('fake-key');
    const p = mod.loadGoogleMaps();
    const script = document.head.querySelector('script');
    script!.onerror?.(new Event('error'));
    await expect(p).rejects.toThrow(/Falha ao carregar Google Maps/i);
  });
});
