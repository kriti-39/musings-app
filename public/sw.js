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

// ─── Push notifications ─────────────────────────────────────────────────────
// Pushes are sent as DATA messages ({ title, body, link }) so this handler is
// the single place that displays them — works the same whether the app is
// open, backgrounded, or fully closed.
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { /* ignore */ }
  const d = payload.data || payload.notification || payload
  const title = d.title || "Deva's Classes"
  const options = {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { link: d.link || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Tapping the notification opens the app at the right page (or focuses an
// already-open window and navigates it there).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) {
          win.focus()
          if ('navigate' in win) win.navigate(link).catch(() => {})
          return
        }
      }
      return self.clients.openWindow(link)
    })
  )
})
