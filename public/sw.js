// ChanceTEK One - 2026 Progressive Web App Service Worker (Fast Mobile PWA + Zero Stale Hydration)
const CACHE_NAME = 'chancetekone-pwa-v3.0.0';
const RUNTIME_CACHE = 'chancetekone-runtime-v3.0.0';

// Pre-cache only lightweight offline shell assets; HTML pages always load fresh from network
// so installed iPhone & Android PWAs never load stale HTML referencing deleted Next.js JS chunks.
const PRECACHE_URLS = [
  '/offline',
  '/images/chancetekone_icon.png?v=2',
  '/manifest.webmanifest',
];

// 1. Install Event: Pre-cache essential offline assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[PWA SW] Precache error:', err))
  );
});

// 2. Activate Event: Purge ALL legacy caches (including v2.5.0 stale HTML/chunks) and claim clients
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              return caches.delete(cacheName);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network-first for HTML & chunks safety; bypass all audio/video/API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET requests, non-http protocols, cross-origin, and only-if-cached
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.origin !== self.location.origin ||
    request.cache === 'only-if-cached'
  ) {
    return;
  }

  // CRITICAL RULE 1: Completely bypass ALL audio & video files (.mp3, .mp4, /audio/, /videos/)
  if (
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.m4v') ||
    url.pathname.endsWith('.mov') ||
    url.pathname.endsWith('.wav') ||
    url.pathname.endsWith('.ogg') ||
    url.pathname.endsWith('.aac') ||
    url.pathname.includes('/audio/') ||
    url.pathname.includes('/videos/') ||
    request.headers.has('range')
  ) {
    return;
  }

  // Bypass API, dev/HMR, RSC payloads, and localhost
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/webpack-hmr') ||
    url.pathname.includes('/__nextjs') ||
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1'
  ) {
    return;
  }

  // Next.js immutable hashed static assets (JS, CSS, fonts): Cache-First ONLY if valid non-HTML 200 response
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          const contentType = (networkResponse.headers.get('content-type') || '').toLowerCase();
          // Never cache HTML error pages in a JS/CSS chunk slot
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic' &&
            !contentType.includes('text/html')
          ) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Static images & fonts: Cache-First with safe non-blocking background fill
  if (
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML Navigation Requests: Strictly Network-First (NEVER serve stale HTML with outdated chunk hashes!)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(request, { cache: 'no-cache' })).catch(async () => {
        const offlinePage = await caches.match('/offline');
        return (
          offlinePage ||
          new Response('Offline - ChanceTEK One', {
            headers: { 'Content-Type': 'text/html' },
          })
        );
      })
    );
    return;
  }
});

// 4. Message Event: Handle manual update & cache purge triggers from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
    );
  }
});
