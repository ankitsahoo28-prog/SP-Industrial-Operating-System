const CACHE_VERSION = 'sp-industrial-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const OFFLINE_QUEUE = 'offline-queue';

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
  '/api/inv/products',
  '/api/inv/dashboard',
  '/api/acc/partners',
  '/api/acc/journals',
  '/api/notifications'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => console.log('Some static assets failed'))
    )
  );
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET requests: try network, queue offline if fails
  if (request.method !== 'GET') {
    event.respondWith(handleMutationRequest(request));
    return;
  }

  // API routes: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // HTML documents: network-first
  if (request.destination === 'document') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets: cache-first
  event.respondWith(cacheFirstStrategy(request));
});

// ===== MUTATION (POST/PUT/DELETE) HANDLER =====
async function handleMutationRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Offline: queue the request for later sync
    const body = await request.clone().text();
    const queueItem = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: body,
      timestamp: Date.now(),
    };

    // Store in IndexedDB
    await addToOfflineQueue(queueItem);

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'OFFLINE_QUEUED', count: 1 }));

    return new Response(JSON.stringify({ error: 'Offline', queued: true, message: 'Your action has been saved and will sync when online.' }),
      { status: 202, headers: { 'Content-Type': 'application/json' } });
  }
}

// ===== NETWORK-FIRST STRATEGY =====
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

// ===== CACHE-FIRST STRATEGY =====
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

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  const queue = await getOfflineQueue();
  let processed = 0;

  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body || undefined,
      });
      if (response.ok || response.status < 500) {
        await removeFromOfflineQueue(item.timestamp);
        processed++;
      }
    } catch (e) {
      // Still offline, stop processing
      break;
    }
  }

  if (processed > 0) {
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE', processed }));
  }
}

// ===== INDEXEDDB FOR OFFLINE QUEUE =====
function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('offlineQueue', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'timestamp' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToOfflineQueue(item) {
  const db = await openQueueDB();
  return new Promise((resolve) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').put(item);
    tx.oncomplete = resolve;
  });
}

async function getOfflineQueue() {
  const db = await openQueueDB();
  return new Promise((resolve) => {
    const tx = db.transaction('queue', 'readonly');
    const req = tx.objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function removeFromOfflineQueue(timestamp) {
  const db = await openQueueDB();
  return new Promise((resolve) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(timestamp);
    tx.oncomplete = resolve;
  });
}

// ===== MESSAGE HANDLER =====
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'PROCESS_QUEUE') processOfflineQueue();
});
