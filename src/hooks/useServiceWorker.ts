import { logger } from '@/utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';


interface ServiceWorkerState {
  isSupported: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  hasUpdate: boolean;
  registration: ServiceWorkerRegistration | null;
}

function shouldDisableAppServiceWorker(): boolean {
  if (!('serviceWorker' in navigator)) return true;
  if (!import.meta.env.PROD) return true;

  const { hostname, search } = window.location;
  const isEmbeddedPreview = window.self !== window.top;

  return (
    search.includes('__lovable_token=') ||
    search.includes('sw=off') ||
    isEmbeddedPreview ||
    hostname.startsWith('id-preview--') ||
    hostname.startsWith('preview--') ||
    hostname === 'lovableproject.com' ||
    hostname.endsWith('.lovableproject.com') ||
    hostname === 'lovableproject-dev.com' ||
    hostname.endsWith('.lovableproject-dev.com') ||
    hostname === 'beta.lovable.dev' ||
    hostname.endsWith('.beta.lovable.dev')
  );
}

function isAppServiceWorker(registration: ServiceWorkerRegistration): boolean {
  return registration.active?.scriptURL.endsWith('/sw.js') === true ||
    registration.installing?.scriptURL.endsWith('/sw.js') === true ||
    registration.waiting?.scriptURL.endsWith('/sw.js') === true;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isInstalled: false,
    isOnline: navigator.onLine,
    hasUpdate: false,
    registration: null,
  });

  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  // Register service worker (disabled on Lovable preview to avoid stale chunks)
  useEffect(() => {
    if (!state.isSupported) return;

    // In dev/preview/editor frames, always unregister the app-shell SW and clear
    // only its caches. This prevents stale chunks and fetch proxy failures.
    if (shouldDisableAppServiceWorker()) {
      const cleanupPreviewCaching = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.filter(isAppServiceWorker).map((registration) => registration.unregister()));

          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames
              .filter((name) => name.startsWith('lalamove-guardian-') || name.startsWith('runtime-cache-') || name === 'pending-actions')
              .map((name) => caches.delete(name))
          );

          setState((prev) => ({
            ...prev,
            isInstalled: false,
            hasUpdate: false,
            registration: null,
          }));
        } catch (error) {
          logger.error('[SW Hook] Preview cache cleanup failed:', error);
        }
      };

      cleanupPreviewCaching();
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        setState(prev => ({
          ...prev,
          isInstalled: true,
          registration,
        }));

        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                if (import.meta.env.DEV) logger.log('[SW Hook] New version available');
                setWaitingWorker(newWorker);
                setState(prev => ({ ...prev, hasUpdate: true }));

                toast('Nova versão disponível', {
                  description: 'Clique para atualizar o aplicativo',
                  action: {
                    label: 'Atualizar',
                    onClick: () => updateServiceWorker(),
                  },
                  duration: 10000,
                });
              }
            });
          }
        });

        // Check for waiting service worker on load
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setState(prev => ({ ...prev, hasUpdate: true }));
        }

      } catch (error) {
        logger.error('[SW Hook] Registration failed:', error);
      }
    };

    registerSW();
  }, [state.isSupported]);

  // Online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      toast.success('Conexão restaurada', {
        description: 'Você está online novamente',
      });
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
      toast.warning('Sem conexão', {
        description: 'Você está offline. Algumas funcionalidades podem estar limitadas.',
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (!waitingWorker) return;

    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, [waitingWorker]);

  // Clear cache
  const clearCache = useCallback(async () => {
    if (!state.registration?.active) return;

    return new Promise<boolean>((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          toast.success('Cache limpo', {
            description: 'O cache foi limpo com sucesso',
          });
          resolve(true);
        } else {
          resolve(false);
        }
      };

      state.registration?.active?.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  }, [state.registration]);

  // Get service worker version
  const getVersion = useCallback(async () => {
    if (!state.registration?.active) return null;

    return new Promise<string | null>((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version);
      };

      state.registration?.active?.postMessage(
        { type: 'GET_VERSION' },
        [messageChannel.port2]
      );
    });
  }, [state.registration]);

  // Queue action for offline sync
  const queueOfflineAction = useCallback(async (
    url: string, 
    method: string, 
    headers: Record<string, string>, 
    body?: string
  ) => {
    try {
      const cache = await caches.open('pending-actions');
      const actionId = `action-${Date.now()}`;
      
      await cache.put(
        new Request(actionId),
        new Response(JSON.stringify({ url, method, headers, body }))
      );

      // Request background sync
      if ('sync' in state.registration! && state.registration) {
        const syncManager = (state.registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
        if (syncManager) {
          await syncManager.register('sync-pending-actions');
        }
      }

      return true;
    } catch (error) {
      logger.error('[SW Hook] Failed to queue offline action:', error);
      return false;
    }
  }, [state.registration]);

  return {
    ...state,
    updateServiceWorker,
    clearCache,
    getVersion,
    queueOfflineAction,
  };
}
