import { useEffect, useState } from 'react';

/**
 * Singleton loader para a Google Maps JS API via chave do conector gerenciado
 * (VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY). Usa v=beta para acessar
 * bibliotecas 3D fotorrealísticas (maps3d).
 *
 * NÃO usar `mapId` nem `AdvancedMarkerElement` — política do conector managed.
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

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
  | string
  | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
  | string
  | undefined;

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

    const params = new URLSearchParams({
      key: BROWSER_KEY,
      v: 'beta',
      libraries: 'maps3d,marker',
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
