/**
 * ==============================================================================
 * VeerSeva - PWA Service Worker
 * Versioned cache & background offline support
 * Handles instant client updates on user acceptance
 * ==============================================================================
 */

const CACHE_NAME = 'veerseva-v1.2.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app/',
  '/app/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/sessionManager.js',
  '/js/accessibility.js',
  '/js/i18n.js',
  '/i18n/en.json',
  '/i18n/hi.json',
  '/public/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching core shell assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate: clean up outdated version caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[ServiceWorker] Removing stale cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network first for dynamic API calls, Cache first for shell assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always use network for API requests and auth
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'OFFLINE', message: 'You are currently working offline.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  }

  // Cache-first falling back to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch updated asset in background (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

// Message listener for skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
