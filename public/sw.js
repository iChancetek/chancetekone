// ChanceTEK One - 2026 Progressive Web App Service Worker (Real-Time Platform Sync)
const CACHE_NAME = 'chancetekone-pwa-v2.4.0';
const RUNTIME_CACHE = 'chancetekone-runtime-v2.4.0';
// Audio files are never cached by the SW — browser handles native Range-request streaming directly

// Pre-cache only offline fallback shell assets; dynamic pages are fetched network-first to ensure real-time platform sync
const PRECACHE_URLS = [
  '/offline',
  '/logo.png',
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

// 2. Activate Event: Clean up stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[PWA SW] Removing legacy cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Intelligent multi-tier caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET requests, non-http protocols, and only-if-cached requests
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    request.cache === 'only-if-cached'
  ) {
    return;
  }

  // CRITICAL RULE 1: Completely bypass ALL audio & video files (.mp3, .mp4, /audio/, /videos/)
  // Browser audio and video elements use HTTP Range requests for seeking/streaming. Never intercept them.
  if (
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.m4v') ||
    url.pathname.endsWith('.wav') ||
    url.pathname.endsWith('.ogg') ||
    url.pathname.endsWith('.aac') ||
    url.pathname.includes('/audio/') ||
    url.pathname.includes('/videos/') ||
    request.headers.has('range')
  ) {
    return;
  }

  // Bypass API endpoints, Auth endpoints, development localhost, and external third-party services
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/webpack-hmr') ||
    url.pathname.includes('/__nextjs') ||
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1' ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('openai.com')
  ) {
    return;
  }

  // Next.js Static Assets (CSS, JS chunks, fonts, images): Stale-While-Revalidate / Cache-First
  // These are content-hashed and immutable. Caching them guarantees CSS and chunk loads never fail or 404 on mobile PWAs.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalidate in background to keep fresh
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML Navigation Requests: Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(request, { cache: 'no-cache' }))
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
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

// 4. Message Event: Handle manual update triggers from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
