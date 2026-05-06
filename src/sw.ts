/// <reference lib="webworker" />
import { clientsClaim, skipWaiting } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()
skipWaiting()

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

registerRoute(
  /^https:\/\/(openexchangerates\.org|api\.frankfurter\.app)\/.*/i,
  new NetworkFirst({
    cacheName: 'exchange-rate-cache',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 3600 })],
  }),
  'GET'
)

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  const data = event.data.json() as { title: string; body: string }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      tag: 'coinsight-reminder',
      data: { url: '/' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data as { url: string }).url
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const win = clients.find(c => c.url.includes(self.location.origin))
      return win ? win.focus() : self.clients.openWindow(url)
    })
  )
})
