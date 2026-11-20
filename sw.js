const CACHE_NAME = 'revision-planner-v33';





const LOCAL_ASSETS = [
  '/',
  '/index.html',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
  '/sounds/rain.mp3',
  '/sounds/forest.mp3',
  '/sounds/white.mp3',
  '/sounds/lofi.mp3'
];

// Installation : mise en cache résiliente des assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Assets locaux obligatoires
      await cache.addAll(LOCAL_ASSETS);
      // 2. Assets tiers distants (tolérants aux échecs réseau individuels via Promise.allSettled)
      await Promise.allSettled(
        EXTERNAL_ASSETS.map(url =>
          fetch(url, { mode: 'no-cors' })
            .then(res => cache.put(url, res))
            .catch(err => console.log('SW external asset skip:', url, err.message))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch : Network First for navigation, Cache First for static assets
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET et les schémas non-HTTP(S) (ex: chrome-extension://, data:, blob:)
  if (event.request.method !== 'GET') return;

  let requestUrl;
  try {
    requestUrl = new URL(event.request.url);
  } catch {
    return;
  }

  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
    return;
  }

  // Ne pas cacher les appels API
  if (requestUrl.pathname.startsWith('/api/')) {
    return event.respondWith(fetch(event.request, { cache: 'no-store' }));
  }

  // Network-First pour la Navigation / HTML afin de toujours appliquer les mises à jour
  if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('/index.html') || requestUrl.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, clone))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          // FIX CORRIGÉ : caches.match(request) retourne une Promise (truthy).
          // Utilisation explicite de .then(r => r || caches.match('/index.html')) pour garantir le fallback SPA hors-ligne.
          caches.match(event.request).then(r => r || caches.match('/index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const clone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, clone))
            .catch(() => {});
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
