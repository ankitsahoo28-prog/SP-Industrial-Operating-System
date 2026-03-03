const CACHE_VERSION = 'sp-industrial-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/sp-logo.png',
  '/favicon.ico'
];

const API_CACHE_ROUTES = [
  '/api/settings',
  '/api/companies',
  '/api/dashboard/stats',
  '/api/tasks',
  '/api/reports',
  '/api/indents',
  '/api/inventory',
  '/api/inv/items',
  '/api/notifications'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.log('Some static assets failed to cache, continuing...');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline', queued: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  if (request.destination === 'document') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  event.respondWith(cacheFirstStrategy(request));
});

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(request.url.includes('/api/') ? API_CACHE : DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.destination === 'document') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response(JSON.stringify({ error: 'Offline', cached: false }),
      { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 503 });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUIRED' });
  });
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
