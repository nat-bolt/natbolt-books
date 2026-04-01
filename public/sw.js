// NatBolt Billu — Service Worker
// Purpose: satisfy Chrome's PWA installability requirements so Android creates
// a proper WebAPK (full-screen, no URL bar) instead of a browser shortcut.
// Strategy: network-first with no aggressive caching — keeps auth flows clean.

const CACHE_NAME = 'natbolt-v3';

// Static shell assets to pre-cache (app loads these on every visit anyway)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  // Remove stale caches from previous versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Never intercept Supabase / Firebase API calls — auth must always hit network
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase.com') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  // For same-origin navigation requests: serve index.html (SPA fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // For everything else: network-first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
