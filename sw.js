const CACHE_NAME = 'speakup-cache-v2';

// Only cache files we KNOW exist — missing files cause addAll() to throw
// and break the entire Service Worker installation.
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './practice.html',
  './style.css',
  './app.js',
  './manifest.json',
];

// Domains that must NEVER be intercepted by the Service Worker.
// Firebase Firestore, Auth, and Storage all use these origins.
const BYPASS_ORIGINS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseapp.com',
  'firebase.googleapis.com',
  'googleapis.com',
  'gstatic.com',
  'api.groq.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'api.unsplash.com',
  'images.unsplash.com',
];

// Install: cache only known-good static assets, using individual try/catch
// so a single missing file cannot break the whole install.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Installing and caching assets');
      // Cache each asset individually — one failure won't block the rest
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Could not cache:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches and immediately take control of all clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: bypass all external/Firebase/API requests; serve cache-first for app shell
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Let the browser handle non-GET requests normally
  if (event.request.method !== 'GET') return;

  // Bypass all external domains (Firebase, Groq, Google Fonts, Unsplash, etc.)
  const shouldBypass = BYPASS_ORIGINS.some(origin => url.includes(origin));
  if (shouldBypass) return;

  // Bypass Vercel serverless API routes (/api/...)
  if (url.includes('/api/')) return;

  // For everything else (app shell): cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResponse => {
        // Opportunistically cache successful same-origin responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        // If offline and not cached, return a generic offline fallback
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
