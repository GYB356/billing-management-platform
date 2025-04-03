const CACHE_NAME = 'i18n-cache-v1';
const STATIC_CACHE_NAME = 'static-cache-v1';

// Common languages that are preloaded
const COMMON_LANGUAGES = ['en', 'fr', 'es', 'de'];

// Less common languages that are cached on first use
const LESS_COMMON_LANGUAGES = ['ar', 'he', 'zh', 'ja', 'ko', 'ru', 'pt', 'it', 'nl', 'pl'];

// Files to cache
const STATIC_FILES = [
  '/offline.html',
  '/styles/main.css',
  '/scripts/i18n.js'
];

// Cache common language files on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache common language files
      caches.open(CACHE_NAME).then((cache) => {
        return Promise.all(
          COMMON_LANGUAGES.map((lang) =>
            cache.add(`/locales/${lang}/translation.json`)
          )
        );
      }),
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.addAll([
          '/images/logo.png',
          '/images/icons/language.svg',
          '/css/main.css',
          '/js/main.js'
        ]);
      })
    ])
  );
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Handle fetch requests
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Handle translation file requests
  if (url.pathname.startsWith('/locales/') && url.pathname.endsWith('/translation.json')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Return cached response if available
        if (response) {
          return response;
        }

        // Fetch and cache new translation
        return fetch(event.request).then((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }

          // Clone the response before caching
          const responseToCache = response.clone();

          // Cache the response
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
    );
    return;
  }

  // Handle static asset requests
  if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Return cached response if available
        if (response) {
          return response;
        }

        // Fetch and cache new static asset
        return fetch(event.request).then((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }

          // Clone the response before caching
          const responseToCache = response.clone();

          // Cache the response
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
    );
    return;
  }

  // For all other requests, try network first, then cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
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