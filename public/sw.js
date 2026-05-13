// Lalamove Guardian Service Worker
const CACHE_NAME = 'lalamove-guardian-v2';
const RUNTIME_CACHE = 'runtime-cache-v2';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/robots.txt',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fall back to cache
  networkFirst: async (request, cacheName = RUNTIME_CACHE) => {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  },

  // Cache first, fall back to network
  cacheFirst: async (request, cacheName = CACHE_NAME) => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      throw error;
    }
  },

  // Stale while revalidate
  staleWhileRevalidate: async (request, cacheName = RUNTIME_CACHE) => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(() => null);

    return cachedResponse || fetchPromise;
  },
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests except for CDN assets
  if (url.origin !== self.location.origin) {
    // Allow caching of CDN assets (fonts, images, etc.)
    if (url.hostname.includes('fonts.googleapis.com') || 
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdnjs.cloudflare.com')) {
      event.respondWith(CACHE_STRATEGIES.cacheFirst(request));
    }
    return;
  }

  // API requests - network first
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/rest/') || url.pathname.includes('/functions/')) {
    event.respondWith(CACHE_STRATEGIES.networkFirst(request));
    return;
  }

  // Always prefer fresh JS/CSS/module chunks to avoid React runtime mismatch
  if (
    url.pathname.startsWith('/node_modules/.vite/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/src/') ||
    /\.(js|mjs|css|map)$/.test(url.pathname)
  ) {
    event.respondWith(CACHE_STRATEGIES.networkFirst(request));
    return;
  }

  // Images/fonts/icons - cache first
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request));
    return;
  }

  // HTML/navigation - network first (fallback cache)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(CACHE_STRATEGIES.networkFirst(request));
    return;
  }

  // Default - network first
  event.respondWith(CACHE_STRATEGIES.networkFirst(request));
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(syncPendingActions());
  }
});

// Handle pending actions when back online
async function syncPendingActions() {
  try {
    const cache = await caches.open('pending-actions');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          const data = await cachedResponse.json();
          await fetch(data.url, {
            method: data.method,
            headers: data.headers,
            body: data.body,
          });
          await cache.delete(request);
        }
      } catch (error) {
        console.error('[SW] Failed to sync action:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = { title: 'Nova Notificação', body: 'Você tem uma nova notificação' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'view', title: 'Ver' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
    requireInteraction: data.severity === 'CRITICAL',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(urlToOpen);
            return;
          }
        }
        // Open new window if none found
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});
