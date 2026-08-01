const CACHE_NAME = 'revision-planner-v25';


const LOCAL_ASSETS = [
  '/',
  '/index.html',
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
  // Ne pas cacher les appels API
  if (event.request.url.includes('/api/')) {
    return event.respondWith(fetch(event.request));
  }

  // Network-First pour la Navigation / HTML afin de toujours appliquer les mises à jour
  if (event.request.mode === 'navigate' || event.request.url.endsWith('/index.html') || event.request.url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
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
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
