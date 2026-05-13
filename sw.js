const CACHE_NAME = 'speakup-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './practice.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Event: Cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Fetch Event: Serve from Cache or Network
self.addEventListener('fetch', event => {
  // Don't intercept API requests to Gemini/Groq
  if (event.request.url.includes('googleapis.com') || event.request.url.includes('api.groq.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found, else fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
