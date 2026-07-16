// v14 — fix blank page on back button + push notification support
const CACHE_NAME = 'speakup-cache-v14';

const ASSETS_TO_CACHE = [
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/manifest.json',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png'
];

// Install: pre-cache static assets only
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate: wipe every old cache version immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Only cache static assets. Never intercept navigations or external URLs.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = req.url;

  // ── 1. NEVER intercept navigation requests (page loads, back/forward) ──────
  // This is the key fix: allows Chrome bfcache to work correctly.
  // Without this, pressing Back shows a blank page.
  if (req.mode === 'navigate') {
    return; // browser handles it — bfcache will restore page instantly
  }

  // ── 2. NEVER intercept non-GET requests ────────────────────────────────────
  if (req.method !== 'GET') return;

  // ── 3. NEVER intercept external / third-party URLs ─────────────────────────
  if (
    url.includes('googleapis.com') ||
    url.includes('apis.google.com') ||
    url.includes('google.com') ||
    url.includes('wikimedia.org') ||
    url.includes('api.groq.com') ||
    url.includes('firebaseapp.com') ||
    url.includes('firebaseio.com') ||
    url.includes('gstatic.com') ||
    url.includes('jsdelivr.net') ||
    url.includes('huggingface.co') ||
    url.includes('hf.co') ||
    url.includes('dicebear.com') ||
    url.includes('unsplash.com') ||
    url.includes('pexels.com') ||
    url.includes('resend.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('systemli.org') ||
    url.includes('jit.si') ||
    url.includes('ffmuc.net') ||
    url.includes('8x8.vc') ||
    url.includes('supabase.co') ||
    url.includes('/api/')
  ) {
    return; // let the browser handle it normally
  }

  // ── 4. Cache-first for same-origin static assets (CSS, JS, images) ─────────
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        // Only cache successful same-origin GET responses
        if (networkRes.ok && networkRes.type === 'basic') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, clone).catch(() => {});
          });
        }
        return networkRes;
      });
    })
  );
});

// ── PUSH: Show notification when streak reminder arrives ──────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Speak Up! 🔥', body: 'Your streak is at risk! Practice now.' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'Speak Up!', {
      body: data.body || 'Keep your streak alive!',
      icon: '/assets/images/icon-192.png',
      badge: '/assets/images/icon-192.png',
      tag: 'streak-reminder',
      renotify: true,
      data: { url: data.url || '/practice' }
    })
  );
});

// ── NOTIFICATION CLICK: Open practice page when user taps notification ────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/practice';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
