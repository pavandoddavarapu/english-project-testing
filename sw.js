// v3 — bumped to bust old cache that was serving stale practice.html
const CACHE_NAME = 'speakup-cache-v3';

const ASSETS_TO_CACHE = [
  './',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
  // NOTE: HTML files are intentionally excluded so they are always
  // fetched fresh from the network (network-first for HTML).
];

// Install: pre-cache static assets only (no HTML)
self.addEventListener('install', event => {
  self.skipWaiting(); // activate immediately, don't wait for old SW to die
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate: wipe every old cache version immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // take control of all tabs right away
  );
});

// Fetch: Network-first for HTML, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Never intercept third-party API / auth / firestore calls
  if (
    url.includes('googleapis.com') ||
    url.includes('api.groq.com') ||
    url.includes('firebaseapp.com') ||
    url.includes('gstatic.com') ||
    url.includes('/api/')
  ) {
    return; // let the browser handle it normally
  }

  // For HTML pages: always try network first, fall back to cache
  if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(networkRes => {
          // Update cache with fresh copy
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return networkRes;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For everything else: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
