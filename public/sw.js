// Minimal service worker — its only job is to make the app installable, which
// is what enables the native "Add to Home screen" prompt in Chrome/Android.
// It is intentionally NETWORK-ONLY (no caching) so it can never serve a stale
// version — the in-app version check still handles updates.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  // Pass everything straight to the network; fall back to a blank 504 if offline.
  event.respondWith(
    fetch(event.request).catch(() => new Response('', { status: 504, statusText: 'Offline' }))
  )
})
