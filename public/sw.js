const CACHE_NAME = 'billing-platform-cache-v1';
const RUNTIME = 'runtime';

// Resources to pre-cache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html'
];

// The install handler takes care of precaching the resources we always need
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting())
  );
});

// The activate handler takes care of cleaning up old caches
self.addEventListener('activate', event => {
  const currentCaches = [CACHE_NAME, RUNTIME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
    }).then(cachesToDelete => {
      return Promise.all(cachesToDelete.map(cacheToDelete => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

// The fetch handler serves responses from a cache
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return caches.open(RUNTIME).then(cache => {
          return fetch(event.request).then(response => {
            // Put a copy of the response in the runtime cache
            return cache.put(event.request, response.clone()).then(() => {
          return response;
        });
          });
        });
      })
    );
  }
});

// Handle background sync for failed translation updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-translations') {
    event.waitUntil(
      // Sync translations that failed to load
      syncTranslations()
    );
  }
});

// Function to sync translations
async function syncTranslations() {
  try {
    const failedRequests = await getFailedTranslationRequests();
    await Promise.all(
      failedRequests.map(async (request) => {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response);
          await removeFailedRequest(request);
        }
      })
    );
  } catch (error) {
    console.error('Failed to sync translations:', error);
  }
}

// Helper functions for managing failed requests
async function getFailedTranslationRequests() {
  // Implementation would depend on how you store failed requests
  return [];
}

async function removeFailedRequest(request) {
  // Implementation would depend on how you store failed requests
}

// Message event - handle cache management
self.addEventListener('message', (event) => {
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    });
  }
}); 