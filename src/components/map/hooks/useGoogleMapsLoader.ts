import { useEffect, useState } from 'react';

/**
 * Singleton loader para a Google Maps JS API.
 *
 * Preferencia: chave propria do projeto Google Cloud `promo-brindes-lalamove`
 * (`VITE_GOOGLE_MAPS_BROWSER_KEY` + `VITE_GOOGLE_MAPS_MAP_ID`, etapa 75 do
 * plano Google) — com ela `mapId` e `AdvancedMarkerElement` funcionam.
 * Fallback: chave do conector gerenciado (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*`),
 * que proibe `mapId`/`AdvancedMarkerElement`; nesse modo o canvas cai no
 * `google.maps.Marker` legado.
 */

type GoogleMapsGlobal = {
  maps?: {
    Map?: unknown;
    importLibrary?: (name: string) => Promise<unknown>;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsGlobal;
    __lovableInitGmaps?: () => void;
  }
}

let loaderPromise: Promise<void> | null = null;

const OWN_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const OWN_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;
const CONNECTOR_KEY = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

const BROWSER_KEY = OWN_KEY || CONNECTOR_KEY;

/** Chave propria presente = conector gerenciado nao esta no caminho. */
export const USING_OWN_KEY = Boolean(OWN_KEY);

/**
 * `mapId` do Map ID na nuvem (estilo gerenciado + Advanced Markers).
 * Ausente com a chave do conector: aquele modo proibe `mapId`.
 */
export function getGoogleMapsMapId(): string | undefined {
  return USING_OWN_KEY ? OWN_MAP_ID : undefined;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(BROWSER_KEY);
}

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps only loads in the browser'));
  }
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  if (!BROWSER_KEY) {
    return Promise.reject(
      new Error(
        'Google Maps não configurado. Conecte o Google Maps Platform em Integrações.'
      )
    );
  }

  loaderPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__lovableInitGmaps';
    window[callbackName] = () => {
      resolve();
    };

    // `v=weekly` com chave propria (etapa 75). O conector gerenciado continua
    // em `v=beta` porque `Google3DCanvas` importa a biblioteca `maps3d`, que
    // nao sai no canal estavel.
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      v: USING_OWN_KEY ? 'weekly' : 'beta',
      libraries: USING_OWN_KEY ? 'maps,marker,routes' : 'maps3d,marker',
      loading: 'async',
      callback: callbackName,
    });
    if (TRACKING_ID) params.set('channel', TRACKING_ID);

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('Falha ao carregar Google Maps JS API'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function useGoogleMapsLoader() {
  const [ready, setReady] = useState<boolean>(
    () => Boolean(window.google?.maps?.Map)
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return { ready, error, configured: isGoogleMapsConfigured() };
}
